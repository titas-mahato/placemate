"""Upgrading a database created by the ORIGINAL app must preserve data, hash passwords, and be repeatable."""
from pathlib import Path

import mysql.connector
import pytest

from conftest import CONN, TEST_DB, raw, recreate_db
from db.migrate import migrate
from sau_hub import create_app

LEGACY_DB = f"{TEST_DB}_migration"


@pytest.fixture()
def legacy():
    recreate_db(LEGACY_DB)
    c = raw(LEGACY_DB)
    cur = c.cursor()
    for stmt in Path(__file__).with_name("legacy_schema.sql").read_text().split(";\n"):
        stmt = "\n".join(l for l in stmt.splitlines() if not l.strip().startswith("--")).strip()
        if stmt:
            cur.execute(stmt)
    c.close()
    return LEGACY_DB


def run_migration():
    c = mysql.connector.connect(**CONN, database=LEGACY_DB)
    log = []
    migrate(c, log=log.append)
    c.close()
    return log


def test_migration_preserves_rows_hashes_passwords_and_is_idempotent(legacy):
    first = run_migration()
    assert any("hashed 1 legacy password" in l for l in first)
    c = raw(LEGACY_DB); cur = c.cursor(dictionary=True)
    cur.execute("SELECT student_id, email, password, password_hash FROM students")
    s = cur.fetchall()
    assert len(s) == 1 and s[0]["student_id"] == "SAU001"                      # data preserved
    assert s[0]["password"] is None and s[0]["password_hash"].startswith(("scrypt:", "pbkdf2:"))  # plaintext gone
    cur.execute("SELECT password, password_hash FROM admins"); a = cur.fetchone()
    assert a["password"] is None and a["password_hash"]
    cur.execute("SELECT is_approved FROM companies"); assert cur.fetchone()["is_approved"] == 1
    cur.execute("SELECT COUNT(*) n FROM placement_listings"); assert cur.fetchone()["n"] == 1
    cur.execute("SELECT COUNT(*) n FROM placement_required_skills"); assert cur.fetchone()["n"] == 1
    cur.execute("SHOW TABLES"); tables = {list(r.values())[0] for r in cur.fetchall()}
    assert {"applications", "recruiters", "student_skills"} <= tables
    c.close()
    assert run_migration() == []                                               # second run changes nothing


def test_legacy_users_can_log_in_with_old_password_after_migration(legacy):
    run_migration()
    app = create_app({"TESTING": True, "DB_NAME": LEGACY_DB, "DB_HOST": CONN["host"], "DB_PORT": CONN["port"], "DB_USER": CONN["user"],
                      "DB_PASSWORD": CONN["password"], "SECRET_KEY": "t", "RATE_LIMIT_ENABLED": False})
    cl = app.test_client()
    ok = cl.post("/api/student/login", json={"email": "legacy@example.test", "password": "plain-old-pw"})
    assert ok.status_code == 200 and ok.get_json()["user"]["student_id"] == "SAU001"
    assert cl.post("/api/admin/login", json={"email": "legacyadmin@example.test", "password": "admin-plain"}).status_code == 200
    assert cl.post("/api/student/login", json={"email": "legacy@example.test", "password": "wrong"}).status_code == 401
    # pre-existing listing is still served (company stayed approved)
    cl.post("/api/student/login", json={"email": "legacy@example.test", "password": "plain-old-pw"})
    data = cl.get("/api/opportunities").get_json()["data"]
    assert [o["title"] for o in data] == ["Legacy Engineer"] and data[0]["skills"] == ["Java"]
