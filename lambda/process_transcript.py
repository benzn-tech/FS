"""
process_transcript.py — FieldSightAI Lambda

Trigger: EventBridge rule 'fieldsightai-transcribe-job-complete'
         (AWS Transcribe emits Transcribe Job State Change events to the default bus)

Responsibilities:
  1. Check whether the Transcribe job completed successfully or failed
  2. On FAILED: update session status to FAILED with the failure reason
  3. On COMPLETED:
     a. Download the raw transcript JSON from S3
     b. Parse it into segments: { segment_index, start_time, end_time, speaker_label, original_text }
     c. Store segments in the DB (transcript_segments table)
     d. Update session status to READY

Environment variables:
  DB_CONNECTION_STRING  — PostgreSQL DSN
  S3_TRANSCRIPT_BUCKET  — bucket where Transcribe wrote its output (fieldsightai-transcripts)
  AWS_REGION            — e.g. ap-southeast-2
"""
import json
import logging
import os
from typing import Any

import boto3

from shared.db import execute, execute_one

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
S3_TRANSCRIPT_BUCKET = os.environ.get("S3_TRANSCRIPT_BUCKET", "fieldsightai-transcripts")


def _set_failed(session_id: str, error: str) -> None:
    try:
        execute(
            """
            UPDATE sessions
               SET status = 'FAILED', error_message = %s, updated_at = NOW()
             WHERE id = %s
            """,
            (error[:2000], session_id),
        )
    except Exception as db_err:
        logger.error("Could not set FAILED on session %s: %s", session_id, db_err)


def _parse_segments(transcript_json: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse Amazon Transcribe output into flat segment list.

    Transcribe JSON structure:
      results.items[]         — words with type 'pronunciation' or 'punctuation'
      results.speaker_labels  — per-word speaker assignments (when diarization enabled)
      results.segments[]      — sentence-level groupings (when available)

    We use sentence segments when present; fall back to grouping pronunciation items
    by gaps > 2 seconds to form pseudo-sentences.
    """
    results = transcript_json.get("results", {})

    # Prefer the high-level segments if Transcribe produced them
    raw_segments = results.get("segments", [])
    items = results.get("items", [])

    # Build a speaker map: start_time → speaker_label (from speaker_labels section)
    speaker_map: dict[str, str] = {}
    speaker_labels_data = results.get("speaker_labels") or {}
    for seg in speaker_labels_data.get("segments", []):
        for item in seg.get("items", []):
            t = item.get("start_time")
            if t:
                speaker_map[t] = seg.get("speaker_label", "SPEAKER_0")

    segments: list[dict[str, Any]] = []

    if raw_segments:
        for idx, seg in enumerate(raw_segments):
            start = float(seg.get("start_time", 0))
            end = float(seg.get("end_time", 0))
            text = seg.get("transcript", "").strip()
            if not text:
                continue
            # Derive speaker from the first word in this segment
            speaker = speaker_map.get(seg.get("start_time", ""), "SPEAKER_0")
            segments.append(
                {
                    "segment_index": idx,
                    "start_time": start,
                    "end_time": end,
                    "speaker_label": speaker,
                    "original_text": text,
                }
            )
    else:
        # Fallback: group pronunciation items into pseudo-sentences by silence gaps
        SILENCE_THRESHOLD = 2.0  # seconds
        current_words: list[dict] = []
        current_start: float | None = None
        current_end: float | None = None
        idx = 0

        for item in items:
            if item["type"] == "punctuation":
                if current_words:
                    current_words[-1]["content"] += item["alternatives"][0]["content"]
                continue

            start = float(item.get("start_time", 0))
            end = float(item.get("end_time", 0))
            content = item["alternatives"][0]["content"]

            # Flush segment on long silence
            if current_start is not None and (start - current_end) > SILENCE_THRESHOLD:
                text = " ".join(w["content"] for w in current_words).strip()
                speaker = speaker_map.get(str(current_start), "SPEAKER_0")
                if text:
                    segments.append(
                        {
                            "segment_index": idx,
                            "start_time": current_start,
                            "end_time": current_end,
                            "speaker_label": speaker,
                            "original_text": text,
                        }
                    )
                    idx += 1
                current_words = []
                current_start = None

            if current_start is None:
                current_start = start
            current_end = end
            current_words.append({"content": content, "start": start})

        # Flush last segment
        if current_words:
            text = " ".join(w["content"] for w in current_words).strip()
            speaker = speaker_map.get(str(current_start), "SPEAKER_0")
            if text:
                segments.append(
                    {
                        "segment_index": idx,
                        "start_time": current_start,
                        "end_time": current_end,
                        "speaker_label": speaker,
                        "original_text": text,
                    }
                )

    return segments


def handler(event: dict, context) -> dict:
    """
    EventBridge Transcribe Job State Change event shape:
    {
      "source": "aws.transcribe",
      "detail-type": "Transcribe Job State Change",
      "detail": {
        "TranscriptionJobName": "<session_id>",
        "TranscriptionJobStatus": "COMPLETED" | "FAILED",
        "FailureReason": "..."   # only on FAILED
      }
    }
    """
    detail = event.get("detail", {})
    job_name: str = detail["TranscriptionJobName"]
    job_status: str = detail["TranscriptionJobStatus"]
    # Job name may have retry suffix e.g. "{session_id}-r2" — strip it to get session_id
    # UUID is always 36 chars; anything after that is the retry suffix
    session_id = job_name[:36]

    logger.info("Transcribe job %s → %s", job_name, job_status)

    # ------------------------------------------------------------------
    # 1. Handle failed Transcribe job
    # ------------------------------------------------------------------
    if job_status == "FAILED":
        reason = detail.get("FailureReason", "Transcription job failed (no reason given)")
        logger.error("Transcribe job FAILED for session %s: %s", session_id, reason)
        _set_failed(session_id, reason)
        return {"statusCode": 200, "body": json.dumps({"status": "FAILED", "session_id": session_id})}

    # ------------------------------------------------------------------
    # 2. Locate the transcript JSON in S3
    #    Key was set by trigger_transcription: {org_id}/{session_id}/transcript.json
    # ------------------------------------------------------------------
    session = execute_one("SELECT org_id FROM sessions WHERE id = %s", (session_id,))
    if not session:
        logger.error("No session found for job %s", job_name)
        return {"statusCode": 200}

    org_id: str = str(session["org_id"])
    transcript_key = f"{org_id}/{session_id}/transcript.json"

    try:
        logger.info("Fetching transcript from s3://%s/%s", S3_TRANSCRIPT_BUCKET, transcript_key)
        obj = s3.get_object(Bucket=S3_TRANSCRIPT_BUCKET, Key=transcript_key)
        transcript_json = json.loads(obj["Body"].read())
    except Exception as exc:
        logger.exception("Failed to fetch transcript JSON for session %s", session_id)
        _set_failed(session_id, f"Could not read transcript from S3: {exc}")
        raise

    # ------------------------------------------------------------------
    # 3. Parse segments
    # ------------------------------------------------------------------
    MIN_DURATION_SECS = 30  # recordings shorter than this are considered false positives

    try:
        segments = _parse_segments(transcript_json)
        logger.info("Parsed %d segments for session %s", len(segments), session_id)
    except Exception as exc:
        logger.exception("Failed to parse transcript for session %s", session_id)
        _set_failed(session_id, f"Transcript parse error: {exc}")
        raise

    # Determine actual recording duration from transcript metadata or last segment
    audio_duration: float = 0.0
    try:
        audio_meta = transcript_json.get("results", {}).get("audio_durations", [])
        if audio_meta:
            audio_duration = float(audio_meta[0].get("duration_in_seconds", 0))
        elif segments:
            audio_duration = float(segments[-1]["end_time"])
    except Exception:
        pass

    # Skip recordings that are too short — likely accidental activations
    if audio_duration > 0 and audio_duration < MIN_DURATION_SECS and not segments:
        logger.info(
            "Session %s is %.1fs — below %ds minimum with no transcript, marking SKIPPED",
            session_id, audio_duration, MIN_DURATION_SECS,
        )
        execute(
            "UPDATE sessions SET status = 'SKIPPED', duration_secs = %s, updated_at = NOW() WHERE id = %s",
            (int(audio_duration), session_id),
        )
        return {"statusCode": 200, "body": json.dumps({"status": "SKIPPED", "session_id": session_id})}

    if audio_duration > 0 and audio_duration < MIN_DURATION_SECS:
        logger.info(
            "Session %s is %.1fs — below %ds minimum, marking SKIPPED",
            session_id, audio_duration, MIN_DURATION_SECS,
        )
        execute(
            "UPDATE sessions SET status = 'SKIPPED', duration_secs = %s, updated_at = NOW() WHERE id = %s",
            (int(audio_duration), session_id),
        )
        return {"statusCode": 200, "body": json.dumps({"status": "SKIPPED", "session_id": session_id})}

    # ------------------------------------------------------------------
    # 4. Store segments in DB (delete any existing from a previous attempt)
    # ------------------------------------------------------------------
    try:
        execute(
            "DELETE FROM transcript_segments WHERE session_id = %s", (session_id,)
        )
        for seg in segments:
            execute(
                """
                INSERT INTO transcript_segments
                  (session_id, segment_index, start_time, end_time, speaker_label, original_text)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    session_id,
                    seg["segment_index"],
                    seg["start_time"],
                    seg["end_time"],
                    seg["speaker_label"],
                    seg["original_text"],
                ),
            )
    except Exception as exc:
        logger.exception("DB write failed for session %s segments", session_id)
        _set_failed(session_id, f"DB write error: {exc}")
        raise

    # ------------------------------------------------------------------
    # 5. Update session status → READY, store duration
    # ------------------------------------------------------------------
    execute(
        """UPDATE sessions
              SET status = 'READY',
                  duration_secs = COALESCE(duration_secs, %s),
                  updated_at = NOW()
            WHERE id = %s""",
        (int(audio_duration) if audio_duration > 0 else None, session_id),
    )
    logger.info("Session %s is now READY (%d segments stored)", session_id, len(segments))

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "READY", "session_id": session_id, "segments": len(segments)}),
    }
