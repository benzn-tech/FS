"""
export_to_safebase.py — FieldSightAI Lambda

Trigger: Invoked synchronously by the Next.js API route POST /api/sessions/[id]/export
         when platform = 'safebase'

Event payload:
{
  "session_id": "<uuid>",
  "org_id":     "<uuid>"
}

Responsibilities:
  1. Load the finalized transcript segments from DB
  2. Format them into a Safebase site diary record
  3. POST the record to the Safebase API
  4. Write the result to export_log
  5. Update session status to EXPORTED on success

Safebase config is stored per-org in organisations.safebase_config JSONB:
  { "api_key": "...", "workspace_id": "..." }

Environment variables:
  DB_CONNECTION_STRING — PostgreSQL DSN
  AWS_REGION           — e.g. ap-southeast-2
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import requests

from shared.db import execute, execute_one

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Safebase base URL — confirmed against Safebase API docs at integration time
SAFEBASE_API_BASE = "https://api.safebase.io/v1"


def _format_diary_entries(segments: list[dict]) -> list[dict]:
    """
    Convert transcript segments into Safebase diary entry records.
    Each segment becomes a timestamped observation entry.
    """
    entries = []
    for seg in segments:
        text = seg.get("edited_text") or seg.get("original_text", "")
        start = seg.get("start_time", 0)
        mins, secs = divmod(int(start), 60)
        entries.append(
            {
                "timestamp": f"{mins:02d}:{secs:02d}",
                "speaker": seg.get("speaker_label", "SPEAKER_0"),
                "observation": text,
            }
        )
    return entries


def _write_export_log(session_id: str, status: str, payload: dict) -> None:
    try:
        execute(
            """
            INSERT INTO export_log (id, session_id, platform, status, response_payload)
            VALUES (%s, %s, 'safebase', %s, %s)
            """,
            (str(uuid.uuid4()), session_id, status, json.dumps(payload)),
        )
    except Exception as err:
        logger.error("Failed to write export_log: %s", err)


def handler(event: dict, context) -> dict:
    session_id: str = event["session_id"]
    org_id: str = event["org_id"]

    logger.info("Exporting session %s to Safebase for org %s", session_id, org_id)

    # ------------------------------------------------------------------
    # 1. Load session + org config
    # ------------------------------------------------------------------
    session = execute_one(
        """
        SELECT s.id, s.title, s.recorded_at, s.duration_secs, s.status,
               o.safebase_config
          FROM sessions s
          JOIN organisations o ON o.id = s.org_id
         WHERE s.id = %s AND s.org_id = %s
        """,
        (session_id, org_id),
    )
    if not session:
        raise ValueError(f"Session {session_id} not found for org {org_id}")

    safebase_config: dict = session.get("safebase_config") or {}
    api_key: str = safebase_config.get("api_key", "")
    workspace_id: str = safebase_config.get("workspace_id", "")

    if not api_key or not workspace_id:
        err = "Safebase is not configured for this organisation"
        _write_export_log(session_id, "FAILED", {"error": err})
        raise ValueError(err)

    # ------------------------------------------------------------------
    # 2. Load finalized transcript segments
    # ------------------------------------------------------------------
    segments = execute(
        """
        SELECT segment_index, start_time, speaker_label,
               edited_text, original_text
          FROM transcript_segments
         WHERE session_id = %s
         ORDER BY segment_index
        """,
        (session_id,),
    )
    if not segments:
        err = "No transcript segments found — cannot export an empty transcript"
        _write_export_log(session_id, "FAILED", {"error": err})
        raise ValueError(err)

    # ------------------------------------------------------------------
    # 3. Format Safebase diary record
    # ------------------------------------------------------------------
    recorded_at = str(session.get("recorded_at", ""))
    diary_entries = _format_diary_entries([dict(s) for s in segments])

    safebase_payload = {
        "workspaceId": workspace_id,
        "type": "site_diary",
        "title": session.get("title") or f"Site Diary — {recorded_at}",
        "date": recorded_at,
        "duration_minutes": (session.get("duration_secs") or 0) // 60,
        "entries": diary_entries,
    }

    # ------------------------------------------------------------------
    # 4. POST to Safebase API
    #    Ref: https://docs.safebase.io/api/site-diaries
    # ------------------------------------------------------------------
    post_url = f"{SAFEBASE_API_BASE}/workspaces/{workspace_id}/diaries"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(post_url, json=safebase_payload, headers=headers, timeout=30)
        resp.raise_for_status()
        response_body = resp.json()
        logger.info("Safebase export successful: %s", response_body)
    except requests.HTTPError as exc:
        err_body = exc.response.text if exc.response else str(exc)
        logger.error("Safebase API error: %s", err_body)
        _write_export_log(
            session_id,
            "FAILED",
            {"error": err_body, "status_code": exc.response.status_code if exc.response else None},
        )
        raise
    except Exception as exc:
        logger.exception("Unexpected error exporting to Safebase")
        _write_export_log(session_id, "FAILED", {"error": str(exc)})
        raise

    # ------------------------------------------------------------------
    # 5. Write export_log + update session status
    # ------------------------------------------------------------------
    _write_export_log(session_id, "SUCCESS", response_body)
    execute(
        "UPDATE sessions SET status = 'EXPORTED', updated_at = NOW() WHERE id = %s",
        (session_id,),
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"ok": True, "platform": "safebase", "session_id": session_id}),
    }
