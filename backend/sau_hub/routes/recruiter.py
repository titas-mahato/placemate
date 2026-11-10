from flask import Blueprint, g, request

from ..db import commit, execute, query_all, query_one
from ..domain import (ALL_STATUSES, TYPES, UNION_SQL, attach_skills, clean_row, list_applicants, load_opportunity,
                      page_meta, paginate_args, set_listing_skills, update_application)
from ..errors import ApiError, ok
from ..security import require_role
from ..validation import Fields, today
from .students import send_resume

bp = Blueprint("recruiter", __name__, url_prefix="/api/recruiter")


def _company_id():
    return g.user["company_id"]


def _owned(typ, oid):
    """Loads a listing only if it belongs to the signed-in recruiter's company; otherwise 404."""
    if typ not in TYPES:
        raise ApiError("Opportunity not found", 404)
    opp = load_opportunity(typ, oid)
    if opp["company_id"] != _company_id():
        raise ApiError("Opportunity not found", 404)
    return opp


def _listing_fields(f, typ, creating):
    title = f.text("title", required=True, max_len=150)
    desc = f.text("description", max_len=5000)
    loc = f.text("location", max_len=100)
    deadline = f.day("deadline")
    if creating and deadline and deadline < today():
        f.err("deadline", "Deadline cannot be in the past")
    min_gpa = f.number("min_gpa", lo=0, hi=10)
    lo = f.number("min_grad_year", lo=2000, hi=2100, integer=True)
    hi = f.number("max_grad_year", lo=2000, hi=2100, integer=True)
    if lo is not None and hi is not None and lo > hi:
        f.err("max_grad_year", "Must not be earlier than the minimum graduation year")
    skills = f.skills()
    if typ == "Placement":
        salary = f.number("salary", lo=0, hi=999.99)
    else:
        salary = f.text("salary", max_len=50)
    return dict(title=title, description=desc, location=loc, deadline=deadline, min_gpa=min_gpa, min_grad_year=lo, max_grad_year=hi), salary, skills


@bp.get("/summary")
@require_role("recruiter")
def summary():
    cid = _company_id()
    listings = query_all(f"SELECT o.type, o.is_active, o.deadline FROM ({UNION_SQL}) o WHERE o.company_id=%s", (cid,))
    active = sum(1 for l in listings if l["is_active"] and (l["deadline"] is None or l["deadline"] >= today()))
    counts = {s: 0 for s in ALL_STATUSES}
    for r in query_all(f"SELECT a.status, COUNT(*) n FROM applications a JOIN ({UNION_SQL}) o ON (o.type='Internship' AND o.id=a.internship_id) OR (o.type='Placement' AND o.id=a.placement_id) WHERE o.company_id=%s GROUP BY a.status", (cid,)):
        counts[r["status"]] = r["n"]
    recent, _ = list_applicants(["o.company_id = %s"], (cid,), 1, 5)
    return ok({"total_listings": len(listings), "active_listings": active, "application_counts": counts,
               "total_applications": sum(counts.values()), "recent_applications": recent})


@bp.get("/company")
@require_role("recruiter")
def get_company():
    return ok({"company": clean_row(query_one("SELECT company_id, name, headquarters_location, website, description, is_approved FROM companies WHERE company_id=%s", (_company_id(),)))})


@bp.put("/company")
@require_role("recruiter")
def update_company():
    f = Fields(request.get_json(silent=True))
    loc, site, desc = f.text("headquarters_location", max_len=150), f.text("website", max_len=200), f.text("description", max_len=3000)
    if site and not site.lower().startswith(("http://", "https://")):
        f.err("website", "Must start with http:// or https://")
    f.check()
    execute("UPDATE companies SET headquarters_location=%s, website=%s, description=%s WHERE company_id=%s", (loc, site, desc, _company_id()))
    commit()
    return get_company()


@bp.get("/opportunities")
@require_role("recruiter")
def my_opportunities():
    rows = query_all(f"SELECT o.* FROM ({UNION_SQL}) o WHERE o.company_id=%s ORDER BY o.created_at DESC, o.id DESC", (_company_id(),))
    attach_skills(rows)
    counts = {(r["internship_id"] and ("Internship", r["internship_id"])) or ("Placement", r["placement_id"]): r["n"]
              for r in query_all("SELECT internship_id, placement_id, COUNT(*) n FROM applications GROUP BY internship_id, placement_id")}
    out = []
    for r in rows:
        d = clean_row(r)
        d.pop("company_approved", None)
        d["is_open"] = bool(r["is_active"]) and (r["deadline"] is None or r["deadline"] >= today())
        d["applicant_count"] = counts.get((r["type"], r["id"]), 0)
        out.append(d)
    return ok({"data": out})


@bp.post("/opportunities")
@require_role("recruiter")
def create_opportunity():
    f = Fields(request.get_json(silent=True))
    typ = f.choice("type", list(TYPES))
    f.check()
    cols, salary, skills = _listing_fields(f, typ, creating=True)
    f.check()
    co = query_one("SELECT is_approved FROM companies WHERE company_id=%s", (_company_id(),))
    if not co["is_approved"]:
        raise ApiError("Your company must be approved by the placement office before posting opportunities", 403)
    t = TYPES[typ]
    sal_col = "package_lpa" if typ == "Placement" else "stipend"
    names = list(cols) + [sal_col]
    vals = list(cols.values()) + [salary]
    oid = execute(f"INSERT INTO {t['table']} (company_id, recruiter_id, {', '.join(names)}) VALUES (%s, %s, {', '.join(['%s'] * len(names))})",
                  (_company_id(), g.user["recruiter_id"], *vals))
    if skills:
        set_listing_skills(typ, oid, skills)
    commit()
    return ok({"message": "Opportunity created", "opportunity": clean_row(load_opportunity(typ, oid))}, 201)


@bp.put("/opportunities/<typ>/<int:oid>")
@require_role("recruiter")
def update_opportunity(typ, oid):
    _owned(typ, oid)
    f = Fields(request.get_json(silent=True))
    cols, salary, skills = _listing_fields(f, typ, creating=False)
    f.check()
    t = TYPES[typ]
    sal_col = "package_lpa" if typ == "Placement" else "stipend"
    sets = ", ".join(f"{c}=%s" for c in list(cols) + [sal_col])
    execute(f"UPDATE {t['table']} SET {sets} WHERE {t['id']}=%s AND company_id=%s", (*cols.values(), salary, oid, _company_id()))
    if skills is not None:
        set_listing_skills(typ, oid, skills)
    commit()
    return ok({"message": "Opportunity updated", "opportunity": clean_row(load_opportunity(typ, oid))})


@bp.patch("/opportunities/<typ>/<int:oid>")
@require_role("recruiter")
def set_open(typ, oid):
    _owned(typ, oid)
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("is_active"), bool):
        raise ApiError("is_active must be true or false", 400, {"is_active": "Must be true or false"})
    t = TYPES[typ]
    execute(f"UPDATE {t['table']} SET is_active=%s WHERE {t['id']}=%s AND company_id=%s", (int(data["is_active"]), oid, _company_id()))
    commit()
    return ok({"message": "Opportunity reopened" if data["is_active"] else "Opportunity closed"})


@bp.get("/opportunities/<typ>/<int:oid>/applicants")
@require_role("recruiter")
def applicants_for(typ, oid):
    _owned(typ, oid)
    page, per = paginate_args()
    rows, meta = list_applicants(["o.type = %s", "o.id = %s", "o.company_id = %s"], (typ, oid, _company_id()), page, per)
    return ok({"data": rows, "pagination": meta})


@bp.get("/applications")
@require_role("recruiter")
def all_applications():
    where, params = ["o.company_id = %s"], [_company_id()]
    a = request.args
    if a.get("status"):
        if a["status"] not in ALL_STATUSES:
            raise ApiError("Unknown status", 400)
        where.append("a.status = %s")
        params.append(a["status"])
    if a.get("type") in TYPES:
        where.append("o.type = %s")
        params.append(a["type"])
    if a.get("q"):
        from ..domain import like
        where.append("(s.first_name LIKE %s OR s.last_name LIKE %s OR s.student_id LIKE %s OR o.title LIKE %s)")
        params += [like(a["q"][:60])] * 4
    page, per = paginate_args()
    rows, meta = list_applicants(where, params, page, per)
    return ok({"data": rows, "pagination": meta})


@bp.patch("/applications/<int:app_id>")
@require_role("recruiter")
def review_application(app_id):
    f = Fields(request.get_json(silent=True))
    status = f.choice("status", ALL_STATUSES, required=False)
    if status == "Withdrawn":
        f.err("status", "Only the student can withdraw an application")
    note = f.text("recruiter_note", max_len=1000)
    f.check()
    if status is None and "recruiter_note" not in f.data:
        raise ApiError("Provide a status and/or recruiter_note", 400)
    row = update_application(app_id, status, note if "recruiter_note" in f.data else None, company_id=_company_id())
    return ok({"message": "Application updated", "application": clean_row(row)})


@bp.get("/applications/<int:app_id>/resume")
@require_role("recruiter")
def applicant_resume(app_id):
    rows, _ = list_applicants(["a.application_id = %s", "o.company_id = %s"], (app_id, _company_id()), 1, 1)
    if not rows:
        raise ApiError("Application not found", 404)
    student = query_one("SELECT resume_path, resume_name FROM students WHERE student_id=%s", (rows[0]["student_id"],))
    return send_resume(student)
