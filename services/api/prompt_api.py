import json
import os
from datetime import datetime
from uuid import UUID

import psycopg2
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor, register_uuid


prompt_api = Blueprint("prompt_api", __name__)
register_uuid()
DSN = os.environ.get("POSTGRES_DSN", "host=localhost dbname=aisena user=aisena password=aisena_pw")
LOCAL_USER_ID = os.environ.get("PROMPT_LOCAL_USER_ID", "00000000-0000-4000-8000-000000000001")
ALLOW_LOCAL_AUTH = os.environ.get("PROMPT_ALLOW_LOCAL_AUTH", "false").lower() == "true"
PROMPT_STATUSES = {"Draft", "Active", "Archived"}
EDITABLE_STATUSES = {"Draft", "Active"}
IMPORTANT_FIELDS = ("title", "description", "prompt_text", "category", "status", "assignee_agent_id")

_prompt_executor = None


def configure_prompt_executor(executor):
    """Register the callback (agent_key, message, tool_actions) -> (result, status_code)
    used to run a prompt's text against its assigned agent."""
    global _prompt_executor
    _prompt_executor = executor

PROMPT_SELECT = """
    SELECT p.id, p.prompt_code, p.title, p.description, p.prompt_text, p.category,
           p.status, p.owner_user_id, owner.display_name AS owner_name,
           p.assignee_agent_id, agent.name AS assignee_agent_name, p.version,
           p.usage_count, p.created_at, p.updated_at, p.archived_at, p.deleted_at,
           COALESCE(array_agg(DISTINCT tag.name) FILTER (WHERE tag.id IS NOT NULL), '{}') AS tags
      FROM aisena_prompts p
      JOIN aisena_users owner ON owner.id = p.owner_user_id
 LEFT JOIN aisena_agents agent ON agent.id = p.assignee_agent_id
 LEFT JOIN aisena_prompt_tag_links link ON link.prompt_id = p.id
 LEFT JOIN aisena_prompt_tags tag ON tag.id = link.tag_id
"""
PROMPT_GROUP = """
 GROUP BY p.id, owner.display_name, agent.name
"""


def _connection():
    return psycopg2.connect(DSN)


def _json_value(value):
    if isinstance(value, (datetime, UUID)):
        return value.isoformat() if isinstance(value, datetime) else str(value)
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    return value


def _serialize(row):
    if row is None:
        return None
    return {key: _json_value(value) for key, value in dict(row).items()}


def _current_user(cursor):
    identity = request.headers.get("X-User-Id") or request.headers.get("X-Authenticated-User")
    if not identity and ALLOW_LOCAL_AUTH:
        identity = LOCAL_USER_ID
    if not identity:
        return None
    cursor.execute(
        """SELECT id, email, display_name, role FROM aisena_users
             WHERE active = true AND (id::text = %s OR lower(email) = lower(%s))""",
        (identity, identity),
    )
    return cursor.fetchone()


def _auth_error(user, roles=None):
    if user is None:
        return jsonify({"error": "Authentication is required"}), 401
    if roles and user["role"] not in roles:
        return jsonify({"error": "You do not have permission to perform this action"}), 403
    return None


def _can_modify(user, prompt):
    return user["role"] == "admin" or (
        user["role"] == "editor" and str(user["id"]) == str(prompt["owner_user_id"])
    )


def _normalize_tags(value):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Tags must be an array")
    result = []
    seen = set()
    for item in value:
        name = str(item).strip()
        if not name or len(name) > 80:
            raise ValueError("Tags must contain 1 to 80 characters")
        key = name.lower()
        if key not in seen:
            seen.add(key)
            result.append(name)
    return result


def _validate(data, partial=False):
    errors = {}
    if not partial or "title" in data:
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            errors["title"] = "Title is required"
        elif len(title.strip()) > 255:
            errors["title"] = "Title must be 255 characters or fewer"
    if not partial or "prompt_text" in data:
        text = data.get("prompt_text")
        if not isinstance(text, str) or not text.strip():
            errors["prompt_text"] = "Prompt text is required"
    if "description" in data and data["description"] is not None and not isinstance(data["description"], str):
        errors["description"] = "Description must be text"
    if "category" in data and data["category"] is not None:
        if not isinstance(data["category"], str) or len(data["category"].strip()) > 120:
            errors["category"] = "Category must be 120 characters or fewer"
    if "status" in data and data["status"] not in EDITABLE_STATUSES:
        errors["status"] = "Status must be Draft or Active"
    try:
        _normalize_tags(data.get("tags"))
    except ValueError as exc:
        errors["tags"] = str(exc)
    return errors


def _get_prompt(cursor, prompt_id, include_deleted=False, for_update=False):
    where = "p.id = %s"
    if not include_deleted:
        where += " AND p.deleted_at IS NULL"
    if for_update:
        cursor.execute(
            "SELECT id FROM aisena_prompts WHERE id = %s" + ("" if include_deleted else " AND deleted_at IS NULL") + " FOR UPDATE",
            (prompt_id,),
        )
        if cursor.fetchone() is None:
            return None
    cursor.execute(PROMPT_SELECT + f" WHERE {where}" + PROMPT_GROUP, (prompt_id,))
    return cursor.fetchone()


def _next_prompt_code(cursor):
    cursor.execute("SELECT pg_advisory_xact_lock(hashtext('aisena_prompts_prompt_code'))")
    cursor.execute(
        """SELECT COALESCE(MAX(substring(prompt_code FROM '[0-9]+$')::integer), 0) + 1 AS next_number
             FROM aisena_prompts WHERE prompt_code ~ '^PROMPT-[0-9]{6}$'"""
    )
    return f"PROMPT-{cursor.fetchone()['next_number']:06d}"


def _set_tags(cursor, prompt_id, tags):
    cursor.execute("DELETE FROM aisena_prompt_tag_links WHERE prompt_id = %s", (prompt_id,))
    for name in tags:
        cursor.execute(
            """INSERT INTO aisena_prompt_tags (name) VALUES (%s)
               ON CONFLICT DO NOTHING RETURNING id""",
            (name,),
        )
        row = cursor.fetchone()
        if row:
            tag_id = row["id"]
        else:
            cursor.execute("SELECT id FROM aisena_prompt_tags WHERE lower(name) = lower(%s)", (name,))
            tag_id = cursor.fetchone()["id"]
        cursor.execute(
            "INSERT INTO aisena_prompt_tag_links (prompt_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (prompt_id, tag_id),
        )


def _record_version(cursor, prompt, user_id, summary):
    cursor.execute(
        """INSERT INTO aisena_prompt_versions
               (prompt_id, version, title, description, prompt_text, category, status,
                assignee_agent_id, changed_by_user_id, change_summary)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            prompt["id"], prompt["version"], prompt["title"], prompt["description"],
            prompt["prompt_text"], prompt["category"], prompt["status"],
            prompt["assignee_agent_id"], user_id, summary,
        ),
    )


def _audit(cursor, prompt, user_id, action, changes=None):
    cursor.execute(
        """INSERT INTO aisena_prompt_audit (prompt_id, prompt_code, user_id, action, changes)
           VALUES (%s, %s, %s, %s, %s::jsonb)""",
        (prompt["id"], prompt["prompt_code"], user_id, action, json.dumps(changes or {})),
    )


def _validate_assignee(cursor, agent_id):
    if not agent_id:
        return None
    cursor.execute("SELECT id FROM aisena_agents WHERE id = %s AND active = true", (agent_id,))
    return agent_id if cursor.fetchone() else False


@prompt_api.route("/api/prompts/session", methods=["GET"])
def prompt_session():
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        return jsonify({"user": _serialize(user), "permissions": {
            "create": user["role"] in {"editor", "admin"},
            "admin": user["role"] == "admin",
        }})


@prompt_api.route("/api/prompts/meta", methods=["GET"])
def prompt_meta():
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        cursor.execute("SELECT DISTINCT category FROM aisena_prompts WHERE category IS NOT NULL AND deleted_at IS NULL ORDER BY category")
        categories = [row["category"] for row in cursor.fetchall()]
        cursor.execute("SELECT id, name FROM aisena_prompt_tags ORDER BY lower(name)")
        tags = cursor.fetchall()
        cursor.execute("SELECT id, key, name FROM aisena_agents WHERE active = true ORDER BY name")
        agents = cursor.fetchall()
        cursor.execute("SELECT id, display_name FROM aisena_users WHERE active = true ORDER BY display_name")
        users = cursor.fetchall()
        return jsonify({
            "categories": categories, "tags": [_serialize(row) for row in tags],
            "agents": [_serialize(row) for row in agents], "owners": [_serialize(row) for row in users],
        })


@prompt_api.route("/api/prompts", methods=["GET"])
def list_prompts():
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 20))))
    except ValueError:
        return jsonify({"error": "Pagination values must be integers"}), 400
    sort_map = {"title": "lower(p.title)", "created_at": "p.created_at", "updated_at": "p.updated_at", "usage_count": "p.usage_count"}
    sort = request.args.get("sort", "updated_at")
    direction = request.args.get("direction", "desc").lower()
    if sort not in sort_map or direction not in {"asc", "desc"}:
        return jsonify({"error": "Invalid sort option"}), 400

    where = ["p.deleted_at IS NULL"]
    params = []
    q = request.args.get("q", "").strip()
    if q:
        where.append("(p.title ILIKE %s OR p.description ILIKE %s OR p.prompt_text ILIKE %s OR p.category ILIKE %s OR EXISTS (SELECT 1 FROM aisena_prompt_tag_links sl JOIN aisena_prompt_tags st ON st.id = sl.tag_id WHERE sl.prompt_id = p.id AND st.name ILIKE %s))")
        params.extend([f"%{q}%"] * 5)
    for arg, column in (("category", "p.category"), ("status", "p.status"), ("owner", "p.owner_user_id::text"), ("agent", "p.assignee_agent_id")):
        value = request.args.get(arg)
        if value:
            where.append(f"{column} = %s")
            params.append(value)
    tags = request.args.getlist("tag")
    if len(tags) == 1 and "," in tags[0]:
        tags = [tag.strip() for tag in tags[0].split(",") if tag.strip()]
    if tags:
        where.append("(SELECT count(DISTINCT lower(ft.name)) FROM aisena_prompt_tag_links fl JOIN aisena_prompt_tags ft ON ft.id = fl.tag_id WHERE fl.prompt_id = p.id AND lower(ft.name) = ANY(%s)) = %s")
        params.extend([[tag.lower() for tag in tags], len(set(tag.lower() for tag in tags))])

    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        clause = " AND ".join(where)
        cursor.execute(f"SELECT count(*) AS total FROM aisena_prompts p WHERE {clause}", params)
        total = cursor.fetchone()["total"]
        cursor.execute(
            PROMPT_SELECT + f" WHERE {clause}" + PROMPT_GROUP +
            f" ORDER BY {sort_map[sort]} {direction} LIMIT %s OFFSET %s",
            params + [per_page, (page - 1) * per_page],
        )
        prompts = []
        for row in cursor.fetchall():
            prompt = _serialize(row)
            prompt["permissions"] = {"edit": _can_modify(user, row), "delete": _can_modify(user, row)}
            prompts.append(prompt)
        return jsonify({
            "prompts": prompts,
            "pagination": {"page": page, "per_page": per_page, "total": total, "pages": (total + per_page - 1) // per_page},
        })


@prompt_api.route("/api/prompts/<uuid:prompt_id>", methods=["GET"])
def get_prompt(prompt_id):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        payload = _serialize(prompt)
        payload["permissions"] = {"edit": _can_modify(user, prompt), "delete": _can_modify(user, prompt)}
        return jsonify({"prompt": payload})


@prompt_api.route("/api/prompts", methods=["POST"])
def create_prompt():
    data = request.get_json(silent=True) or {}
    errors = _validate(data)
    if errors:
        return jsonify({"error": "Validation failed", "fields": errors}), 400
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        assignee = _validate_assignee(cursor, data.get("assignee_agent_id"))
        if assignee is False:
            return jsonify({"error": "Assigned agent is not available"}), 400
        code = _next_prompt_code(cursor)
        cursor.execute(
            """INSERT INTO aisena_prompts
                   (prompt_code, title, description, prompt_text, category, status, owner_user_id, assignee_agent_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (code, data["title"].strip(), data.get("description") or None, data["prompt_text"],
             (data.get("category") or "").strip() or None, data.get("status") or "Draft", user["id"], assignee),
        )
        prompt_id = cursor.fetchone()["id"]
        _set_tags(cursor, prompt_id, _normalize_tags(data.get("tags")))
        prompt = _get_prompt(cursor, prompt_id)
        _record_version(cursor, prompt, user["id"], "Prompt created")
        _audit(cursor, prompt, user["id"], "created")
        return jsonify({"prompt": _serialize(prompt)}), 201


@prompt_api.route("/api/prompts/<uuid:prompt_id>", methods=["PUT"])
def update_prompt(prompt_id):
    data = request.get_json(silent=True) or {}
    errors = _validate(data, partial=True)
    if errors:
        return jsonify({"error": "Validation failed", "fields": errors}), 400
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        if not _can_modify(user, prompt):
            return jsonify({"error": "Only the owner or an administrator can edit this prompt"}), 403
        assignee = prompt["assignee_agent_id"]
        if "assignee_agent_id" in data:
            assignee = _validate_assignee(cursor, data.get("assignee_agent_id"))
            if assignee is False:
                return jsonify({"error": "Assigned agent is not available"}), 400
        values = {
            "title": data.get("title", prompt["title"]).strip(),
            "description": data.get("description", prompt["description"]) or None,
            "prompt_text": data.get("prompt_text", prompt["prompt_text"]),
            "category": (data.get("category", prompt["category"]) or "").strip() or None,
            "status": data.get("status", prompt["status"]),
            "assignee_agent_id": assignee,
        }
        changes = {field: {"from": _json_value(prompt[field]), "to": _json_value(values[field])} for field in IMPORTANT_FIELDS if prompt[field] != values[field]}
        tags = _normalize_tags(data.get("tags")) if "tags" in data else list(prompt["tags"])
        tags_changed = sorted(tag.lower() for tag in tags) != sorted(tag.lower() for tag in prompt["tags"])
        if not changes and not tags_changed:
            return jsonify({"prompt": _serialize(prompt)})
        new_version = prompt["version"] + 1
        cursor.execute(
            """UPDATE aisena_prompts SET title=%s, description=%s, prompt_text=%s, category=%s,
                      status=%s, assignee_agent_id=%s, version=%s, updated_at=now()
                 WHERE id=%s""",
            (values["title"], values["description"], values["prompt_text"], values["category"],
             values["status"], values["assignee_agent_id"], new_version, prompt_id),
        )
        _set_tags(cursor, prompt_id, tags)
        updated = _get_prompt(cursor, prompt_id)
        summary = (data.get("change_summary") or "Updated " + ", ".join(list(changes) + (["tags"] if tags_changed else []))).strip()[:500]
        _record_version(cursor, updated, user["id"], summary)
        _audit(cursor, updated, user["id"], "updated", changes)
        return jsonify({"prompt": _serialize(updated)})


def _status_action(prompt_id, target, action):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        if not _can_modify(user, prompt):
            return jsonify({"error": "Only the owner or an administrator can change this prompt"}), 403
        if prompt["status"] == target:
            return jsonify({"prompt": _serialize(prompt)})
        cursor.execute(
            """UPDATE aisena_prompts SET status=%s, version=version+1, updated_at=now(),
                      archived_at=CASE WHEN %s='Archived' THEN now() ELSE NULL END WHERE id=%s""",
            (target, target, prompt_id),
        )
        updated = _get_prompt(cursor, prompt_id)
        _record_version(cursor, updated, user["id"], f"Prompt {action}")
        _audit(cursor, updated, user["id"], action)
        return jsonify({"prompt": _serialize(updated)})


@prompt_api.route("/api/prompts/<uuid:prompt_id>/archive", methods=["POST"])
def archive_prompt(prompt_id):
    return _status_action(prompt_id, "Archived", "archived")


@prompt_api.route("/api/prompts/<uuid:prompt_id>/restore", methods=["POST"])
def restore_prompt(prompt_id):
    return _status_action(prompt_id, "Draft", "restored")


@prompt_api.route("/api/prompts/<uuid:prompt_id>", methods=["DELETE"])
def delete_prompt(prompt_id):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        if not _can_modify(user, prompt):
            return jsonify({"error": "Only the owner or an administrator can delete this prompt"}), 403
        _audit(cursor, prompt, user["id"], "deleted")
        cursor.execute("UPDATE aisena_prompts SET deleted_at=now(), updated_at=now() WHERE id=%s", (prompt_id,))
        return jsonify({"message": "Prompt deleted"})


@prompt_api.route("/api/prompts/<uuid:prompt_id>/copy", methods=["POST"])
def copy_prompt(prompt_id):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        cursor.execute("UPDATE aisena_prompts SET usage_count=usage_count+1 WHERE id=%s", (prompt_id,))
        prompt["usage_count"] += 1
        _audit(cursor, prompt, user["id"], "copied")
        return jsonify({"prompt_text": prompt["prompt_text"], "usage_count": prompt["usage_count"]})


@prompt_api.route("/api/prompts/<uuid:prompt_id>/duplicate", methods=["POST"])
def duplicate_prompt(prompt_id):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        source = _get_prompt(cursor, prompt_id)
        if not source:
            return jsonify({"error": "Prompt not found"}), 404
        code = _next_prompt_code(cursor)
        title = f"{source['title']} Copy"[:255]
        status = "Draft" if source["status"] == "Archived" else source["status"]
        cursor.execute(
            """INSERT INTO aisena_prompts
                   (prompt_code, title, description, prompt_text, category, status, owner_user_id, assignee_agent_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (code, title, source["description"], source["prompt_text"], source["category"], status, user["id"], source["assignee_agent_id"]),
        )
        new_id = cursor.fetchone()["id"]
        _set_tags(cursor, new_id, source["tags"])
        duplicate = _get_prompt(cursor, new_id)
        _record_version(cursor, duplicate, user["id"], f"Duplicated from {source['prompt_code']}")
        _audit(cursor, source, user["id"], "duplicated", {"duplicate_prompt_id": str(new_id), "duplicate_prompt_code": code})
        _audit(cursor, duplicate, user["id"], "created", {"source_prompt_id": str(source["id"])})
        return jsonify({"prompt": _serialize(duplicate)}), 201


@prompt_api.route("/api/prompts/<uuid:prompt_id>/versions", methods=["GET"])
def prompt_versions(prompt_id):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        if not _get_prompt(cursor, prompt_id):
            return jsonify({"error": "Prompt not found"}), 404
        cursor.execute(
            """SELECT v.*, u.display_name AS changed_by_name FROM aisena_prompt_versions v
                 JOIN aisena_users u ON u.id=v.changed_by_user_id
                WHERE v.prompt_id=%s ORDER BY v.version DESC""",
            (prompt_id,),
        )
        return jsonify({"versions": [_serialize(row) for row in cursor.fetchall()]})


@prompt_api.route("/api/prompts/<uuid:prompt_id>/versions/compare", methods=["GET"])
def compare_prompt_versions(prompt_id):
    try:
        versions = [int(request.args[name]) for name in ("from", "to")]
    except (KeyError, ValueError):
        return jsonify({"error": "from and to version numbers are required"}), 400
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        cursor.execute("SELECT * FROM aisena_prompt_versions WHERE prompt_id=%s AND version=ANY(%s) ORDER BY version", (prompt_id, versions))
        rows = {row["version"]: row for row in cursor.fetchall()}
        if any(version not in rows for version in versions):
            return jsonify({"error": "One or more versions were not found"}), 404
        changed = [field for field in IMPORTANT_FIELDS if rows[versions[0]][field] != rows[versions[1]][field]]
        return jsonify({"from": _serialize(rows[versions[0]]), "to": _serialize(rows[versions[1]]), "changed_fields": changed})


@prompt_api.route("/api/prompts/<uuid:prompt_id>/versions/<int:version>/restore", methods=["POST"])
def restore_prompt_version(prompt_id, version):
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user, {"editor", "admin"})
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        if not _can_modify(user, prompt):
            return jsonify({"error": "Only the owner or an administrator can restore a version"}), 403
        cursor.execute("SELECT * FROM aisena_prompt_versions WHERE prompt_id=%s AND version=%s", (prompt_id, version))
        source = cursor.fetchone()
        if not source:
            return jsonify({"error": "Version not found"}), 404
        new_version = prompt["version"] + 1
        cursor.execute(
            """UPDATE aisena_prompts SET title=%s, description=%s, prompt_text=%s, category=%s,
                      status=%s, assignee_agent_id=%s, version=%s, updated_at=now(),
                      archived_at=CASE WHEN %s='Archived' THEN now() ELSE NULL END WHERE id=%s""",
            (source["title"], source["description"], source["prompt_text"], source["category"], source["status"],
             source["assignee_agent_id"], new_version, source["status"], prompt_id),
        )
        restored = _get_prompt(cursor, prompt_id)
        _record_version(cursor, restored, user["id"], f"Restored version {version}")
        _audit(cursor, restored, user["id"], "version_restored", {"restored_version": version, "new_version": new_version})
        return jsonify({"prompt": _serialize(restored)})


def _execute_prompt(cursor, prompt, user, tool_actions):
    """Run prompt_text against its assigned agent via the configured executor;
    returns (result_dict, http_status)."""
    if not prompt["assignee_agent_id"]:
        return {"error": "Assign an agent to this prompt before running it."}, 400
    if _prompt_executor is None:
        return {"error": "No prompt executor is configured."}, 503
    reply_payload, _executor_status = _prompt_executor(prompt["assignee_agent_id"], prompt["prompt_text"], tool_actions)
    status = reply_payload.get("status", "error")
    success = status == "ready"
    if success:
        cursor.execute("UPDATE aisena_prompts SET usage_count=usage_count+1 WHERE id=%s", (prompt["id"],))
        prompt["usage_count"] += 1
    _audit(cursor, prompt, user["id"], "executed" if success else "execution_blocked", {"status": status})
    result = {
        "status": status,
        "reply": reply_payload.get("reply", ""),
        "prompt_code": prompt["prompt_code"],
        "agent_key": prompt["assignee_agent_id"],
        "executed_text_preview": prompt["prompt_text"][:280],
        "usage_count": prompt["usage_count"],
    }
    return result, 200


@prompt_api.route("/api/prompts/<uuid:prompt_id>/run", methods=["POST"])
def run_prompt(prompt_id):
    data = request.get_json(silent=True) or {}
    tool_actions = data.get("tool_actions") or []
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        prompt = _get_prompt(cursor, prompt_id, for_update=True)
        if not prompt:
            return jsonify({"error": "Prompt not found"}), 404
        result, status_code = _execute_prompt(cursor, prompt, user, tool_actions)
        return jsonify({"result": result}), status_code


@prompt_api.route("/api/prompts/run", methods=["POST"])
def run_prompts_batch():
    data = request.get_json(silent=True) or {}
    prompt_ids = data.get("prompt_ids")
    tool_actions = data.get("tool_actions") or []
    if not isinstance(prompt_ids, list) or not prompt_ids:
        return jsonify({"error": "prompt_ids must be a non-empty array"}), 400
    with _connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        user = _current_user(cursor)
        error = _auth_error(user)
        if error:
            return error
        succeeded = 0
        failed = 0
        results = []
        for prompt_id in prompt_ids:
            prompt = _get_prompt(cursor, prompt_id, for_update=True)
            if not prompt:
                failed += 1
                results.append({"prompt_id": prompt_id, "error": "Prompt not found"})
                continue
            result, status_code = _execute_prompt(cursor, prompt, user, tool_actions)
            results.append({"prompt_id": prompt_id, **result})
            if status_code == 200 and result.get("status") == "ready":
                succeeded += 1
            else:
                failed += 1
        return jsonify({
            "summary": {"selected": len(prompt_ids), "succeeded": succeeded, "failed": failed},
            "results": results,
        })