"""Business rules shared by the student, recruiter and admin routes."""

from datetime import date
from decimal import Decimal

from flask import request

from .db import execute, query_all, query_one
from .errors import ApiError


TYPES = {
    "Internship": {
        "table": "internship_listings",
        "id": "internship_id",
        "skills": "internship_required_skills",
        "app_col": "internship_id",
    },
    "Placement": {
        "table": "placement_listings",
        "id": "placement_id",
        "skills": "placement_required_skills",
        "app_col": "placement_id",
    },
}

OPEN_CLAUSE = (
    "o.is_active = 1 AND "
    "(o.deadline IS NULL OR o.deadline >= CURDATE())"
)


# Both SELECT statements must return the same columns in the same order.
# Placement database columns are mapped to shared application names.
UNION_SQL = """
SELECT
    'Internship' AS type,
    i.internship_id AS id,
    i.company_id,
    c.name AS company,
    c.is_approved AS company_approved,
    i.title AS title,
    i.description,
    COALESCE(i.location, c.headquarters_location) AS location,
    CAST(i.stipend AS CHAR) AS salary,
    i.deadline,
    i.min_gpa,
    i.min_grad_year,
    i.max_grad_year,
    i.is_active,
    i.recruiter_id,
    i.created_at
FROM internship_listings i
JOIN companies c ON c.company_id = i.company_id

UNION ALL

SELECT
    'Placement' AS type,
    p.placement_id AS id,
    p.company_id,
    c.name AS company,
    c.is_approved AS company_approved,
    p.title AS title,
    p.description,
    COALESCE(p.location, c.headquarters_location) AS location,
    CAST(p.package_lpa AS CHAR) AS salary,
    p.deadline,
    p.min_gpa,
    p.min_grad_year,
    p.max_grad_year,
    p.is_active,
    p.recruiter_id,
    p.created_at
FROM placement_listings p
JOIN companies c ON c.company_id = p.company_id
"""


# Application lifecycle.
# Recruiters/admins may only move forward along these edges.
TRANSITIONS = {
    "Applied": {"Under Review", "Shortlisted", "Rejected"},
    "Under Review": {"Shortlisted", "Interview", "Rejected"},
    "Shortlisted": {"Interview", "Offered", "Rejected"},
    "Interview": {"Offered", "Rejected"},
    "Offered": set(),
    "Rejected": set(),
    "Withdrawn": set(),
}

STUDENT_WITHDRAWABLE = {
    "Applied",
    "Under Review",
    "Shortlisted",
    "Interview",
}

ALL_STATUSES = list(TRANSITIONS.keys())


def paginate_args(default=20, maximum=50):
    try:
        page = max(int(request.args.get("page", 1)), 1)
        per = min(
            max(int(request.args.get("per_page", default)), 1),
            maximum,
        )
    except (ValueError, TypeError):
        raise ApiError("page and per_page must be integers", 400)

    return page, per


def page_meta(page, per, total):
    return {
        "page": page,
        "per_page": per,
        "total": total,
        "pages": max((total + per - 1) // per, 1),
    }


def jsonable(value):
    if isinstance(value, Decimal):
        return float(value)

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def clean_row(row):
    return {key: jsonable(value) for key, value in row.items()}


def like(value):
    """Escape LIKE wildcards in user input."""
    return (
        "%"
        + value.replace("\\", "\\\\")
        .replace("%", r"\%")
        .replace("_", r"\_")
        + "%"
    )


# ---------- Skills ----------


def get_or_create_skill_ids(names):
    ids = []

    for name in names:
        row = query_one(
            "SELECT skill_id FROM skills "
            "WHERE LOWER(skill_name) = LOWER(%s)",
            (name,),
        )

        if row:
            ids.append(row["skill_id"])
        else:
            ids.append(
                execute(
                    "INSERT INTO skills (skill_name) VALUES (%s)",
                    (name,),
                )
            )

    return ids


def set_listing_skills(typ, listing_id, names):
    listing = TYPES[typ]

    execute(
        f"DELETE FROM {listing['skills']} "
        f"WHERE {listing['id']} = %s",
        (listing_id,),
    )

    for skill_id in get_or_create_skill_ids(names):
        execute(
            f"INSERT IGNORE INTO {listing['skills']} "
            f"({listing['id']}, skill_id) VALUES (%s, %s)",
            (listing_id, skill_id),
        )


def set_student_skills(student_id, names):
    execute(
        "DELETE FROM student_skills WHERE student_id = %s",
        (student_id,),
    )

    for skill_id in get_or_create_skill_ids(names):
        execute(
            "INSERT IGNORE INTO student_skills "
            "(student_id, skill_id) VALUES (%s, %s)",
            (student_id, skill_id),
        )


def student_skill_names(student_id):
    rows = query_all(
        """
        SELECT s.skill_name
        FROM student_skills ss
        JOIN skills s ON s.skill_id = ss.skill_id
        WHERE ss.student_id = %s
        ORDER BY s.skill_name
        """,
        (student_id,),
    )

    return [row["skill_name"] for row in rows]


def attach_skills(rows):
    """Attach skill names to opportunities using batched queries."""
    for typ, listing in TYPES.items():
        ids = [
            row["id"]
            for row in rows
            if row["type"] == typ
        ]

        if not ids:
            continue

        marks = ",".join(["%s"] * len(ids))

        found = query_all(
            f"""
            SELECT x.{listing['id']} AS oid, s.skill_name
            FROM {listing['skills']} x
            JOIN skills s ON s.skill_id = x.skill_id
            WHERE x.{listing['id']} IN ({marks})
            ORDER BY s.skill_name
            """,
            tuple(ids),
        )

        by_id = {}

        for item in found:
            by_id.setdefault(item["oid"], []).append(
                item["skill_name"]
            )

        for row in rows:
            if row["type"] == typ:
                row["skills"] = by_id.get(row["id"], [])

    return rows


# ---------- Eligibility ----------


def eligibility(student, opp):
    """Return whether a student is eligible and any reasons why not."""
    reasons = []

    if not opp["is_active"]:
        reasons.append("This opportunity is closed")
    elif (
        opp["deadline"] is not None
        and opp["deadline"] < date.today()
    ):
        reasons.append("The application deadline has passed")

    if student is not None:
        if (
            opp["min_gpa"] is not None
            and (
                student["gpa"] is None
                or float(student["gpa"]) < float(opp["min_gpa"])
            )
        ):
            reasons.append(
                f"Minimum CGPA of {float(opp['min_gpa']):g} required"
            )

        graduation_year = student["graduation_year"]

        if (
            opp["min_grad_year"] is not None
            and (
                graduation_year is None
                or graduation_year < opp["min_grad_year"]
            )
        ):
            reasons.append(
                f"Open to graduation year "
                f"{opp['min_grad_year']} or later"
            )

        if (
            opp["max_grad_year"] is not None
            and (
                graduation_year is None
                or graduation_year > opp["max_grad_year"]
            )
        ):
            reasons.append(
                f"Open to graduation year "
                f"{opp['max_grad_year']} or earlier"
            )

    return not reasons, reasons


def public_opportunity(row, student=None, applied=None):
    data = clean_row(row)

    data.pop("recruiter_id", None)
    data.pop("company_approved", None)

    data["is_open"] = bool(row["is_active"]) and (
        row["deadline"] is None
        or row["deadline"] >= date.today()
    )

    data["opportunity_key"] = f"{row['type']}-{row['id']}"

    if student is not None:
        eligible, reasons = eligibility(student, row)

        data["eligible"] = eligible
        data["ineligible_reasons"] = reasons
        data["applied"] = applied is not None
        data["application_status"] = (
            applied["status"] if applied else None
        )
        data["application_id"] = (
            applied["application_id"] if applied else None
        )

        my_skills = {
            skill.lower()
            for skill in student.get("_skills", [])
        }

        data["skill_matches"] = sum(
            1
            for skill in row.get("skills", [])
            if skill.lower() in my_skills
        )

    return data


def load_opportunity(typ, oid):
    if typ not in TYPES:
        raise ApiError("Unknown opportunity type", 404)

    row = query_one(
        f"""
        SELECT o.*
        FROM ({UNION_SQL}) o
        WHERE o.type = %s AND o.id = %s
        """,
        (typ, oid),
    )

    if not row:
        raise ApiError("Opportunity not found", 404)

    return attach_skills([row])[0]


def application_target(typ, oid):
    return TYPES[typ]["app_col"], oid


# ---------- Applicant review ----------


APPLICANT_SELECT = f"""
SELECT
    a.application_id,
    a.status,
    a.cover_note,
    a.recruiter_note,
    a.applied_at,
    a.updated_at,
    o.type,
    o.id AS opportunity_id,
    o.title,
    o.company,
    o.company_id,
    s.student_id,
    s.first_name,
    s.last_name,
    s.email,
    s.major,
    s.gpa,
    s.graduation_year,
    s.phone,
    s.bio,
    (s.resume_path IS NOT NULL) AS has_resume
FROM applications a
JOIN students s ON s.student_id = a.student_id
JOIN ({UNION_SQL}) o
    ON (
        o.type = 'Internship'
        AND o.id = a.internship_id
    )
    OR (
        o.type = 'Placement'
        AND o.id = a.placement_id
    )
"""


def list_applicants(where=None, params=(), page=1, per=20):
    where = list(where or [])
    base = APPLICANT_SELECT

    if where:
        base += " WHERE " + " AND ".join(where)

    total_row = query_one(
        f"SELECT COUNT(*) AS n FROM ({base}) AS t",
        tuple(params),
    )
    total = total_row["n"]

    rows = query_all(
        base
        + " ORDER BY a.applied_at DESC, a.application_id DESC"
        + " LIMIT %s OFFSET %s",
        tuple(params) + (per, (page - 1) * per),
    )

    student_ids = [row["student_id"] for row in rows]
    skills_by_student = {}

    if student_ids:
        marks = ",".join(["%s"] * len(student_ids))

        skill_rows = query_all(
            f"""
            SELECT ss.student_id, s.skill_name
            FROM student_skills ss
            JOIN skills s ON s.skill_id = ss.skill_id
            WHERE ss.student_id IN ({marks})
            ORDER BY s.skill_name
            """,
            tuple(student_ids),
        )

        for skill in skill_rows:
            skills_by_student.setdefault(
                skill["student_id"], []
            ).append(skill["skill_name"])

    result = []

    for row in rows:
        data = clean_row(row)
        data["has_resume"] = bool(row["has_resume"])
        data["skills"] = skills_by_student.get(
            row["student_id"], []
        )
        result.append(data)

    return result, page_meta(page, per, total)


def update_application(
    app_id,
    status=None,
    note=None,
    company_id=None,
):
    """Update an application while enforcing status and company ownership."""
    from .db import commit

    row = query_one(
        f"""
        SELECT a.application_id, a.status, o.company_id
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
        WHERE a.application_id = %s
        """,
        (app_id,),
    )

    if (
        not row
        or (
            company_id is not None
            and row["company_id"] != company_id
        )
    ):
        raise ApiError("Application not found", 404)

    locked = query_one(
        "SELECT status FROM applications "
        "WHERE application_id = %s FOR UPDATE",
        (app_id,),
    )

    if not locked:
        raise ApiError("Application not found", 404)

    current = locked["status"]

    if status is not None and status != current:
        if status not in TRANSITIONS[current]:
            allowed = sorted(TRANSITIONS[current])
            raise ApiError(
                f"Cannot move an application from "
                f"'{current}' to '{status}'",
                409,
                {"allowed": allowed},
            )

        execute(
            "UPDATE applications SET status = %s "
            "WHERE application_id = %s",
            (status, app_id),
        )

    if note is not None:
        execute(
            "UPDATE applications SET recruiter_note = %s "
            "WHERE application_id = %s",
            (note or None, app_id),
        )

    commit()

    return query_one(
        """
        SELECT application_id, status, recruiter_note, updated_at
        FROM applications
        WHERE application_id = %s
        """,
        (app_id,),
    )