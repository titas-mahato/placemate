import pytest
from mysql.connector import Error as DBError

from conftest import PW

REG = {"student_id": "SAU100", "first_name": "Asha", "last_name": "Rao", "email": "asha@example.test", "password": PW,
       "program": "Computer Science", "year": "2026", "gpa": "8.2"}


def test_register_student_ok_and_password_is_hashed(client, sql):
    r = client().post("/api/student/register", REG)
    assert r.status_code == 201 and r.get_json()["success"] is True
    row = sql("SELECT * FROM students WHERE student_id='SAU100'")[0]
    assert row["password_hash"].startswith(("scrypt:", "pbkdf2:")) and PW not in str(row.values())
    assert row["major"] == "Computer Science" and row["graduation_year"] == 2026  # React's `program`/`year` still accepted


@pytest.mark.parametrize("patch,field", [
    ({"email": "not-an-email"}, "email"), ({"password": "short1"}, "password"), ({"password": "onlyletters"}, "password"),
    ({"year": "1850"}, "year"), ({"year": None, "graduation_year": "1850"}, "graduation_year"), ({"gpa": "11"}, "gpa"), ({"student_id": "a b"}, "student_id"), ({"first_name": ""}, "first_name"),
])
def test_register_validation(client, patch, field):
    r = client().post("/api/student/register", {**REG, **patch})
    body = r.get_json()
    assert r.status_code == 400 and field in body["errors"] and body["success"] is False


def test_register_duplicate_email_or_id(client):
    a = client()
    assert a.post("/api/student/register", REG).status_code == 201
    assert a.post("/api/student/register", {**REG, "student_id": "OTHER1"}).status_code == 409
    assert a.post("/api/student/register", {**REG, "email": "new@example.test"}).status_code == 409


def test_cannot_self_assign_privileged_role(client, sql):
    r = client().post("/api/student/register", {**REG, "role": "admin", "is_admin": True})
    assert r.status_code == 201
    assert sql("SELECT COUNT(*) n FROM admins")[0]["n"] == 0
    assert client().login("admin", "asha@example.test").status_code == 401  # a student email can't log in as admin


def test_login_correct_wrong_and_unknown_look_identical(client, make):
    make.student()
    assert client().login("student", "s1@example.test").status_code == 200
    wrong, unknown = client().login("student", "s1@example.test", "Wrong123!"), client().login("student", "nobody@example.test")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.get_json()["message"] == unknown.get_json()["message"]  # no user enumeration


def test_legacy_alias_endpoints_still_work(client, make):
    make.student(); make.admin()
    assert client().post("/api/student/login", {"email": "s1@example.test", "password": PW}).status_code == 200
    assert client().post("/api/admin/login", {"email": "admin@example.test", "password": PW}).status_code == 200


def test_me_logout_and_session_invalidation(client, make):
    make.student()
    a = client()
    assert a.get("/api/auth/me").status_code == 401
    a.login("student", "s1@example.test")
    me = a.get("/api/auth/me").get_json()["user"]
    assert me["role"] == "student" and "password_hash" not in me
    assert a.post("/api/auth/logout").status_code == 200
    assert a.get("/api/auth/me").status_code == 401


def test_protected_endpoints_require_authentication(client):
    a = client()
    for url in ("/api/student/profile", "/api/student/applications", "/api/opportunities", "/api/recruiter/summary", "/api/admin/stats"):
        assert a.get(url).status_code == 401, url


def test_csrf_token_required_for_mutations(client, make):
    make.student()
    a = client()
    a.login("student", "s1@example.test")
    token, a.csrf = a.csrf, None
    assert a.put("/api/student/profile", {"first_name": "X", "graduation_year": 2026}).status_code == 403
    a.csrf = "wrong"
    assert a.put("/api/student/profile", {"first_name": "X", "graduation_year": 2026}).status_code == 403
    a.csrf = token
    assert a.put("/api/student/profile", {"first_name": "X", "graduation_year": 2026}).status_code == 200


def test_login_rate_limiting(app, client, make):
    make.student()
    app.config["RATE_LIMIT_ENABLED"] = True
    a = client()
    codes = [a.login("student", "s1@example.test", "Bad12345!").status_code for _ in range(7)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    assert a.login("student", "s1@example.test").status_code == 429  # even the right password is blocked while throttled


def test_deactivated_account_loses_access_immediately(client, make, sql):
    make.student()
    a = client()
    a.login("student", "s1@example.test")
    assert a.get("/api/student/profile").status_code == 200
    sql("UPDATE students SET is_active=0")
    assert a.get("/api/student/profile").status_code == 401
    assert client().login("student", "s1@example.test").status_code == 403


def test_pending_recruiter_cannot_login_until_approved(client, make, sql):
    r = client().post("/api/recruiter/register", {"name": "Ravi", "email": "ravi@example.test", "password": PW, "company_name": "NewCo"})
    assert r.status_code == 201
    assert client().login("recruiter", "ravi@example.test").status_code == 403
    assert sql("SELECT is_approved FROM companies WHERE name='NewCo'")[0]["is_approved"] == 0
    sql("UPDATE recruiters SET status='approved'")
    assert client().login("recruiter", "ravi@example.test").status_code == 200


def test_roles_are_not_interchangeable(client, make):
    c = make.company(); make.recruiter(c); make.student(); make.admin()
    s, r = client(), client()
    s.login("student", "s1@example.test"); r.login("recruiter", "rec@example.test")
    assert s.get("/api/recruiter/summary").status_code == 403
    assert s.get("/api/admin/stats").status_code == 403
    assert r.get("/api/admin/stats").status_code == 403
    assert r.get("/api/student/profile").status_code == 403


def test_database_errors_do_not_leak_details(app, client, make, monkeypatch):
    make.student()
    a = client(); a.login("student", "s1@example.test")
    from sau_hub.routes import students
    def boom(*_a, **_k): raise DBError("Table 'secret_schema.students' doesn't exist")
    monkeypatch.setattr(students, "student_skill_names", boom)
    r = a.get("/api/student/profile")
    assert r.status_code == 500 and "secret_schema" not in r.get_data(as_text=True)


def test_unknown_route_and_bad_json_are_consistent(client):
    a = client()
    r = a.get("/api/nope")
    assert r.status_code == 404 and r.get_json()["success"] is False
    assert a.post("/api/student/register", None).status_code in (400, 415)


# ---------------- change password ----------------
@pytest.mark.parametrize("role,email", [("student", "s1@example.test"), ("admin", "admin@example.test"), ("recruiter", "rec@example.test")])
def test_change_password_all_roles(client, make, role, email):
    make.student(); make.admin(); make.recruiter(make.company())
    a = client(); a.login(role, email)
    r = a.post("/api/auth/change-password", {"current_password": PW, "new_password": "NewPassw0rd"})
    assert r.status_code == 200
    assert client().login(role, email, PW).status_code == 401           # old password no longer works
    assert client().login(role, email, "NewPassw0rd").status_code == 200


def test_change_password_rejects_wrong_current_weak_new_same_and_anonymous(client, make, sql):
    make.student()
    assert client().post("/api/auth/change-password", {"current_password": PW, "new_password": "NewPassw0rd"}).status_code == 401
    a = client(); a.login("student", "s1@example.test")
    before = sql("SELECT password_hash FROM students")[0]["password_hash"]
    bad = a.post("/api/auth/change-password", {"current_password": "WrongPass1", "new_password": "NewPassw0rd"})
    assert bad.status_code == 400 and "current_password" in bad.get_json()["errors"]
    assert "new_password" in a.post("/api/auth/change-password", {"current_password": PW, "new_password": "short"}).get_json()["errors"]
    assert a.post("/api/auth/change-password", {"current_password": PW, "new_password": PW}).status_code == 400
    assert a.post("/api/auth/change-password", {"new_password": "NewPassw0rd1"}).status_code == 400   # current missing
    assert sql("SELECT password_hash FROM students")[0]["password_hash"] == before                     # nothing changed


def test_change_password_only_affects_own_account_and_needs_csrf(client, make, sql):
    make.student("S1"); make.student("S2")
    a = client(); a.login("student", "s1@example.test")
    token, a.csrf = a.csrf, None
    assert a.post("/api/auth/change-password", {"current_password": PW, "new_password": "NewPassw0rd"}).status_code == 403
    a.csrf = token
    a.post("/api/auth/change-password", {"current_password": PW, "new_password": "NewPassw0rd"})
    assert client().login("student", "s2@example.test", PW).status_code == 200      # other student untouched


def test_change_password_attempts_are_throttled(app, client, make):
    make.student()
    app.config["RATE_LIMIT_ENABLED"] = True
    a = client(); a.login("student", "s1@example.test")
    codes = [a.post("/api/auth/change-password", {"current_password": f"Wrong{i}pass", "new_password": "NewPassw0rd"}).status_code for i in range(6)]
    assert codes[:5] == [400] * 5 and codes[5] == 429
