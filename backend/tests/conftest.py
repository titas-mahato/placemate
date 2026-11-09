"""Test fixtures. Tests run against a DEDICATED database (default 'sau_hub_test') that is dropped and
recreated — the fixture refuses to touch any database whose name does not contain '_test'."""
import io
import os

import mysql.connector
import pytest

from sau_hub import create_app
from sau_hub.security import hash_password, limiter

TEST_DB = os.getenv("TEST_DB_NAME", "sau_hub_test")
assert "_test" in TEST_DB, "TEST_DB_NAME must contain '_test' (safety check)"
CONN = dict(host=os.getenv("DB_HOST", "127.0.0.1"), port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"), password=os.getenv("DB_PASSWORD", ""))
PW = "Passw0rd!"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def raw(db=None):
    return mysql.connector.connect(**CONN, database=db, autocommit=True) if db else mysql.connector.connect(**CONN, autocommit=True)


def recreate_db(name):
    assert "_test" in name
    c = raw()
    cur = c.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS `{name}`")
    cur.execute(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4")
    c.close()


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    recreate_db(TEST_DB)
    from db.migrate import migrate
    c = mysql.connector.connect(**CONN, database=TEST_DB)
    migrate(c, log=lambda *_: None)
    c.close()
    return create_app({"TESTING": True, "DB_NAME": TEST_DB, "DB_HOST": CONN["host"], "DB_PORT": CONN["port"], "DB_USER": CONN["user"],
                       "DB_PASSWORD": CONN["password"], "SECRET_KEY": "test-secret", "RATE_LIMIT_ENABLED": False,
                       "SESSION_COOKIE_SECURE": False, "UPLOAD_DIR": str(tmp_path_factory.mktemp("uploads"))})


@pytest.fixture(autouse=True)
def clean(app):
    c = raw(TEST_DB)
    cur = c.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS=0")
    cur.execute("SHOW TABLES")
    for (t,) in cur.fetchall():
        cur.execute(f"TRUNCATE TABLE `{t}`")
    cur.execute("SET FOREIGN_KEY_CHECKS=1")
    c.close()
    limiter.clear()
    app.config["RATE_LIMIT_ENABLED"] = False
    import shutil
    shutil.rmtree(os.path.join(app.config["UPLOAD_DIR"], "resumes"), ignore_errors=True)  # isolate uploaded files too
    yield


@pytest.fixture()
def sql(app):
    c = raw(TEST_DB)

    def run(q, p=()):
        cur = c.cursor(dictionary=True)
        cur.execute(q, p)
        try:
            return cur.fetchall() if cur.with_rows else cur.lastrowid
        finally:
            cur.close()
    yield run
    c.close()


class Api:
    """Cookie-aware JSON client that remembers its CSRF token, like the real frontend does."""

    def __init__(self, app):
        self.c, self.csrf = app.test_client(), None

    def _h(self):
        return {"X-CSRF-Token": self.csrf} if self.csrf else {}

    def get(self, url, **kw): return self.c.get(url, headers=self._h(), **kw)
    def post(self, url, json=None, **kw): return self.c.post(url, json=json, headers=self._h(), **kw)
    def put(self, url, json=None, **kw): return self.c.put(url, json=json, headers=self._h(), **kw)
    def patch(self, url, json=None, **kw): return self.c.patch(url, json=json, headers=self._h(), **kw)
    def delete(self, url, **kw): return self.c.delete(url, headers=self._h(), **kw)

    def login(self, role, email, password=PW):
        r = self.c.post("/api/auth/login", json={"role": role, "email": email, "password": password})
        if r.status_code == 200:
            self.csrf = r.get_json()["csrf_token"]
        return r


@pytest.fixture()
def client(app):
    return lambda: Api(app)


@pytest.fixture()
def make(sql):
    """Factories that insert rows directly so tests don't depend on the API they are testing."""
    class F:
        n = 0

        def student(self, sid="S1", email=None, gpa=8.0, year=2026, major="Computer Science", active=1):
            sql("INSERT INTO students (student_id,first_name,last_name,email,password_hash,major,graduation_year,gpa,is_active) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (sid, "Test", sid, email or f"{sid.lower()}@example.test", hash_password(PW), major, year, gpa, active))
            return sid

        def company(self, name="Acme", approved=1):
            return sql("INSERT INTO companies (name, headquarters_location, is_approved) VALUES (%s,'Delhi',%s)", (name, approved))

        def recruiter(self, company_id, email="rec@example.test", status="approved"):
            return sql("INSERT INTO recruiters (company_id,name,email,password_hash,status) VALUES (%s,'Rec',%s,%s,%s)", (company_id, email, hash_password(PW), status))

        def admin(self, email="admin@example.test"):
            return sql("INSERT INTO admins (name,email,password_hash) VALUES ('Admin',%s,%s)", (email, hash_password(PW)))

        def listing(self, company_id, typ="Placement", title="Engineer", deadline="2099-01-01", min_gpa=None, min_year=None, max_year=None, active=1):
            if typ == "Placement":
                return sql("INSERT INTO placement_listings (company_id,title,package_lpa,location,description,deadline,min_gpa,min_grad_year,max_grad_year,is_active) VALUES (%s,%s,9.5,'Delhi','d',%s,%s,%s,%s,%s)",
                           (company_id, title, deadline, min_gpa, min_year, max_year, active))
            return sql("INSERT INTO internship_listings (company_id,title,stipend,location,description,deadline,min_gpa,min_grad_year,max_grad_year,is_active) VALUES (%s,%s,'20000','Delhi','d',%s,%s,%s,%s,%s)",
                       (company_id, title, deadline, min_gpa, min_year, max_year, active))

        def apply(self, sid, listing_id, typ="Placement", status="Applied"):
            col = "placement_id" if typ == "Placement" else "internship_id"
            return sql(f"INSERT INTO applications (student_id,{col},status) VALUES (%s,%s,%s)", (sid, listing_id, status))
    return F()


@pytest.fixture()
def pdf_file():
    return lambda data=PDF, name="cv.pdf": {"resume": (io.BytesIO(data), name)}
