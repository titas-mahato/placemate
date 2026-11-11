import csv
import io
import re

from flask import Blueprint, Response, request

from ..db import commit, execute, query_all, query_one
from ..domain import (
    ALL_STATUSES,
    TYPES,
    UNION_SQL,
    clean_row,
    like,
    list_applicants,
    page_meta,
    paginate_args,
    update_application,
)
from ..errors import ApiError, ok
from ..security import require_role
from ..validation import Fields
from .students import send_resume


bp = Blueprint("admin", __name__, url_prefix="/api/admin")

PLACED = (
    "EXISTS (SELECT 1 FROM applications a "
    "WHERE a.student_id = s.student_id AND a.status = 'Offered')"
)

SORTABLE = {
    "student_id": "s.student_id",
    "first_name": "s.first_name",
    "major": "s.major",
    "gpa": "s.gpa",
    "graduation_year": "s.graduation_year",
    "applications_count": "applications_count",
}


@bp.get("/stats")
@require_role("admin")
def stats():
    def one(sql, params=()):
        row = query_one(sql, params)
        return list(row.values())[0] if row else 0

    total = one("SELECT COUNT(*) AS total FROM students")
    placed = one(
        f"SELECT COUNT(*) AS total FROM students s WHERE {PLACED}"
    )

    by_status = {status: 0 for status in ALL_STATUSES}
    for row in query_all(
        "SELECT status, COUNT(*) AS n FROM applications GROUP BY status"
    ):
        by_status[row["status"]] = row["n"]

    open_clause = (
        "is_active = 1 AND "
        "(deadline IS NULL OR deadline >= CURDATE())"
    )

    # Existing database stores placement packages in salary_package (VARCHAR).
    # Extract numeric text before averaging values such as "12 LPA".
    avg = one(
        """
        SELECT AVG(
            CAST(
                NULLIF(
                    REGEXP_REPLACE(p.salary_package, '[^0-9.]', ''),
                    ''
                ) AS DECIMAL(10,2)
            )
        ) AS avg_package
        FROM applications a
        JOIN placement_listings p
            ON p.placement_id = a.placement_id
        WHERE a.status = 'Offered'
        """
    )

    top_companies = query_all(
        f"""
        SELECT o.company AS name, COUNT(*) AS n
        FROM applications a
        JOIN ({UNION_SQL}) o
            ON (
                o.type = 'Internship'
                AND o.id = a.internship_id
            )
            OR (
                o.type = 'Placement'
                AND o.id = a.placement_id
            )
        WHERE a.status = 'Offered'
        GROUP BY o.company
        ORDER BY n DESC
        LIMIT 5
        """
    )

    return ok({
        "students_total": total,
        "students_placed": placed,
        "placement_rate": round(100 * placed / total, 1) if total else 0,
        "students_with_applications": one(
            "SELECT COUNT(DISTINCT student_id) AS total FROM applications"
        ),
        "avg_offered_package_lpa": (
            round(float(avg), 2) if avg is not None else None
        ),
        "recruiters": {
            row["status"]: row["n"]
            for row in query_all(
                "SELECT status, COUNT(*) AS n "
                "FROM recruiters GROUP BY status"
            )
        },
        "companies_total": one(
            "SELECT COUNT(*) AS total FROM companies"
        ),
        "companies_pending": one(
            "SELECT COUNT(*) AS total FROM companies "
            "WHERE is_approved = 0"
        ),
        "open_internships": one(
            f"SELECT COUNT(*) AS total FROM internship_listings "
            f"WHERE {open_clause}"
        ),
        "open_placements": one(
            f"SELECT COUNT(*) AS total FROM placement_listings "
            f"WHERE {open_clause}"
        ),
        "applications_total": sum(by_status.values()),
        "applications_by_status": by_status,
        "applications_by_month": [
            {"month": row["m"], "count": row["n"]}
            for row in query_all(
                """
                SELECT DATE_FORMAT(applied_at, '%Y-%m') AS m,
                       COUNT(*) AS n
                FROM applications
                WHERE applied_at >= DATE_SUB(
                    CURDATE(), INTERVAL 6 MONTH
                )
                GROUP BY m
                ORDER BY m
                """
            )
        ],
        "placement_by_major": [
            {
                "major": row["major"] or "Unspecified",
                "students": row["students"],
                "placed": int(row["placed"] or 0),
            }
            for row in query_all(
                f"""
                SELECT s.major,
                       COUNT(*) AS students,
                       SUM({PLACED}) AS placed
                FROM students s
                GROUP BY s.major
                ORDER BY students DESC
                LIMIT 12
                """
            )
        ],
        "top_hiring_companies": [
            {"company": row["name"], "offers": row["n"]}
            for row in top_companies
        ],
    })


def _student_query(args, paginate=True):
    where, params = [], []

    if args.get("q"):
        where.append(
            "(s.first_name LIKE %s OR s.last_name LIKE %s "
            "OR s.student_id LIKE %s OR s.email LIKE %s)"
        )
        params += [like(args["q"][:60])] * 4

    if args.get("major"):
        where.append("s.major = %s")
        params.append(args["major"])

    for key, col, op, cast in (
        ("gpa_min", "s.gpa", ">=", float),
        ("gpa_max", "s.gpa", "<=", float),
        ("year_min", "s.graduation_year", ">=", int),
        ("year_max", "s.graduation_year", "<=", int),
    ):
        if args.get(key):
            try:
                params.append(cast(args[key]))
            except (ValueError, TypeError):
                raise ApiError(f"{key} must be a number", 400)
            where.append(f"{col} {op} %s")

    if args.get("skill"):
        where.append(
            "EXISTS (SELECT 1 FROM student_skills ss "
            "JOIN skills k ON k.skill_id = ss.skill_id "
            "WHERE ss.student_id = s.student_id "
            "AND k.skill_name = %s)"
        )
        params.append(args["skill"])

    if args.get("placed") in ("0", "1"):
        where.append(
            ("" if args["placed"] == "1" else "NOT ") + PLACED
        )

    if args.get("status") in ALL_STATUSES:
        where.append(
            "EXISTS (SELECT 1 FROM applications a "
            "WHERE a.student_id = s.student_id AND a.status = %s)"
        )
        params.append(args["status"])

    key = SORTABLE.get(args.get("sort_by", "student_id"))
    if key is None:
        raise ApiError("Invalid sort_by", 400)

    direction = "DESC" if args.get("sort_dir") == "desc" else "ASC"

    base = (
        "SELECT s.student_id, s.first_name, s.last_name, s.email, "
        "s.major, s.graduation_year, s.gpa, s.is_active, "
        "(s.resume_path IS NOT NULL) AS has_resume, "
        "(SELECT COUNT(*) FROM applications a "
        "WHERE a.student_id = s.student_id) AS applications_count, "
        f"{PLACED} AS placed FROM students s"
        + (" WHERE " + " AND ".join(where) if where else "")
    )

    return base, params, (
        f" ORDER BY {key} {direction}, s.student_id ASC"
    )


def _with_skills(rows):
    if not rows:
        return rows

    marks = ",".join(["%s"] * len(rows))
    by = {}

    for row in query_all(
        f"""
        SELECT ss.student_id, k.skill_name
        FROM student_skills ss
        JOIN skills k ON k.skill_id = ss.skill_id
        WHERE ss.student_id IN ({marks})
        ORDER BY k.skill_name
        """,
        tuple(row["student_id"] for row in rows),
    ):
        by.setdefault(row["student_id"], []).append(row["skill_name"])

    for row in rows:
        row["skills"] = by.get(row["student_id"], [])
        row["placed"] = bool(row["placed"])
        row["is_active"] = bool(row["is_active"])
        row["has_resume"] = bool(row["has_resume"])

    return rows


@bp.get("/students")
@require_role("admin")
def students():
    base, params, order = _student_query(request.args)
    page, per = paginate_args(default=25, maximum=100)

    total = query_one(
        f"SELECT COUNT(*) AS n FROM ({base}) t", tuple(params)
    )["n"]

    rows = query_all(
        base + order + " LIMIT %s OFFSET %s",
        tuple(params) + (per, (page - 1) * per),
    )

    data = [clean_row(row) for row in _with_skills(rows)]
    return ok({"data": data, "pagination": page_meta(page, per, total)})


def _csv_safe(value):
    text = "" if value is None else str(value)
    if text[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


@bp.get("/students/export.csv")
@require_role("admin")
def export_students():
    base, params, order = _student_query(request.args)
    rows = _with_skills(query_all(base + order, tuple(params)))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Student ID", "Name", "Email", "Major",
        "Graduation Year", "GPA", "Applications",
        "Placed", "Skills",
    ])

    for row in rows:
        writer.writerow([
            _csv_safe(value)
            for value in (
                row["student_id"],
                f"{row['first_name']} {row['last_name']}".strip(),
                row["email"],
                row["major"],
                row["graduation_year"],
                row["gpa"],
                row["applications_count"],
                "Yes" if row["placed"] else "No",
                "; ".join(row["skills"]),
            )
        ])

    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=students.csv"
        },
    )


@bp.get("/filters")
@require_role("admin")
def filters():
    return ok({
        "majors": [
            row["major"]
            for row in query_all(
                "SELECT DISTINCT major FROM students "
                "WHERE major IS NOT NULL AND major <> '' ORDER BY major"
            )
        ],
        "skills": [
            row["skill_name"]
            for row in query_all(
                "SELECT skill_name FROM skills ORDER BY skill_name"
            )
        ],
    })


def _toggle(table, key, ident, field, label):
    data = request.get_json(silent=True) or {}

    if not isinstance(data.get(field), bool):
        raise ApiError(
            f"{field} must be true or false",
            400,
            {field: "Must be true or false"},
        )

    if not query_one(
        f"SELECT 1 FROM {table} WHERE {key} = %s", (ident,)
    ):
        raise ApiError(f"{label} not found", 404)

    execute(
        f"UPDATE {table} SET {field} = %s WHERE {key} = %s",
        (int(data[field]), ident),
    )
    commit()
    return ok({"message": f"{label} updated"})


@bp.patch("/students/<sid>")
@require_role("admin")
def set_student_active(sid):
    return _toggle("students", "student_id", sid, "is_active", "Student")


@bp.get("/students/<sid>/resume")
@require_role("admin")
def student_resume(sid):
    row = query_one(
        "SELECT resume_path, resume_name FROM students WHERE student_id = %s",
        (sid,),
    )
    if not row:
        raise ApiError("Student not found", 404)
    return send_resume(row)


@bp.get("/recruiters")
@require_role("admin")
def recruiters():
    where, params = "", ()

    if request.args.get("status"):
        where, params = " WHERE r.status = %s", (request.args["status"],)

    rows = query_all(
        "SELECT r.recruiter_id, r.name, r.email, r.status, r.created_at, "
        "c.company_id, c.name AS company, "
        "c.is_approved AS company_approved "
        "FROM recruiters r "
        "JOIN companies c ON c.company_id = r.company_id"
        + where
        + " ORDER BY FIELD(r.status,'pending','approved','suspended','rejected'), "
        "r.created_at DESC",
        params,
    )

    result = []
    for row in rows:
        data = clean_row(row)
        data["company_approved"] = bool(row["company_approved"])
        result.append(data)

    return ok({"data": result})


@bp.patch("/recruiters/<int:rid>")
@require_role("admin")
def set_recruiter_status(rid):
    fields = Fields(request.get_json(silent=True))
    status = fields.choice(
        "status", ["approved", "rejected", "suspended", "pending"]
    )
    fields.check()

    row = query_one(
        "SELECT company_id FROM recruiters WHERE recruiter_id = %s",
        (rid,),
    )
    if not row:
        raise ApiError("Recruiter not found", 404)

    execute(
        "UPDATE recruiters SET status = %s WHERE recruiter_id = %s",
        (status, rid),
    )

    if status == "approved":
        execute(
            "UPDATE companies SET is_approved = 1 WHERE company_id = %s",
            (row["company_id"],),
        )

    commit()
    return ok({"message": f"Recruiter {status}"})


@bp.get("/companies")
@require_role("admin")
def companies():
    rows = query_all(
        "SELECT c.company_id, c.name, c.headquarters_location, "
        "c.website, c.is_approved, "
        "(SELECT COUNT(*) FROM recruiters r "
        "WHERE r.company_id = c.company_id) AS recruiters, "
        "(SELECT COUNT(*) FROM internship_listings i "
        "WHERE i.company_id = c.company_id) + "
        "(SELECT COUNT(*) FROM placement_listings p "
        "WHERE p.company_id = c.company_id) AS listings "
        "FROM companies c "
        "ORDER BY c.is_approved ASC, c.name"
    )

    return ok({
        "data": [
            dict(clean_row(row), is_approved=bool(row["is_approved"]))
            for row in rows
        ]
    })


@bp.patch("/companies/<int:cid>")
@require_role("admin")
def set_company_approved(cid):
    return _toggle("companies", "company_id", cid, "is_approved", "Company")


@bp.get("/opportunities")
@require_role("admin")
def opportunities():
    where, params = [], []

    if request.args.get("type") in TYPES:
        where.append("o.type = %s")
        params.append(request.args["type"])

    if request.args.get("status") == "open":
        where.append(
            "o.is_active = 1 AND "
            "(o.deadline IS NULL OR o.deadline >= CURDATE())"
        )
    elif request.args.get("status") == "closed":
        where.append("(o.is_active = 0 OR o.deadline < CURDATE())")

    if request.args.get("q"):
        where.append("(o.title LIKE %s OR o.company LIKE %s)")
        params += [like(request.args["q"][:80])] * 2

    sql = (
        f"SELECT o.type, o.id, o.title, o.company, o.location, "
        "o.deadline, o.is_active, o.created_at, "
        "(SELECT COUNT(*) FROM applications a "
        "WHERE (o.type = 'Internship' AND a.internship_id = o.id) "
        "OR (o.type = 'Placement' AND a.placement_id = o.id)) AS applicants "
        f"FROM ({UNION_SQL}) o"
        + (" WHERE " + " AND ".join(where) if where else "")
    )

    page, per = paginate_args(default=25, maximum=100)
    total = query_one(
        f"SELECT COUNT(*) AS n FROM ({sql}) t", tuple(params)
    )["n"]

    rows = query_all(
        sql + " ORDER BY o.created_at DESC LIMIT %s OFFSET %s",
        tuple(params) + (per, (page - 1) * per),
    )

    return ok({
        "data": [
            dict(clean_row(row), is_active=bool(row["is_active"]))
            for row in rows
        ],
        "pagination": page_meta(page, per, total),
    })


@bp.patch("/opportunities/<typ>/<int:oid>")
@require_role("admin")
def set_opportunity_active(typ, oid):
    if typ not in TYPES:
        raise ApiError("Opportunity not found", 404)

    table_info = TYPES[typ]
    return _toggle(
        table_info["table"],
        table_info["id"],
        oid,
        "is_active",
        "Opportunity",
    )


@bp.get("/applications")
@require_role("admin")
def applications():
    where, params = [], []
    args = request.args

    if args.get("status") in ALL_STATUSES:
        where.append("a.status = %s")
        params.append(args["status"])

    if args.get("type") in TYPES:
        where.append("o.type = %s")
        params.append(args["type"])

    if args.get("q"):
        where.append(
            "(s.first_name LIKE %s OR s.last_name LIKE %s "
            "OR s.student_id LIKE %s OR o.title LIKE %s "
            "OR o.company LIKE %s)"
        )
        params += [like(args["q"][:60])] * 5

    page, per = paginate_args(default=25, maximum=100)
    rows, meta = list_applicants(where, params, page, per)
    return ok({"data": rows, "pagination": meta})


@bp.patch("/applications/<int:app_id>")
@require_role("admin")
def override_application(app_id):
    fields = Fields(request.get_json(silent=True))
    status = fields.choice("status", ALL_STATUSES, required=False)
    note = fields.text("recruiter_note", max_len=1000)
    fields.check()

    if status is None and "recruiter_note" not in fields.data:
        raise ApiError("Provide a status and/or recruiter_note", 400)

    row = update_application(
        app_id,
        status,
        note if "recruiter_note" in fields.data else None,
    )

    return ok({
        "message": "Application updated",
        "application": clean_row(row),
    })