"""The complete recruitment lifecycle, end to end through the HTTP API (no direct DB shortcuts for the steps under test)."""
from conftest import PW


def test_full_recruitment_lifecycle(client, make, sql):
    # --- setup performed by the placement office
    admin_id = make.admin()
    admin = client(); assert admin.login("admin", "admin@example.test").status_code == 200

    # recruiter self-registers; cannot log in until the admin approves
    rec = client()
    assert rec.post("/api/recruiter/register", {"name": "Priya", "email": "priya@acme.example.test", "password": PW, "company_name": "Acme Corp"}).status_code == 201
    assert rec.login("recruiter", "priya@acme.example.test").status_code == 403
    pending = admin.get("/api/admin/recruiters?status=pending").get_json()["data"]
    assert admin.patch(f"/api/admin/recruiters/{pending[0]['recruiter_id']}", {"status": "approved"}).status_code == 200
    assert rec.login("recruiter", "priya@acme.example.test").status_code == 200

    # recruiter publishes an opportunity
    created = rec.post("/api/recruiter/opportunities", {"type": "Placement", "title": "Graduate Engineer", "salary": 10, "deadline": "2099-06-30",
                                                        "min_gpa": 7, "skills": ["Python"]}).get_json()["opportunity"]

    # 1. student registers and logs in
    stu = client()
    assert stu.post("/api/student/register", {"student_id": "SAU2026", "first_name": "Neha", "last_name": "Singh", "email": "neha@example.test",
                                              "password": PW, "major": "Computer Science", "graduation_year": 2026, "gpa": 8.1}).status_code == 201
    assert stu.login("student", "neha@example.test").status_code == 200
    assert stu.put("/api/student/profile", {"first_name": "Neha", "last_name": "Singh", "major": "Computer Science", "graduation_year": 2026, "gpa": 8.1, "skills": ["Python"]}).status_code == 200

    # 2. views the opportunity (eligible, skill match)
    d = stu.get(f"/api/opportunities/Placement/{created['id']}").get_json()["opportunity"]
    assert d["eligible"] is True and d["skill_matches"] == 1 and d["applied"] is False

    # 3 + 4. applies; the application is persisted in the database
    r = stu.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": created["id"], "cover_note": "Excited to apply"})
    assert r.status_code == 201
    row = sql("SELECT student_id, placement_id, status FROM applications")[0]
    assert row == {"student_id": "SAU2026", "placement_id": created["id"], "status": "Applied"}
    assert stu.post("/api/student/applications", {"opportunity_type": "Placement", "opportunity_id": created["id"]}).status_code == 409

    # 5 + 6. recruiter sees the application
    apps = rec.get(f"/api/recruiter/opportunities/Placement/{created['id']}/applicants").get_json()["data"]
    assert len(apps) == 1 and apps[0]["student_id"] == "SAU2026" and apps[0]["cover_note"] == "Excited to apply"

    # 7. recruiter moves it through the pipeline
    for status in ("Under Review", "Shortlisted", "Interview", "Offered"):
        assert rec.patch(f"/api/recruiter/applications/{apps[0]['application_id']}", {"status": status, "recruiter_note": f"{status} ok"}).status_code == 200

    # 8. student sees the updated status after a brand-new login
    stu2 = client(); stu2.login("student", "neha@example.test")
    mine = stu2.get("/api/student/applications").get_json()["applications"]
    assert mine[0]["status"] == "Offered" and mine[0]["recruiter_note"] == "Offered ok"
    assert stu2.get("/api/student/summary").get_json()["application_counts"]["Offered"] == 1

    # admin statistics reflect the placement
    stats = admin.get("/api/admin/stats").get_json()
    assert stats["students_placed"] == 1 and stats["placement_rate"] == 100.0 and stats["avg_offered_package_lpa"] == 10.0
    assert stats["top_hiring_companies"] == [{"company": "Acme Corp", "offers": 1}]

    # 9. unauthorized access is denied
    anon = client()
    assert anon.get(f"/api/opportunities/Placement/{created['id']}").status_code == 401
    assert stu2.patch(f"/api/recruiter/applications/{apps[0]['application_id']}", {"status": "Rejected"}).status_code == 403
    assert stu2.get("/api/admin/students").status_code == 403
    other = client(); other.post("/api/recruiter/register", {"name": "Eve", "email": "eve@rival.example.test", "password": PW, "company_name": "Rival Inc"})
    sql("UPDATE recruiters SET status='approved' WHERE email='eve@rival.example.test'"); other.login("recruiter", "eve@rival.example.test")
    assert other.patch(f"/api/recruiter/applications/{apps[0]['application_id']}", {"status": "Rejected"}).status_code == 404
    assert other.get(f"/api/recruiter/opportunities/Placement/{created['id']}/applicants").status_code == 404
