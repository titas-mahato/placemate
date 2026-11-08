import logging

from flask import Flask
from flask_cors import CORS

from . import db as _db
from .config import load_config
from .errors import ok, register_error_handlers
from .security import csrf_protect, require_json


def create_app(overrides=None):
    try:
        from dotenv import load_dotenv
        from .config import BACKEND_DIR
        load_dotenv(BACKEND_DIR / ".env")
    except ImportError:  # python-dotenv is optional at runtime
        pass
    app = Flask(__name__)
    app.config.update(load_config(overrides))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if app.config["CORS_ORIGINS"]:  # same-origin (Vite proxy / reverse proxy) needs no CORS at all
        CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True,
             allow_headers=["Content-Type", "X-CSRF-Token"], methods=["GET", "POST", "PUT", "PATCH", "DELETE"])

    app.teardown_appcontext(_db.close_db)
    app.before_request(require_json)
    app.before_request(csrf_protect)
    register_error_handlers(app)

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        if resp.mimetype == "application/json":
            resp.headers["Cache-Control"] = "no-store"
        return resp

    from .routes import admin, auth, opportunities, recruiter, students
    for m in (auth, students, opportunities, recruiter, admin):
        app.register_blueprint(m.bp)

    @app.get("/api/health")
    def health():
        return ok({"status": "ok"})

    return app
