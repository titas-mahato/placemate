from flask import Blueprint, current_app, g, request, session

from ..db import IntegrityError, commit, execute, query_one
from ..domain import student_skill_names
from ..errors import ApiError, ok
from werkzeug.security import check_password_hash

from ..security import ROLES, authenticate, hash_password, limiter, load_current_user, require_role
from ..validation import STUDENT_ID_RE, Fields

bp = Blueprint("auth", __name__, url_prefix="/api")


def public_user(role, row):
    """Only fields the signed-in user is allowed to see about themself. Never includes hashes."""
    if role == "student":
        return {"role": role, "student_id": row["student_id"], "first_name": row["first_name"], "last_name": row["last_name"],
                "email": row["email"], "major": row["major"], "graduation_year": row["graduation_year"],
                "gpa": float(row["gpa"]) if row["gpa"] is not None else None}
    if role == "recruiter":
        c = query_one("SELECT company_id, name FROM companies WHERE company_id = %s", (row["company_id"],))
        return {"role": role, "recruiter_id": row["recruiter_id"], "name": row["name"], "email": row["email"],
                "company_id": c["company_id"], "company_name": c["name"]}
    return {"role": role, "admin_id": row["admin_id"], "name": row["name"], "email": row["email"]}


def _login(role):
    data = request.get_json(silent=True)
    f = Fields(data or {})
    email = f.text("email", required=True, max_len=120)
    password = data.get("password") if isinstance(data, dict) else None
    if not email or not isinstance(password, str) or not password:
        raise ApiError("Email and password are required", 400)
    row, csrf = authenticate(current_app.config, role, email.lower(), password)
    return ok({"message": "Login successful", "user": public_user(role, row), "csrf_token": csrf})


@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in ROLES:
        raise ApiError("role must be one of: student, recruiter, admin", 400)
    return _login(role)


# Backwards-compatible paths used by the original frontend.
@bp.post("/student/login")
def student_login_alias():
    return _login("student")


@bp.post("/admin/login")
def admin_login_alias():
    return _login("admin")


@bp.post("/recruiter/login")
def recruiter_login_alias():
    return _login("recruiter")


@bp.get("/auth/me")
def me():
    cur = load_current_user()
    if cur is None:
        raise ApiError("Authentication required", 401)
    role, row = cur
    return ok({"user": public_user(role, row), "csrf_token": session.get("csrf")})


@bp.post("/auth/logout")
def logout():
    session.clear()
    return ok({"message": "Logged out"})


@bp.post("/student/register")
def register_student():
    # NOTE: any "role" supplied by the client is ignored; this endpoint can only create students.
    f = Fields(request.get_json(silent=True))
    sid = f.text("student_id", required=True, max_len=20)
    if sid and not STUDENT_ID_RE.match(sid):
        f.err("student_id", "Use 3–20 letters, numbers, - or _")
    first = f.text("first_name", required=True, max_len=50)
    last = f.text("last_name", max_len=50, default="")
    email = f.email()
    pw = f.password()
    major = f.text("major", max_len=100) or f.text("program", max_len=100)
    # `year` is the legacy field name sent by the original React form; errors are keyed to whichever name was sent.
    year_key = "graduation_year" if "graduation_year" in f.data else "year"
    year = f.number(year_key, lo=2000, hi=2100, integer=True, required=True)
    gpa = f.number("gpa", lo=0, hi=10)
    f.check()
    try:
        execute("INSERT INTO students (student_id, first_name, last_name, email, password_hash, major, graduation_year, gpa) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (sid, first, last or "", email, hash_password(pw), major, year, gpa))
        commit()
    except IntegrityError:
        raise ApiError("An account with this email or student ID already exists", 409)
    return ok({"message": "Registration successful! You can now sign in."}, 201)


@bp.post("/recruiter/register")
def register_recruiter():
    f = Fields(request.get_json(silent=True))
    name = f.text("name", required=True, max_len=100)
    email = f.email()
    pw = f.password()
    company = f.text("company_name", required=True, max_len=150)
    location = f.text("company_location", max_len=150)
    website = f.text("website", max_len=200)
    if website and not website.lower().startswith(("http://", "https://")):
        f.err("website", "Must start with http:// or https://")
    f.check()
    try:
        row = query_one("SELECT company_id FROM companies WHERE LOWER(name) = LOWER(%s)", (company,))
        company_id = row["company_id"] if row else execute(
            "INSERT INTO companies (name, headquarters_location, website, is_approved) VALUES (%s,%s,%s,0)", (company, location, website))
        execute("INSERT INTO recruiters (company_id, name, email, password_hash, status) VALUES (%s,%s,%s,%s,'pending')",
                (company_id, name, email, hash_password(pw)))
        commit()
    except IntegrityError:
        from ..db import rollback
        rollback()
        raise ApiError("An account with this email already exists", 409)
    return ok({"message": "Registration received. The placement office must approve your account before you can sign in."}, 201)


PASSWORD_TABLES = {"student": ("students", "student_id"), "recruiter": ("recruiters", "recruiter_id"), "admin": ("admins", "admin_id")}


@bp.post("/auth/change-password")
@require_role("student", "recruiter", "admin")
def change_password():
    """Lets any signed-in user change their OWN password. The current password must be re-entered."""
    f = Fields(request.get_json(silent=True))
    data = f.data
    current = data.get("current_password")
    if not isinstance(current, str) or not current:
        f.err("current_password", "This field is required")
    new = f.password("new_password")
    f.check()

    table, key = PASSWORD_TABLES[g.role]
    uid = g.user[key]
    throttle = ("pw", g.role, uid)
    cfg = current_app.config
    if cfg["RATE_LIMIT_ENABLED"] and limiter.blocked(throttle, cfg["LOGIN_MAX_FAILURES"], cfg["LOGIN_WINDOW_SECONDS"]):
        raise ApiError("Too many failed attempts. Please wait a few minutes and try again.", 429)
    if not g.user.get("password_hash") or not check_password_hash(g.user["password_hash"], current):
        limiter.record(throttle)
        raise ApiError("Current password is incorrect", 400, {"current_password": "Current password is incorrect"})
    if current == new:
        raise ApiError("Choose a password different from your current one", 400, {"new_password": "Must differ from your current password"})
    execute(f"UPDATE {table} SET password_hash = %s WHERE {key} = %s", (hash_password(new), uid))
    commit()
    limiter.clear(throttle)
    return ok({"message": "Password changed"})
