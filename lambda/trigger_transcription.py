"""
trigger_transcription.py — FieldSightAI Lambda

Trigger: S3 PUT event on the fieldsightai-videos bucket

Responsibilities:
  1. Extract org_id and session_id from the S3 object key
  2. Look up the session in the DB to get the org's preferred language
  3. Start an Amazon Transcribe job for the video
  4. Update session status to TRANSCRIBING
  5. On failure: set status to FAILED with error_message

Environment variables:
  DB_CONNECTION_STRING   — PostgreSQL DSN
  S3_TRANSCRIPT_BUCKET   — output bucket (fieldsightai-transcripts)
  S3_VIDEO_BUCKET        — source bucket (fieldsightai-videos)
  AWS_REGION             — e.g. ap-southeast-2
"""
import json
import logging
import os

import boto3

from shared.db import execute, execute_one

logger = logging.getLogger()
logger.setLevel(logging.INFO)

transcribe = boto3.client(
    "transcribe", region_name=os.environ.get("AWS_REGION", "ap-southeast-2")
)
S3_VIDEO_BUCKET = os.environ.get("S3_VIDEO_BUCKET", "fieldsightai-videos")
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
        logger.error("Could not set FAILED status for %s: %s", session_id, db_err)


def handler(event: dict, context) -> dict:
    """
    S3 event shape (wrapped in EventBridge or direct S3 notification):
    {
      "Records": [
        {
          "s3": {
            "bucket": { "name": "fieldsightai-videos" },
            "object": { "key": "{org_id}/{session_id}/raw.mp4" }
          }
        }
      ]
    }
    """
    records = event.get("Records", [])
    if not records:
        logger.warning("No S3 records in event")
        return {"statusCode": 200}

    processed = []

    # S3 key → Transcribe MediaFormat mapping
    _FORMAT_MAP = {
        ".mp4": "mp4",
        ".mov": "mp4",
        ".avi": "mp4",
        ".wav": "wav",
        ".mp3": "mp3",
        ".aac": "aac",
    }

    for record in records:
        s3_key: str = record["s3"]["object"]["key"]
        # Key format: {org_id}/{session_id}/raw.{ext}
        parts = s3_key.split("/")
        if len(parts) < 3:
            logger.warning("Unexpected key format: %s", s3_key)
            continue

        org_id     = parts[0]
        session_id = parts[1]
        file_ext   = "." + s3_key.rsplit(".", 1)[-1].lower() if "." in s3_key else ""

        # ----------------------------------------------------------
        # Skip photos — no transcription needed, already set to READY
        # ----------------------------------------------------------
        if file_ext in (".jpg", ".jpeg", ".png"):
            logger.info("Skipping photo (no transcription needed): %s", s3_key)
            continue

        media_format = _FORMAT_MAP.get(file_ext, "mp4")
        logger.info(
            "Starting transcription for session %s (org %s, format %s)",
            session_id, org_id, media_format,
        )

        try:
            # ----------------------------------------------------------
            # 1. Fetch org's preferred transcription language
            # ----------------------------------------------------------
            row = execute_one(
                """
                SELECT o.transcribe_language
                  FROM sessions s
                  JOIN organisations o ON o.id = s.org_id
                 WHERE s.id = %s
                """,
                (session_id,),
            )
            language_code = (row or {}).get("transcribe_language") or "en-AU"

            # ----------------------------------------------------------
            # 2. Start Transcribe job
            #    Use session_id as job name; append retry_count if job already exists
            # ----------------------------------------------------------
            media_uri = f"s3://{S3_VIDEO_BUCKET}/{s3_key}"
            output_key = f"{org_id}/{session_id}/transcript.json"

            # Get retry count to make job name unique on retries
            session_row = execute_one(
                "SELECT retry_count FROM sessions WHERE id = %s", (session_id,)
            )
            retry_count = (session_row or {}).get("retry_count") or 0
            job_name = session_id if retry_count == 0 else f"{session_id}-r{retry_count}"

            transcribe.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={"MediaFileUri": media_uri},
                MediaFormat=media_format,
                LanguageCode=language_code,
                OutputBucketName=S3_TRANSCRIPT_BUCKET,
                OutputKey=output_key,
                Settings={
                    "ShowSpeakerLabels": True,
                    "MaxSpeakerLabels": 10,
                },
            )
            logger.info("Transcribe job '%s' started (language: %s)", job_name, language_code)

            # ----------------------------------------------------------
            # 3. Update session status → TRANSCRIBING
            # ----------------------------------------------------------
            execute(
                """
                UPDATE sessions
                   SET status = 'TRANSCRIBING', updated_at = NOW()
                 WHERE id = %s
                """,
                (session_id,),
            )

            processed.append(session_id)

        except Exception as exc:
            logger.exception("trigger_transcription failed for session %s", session_id)
            _set_failed(session_id, str(exc))
            raise

    return {"statusCode": 200, "body": json.dumps({"processed": processed})}
