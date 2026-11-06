"""Small, dependency-free input validation. Each helper raises ApiError(400) with a field message."""
import re
from datetime import date, datetime

from .errors import ApiError

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
STUDENT_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{3,20}$")
PHONE_RE = re.compile(r"^[0-9+\-() ]{7,20}$")


class Fields:
    """Collects field errors so the client can show all of them at once."""

    def __init__(self, data):
        if not isinstance(data, dict):
            raise ApiError("Request body must be a JSON object", 400)
        self.data, self.errors = data, {}

    def err(self, name, msg):
        self.errors.setdefault(name, msg)

    def text(self, name, *, required=False, max_len=255, min_len=0, default=None):
        v = self.data.get(name)
        if v is None or (isinstance(v, str) and not v.strip()):
            if required:
                self.err(name, "This field is required")
            return default
        if not isinstance(v, str):
            self.err(name, "Must be text")
            return default
        v = v.strip()
        if len(v) > max_len:
            self.err(name, f"Must be at most {max_len} characters")
        elif len(v) < min_len:
            self.err(name, f"Must be at least {min_len} characters")
        return v

    def email(self, name="email", required=True):
        v = self.text(name, required=required, max_len=120)
        if v is not None and not EMAIL_RE.match(v):
            self.err(name, "Enter a valid email address")
        return v.lower() if v else v

    def password(self, name="password"):
        v = self.data.get(name)
        if not isinstance(v, str) or not v:
            self.err(name, "This field is required")
            return None
        if len(v) < 8 or len(v) > 128 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            self.err(name, "Use 8–128 characters including at least one letter and one number")
        return v

    def number(self, name, *, lo=None, hi=None, integer=False, required=False):
        v = self.data.get(name)
        if v is None or v == "":
            if required:
                self.err(name, "This field is required")
            return None
        try:
            if isinstance(v, bool):
                raise ValueError
            n = int(v) if integer else float(v)
        except (TypeError, ValueError):
            self.err(name, "Must be a whole number" if integer else "Must be a number")
            return None
        if (lo is not None and n < lo) or (hi is not None and n > hi):
            self.err(name, f"Must be between {lo} and {hi}")
            return None
        return n

    def day(self, name, required=False):
        v = self.data.get(name)
        if v in (None, ""):
            if required:
                self.err(name, "This field is required")
            return None
        try:
            return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
        except ValueError:
            self.err(name, "Use the format YYYY-MM-DD")
            return None

    def choice(self, name, options, required=True):
        v = self.data.get(name)
        if v is None and not required:
            return None
        if v not in options:
            self.err(name, f"Must be one of: {', '.join(options)}")
            return None
        return v

    def skills(self, name="skills", max_items=30):
        v = self.data.get(name)
        if v is None:
            return None
        if not isinstance(v, list) or len(v) > max_items:
            self.err(name, f"Provide a list of at most {max_items} skills")
            return None
        out, seen = [], set()
        for s in v:
            if not isinstance(s, str) or not s.strip() or len(s.strip()) > 40:
                self.err(name, "Each skill must be 1–40 characters")
                return None
            clean = re.sub(r"\s+", " ", s.strip())
            if clean.lower() not in seen:
                seen.add(clean.lower())
                out.append(clean)
        return out

    def check(self):
        if self.errors:
            raise ApiError("Please correct the highlighted fields", 400, self.errors)


def today():
    return date.today()
