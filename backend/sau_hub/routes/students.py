import os
import uuid
from datetime import timedelta
from pathlib import Path

from flask import Blueprint, current_app, g, request, send_file
from werkzeug.utils import secure_filename

from ..db import IntegrityError, commit, execute, query_all, query_one, rollback
from ..domain import (ALL_STATUSES, STUDENT_WITHDRAWABLE, UNION_SQL, TYPES, attach_skills, clean_row, eligibility,
                      load_opportunity, public_opportunity, set_student_skills, student_skill_names)
from ..errors import ApiError, ok
from ..security import require_role
from ..validation import PHONE_RE, Fields, today

bp = Blueprint("students", __name__, url_prefix="/api")


def _profile(row):
    return {
        "student_id": row["student_id"], "first_name": row["first_name"], "last_name": row["last_name"], "email": row["email"],
        "major": row["major"], "graduation_year": row["graduation_year"],
        "gpa": float(row["gpa"]) if row["gpa"] is not None else None, "phone": row["phone"], "bio": row["bio"],
        "skills": student_skill_names(row["student_id"]), "resume_name": row["resume_name"], "has_resume": bool(row["resume_path"]),
    }


@bp.get("/student/profile")
@require_role("student")
def get_profile():
    return ok({"profile": _profile(g.user)})


@bp.put("/student/profile")
@require_role("student")
def update_profile():
    f = Fields(request.get_json(silent=True))
    first = f.text("first_name", required=True, max_len=50)
    last = f.text("last_name", max_len=50, default="")
    major = f.text("major", max_len=100)
    year = f.number("graduation_year", lo=2000, hi=2100, integer=True, required=True)
    gpa = f.number("gpa", lo=0, hi=10)
    phone = f.text("phone", max_len=20)
    if phone and not PHONE_RE.match(phone):
        f.err("phone", "Enter a valid phone number")
    bio = f.text("bio", max_len=1000)
    skills = f.skills()
    f.check()
    sid = g.user["student_id"]  # always the authenticated student: no id is accepted from the client
    execute("UPDATE students SET first_name=%s, last_name=%s, major=%s, graduation_year=%s, gpa=%s, phone=%s, bio=%s WHERE student_id=%s",
            (first, last or "", major, year, gpa, phone, bio, sid))
    if skills is not None:
        set_student_skills(sid, skills)
    commit()
    return ok({"message": "Profile updated", "profile": _profile(query_one("SELECT * FROM students WHERE student_id=%s", (sid,)))})


@bp.get("/skills")
@require_role("student", "recruiter", "admin")
def list_skills():
    return ok({"skills": [r["skill_name"] for r in query_all("SELECT skill_name FROM skills ORDER BY skill_name")]})


# ---------------- resume ----------------
def _resume_dir():
    d = Path(current_app.config["UPLOAD_DIR"]) / "resumes"
    d.mkdir(parents=True, exist_ok=True)
    return d


def send_resume(student_row):
    if not student_row["resume_path"]:
        raise ApiError("No resume uploaded", 404)
    path = _resume_dir() / Path(student_row["resume_path"]).name  # .name blocks any path traversal
    if not path.is_file():
        raise ApiError("Resume file is missing", 404)
    name = secure_filename(student_row["resume_name"] or "resume.pdf") or "resume.pdf"
    return send_file(path, mimetype="application/pdf", as_attachment=True, download_name=name)


@bp.post("/student/resume")
@require_role("student")
def upload_resume():
    file = request.files.get("resume")
    if file is None or not file.filename:
        raise ApiError("Attach a PDF file in the 'resume' field", 400, {"resume": "This field is required"})
    blob = file.read(current_app.config["RESUME_MAX_BYTES"] + 1)
    if len(blob) > current_app.config["RESUME_MAX_BYTES"]:
        raise ApiError("Resume must be 2 MB or smaller", 413)
    if not blob.startswith(b"%PDF-"):  # check content, never trust the extension / client MIME type
        raise ApiError("Only PDF files are accepted", 400, {"resume": "Not a valid PDF"})
    fname = f"{uuid.uuid4().hex}.pdf"
    (_resume_dir() / fname).write_bytes(blob)
    old = g.user["resume_path"]
    execute("UPDATE students SET resume_path=%s, resume_name=%s WHERE student_id=%s",
            (fname, secure_filename(file.filename)[:200] or "resume.pdf", g.user["student_id"]))
    commit()
    if old:
        (_resume_dir() / Path(old).name).unlink(missing_ok=True)
    return ok({"message": "Resume uploaded"}, 201)


@bp.get("/student/resume")
@require_role("student")
def download_resume():
    return send_resume(g.user)


@bp.delete("/student/resume")
@require_role("student")
def delete_resume():
    old = g.user["resume_path"]
    execute("UPDATE students SET resume_path=NULL, resume_name=NULL WHERE student_id=%s", (g.user["student_id"],))
    commit()
    if old:
        (_resume_dir() / Path(old).name).unlink(missing_ok=True)
    return ok({"message": "Resume removed"})


# ---------------- applications ----------------
APP_SELECT = f"""
SELECT a.application_id, a.status, a.cover_note, a.recruiter_note, a.applied_at, a.updated_at,
       o.type, o.id AS opportunity_id, o.title, o.company, o.location, o.deadline
FROM applications a
JOIN ({UNION_SQL}) o ON (o.type = 'Internship' AND o.id = a.internship_id) OR (o.type = 'Placement' AND o.id = a.placement_id)
"""


@bp.get("/student/applications")
@require_role("student")
def my_applications():
    rows = query_all(APP_SELECT + " WHERE a.student_id = %s ORDER BY a.applied_at DESC, a.application_id DESC", (g.user["student_id"],))
    return ok({"applications": [clean_row(r) for r in rows]})


@bp.post("/student/applications")
@require_role("student")
def apply():
    data = request.get_json(silent=True)
    f = Fields(data)
    typ = f.choice("opportunity_type", list(TYPES))
    oid = f.number("opportunity_id", integer=True, required=True, lo=1, hi=2**31 - 1)
    note = f.text("cover_note", max_len=1500)
    f.check()
    opp = load_opportunity(typ, oid)
    if not opp["company_approved"]:
        raise ApiError("Opportunity not found", 404)  # unapproved companies are invisible to students
    can, reasons = eligibility(g.user, opp)
    if not can:
        raise ApiError("You are not eligible to apply: " + "; ".join(reasons), 403, {"eligibility": reasons})
    col = TYPES[typ]["app_col"]
    try:
        # The UNIQUE(student, listing) keys make a duplicate impossible even under concurrent requests.
        app_id = execute(f"INSERT INTO applications (student_id, {col}, cover_note) VALUES (%s,%s,%s)", (g.user["student_id"], oid, note))
        commit()
    except IntegrityError:
        rollback()
        raise ApiError("You have already applied to this opportunity", 409)
    return ok({"message": "Application submitted", "application_id": app_id}, 201)


@bp.post("/student/applications/<int:app_id>/withdraw")
@require_role("student")
def withdraw(app_id):
    row = query_one("SELECT status FROM applications WHERE application_id=%s AND student_id=%s", (app_id, g.user["student_id"]))
    if not row:
        raise ApiError("Application not found", 404)  # also hides other students' applications
    if row["status"] not in STUDENT_WITHDRAWABLE:
        raise ApiError(f"An application with status '{row['status']}' can no longer be withdrawn", 409)
    execute("UPDATE applications SET status='Withdrawn' WHERE application_id=%s", (app_id,))
    commit()
    return ok({"message": "Application withdrawn"})


@bp.get("/student/summary")
@require_role("student")
def summary():
    sid = g.user["student_id"]
    counts = {s: 0 for s in ALL_STATUSES}
    for r in query_all("SELECT status, COUNT(*) n FROM applications WHERE student_id=%s GROUP BY status", (sid,)):
        counts[r["status"]] = r["n"]
    soon = today() + timedelta(days=14)
    rows = query_all(
        f"SELECT o.* FROM ({UNION_SQL}) o WHERE o.is_active=1 AND o.company_approved=1 AND o.deadline BETWEEN CURDATE() AND %s "
        "AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.student_id=%s AND ((o.type='Internship' AND a.internship_id=o.id) OR (o.type='Placement' AND a.placement_id=o.id))) "
        "ORDER BY o.deadline ASC LIMIT 20", (soon, sid))
    deadlines = [public_opportunity(r, g.user, None) for r in attach_skills(rows)]
    deadlines = [d for d in deadlines if d["eligible"]][:5]
    prof = _profile(g.user)
    checks = [prof["major"], prof["gpa"] is not None, prof["phone"], prof["bio"], prof["skills"], prof["has_resume"]]
    return ok({"application_counts": counts, "total_applications": sum(counts.values()), "upcoming_deadlines": deadlines,
               "profile_completeness": round(100 * sum(1 for c in checks if c) / len(checks))})
