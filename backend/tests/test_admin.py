import pytest

from conftest import PW


@pytest.fixture()
def adm(client, make):
    make.admin()
    a = client()
    assert a.login("admin", "admin@example.test").status_code == 200
    return a


def test_admin_endpoints_are_admin_only(client, make):
    co = make.company(); make.recruiter(co); make.student()
    s, r = client(), client()
    s.login("student", "s1@example.test"); r.login("recruiter", "rec@example.test")
    for url in ("/api/admin/stats", "/api/admin/students", "/api/admin/recruiters", "/api/admin/companies", "/api/admin/opportunities", "/api/admin/applications", "/api/admin/students/export.csv"):
        assert client().get(url).status_code == 401, url
        assert s.get(url).status_code == 403, url
        assert r.get(url).status_code == 403, url


def test_stats_on_empty_database_do_not_divide_by_zero(adm):
    s = adm.get("/api/admin/stats").get_json()
    assert s["students_total"] == 0 and s["placement_rate"] == 0 and s["avg_offered_package_lpa"] is None and s["applications_total"] == 0


def test_stats_are_computed_from_real_records(adm, make):
    co = make.company("Acme"); make.recruiter(co)
    for sid, major in (("S1", "CS"), ("S2", "CS"), ("S3", "Math"), ("S4", "Math")):
        make.student(sid, major=major)
    p1, p2 = make.listing(co, "Placement", "P1"), make.listing(co, "Placement", "P2", deadline="2000-01-01")
    i1 = make.listing(co, "Internship", "I1")
    make.apply("S1", p1, status="Offered"); make.apply("S2", p1, status="Rejected"); make.apply("S3", i1, "Internship", "Interview")
    s = adm.get("/api/admin/stats").get_json()
    assert (s["students_total"], s["students_placed"], s["placement_rate"]) == (4, 1, 25.0)
    assert s["applications_total"] == 3 and s["applications_by_status"]["Offered"] == 1 and s["applications_by_status"]["Rejected"] == 1
    assert s["open_placements"] == 1 and s["open_internships"] == 1  # P2's deadline has passed
    assert s["avg_offered_package_lpa"] == 9.5 and s["students_with_applications"] == 3
    by = {m["major"]: m for m in s["placement_by_major"]}
    assert by["CS"] == {"major": "CS", "students": 2, "placed": 1} and by["Math"]["placed"] == 0
    assert s["top_hiring_companies"] == [{"company": "Acme", "offers": 1}]
    assert s["recruiters"] == {"approved": 1}


def test_student_search_filter_sort_pagination(adm, make):
    for sid, gpa, yr, major in (("A1", 9.0, 2026, "CS"), ("A2", 7.0, 2026, "CS"), ("B1", 8.0, 2027, "Math"), ("B2", 6.0, 2027, "Math")):
        make.student(sid, gpa=gpa, year=yr, major=major)
    ids = lambda q: [s["student_id"] for s in adm.get("/api/admin/students?" + q).get_json()["data"]]
    assert ids("") == ["A1", "A2", "B1", "B2"]
    assert ids("sort_by=gpa&sort_dir=desc") == ["A1", "B1", "A2", "B2"]
    assert ids("major=Math") == ["B1", "B2"] and ids("gpa_min=7.5") == ["A1", "B1"] and ids("year_min=2027&gpa_max=6.5") == ["B2"]
    assert ids("q=a2") == ["A2"] and ids("q=%25") == []  # LIKE wildcards in the search box are escaped
    body = adm.get("/api/admin/students?per_page=3&page=2").get_json()
    assert [s["student_id"] for s in body["data"]] == ["B2"] and body["pagination"]["total"] == 4
    assert adm.get("/api/admin/students?sort_by=password_hash").status_code == 400  # sort columns are whitelisted
    assert adm.get("/api/admin/students?gpa_min=abc").status_code == 400


def test_student_rows_expose_real_status_and_no_secrets(adm, make, sql):
    co = make.company(); make.student("S1"); make.student("S2"); lid = make.listing(co)
    make.apply("S1", lid, status="Offered")
    sql("INSERT INTO skills (skill_name) VALUES ('Python')"); sql("INSERT INTO student_skills VALUES ('S1', 1)")
    rows = {s["student_id"]: s for s in adm.get("/api/admin/students").get_json()["data"]}
    assert rows["S1"]["placed"] is True and rows["S1"]["applications_count"] == 1 and rows["S1"]["skills"] == ["Python"]
    assert rows["S2"]["placed"] is False and rows["S2"]["skills"] == []  # no random skills, no synthetic statuses
    assert "password_hash" not in rows["S1"]
    assert [s["student_id"] for s in adm.get("/api/admin/students?placed=1").get_json()["data"]] == ["S1"]
    assert [s["student_id"] for s in adm.get("/api/admin/students?placed=0").get_json()["data"]] == ["S2"]


def test_csv_export_honours_filters_and_blocks_formula_injection(adm, make, sql):
    make.student("S1", major="CS"); make.student("S2", major="Math")
    sql("UPDATE students SET first_name='=HYPERLINK(\"http://evil\")' WHERE student_id='S1'")
    r = adm.get("/api/admin/students/export.csv")
    assert r.mimetype == "text/csv" and "attachment" in r.headers["Content-Disposition"]
    text = r.get_data(as_text=True)
    assert "'=HYPERLINK" in text and ",=HYPERLINK" not in text and "password" not in text.lower()
    assert "S2" not in adm.get("/api/admin/students/export.csv?major=CS").get_data(as_text=True)


def test_approving_recruiter_approves_company_and_enables_login(adm, client, make, sql):
    r = client().post("/api/recruiter/register", {"name": "Ravi", "email": "ravi@example.test", "password": PW, "company_name": "NewCo"})
    assert r.status_code == 201
    rid = adm.get("/api/admin/recruiters?status=pending").get_json()["data"][0]["recruiter_id"]
    assert adm.patch(f"/api/admin/recruiters/{rid}", {"status": "approved"}).status_code == 200
    assert sql("SELECT is_approved FROM companies WHERE name='NewCo'")[0]["is_approved"] == 1
    assert client().login("recruiter", "ravi@example.test").status_code == 200
    assert adm.patch(f"/api/admin/recruiters/{rid}", {"status": "bogus"}).status_code == 400
    assert adm.patch("/api/admin/recruiters/999", {"status": "approved"}).status_code == 404


def test_suspending_recruiter_kills_live_session(adm, client, make):
    co = make.company(); rid = make.recruiter(co)
    r = client(); r.login("recruiter", "rec@example.test")
    assert r.get("/api/recruiter/summary").status_code == 200
    adm.patch(f"/api/admin/recruiters/{rid}", {"status": "suspended"})
    assert r.get("/api/recruiter/summary").status_code == 401


def test_company_unapproval_hides_its_listings_from_students(adm, client, make):
    co = make.company("Acme"); make.listing(co, "Placement", "Visible?"); make.student()
    st = client(); st.login("student", "s1@example.test")
    assert len(st.get("/api/opportunities").get_json()["data"]) == 1
    assert adm.patch(f"/api/admin/companies/{co}", {"is_approved": False}).status_code == 200
    assert st.get("/api/opportunities").get_json()["data"] == []
    assert adm.patch("/api/admin/companies/999", {"is_approved": True}).status_code == 404
    assert adm.patch(f"/api/admin/companies/{co}", {"is_approved": "yes"}).status_code == 400


def test_admin_can_close_listing_and_deactivate_student(adm, client, make):
    co = make.company(); lid = make.listing(co); make.student()
    assert adm.patch(f"/api/admin/opportunities/Placement/{lid}", {"is_active": False}).status_code == 200
    assert adm.get("/api/admin/opportunities?status=closed").get_json()["data"][0]["id"] == lid
    assert adm.patch("/api/admin/opportunities/Bogus/1", {"is_active": False}).status_code == 404
    st = client(); st.login("student", "s1@example.test")
    adm.patch("/api/admin/students/S1", {"is_active": False})
    assert st.get("/api/student/profile").status_code == 401
    assert adm.patch("/api/admin/students/NOPE", {"is_active": False}).status_code == 404


def test_admin_application_oversight_and_override(adm, make):
    co = make.company(); make.student(); lid = make.listing(co); aid = make.apply("S1", lid)
    rows = adm.get("/api/admin/applications?status=Applied&q=acme").get_json()["data"]
    assert len(rows) == 1 and rows[0]["company"] == "Acme"
    assert adm.patch(f"/api/admin/applications/{aid}", {"status": "Offered"}).status_code == 409  # admins obey the same state machine
    assert adm.patch(f"/api/admin/applications/{aid}", {"status": "Rejected", "recruiter_note": "policy"}).status_code == 200


def test_admin_cannot_read_missing_resume_and_filters_endpoint(adm, make):
    make.student()
    assert adm.get("/api/admin/students/S1/resume").status_code == 404
    assert adm.get("/api/admin/students/NOPE/resume").status_code == 404
    assert adm.get("/api/admin/filters").get_json()["majors"] == ["Computer Science"]
