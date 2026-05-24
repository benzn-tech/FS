"""
export_to_aconex.py — FieldSightAI Lambda

Trigger: Invoked synchronously by the Next.js API route POST /api/sessions/[id]/export
         when platform = 'aconex'

Event payload:
{
  "session_id": "<uuid>",
  "org_id":     "<uuid>"
}

Responsibilities:
  1. Load the finalized transcript segments from DB
  2. Format them into an Aconex daily diary document
  3. POST the document to the Aconex API
  4. Write the result to export_log
  5. Update session status to EXPORTED on success

Aconex config is stored per-org in organisations.aconex_config JSONB:
  { "api_key": "...", "project_id": "...", "document_type": "Daily Diary" }

Environment variables:
  DB_CONNECTION_STRING — PostgreSQL DSN
  AWS_REGION           — e.g. ap-southeast-2
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import boto3
import requests

from shared.db import execute, execute_one

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Aconex base URL — real endpoint confirmed against Aconex API docs at integration time
ACONEX_API_BASE = "https://api.aconex.com/api"


def _format_diary(session: dict, segments: list[dict]) -> str:
    """Format transcript segments into a plain-text daily diary entry."""
    recorded = session.get("recorded_at", "")
    title = session.get("title") or f"Site Diary — {recorded}"

    lines = [
        f"DAILY SITE DIARY",
        f"Session: {title}",
        f"Date: {recorded}",
        f"Duration: {session.get('duration_secs', 0) // 60} minutes",
        "",
        "--- TRANSCRIPT ---",
        "",
    ]

    for seg in segments:
        speaker = seg.get("speaker_label", "SPEAKER_0")
        # Use edited text if available, otherwise the original Transcribe output
        text = seg.get("edited_text") or seg.get("original_text", "")
        start = seg.get("start_time", 0)
        mins, secs = divmod(int(start), 60)
        lines.append(f"[{mins:02d}:{secs:02d}] {speaker}: {text}")

    return "\n".join(lines)


def _write_export_log(session_id: str, status: str, payload: dict) -> None:
    try:
        execute(
            """
            INSERT INTO export_log (id, session_id, platform, status, response_payload)
            VALUES (%s, %s, 'aconex', %s, %s)
            """,
            (str(uuid.uuid4()), session_id, status, json.dumps(payload)),
        )
    except Exception as err:
        logger.error("Failed to write export_log: %s", err)


def handler(event: dict, context) -> dict:
    session_id: str = event["session_id"]
    org_id: str = event["org_id"]

    logger.info("Exporting session %s to Aconex for org %s", session_id, org_id)

    # ------------------------------------------------------------------
    # 1. Load session + org config
    # ------------------------------------------------------------------
    session = execute_one(
        """
        SELECT s.id, s.title, s.recorded_at, s.duration_secs, s.status,
               o.aconex_config
          FROM sessions s
          JOIN organisations o ON o.id = s.org_id
         WHERE s.id = %s AND s.org_id = %s
        """,
        (session_id, org_id),
    )
    if not session:
        raise ValueError(f"Session {session_id} not found for org {org_id}")

    aconex_config: dict = session.get("aconex_config") or {}
    api_key: str = aconex_config.get("api_key", "")
    project_id: str = aconex_config.get("project_id", "")
    document_type: str = aconex_config.get("document_type", "Daily Diary")

    if not api_key or not project_id:
        err = "Aconex is not configured for this organisation"
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
    # 3. Format diary document
    # ------------------------------------------------------------------
    diary_text = _format_diary(dict(session), [dict(s) for s in segments])

    # ------------------------------------------------------------------
    # 4. POST to Aconex API
    #    Aconex document upload: POST /api/projects/{project_id}/documents
    #    Ref: https://help.aconex.com/aconex/api-documents
    # ------------------------------------------------------------------
    upload_url = f"{ACONEX_API_BASE}/projects/{project_id}/documents"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "documentType": document_type,
        "title": session.get("title") or f"Site Diary {session.get('recorded_at', '')}",
        "content": diary_text,
    }

    try:
        resp = requests.post(upload_url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        response_body = resp.json()
        logger.info("Aconex export successful: %s", response_body)
    except requests.HTTPError as exc:
        err_body = exc.response.text if exc.response else str(exc)
        logger.error("Aconex API error: %s", err_body)
        _write_export_log(session_id, "FAILED", {"error": err_body, "status_code": exc.response.status_code if exc.response else None})
        raise
    except Exception as exc:
        logger.exception("Unexpected error exporting to Aconex")
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
        "body": json.dumps({"ok": True, "platform": "aconex", "session_id": session_id}),
    }
