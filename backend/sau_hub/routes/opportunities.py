from flask import Blueprint, g, request

from ..db import query_all
from ..domain import (TYPES, UNION_SQL, attach_skills, like, load_opportunity, page_meta, paginate_args,
                      public_opportunity, student_skill_names)
from ..errors import ApiError, ok
from ..security import require_role

bp = Blueprint("opportunities", __name__, url_prefix="/api")


def _applications_by_key(student_id):
    rows = query_all("SELECT application_id, status, internship_id, placement_id FROM applications WHERE student_id=%s", (student_id,))
    return {("Internship", r["internship_id"]) if r["internship_id"] else ("Placement", r["placement_id"]): r for r in rows}


@bp.get("/opportunities")
@require_role("student", "recruiter", "admin")
def browse():
    """Combined internship + placement feed. Students only ever see open listings of approved companies."""
    a = request.args
    where, params = ["o.company_approved = 1"], []
    if a.get("include_closed") != "1":
        where.append("o.is_active = 1 AND (o.deadline IS NULL OR o.deadline >= CURDATE())")
    typ = a.get("type")
    if typ:
        if typ not in TYPES:
            raise ApiError("type must be Internship or Placement", 400)
        where.append("o.type = %s")
        params.append(typ)
    if a.get("q"):
        where.append("(o.title LIKE %s OR o.company LIKE %s OR o.description LIKE %s)")
        params += [like(a["q"][:80])] * 3
    if a.get("location"):
        where.append("o.location LIKE %s")
        params.append(like(a["location"][:80]))
    if a.get("skill"):
        sk = a["skill"][:40]
        where.append("""((o.type='Internship' AND EXISTS (SELECT 1 FROM internship_required_skills r JOIN skills s ON s.skill_id=r.skill_id WHERE r.internship_id=o.id AND s.skill_name=%s))
                      OR (o.type='Placement' AND EXISTS (SELECT 1 FROM placement_required_skills r JOIN skills s ON s.skill_id=r.skill_id WHERE r.placement_id=o.id AND s.skill_name=%s)))""")
        params += [sk, sk]
    rows = query_all(f"SELECT o.* FROM ({UNION_SQL}) o WHERE {' AND '.join(where)} ORDER BY o.created_at DESC, o.id DESC LIMIT 1000", tuple(params))
    attach_skills(rows)

    student, apps = None, {}
    if g.role == "student":
        student = dict(g.user)
        student["_skills"] = student_skill_names(g.user["student_id"])
        apps = _applications_by_key(g.user["student_id"])
    items = [public_opportunity(r, student, apps.get((r["type"], r["id"]))) if student else public_opportunity(r) for r in rows]

    if student and a.get("eligible") == "1":
        items = [i for i in items if i["eligible"]]
    if student and a.get("hide_applied") == "1":
        items = [i for i in items if not i["applied"]]
    sort = a.get("sort", "newest")
    if sort == "deadline":
        items.sort(key=lambda i: (i["deadline"] is None, i["deadline"] or ""))
    elif sort == "match" and student:
        items.sort(key=lambda i: -i["skill_matches"])
    elif sort not in ("newest", "match"):
        raise ApiError("sort must be newest, deadline or match", 400)

    page, per = paginate_args()
    total = len(items)
    return ok({"data": items[(page - 1) * per: page * per], "pagination": page_meta(page, per, total)})


@bp.get("/opportunities/<typ>/<int:oid>")
@require_role("student", "recruiter", "admin")
def detail(typ, oid):
    opp = load_opportunity(typ, oid)
    if not opp["company_approved"] and g.role == "student":
        raise ApiError("Opportunity not found", 404)
    if g.role == "student":
        student = dict(g.user)
        student["_skills"] = student_skill_names(g.user["student_id"])
        app = _applications_by_key(g.user["student_id"]).get((typ, oid))
        return ok({"opportunity": public_opportunity(opp, student, app)})
    return ok({"opportunity": public_opportunity(opp)})
