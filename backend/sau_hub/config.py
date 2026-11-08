"""Environment-based configuration. No secrets live in source code."""
import logging
import os
import secrets
from datetime import timedelta
from pathlib import Path

log = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent.parent


def _bool(name, default):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def load_config(overrides=None):
    env = os.getenv("APP_ENV", "development").lower()
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        if env == "production":
            raise RuntimeError("SECRET_KEY must be set when APP_ENV=production")
        secret = secrets.token_hex(32)  # dev/test only: sessions reset on every restart
        log.warning("SECRET_KEY not set; using a temporary random key (development only).")
    cfg = {
        "APP_ENV": env,
        "SECRET_KEY": secret,
        "DB_HOST": os.getenv("DB_HOST", "localhost"),
        "DB_PORT": int(os.getenv("DB_PORT", "3306")),
        "DB_USER": os.getenv("DB_USER", "root"),
        "DB_PASSWORD": os.getenv("DB_PASSWORD", ""),
        "DB_NAME": os.getenv("DB_NAME", "placement_and_internship_cell"),
        "DB_POOL_SIZE": int(os.getenv("DB_POOL_SIZE", "5")),
        "CORS_ORIGINS": [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": _bool("SESSION_COOKIE_SECURE", env == "production"),
        "PERMANENT_SESSION_LIFETIME": timedelta(hours=int(os.getenv("SESSION_HOURS", "8"))),
        "MAX_CONTENT_LENGTH": 3 * 1024 * 1024,  # hard cap on request bodies
        "RESUME_MAX_BYTES": 2 * 1024 * 1024,
        "UPLOAD_DIR": os.getenv("UPLOAD_DIR", str(BACKEND_DIR / "uploads")),
        "RATE_LIMIT_ENABLED": _bool("RATE_LIMIT_ENABLED", True),
        "LOGIN_MAX_FAILURES": int(os.getenv("LOGIN_MAX_FAILURES", "5")),
        "LOGIN_WINDOW_SECONDS": int(os.getenv("LOGIN_WINDOW_SECONDS", "900")),
        "JSON_SORT_KEYS": False,
    }
    if overrides:
        cfg.update(overrides)
    return cfg
