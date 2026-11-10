import pytest


@pytest.fixture()
def world(client, make):
    """Two companies with one recruiter each, a student, and an application to company A's listing."""
    ca, cb = make.company("Alpha"), make.company("Beta")
    make.recruiter(ca, "a@example.test"); make.recruiter(cb, "b@example.test")
    make.student("S1")
    lid = make.listing(ca, "Placement", "Alpha Role")
    app_id = make.apply("S1", lid)
    ra, rb = client(), client()
    assert ra.login("recruiter", "a@example.test").status_code == 200
    assert rb.login("recruiter", "b@example.test").status_code == 200
    return dict(ra=ra, rb=rb, ca=ca, cb=cb, lid=lid, app=app_id)


NEW = {"type": "Placement", "title": "SDE", "description": "Build things", "location": "Delhi", "salary": 12.5, "deadline": "2099-12-31",
       "min_gpa": 7, "min_grad_year": 2026, "max_grad_year": 2027, "skills": ["Python", "SQL"]}


def test_create_edit_close_reopen_opportunity(world, client, make):
    ra = world["ra"]
    r = ra.post("/api/recruiter/opportunities", NEW)
    assert r.status_code == 201
    o = r.get_json()["opportunity"]
    assert o["company_id"] == world["ca"] and o["skills"] == ["Python", "SQL"] and o["salary"] == "12.50"  # salary is always a string (placements: LPA, internships: free-text stipend)
    r = ra.put(f"/api/recruiter/opportunities/Placement/{o['id']}", {**NEW, "title": "SDE II", "salary": 15, "skills": ["Go"]})
    assert r.status_code == 200 and r.get_json()["opportunity"]["title"] == "SDE II" and r.get_json()["opportunity"]["skills"] == ["Go"]
    make.student("S9")
    st = client(); st.login("student", "s9@example.test")
    assert "SDE II" in [x["title"] for x in st.get("/api/opportunities").get_json()["data"]]
    assert ra.patch(f"/api/recruiter/opportunities/Placement/{o['id']}", {"is_active": False}).status_code == 200
    assert "SDE II" not in [x["title"] for x in st.get("/api/opportunities").get_json()["data"]]
    assert st.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": o["id"]}).status_code == 403
    assert ra.patch(f"/api/recruiter/opportunities/Placement/{o['id']}", {"is_active": True}).status_code == 200


def test_create_internship_with_text_stipend(world):
    r = world["ra"].post("/api/recruiter/opportunities", {"type": "Internship", "title": "Intern", "salary": "20000/month", "location": "Remote"})
    assert r.status_code == 201 and r.get_json()["opportunity"]["salary"] == "20000/month"


@pytest.mark.parametrize("patch,field", [
    ({"title": ""}, "title"), ({"type": "Job"}, "type"), ({"deadline": "2000-01-01"}, "deadline"), ({"deadline": "tomorrow"}, "deadline"),
    ({"min_gpa": 12}, "min_gpa"), ({"min_grad_year": 2030, "max_grad_year": 2026}, "max_grad_year"), ({"salary": -3}, "salary"),
])
def test_create_validation(world, patch, field):
    r = world["ra"].post("/api/recruiter/opportunities", {**NEW, **patch})
    assert r.status_code == 400 and field in r.get_json()["errors"]


def test_unapproved_company_cannot_post(client, make):
    co = make.company("Pending", approved=0); make.recruiter(co, "p@example.test")
    r = client(); r.login("recruiter", "p@example.test")
    assert r.post("/api/recruiter/opportunities", NEW).status_code == 403


def test_recruiter_sees_only_own_company_listings(world, make):
    make.listing(world["cb"], "Placement", "Beta Role")
    mine = world["ra"].get("/api/recruiter/opportunities").get_json()["data"]
    assert [o["title"] for o in mine] == ["Alpha Role"] and mine[0]["applicant_count"] == 1


def test_ownership_other_company_gets_404_everywhere(world):
    rb, lid, app_id = world["rb"], world["lid"], world["app"]
    assert rb.put(f"/api/recruiter/opportunities/Placement/{lid}", NEW).status_code == 404
    assert rb.patch(f"/api/recruiter/opportunities/Placement/{lid}", {"is_active": False}).status_code == 404
    assert rb.get(f"/api/recruiter/opportunities/Placement/{lid}/applicants").status_code == 404
    assert rb.patch(f"/api/recruiter/applications/{app_id}", {"status": "Rejected"}).status_code == 404
    assert rb.get(f"/api/recruiter/applications/{app_id}/resume").status_code == 404
    assert rb.get("/api/recruiter/applications").get_json()["data"] == []
    assert world["ra"].get("/api/recruiter/applications").get_json()["pagination"]["total"] == 1


def test_applicant_details_visible_to_owner(world, sql, pdf_file):
    sql("UPDATE students SET phone='+91 99999 11111' WHERE student_id='S1'")
    row = world["ra"].get(f"/api/recruiter/opportunities/Placement/{world['lid']}/applicants").get_json()["data"][0]
    assert row["student_id"] == "S1" and row["email"] == "s1@example.test" and row["phone"] == "+91 99999 11111"
    assert "password_hash" not in row and "password" not in row


def test_status_transitions_valid_and_invalid(world, sql):
    ra, app_id = world["ra"], world["app"]
    path = f"/api/recruiter/applications/{app_id}"
    assert ra.patch(path, {"status": "Offered"}).status_code == 409           # can't skip straight to Offered
    assert ra.patch(path, {"status": "Withdrawn"}).status_code == 400         # only students withdraw
    assert ra.patch(path, {"status": "Bogus"}).status_code == 400
    for nxt in ("Under Review", "Shortlisted", "Interview", "Offered"):
        r = ra.patch(path, {"status": nxt, "recruiter_note": f"moved to {nxt}"})
        assert r.status_code == 200 and r.get_json()["application"]["status"] == nxt
    assert ra.patch(path, {"status": "Rejected"}).status_code == 409          # Offered is final
    assert sql("SELECT recruiter_note FROM applications")[0]["recruiter_note"] == "moved to Offered"
    assert ra.patch(path, {}).status_code == 400
    assert ra.patch("/api/recruiter/applications/9999", {"status": "Rejected"}).status_code == 404


def test_withdrawn_application_cannot_be_reviewed(world, client, sql):
    st = client(); st.login("student", "s1@example.test")
    assert st.post(f"/api/student/applications/{world['app']}/withdraw").status_code == 200
    r = world["ra"].patch(f"/api/recruiter/applications/{world['app']}", {"status": "Shortlisted"})
    assert r.status_code == 409 and r.get_json()["errors"]["allowed"] == []
    assert sql("SELECT status FROM applications")[0]["status"] == "Withdrawn"


def test_recruiter_can_download_applicant_resume(world, client, pdf_file):
    s = client(); s.login("student", "s1@example.test")
    s.post("/api/student/resume", data=pdf_file(), content_type="multipart/form-data")
    r = world["ra"].get(f"/api/recruiter/applications/{world['app']}/resume")
    assert r.status_code == 200 and r.data.startswith(b"%PDF")
    assert world["rb"].get(f"/api/recruiter/applications/{world['app']}/resume").status_code == 404


def test_summary_uses_real_counts(world, make):
    make.student("S2"); make.apply("S2", world["lid"], status="Shortlisted")
    s = world["ra"].get("/api/recruiter/summary").get_json()
    assert s["total_listings"] == 1 and s["active_listings"] == 1 and s["total_applications"] == 2
    assert s["application_counts"]["Applied"] == 1 and s["application_counts"]["Shortlisted"] == 1 and len(s["recent_applications"]) == 2
    assert world["rb"].get("/api/recruiter/summary").get_json()["total_applications"] == 0


def test_company_profile_edit_scoped_to_own_company(world, sql):
    r = world["ra"].put("/api/recruiter/company", {"headquarters_location": "Mumbai", "website": "https://alpha.example.test", "description": "We build"})
    assert r.status_code == 200
    assert sql("SELECT headquarters_location FROM companies WHERE company_id=%s", (world["ca"],))[0]["headquarters_location"] == "Mumbai"
    assert sql("SELECT headquarters_location FROM companies WHERE company_id=%s", (world["cb"],))[0]["headquarters_location"] == "Delhi"
    assert world["ra"].put("/api/recruiter/company", {"website": "javascript:alert(1)"}).status_code == 400
