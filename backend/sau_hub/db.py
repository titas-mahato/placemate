"""Thin MySQL helper: one pooled connection per request, parameterized queries only."""
import mysql.connector
from mysql.connector import pooling
from flask import current_app, g

_pools = {}


def _pool(app):
    key = (app.config["DB_HOST"], app.config["DB_PORT"], app.config["DB_NAME"], app.config["DB_USER"])
    if key not in _pools:
        _pools[key] = pooling.MySQLConnectionPool(
            pool_name=f"sau_{len(_pools)}", pool_size=app.config["DB_POOL_SIZE"], pool_reset_session=True,
            host=app.config["DB_HOST"], port=app.config["DB_PORT"], user=app.config["DB_USER"],
            password=app.config["DB_PASSWORD"], database=app.config["DB_NAME"], autocommit=False,
            charset="utf8mb4",
        )
    return _pools[key]


def get_db():
    if "db" not in g:
        g.db = _pool(current_app).get_connection()
    return g.db


def close_db(exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        try:
            if exc is not None:
                conn.rollback()
        finally:
            conn.close()  # returns the connection to the pool


def query_all(sql, params=()):
    cur = get_db().cursor(dictionary=True)
    try:
        cur.execute(sql, params)
        return cur.fetchall()
    finally:
        cur.close()


def query_one(sql, params=()):
    rows = query_all(sql, params)
    return rows[0] if rows else None


def execute(sql, params=()):
    """Runs a write. Caller decides when to commit() so multi-step operations stay atomic."""
    cur = get_db().cursor()
    try:
        cur.execute(sql, params)
        return cur.lastrowid
    finally:
        cur.close()


def commit():
    get_db().commit()


def rollback():
    get_db().rollback()


IntegrityError = mysql.connector.IntegrityError
DatabaseError = mysql.connector.Error
