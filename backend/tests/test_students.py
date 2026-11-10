from conftest import PDF


def student(client, make, sid="S1", **kw):
    make.student(sid, **kw)
    a = client()
    assert a.login("student", f"{sid.lower()}@example.test").status_code == 200
    return a


def test_profile_get_and_update_with_skills(client, make):
    a = student(client, make)
    r = a.put("/api/student/profile", {"first_name": "Asha", "last_name": "Rao", "major": "Math", "graduation_year": 2027, "gpa": 7.5,
                                       "phone": "+91 98765 43210", "bio": "Hi", "skills": ["Python", "python", "SQL"]})
    assert r.status_code == 200
    p = a.get("/api/student/profile").get_json()["profile"]
    assert p["first_name"] == "Asha" and p["gpa"] == 7.5 and p["skills"] == ["Python", "SQL"]  # case-insensitive de-dupe


def test_profile_validation_errors(client, make):
    a = student(client, make)
    r = a.put("/api/student/profile", {"first_name": "", "graduation_year": 1800, "gpa": 99, "phone": "abc", "skills": ["x" * 50]})
    assert r.status_code == 400 and set(r.get_json()["errors"]) >= {"first_name", "graduation_year", "gpa", "phone", "skills"}


def test_profile_update_cannot_touch_other_student_or_identity(client, make, sql):
    make.student("S2"); a = student(client, make, "S1")
    a.put("/api/student/profile", {"first_name": "Mallory", "graduation_year": 2026, "student_id": "S2", "email": "hack@example.test"})
    assert sql("SELECT first_name FROM students WHERE student_id='S2'")[0]["first_name"] == "Test"
    assert sql("SELECT email FROM students WHERE student_id='S1'")[0]["email"] == "s1@example.test"


def test_opportunity_feed_filters_and_hides_unapproved_companies(client, make):
    ok_co, bad_co = make.company("Good"), make.company("Hidden", approved=0)
    make.listing(ok_co, "Placement", "Backend Dev"); make.listing(ok_co, "Internship", "Data Intern"); make.listing(bad_co, "Placement", "Secret Job")
    make.listing(ok_co, "Placement", "Old Job", deadline="2000-01-01"); make.listing(ok_co, "Placement", "Closed Job", active=0)
    a = student(client, make)
    titles = {o["title"] for o in a.get("/api/opportunities").get_json()["data"]}
    assert titles == {"Backend Dev", "Data Intern"}
    assert [o["title"] for o in a.get("/api/opportunities?type=Internship").get_json()["data"]] == ["Data Intern"]
    assert [o["title"] for o in a.get("/api/opportunities?q=backend").get_json()["data"]] == ["Backend Dev"]
    assert a.get("/api/opportunities?type=Nope").status_code == 400


def test_feed_pagination_and_sort_validation(client, make):
    co = make.company()
    for i in range(5):
        make.listing(co, "Placement", f"Job{i}")
    a = student(client, make)
    body = a.get("/api/opportunities?per_page=2&page=3").get_json()
    assert len(body["data"]) == 1 and body["pagination"] == {"page": 3, "per_page": 2, "total": 5, "pages": 3}
    assert a.get("/api/opportunities?sort=bogus").status_code == 400
    assert a.get("/api/opportunities?page=x").status_code == 400


def test_eligibility_flags_in_feed_and_detail(client, make):
    co = make.company()
    lid = make.listing(co, "Placement", "Strict", min_gpa=9.0, min_year=2025, max_year=2026)
    a = student(client, make, gpa=7.0, year=2027)
    d = a.get(f"/api/opportunities/Placement/{lid}").get_json()["opportunity"]
    assert d["eligible"] is False and len(d["ineligible_reasons"]) == 2 and d["applied"] is False
    assert a.get("/api/opportunities?eligible=1").get_json()["data"] == []
    assert a.get("/api/opportunities/Placement/9999").status_code == 404
    assert a.get("/api/opportunities/Bogus/1").status_code == 404


def test_apply_success_persists_and_shows_in_history(client, make, sql):
    co = make.company(); lid = make.listing(co, "Internship", "Intern")
    a = student(client, make)
    r = a.post("/api/student/applications", {"opportunity_type": "Internship", "opportunity_id": lid, "cover_note": "Please consider me"})
    assert r.status_code == 201
    assert sql("SELECT status, internship_id, placement_id FROM applications")[0] == {"status": "Applied", "internship_id": lid, "placement_id": None}
    b = client(); b.login("student", "s1@example.test")  # fresh login: history survives
    hist = b.get("/api/student/applications").get_json()["applications"]
    assert len(hist) == 1 and hist[0]["title"] == "Intern" and hist[0]["status"] == "Applied"
    d = b.get(f"/api/opportunities/Internship/{lid}").get_json()["opportunity"]
    assert d["applied"] is True and d["application_status"] == "Applied"


def test_duplicate_application_rejected_but_same_id_other_type_allowed(client, make, sql):
    co = make.company(); pid = make.listing(co, "Placement"); iid = make.listing(co, "Internship")
    assert pid == iid == 1  # ids collide across tables: the (type, id) pair is what identifies a listing
    a = student(client, make)
    body = {"opportunity_type": "Placement", "opportunity_id": pid}
    assert a.post("/api/student/applications", body).status_code == 201
    assert a.post("/api/student/applications", body).status_code == 409
    assert a.post("/api/student/applications", {"opportunity_type": "Internship", "opportunity_id": iid}).status_code == 201
    assert sql("SELECT COUNT(*) n FROM applications")[0]["n"] == 2


def test_apply_blocked_by_eligibility_deadline_closed_and_unapproved(client, make):
    co, hidden = make.company(), make.company("Hidden", approved=0)
    cases = {"gpa": make.listing(co, min_gpa=9.5), "year": make.listing(co, min_year=2030), "expired": make.listing(co, deadline="2000-01-01"),
             "closed": make.listing(co, active=0)}
    a = student(client, make, gpa=7.0, year=2026)
    for name, lid in cases.items():
        r = a.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": lid})
        assert r.status_code == 403, name
    assert a.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": make.listing(hidden)}).status_code == 404
    assert a.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": 4242}).status_code == 404


def test_apply_input_validation(client, make):
    a = student(client, make)
    for body in ({}, {"opportunity_type": "Job", "opportunity_id": 1}, {"opportunity_type": "Placement", "opportunity_id": "abc"}):
        assert a.post("/api/student/applications", body).status_code == 400


def test_students_only_see_and_withdraw_their_own_applications(client, make):
    co = make.company(); lid = make.listing(co); make.student("S2")
    app_id = make.apply("S2", lid)
    a = student(client, make, "S1")
    assert a.get("/api/student/applications").get_json()["applications"] == []
    assert a.post(f"/api/student/applications/{app_id}/withdraw").status_code == 404


def test_withdraw_rules(client, make, sql):
    co = make.company(); l1, l2 = make.listing(co), make.listing(co, title="Two")
    a = student(client, make)
    mine, final = make.apply("S1", l1), make.apply("S1", l2, status="Offered")
    assert a.post(f"/api/student/applications/{mine}/withdraw").status_code == 200
    assert sql("SELECT status FROM applications WHERE application_id=%s", (mine,))[0]["status"] == "Withdrawn"
    assert a.post(f"/api/student/applications/{mine}/withdraw").status_code == 409
    assert a.post(f"/api/student/applications/{final}/withdraw").status_code == 409


def test_resume_upload_download_replace_delete(client, make, pdf_file, app):
    import os
    a = student(client, make)
    assert a.post("/api/student/resume", data=pdf_file(), content_type="multipart/form-data").status_code == 201
    r = a.get("/api/student/resume")
    assert r.status_code == 200 and r.data == PDF and r.mimetype == "application/pdf"
    folder = os.path.join(app.config["UPLOAD_DIR"], "resumes")
    assert len(os.listdir(folder)) == 1
    a.post("/api/student/resume", data=pdf_file(PDF + b"v2"), content_type="multipart/form-data")
    assert len(os.listdir(folder)) == 1  # old file removed on replace
    assert a.delete("/api/student/resume").status_code == 200 and os.listdir(folder) == []
    assert a.get("/api/student/resume").status_code == 404


def test_resume_rejects_non_pdf_oversized_and_missing(client, make, pdf_file):
    a = student(client, make)
    assert a.post("/api/student/resume", data=pdf_file(b"MZ\x90 not a pdf", "cv.pdf"), content_type="multipart/form-data").status_code == 400
    assert a.post("/api/student/resume", data=pdf_file(b"%PDF-" + b"0" * (2 * 1024 * 1024 + 10)), content_type="multipart/form-data").status_code == 413
    assert a.post("/api/student/resume", data={}, content_type="multipart/form-data").status_code == 400


def test_summary_counts_and_deadlines(client, make):
    co = make.company()
    soon = make.listing(co, title="Soon", deadline="2099-01-01")  # not within 14 days
    from datetime import date, timedelta
    near = make.listing(co, title="Near", deadline=(date.today() + timedelta(days=5)).isoformat())
    applied = make.listing(co, title="Applied", deadline=(date.today() + timedelta(days=3)).isoformat())
    a = student(client, make)
    make.apply("S1", applied)
    s = a.get("/api/student/summary").get_json()
    assert s["application_counts"]["Applied"] == 1 and s["total_applications"] == 1
    assert [d["title"] for d in s["upcoming_deadlines"]] == ["Near"]  # already-applied listing excluded
    assert 0 <= s["profile_completeness"] <= 100
