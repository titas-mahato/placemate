"""Authentication, role-based access control, CSRF and login rate limiting.

Design: server-side sessions via Flask's signed, HttpOnly cookie. The cookie only carries
{role, id, csrf}; on every request the user is re-read from MySQL, so deactivating/suspending
an account takes effect immediately. Nothing in the browser (localStorage/sessionStorage/role
flags) is ever trusted for authorization."""
import hmac
import logging
import secrets
import time
from collections import defaultdict, deque
from functools import wraps

from flask import g, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from .db import query_one
from .errors import ApiError

log = logging.getLogger("sau_hub")

ROLES = {
    "student": {"sql": "SELECT * FROM students WHERE email = %s", "id": "student_id", "active": lambda r: bool(r["is_active"])},
    "recruiter": {"sql": "SELECT * FROM recruiters WHERE email = %s", "id": "recruiter_id", "active": lambda r: r["status"] == "approved"},
    "admin": {"sql": "SELECT * FROM admins WHERE email = %s", "id": "admin_id", "active": lambda r: bool(r["is_active"])},
}
LOAD_BY_ID = {
    "student": "SELECT * FROM students WHERE student_id = %s",
    "recruiter": "SELECT * FROM recruiters WHERE recruiter_id = %s",
    "admin": "SELECT * FROM admins WHERE admin_id = %s",
}
# A fixed dummy hash lets us spend the same time verifying for unknown emails (no user enumeration by timing).
_DUMMY_HASH = generate_password_hash("not-a-real-password")


def hash_password(pw):
    return generate_password_hash(pw)


class RateLimiter:
    """In-memory sliding window (per process). Fine for a single server; use Redis for multi-worker deployments."""

    def __init__(self):
        self.hits = defaultdict(deque)

    def _prune(self, key, window):
        q, now = self.hits[key], time.time()
        while q and now - q[0] > window:
            q.popleft()
        return q

    def blocked(self, key, limit, window):
        return len(self._prune(key, window)) >= limit

    def record(self, key):
        self.hits[key].append(time.time())

    def clear(self, key=None):
        if key is None:
            self.hits.clear()
        else:
            self.hits.pop(key, None)


limiter = RateLimiter()


def _client_ip():
    return request.remote_addr or "unknown"


def authenticate(app_cfg, role, email, password):
    """Verify credentials; on success start a fresh session and return (user_row, csrf_token)."""
    spec = ROLES[role]
    ip_key, acct_key = ("ip", role, _client_ip()), ("acct", role, (email or "").lower())
    limit, window = app_cfg["LOGIN_MAX_FAILURES"], app_cfg["LOGIN_WINDOW_SECONDS"]
    if app_cfg["RATE_LIMIT_ENABLED"] and (limiter.blocked(acct_key, limit, window) or limiter.blocked(ip_key, limit * 6, window)):
        log.warning("login throttled role=%s ip=%s", role, _client_ip())
        raise ApiError("Too many failed attempts. Please wait a few minutes and try again.", 429)

    row = query_one(spec["sql"], (email,)) if email else None
    stored = (row or {}).get("password_hash") or _DUMMY_HASH
    valid = bool(password) and check_password_hash(stored, password) and row is not None and bool((row or {}).get("password_hash"))
    if not valid:
        limiter.record(acct_key)
        limiter.record(ip_key)
        log.info("login failed role=%s ip=%s", role, _client_ip())
        raise ApiError("Invalid email or password", 401)
    if role == "recruiter" and row["status"] == "pending":
        raise ApiError("Your recruiter account is awaiting approval by the placement office.", 403)
    if not spec["active"](row):
        raise ApiError("This account is not active. Please contact the placement office.", 403)

    limiter.clear(acct_key)
    session.clear()  # prevents session fixation
    session.permanent = True
    session["role"], session["uid"] = role, row[spec["id"]]
    session["csrf"] = secrets.token_urlsafe(32)
    log.info("login ok role=%s", role)
    return row, session["csrf"]


def load_current_user():
    """Returns (role, row) for the session, or None. Re-validates against the database every time."""
    role, uid = session.get("role"), session.get("uid")
    if role not in ROLES or uid is None:
        return None
    row = query_one(LOAD_BY_ID[role], (uid,))
    if not row or not ROLES[role]["active"](row):
        session.clear()
        return None
    return role, row


def require_role(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            cur = load_current_user()
            if cur is None:
                raise ApiError("Authentication required", 401)
            role, row = cur
            if role not in roles:
                raise ApiError("You do not have permission to perform this action", 403)
            g.role, g.user = role, row
            return fn(*a, **kw)
        return wrapper
    return deco


CSRF_EXEMPT = {"auth.login", "auth.student_login_alias", "auth.admin_login_alias", "auth.recruiter_login_alias",
               "auth.register_student", "auth.register_recruiter"}


def csrf_protect():
    """before_request hook: mutating requests from a logged-in session must echo the CSRF token."""
    if request.method in ("GET", "HEAD", "OPTIONS") or request.endpoint in CSRF_EXEMPT:
        return None
    if session.get("uid") is None:
        return None  # unauthenticated: the role guard will answer 401
    sent = request.headers.get("X-CSRF-Token", "")
    if not hmac.compare_digest(sent, session.get("csrf", "")):
        raise ApiError("Missing or invalid CSRF token", 403)
    return None


def require_json():
    if request.method in ("POST", "PUT", "PATCH") and request.content_length:
        if request.mimetype not in ("application/json", "multipart/form-data"):
            raise ApiError("Content-Type must be application/json", 415)
