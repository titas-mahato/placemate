"""One consistent JSON shape for every response:
   success: {"success": true, ...payload}
   failure: {"success": false, "message": "...", "errors": {"field": "..."}}"""
import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

from .db import DatabaseError

log = logging.getLogger("sau_hub")


class ApiError(Exception):
    def __init__(self, message, status=400, errors=None):
        super().__init__(message)
        self.message, self.status, self.errors = message, status, errors or {}


def ok(payload=None, status=200):
    body = {"success": True}
    body.update(payload or {})
    return jsonify(body), status


def fail(message, status=400, errors=None):
    body = {"success": False, "message": message}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api(e):
        return fail(e.message, e.status, e.errors)

    @app.errorhandler(HTTPException)
    def _http(e):
        msgs = {404: "Resource not found", 405: "Method not allowed", 413: "Request is too large"}
        return fail(msgs.get(e.code, e.description or e.name), e.code)

    @app.errorhandler(DatabaseError)
    def _db(e):
        # Never leak SQL / schema details to the client; keep them in the server log.
        log.error("database error: %s", e)
        return fail("A database error occurred. Please try again.", 500)

    @app.errorhandler(Exception)
    def _any(e):
        log.exception("unhandled error")
        return fail("Internal server error", 500)
