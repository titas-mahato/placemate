"""DEVELOPMENT SAMPLE DATA ONLY — never run against a real/production database.

Every record is clearly fake: emails end in @example.test, company names start with "[SAMPLE]",
student IDs start with DEMO. A random password is generated and printed once.

    python -m db.seed_dev --yes
"""
import os
import secrets
import sys
from datetime import date, timedelta
from pathlib import Path

if os.getenv("APP_ENV", "development") == "production":
    sys.exit("Refusing to seed sample data when APP_ENV=production.")
if "--yes" not in sys.argv:
    sys.exit("This inserts SAMPLE data into the configured database. Re-run with --yes to confirm.")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from sau_hub import create_app  # noqa: E402
from sau_hub.db import commit, execute, query_one  # noqa: E402
from sau_hub.domain import set_listing_skills, set_student_skills  # noqa: E402
from sau_hub.security import hash_password  # noqa: E402

pw = "Demo" + secrets.token_hex(4) + "1"
h = hash_password(pw)
app = create_app()
with app.app_context():
    if query_one("SELECT 1 FROM students WHERE student_id = 'DEMO001'"):
        sys.exit("Sample data already present (DEMO001 exists); nothing inserted.")
    cos = {}
    for n, loc in (("[SAMPLE] Acme Software", "Bengaluru"), ("[SAMPLE] Globex Analytics", "Delhi"), ("[SAMPLE] Initech Labs", "Hyderabad")):
        cos[n] = execute("INSERT INTO companies (name, headquarters_location, is_approved) VALUES (%s,%s,%s)", (n, loc, 0 if "Initech" in n else 1))
    r1 = execute("INSERT INTO recruiters (company_id,name,email,password_hash,status) VALUES (%s,%s,%s,%s,'approved')", (cos["[SAMPLE] Acme Software"], "Sample Recruiter", "recruiter.demo@example.test", h))
    execute("INSERT INTO recruiters (company_id,name,email,password_hash,status) VALUES (%s,%s,%s,%s,'pending')", (cos["[SAMPLE] Initech Labs"], "Pending Recruiter", "pending.demo@example.test", h))
    soon, later = date.today() + timedelta(days=10), date.today() + timedelta(days=60)
    execute("INSERT INTO placement_listings (company_id,recruiter_id,title,package_lpa,location,description,deadline,min_gpa,min_grad_year,max_grad_year) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (cos["[SAMPLE] Acme Software"], r1, "Software Engineer (sample)", 9.5, "Bengaluru", "Sample listing for development.", later, 6.5, 2026, 2027))
    p1 = query_one("SELECT MAX(placement_id) i FROM placement_listings")["i"]
    set_listing_skills("Placement", p1, ["Python", "SQL"])
    execute("INSERT INTO internship_listings (company_id,recruiter_id,title,stipend,location,description,deadline) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (cos["[SAMPLE] Acme Software"], r1, "Data Intern (sample)", "20000/month", "Remote", "Sample internship for development.", soon))
    i1 = query_one("SELECT MAX(internship_id) i FROM internship_listings")["i"]
    set_listing_skills("Internship", i1, ["Python"])
    execute("INSERT INTO internship_listings (company_id,title,stipend,location,description,deadline) VALUES (%s,%s,%s,%s,%s,%s)",
            (cos["[SAMPLE] Globex Analytics"], "Analyst Intern (sample)", "15000/month", "Delhi", "Sample internship.", later))
    for n, (major, gpa, yr) in enumerate([("Computer Science", 8.4, 2026), ("Computer Science", 7.1, 2026), ("Mathematics", 6.2, 2027), ("Economics", 7.8, 2026)], 1):
        sid = f"DEMO00{n}"
        execute("INSERT INTO students (student_id,first_name,last_name,email,password_hash,major,graduation_year,gpa) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (sid, f"Sample{n}", "Student", f"student{n}.demo@example.test", h, major, yr, gpa))
        set_student_skills(sid, ["Python", "SQL"] if n < 3 else ["Statistics"])
    execute("INSERT INTO applications (student_id, placement_id, status) VALUES ('DEMO001', %s, 'Applied')", (p1,))
    commit()
print("Sample data inserted. All sample accounts share this one-time password (not stored anywhere):", pw)
print("  student: student1.demo@example.test   recruiter: recruiter.demo@example.test")
print("Create an admin separately with: python create_admin.py")
