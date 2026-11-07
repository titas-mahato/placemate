
"""Idempotent database setup / upgrade. NEVER drops tables or deletes rows.

    python -m db.migrate            # uses DB_* variables from the environment / .env

1. Creates any missing tables from db/schema.sql.
2. Adds columns that older databases lack (checked via information_schema, so it works on
   MySQL 8 as well as MariaDB).
3. Hashes legacy plaintext passwords (students.password / admins.password), then NULLs the
   plaintext column so it no longer exists in readable form.
4. Existing companies are marked approved (they were already visible before approvals existed).
"""
import os
import re
import sys
from pathlib import Path

import mysql.connector
from werkzeug.security import generate_password_hash

HERE = Path(__file__).resolve().parent

# table -> [(column, DDL fragment)]
ADD_COLUMNS = {
    "students": [
        ("password_hash", "VARCHAR(255) NULL"), ("phone", "VARCHAR(20) NULL"), ("bio", "TEXT NULL"),
        ("resume_path", "VARCHAR(255) NULL"), ("resume_name", "VARCHAR(255) NULL"),
        ("is_active", "TINYINT(1) NOT NULL DEFAULT 1"),
        ("created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
        ("updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ],
    "admins": [
        ("password_hash", "VARCHAR(255) NULL"), ("is_active", "TINYINT(1) NOT NULL DEFAULT 1"),
        ("created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ],
    "companies": [
        ("website", "VARCHAR(200) NULL"), ("description", "TEXT NULL"),
        ("is_approved", "TINYINT(1) NOT NULL DEFAULT 0"),
        ("created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ],
}
LISTING_COLS = [
    ("recruiter_id", "INT NULL"), ("deadline", "DATE NULL"), ("min_gpa", "DECIMAL(3,2) NULL"),
    ("min_grad_year", "INT NULL"), ("max_grad_year", "INT NULL"),
    ("created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ("updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
]
ADD_COLUMNS["internship_listings"] = LISTING_COLS + [("location", "VARCHAR(100) NULL")]
ADD_COLUMNS["placement_listings"] = LISTING_COLS

HASH_PREFIXES = ("scrypt:", "pbkdf2:")


def connect_from_env():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"), port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"), password=os.getenv("DB_PASSWORD", ""),
        database=os.environ["DB_NAME"], autocommit=False,
    )


def _columns(cur, table):
    cur.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s", (table,))
    return {r[0] for r in cur.fetchall()}


def _run_schema(cur):
    sql = (HERE / "schema.sql").read_text(encoding="utf-8")
    sql = re.sub(r"--.*", "", sql)
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            cur.execute(stmt)


def _hash_legacy(cur, table, key, log):
    cols = _columns(cur, table)
    if "password" not in cols:
        return
    cur.execute(f"SELECT {key}, password FROM {table} WHERE password IS NOT NULL AND password <> '' AND (password_hash IS NULL OR password_hash = '')")
    rows = cur.fetchall()
    for pk, plain in rows:
        stored = plain if str(plain).startswith(HASH_PREFIXES) else generate_password_hash(plain)
        cur.execute(f"UPDATE {table} SET password_hash = %s WHERE {key} = %s", (stored, pk))
    # Plaintext must not stay behind. Make the legacy column nullable and blank it.
    cur.execute(f"ALTER TABLE {table} MODIFY password VARCHAR(255) NULL")
    cur.execute(f"UPDATE {table} SET password = NULL")
    if rows:
        log(f"  hashed {len(rows)} legacy password(s) in {table} and cleared the plaintext column")


def migrate(conn, log=print):
    cur = conn.cursor()
    _run_schema(cur)
    # DDL auto-commits in MySQL; we still commit explicitly for the data steps.
    for table, cols in ADD_COLUMNS.items():
        have = _columns(cur, table)
        for name, ddl in cols:
            if name not in have:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
                log(f"  added {table}.{name}")
                if table == "companies" and name == "is_approved":
                    cur.execute("UPDATE companies SET is_approved = 1")
                    log("  marked pre-existing companies as approved")
    # Relax legacy NOT NULL on old listings' optional fields is not needed; foreign keys for new columns:
    for table, fk, ref in (("internship_listings", "fk_int_recruiter", "recruiter_id"), ("placement_listings", "fk_pl_recruiter", "recruiter_id")):
        cur.execute("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s", (table, fk))
        if not cur.fetchone():
            cur.execute(f"ALTER TABLE {table} ADD CONSTRAINT {fk} FOREIGN KEY ({ref}) REFERENCES recruiters(recruiter_id) ON DELETE SET NULL")
            log(f"  added foreign key {fk}")
    _hash_legacy(cur, "students", "student_id", log)
    _hash_legacy(cur, "admins", "admin_id", log)
    conn.commit()
    cur.close()


if __name__ == "__main__":
    try:
        from dotenv import load_dotenv
        load_dotenv(HERE.parent / ".env")
    except ImportError:
        pass
    if not os.getenv("DB_NAME"):
        sys.exit("DB_NAME is not set. Copy backend/.env.example to backend/.env first.")
    c = connect_from_env()
    print(f"Migrating database '{os.environ['DB_NAME']}' ...")
    migrate(c)
    c.close()
    print("Done.")
