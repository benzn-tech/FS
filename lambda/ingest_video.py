"""
ingest_video.py — FieldSightAI Lambda (handles all media types)

Trigger:
  - EventBridge scheduled rule: every 2 minutes (polls RealPTT for new uploads)
  - EventBridge custom bus rule: 'retry-requested' (manual retry from dashboard)

Flow:
  1. Login to RealPTT
  2. For each known user account, query /ptt/uploadFile for files since last poll
  3. For each new file (video, audio, or photo) not already in DB:
     a. Stream file from RealPTT → S3 (multipart upload)
     b. Upsert session record in DB (status: INGESTED, media_type set)
  4. Photos: status set to READY immediately (no transcription needed)
     Videos/Audio: S3 PUT triggers trigger_transcription.py automatically
  5. On retry: re-ingest a specific realptt_id (file_name)

Environment variables:
  DB_CONNECTION_STRING    — PostgreSQL DSN (from SSM)
  S3_VIDEO_BUCKET         — destination bucket (fsai-videos)
  POLL_LOOKBACK_MINUTES   — how far back to query RealPTT (default: 5)
  REALPTT_USER_ACCOUNTS   — comma-separated list of user accounts to poll
                            (default: Benl1,Benl2,Benl3,Benl4,Benl5,Benl6,Benl7)
"""
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3
import requests

from shared.db import execute, execute_one
from shared.realptt import RealPTTClient
from shared.ssm import get_param

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
S3_VIDEO_BUCKET      = os.environ.get("S3_VIDEO_BUCKET", "fsai-videos")
POLL_LOOKBACK_MINUTES = int(os.environ.get("POLL_LOOKBACK_MINUTES", "5"))
_default_accounts    = "Benl1,Benl2,Benl3,Benl4,Benl5,Benl6,Benl7"
USER_ACCOUNTS        = [a.strip() for a in os.environ.get("REALPTT_USER_ACCOUNTS", _default_accounts).split(",")]

# File extension → media_type
_EXT_TYPE = {
    ".mp4": "video",
    ".avi": "video",
    ".mov": "video",
    ".wav": "audio",
    ".mp3": "audio",
    ".aac": "audio",
    ".jpg": "photo",
    ".jpeg": "photo",
    ".png": "photo",
}

# S3 key suffix per media type (keeps bucket organised)
_TYPE_PREFIX = {"video": "video", "audio": "audio", "photo": "photo"}
_TYPE_EXT    = {"video": ".mp4", "audio": ".wav", "photo": ".jpg"}


def _get_realptt_client() -> RealPTTClient:
    account  = get_param("/fieldsightai/realptt_account")
    password = get_param("/fieldsightai/realptt_password")
    client   = RealPTTClient(account, password)
    client.login()
    return client


def _media_type_from_filename(file_name: str) -> str:
    """Derive media_type from the file_name (no extension = assume video)."""
    for ext, mtype in _EXT_TYPE.items():
        if file_name.lower().endswith(ext):
            return mtype
    return "video"


def _media_type_from_down_path(down_path: str) -> str:
    """Derive media_type from the FileUrl inside down_path."""
    lower = down_path.lower()
    for ext, mtype in _EXT_TYPE.items():
        if ext in lower:
            return mtype
    return "video"


def _already_ingested(realptt_id: str) -> bool:
    row = execute_one(
        "SELECT id FROM sessions WHERE realptt_id = %s", (realptt_id,)
    )
    return row is not None


def _stream_to_s3(client: RealPTTClient, down_path: str, bucket: str, key: str) -> None:
    """Stream a RealPTT uploadFile download directly to S3 via multipart upload."""
    from urllib.parse import urlparse, urlunparse
    parsed  = urlparse(down_path)
    url     = urlunparse(parsed._replace(path=f"{parsed.path};jsessionid={client.session_id}"))

    logger.info("Streaming %s → s3://%s/%s", down_path[:80], bucket, key)
    chunk_size = 10 * 1024 * 1024  # 10 MB

    with requests.get(url, stream=True, timeout=(30, 600)) as resp:
        resp.raise_for_status()

        mpu       = s3.create_multipart_upload(Bucket=bucket, Key=key)
        upload_id = mpu["UploadId"]
        parts     = []
        part_num  = 1

        try:
            buffer = b""
            for chunk in resp.iter_content(chunk_size=chunk_size):
                buffer += chunk
                if len(buffer) >= chunk_size:
                    part = s3.upload_part(
                        Bucket=bucket, Key=key, UploadId=upload_id,
                        PartNumber=part_num, Body=buffer,
                    )
                    parts.append({"PartNumber": part_num, "ETag": part["ETag"]})
                    part_num += 1
                    buffer = b""
            if buffer:
                part = s3.upload_part(
                    Bucket=bucket, Key=key, UploadId=upload_id,
                    PartNumber=part_num, Body=buffer,
                )
                parts.append({"PartNumber": part_num, "ETag": part["ETag"]})

            s3.complete_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )
        except Exception:
            s3.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)
            raise

    logger.info("Upload complete: %d parts", len(parts))


def _lookup_device_mapping(src_account: str) -> tuple[str | None, str | None]:
    row = execute_one(
        "SELECT project_id, user_id FROM project_devices WHERE device_account = %s",
        (src_account,),
    )
    if not row:
        return None, None
    return (
        str(row["project_id"]) if row["project_id"] else None,
        str(row["user_id"])    if row["user_id"]    else None,
    )


def _ingest_file(upload_file: dict, org_id: str, client: RealPTTClient) -> str:
    """
    Ingest a single RealPTT uploadFile record. Returns session_id.

    upload_file keys: id, file_name, file_type, down_path,
                      sender_account, sender_name, upload_time
    """
    file_name      = upload_file["file_name"]     # e.g. "2026-03-24-12-52-13" — dedup key
    down_path      = upload_file["down_path"]
    sender_account = upload_file.get("sender_account", "")
    sender_name    = upload_file.get("sender_name", "")
    upload_time    = upload_file.get("upload_time", "")

    # Derive media type from the actual file extension in the download URL
    media_type = _media_type_from_down_path(down_path)

    # Parse recording timestamp from file_name (AEST, UTC+10) → UTC
    try:
        recorded_at_local = datetime.strptime(file_name, "%Y-%m-%d-%H-%M-%S")
        recorded_at = (recorded_at_local - timedelta(hours=10)).replace(tzinfo=timezone.utc)
    except ValueError:
        # Fallback: use upload_time (server time UTC+8) → UTC
        recorded_at_local = datetime.strptime(upload_time, "%Y-%m-%d %H:%M:%S")
        recorded_at = (recorded_at_local - timedelta(hours=8)).replace(tzinfo=timezone.utc)

    project_id, user_id = _lookup_device_mapping(sender_account)
    if project_id:
        logger.info("Device '%s' mapped to project %s", sender_account, project_id)
    else:
        logger.warning("Device '%s' has no project mapping — will be unassigned", sender_account)

    # Reuse existing session ID if this realptt_id was previously ingested,
    # so the S3 key path always matches the session's DB id.
    existing = execute_one("SELECT id FROM sessions WHERE realptt_id = %s", (file_name,))
    session_id = str(existing["id"]) if existing else str(uuid.uuid4())
    ext        = _TYPE_EXT.get(media_type, ".mp4")
    s3_key     = f"{org_id}/{session_id}/raw{ext}"

    type_label = media_type.capitalize()
    title      = f"Site {type_label} — {sender_name or sender_account} — {file_name}"

    # Photos go straight to READY (no transcription pipeline)
    initial_status = "READY" if media_type == "photo" else "INGESTED"

    _stream_to_s3(client, down_path, S3_VIDEO_BUCKET, s3_key)

    execute(
        """
        INSERT INTO sessions
          (id, org_id, user_id, project_id, realptt_id, realptt_account, realptt_user_name,
           title, recorded_at, video_s3_key, media_type, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (realptt_id) DO UPDATE
          SET status             = EXCLUDED.status,
              project_id         = EXCLUDED.project_id,
              user_id            = EXCLUDED.user_id,
              error_message      = NULL,
              retry_count        = sessions.retry_count + 1,
              video_s3_key       = EXCLUDED.video_s3_key,
              updated_at         = NOW()
        """,
        (session_id, org_id, user_id, project_id, file_name,
         sender_account, sender_name, title, recorded_at,
         s3_key, media_type, initial_status),
    )
    logger.info(
        "Ingested %s session %s (realptt_id=%s, project=%s)",
        media_type, session_id, file_name, project_id,
    )
    return session_id


def _get_org_id() -> str:
    row = execute_one("SELECT id FROM organisations LIMIT 1")
    if not row:
        raise RuntimeError("No organisations found — seed the DB first")
    return str(row["id"])


def handler(event: dict, context) -> dict:
    """
    Handles two event shapes:

    1. Scheduled poll (EventBridge rate rule):
       { "source": "aws.events", "detail-type": "Scheduled Event" }

    2. Manual retry (EventBridge custom bus):
       { "source": "fieldsightai.api", "detail-type": "retry-requested",
         "detail": { "realptt_id": "<file_name>" } }
    """
    detail_type = event.get("detail-type", "")
    is_retry    = detail_type == "retry-requested"

    org_id  = _get_org_id()
    client  = _get_realptt_client()
    ingested = []

    try:
        if is_retry:
            detail     = event.get("detail", {})
            realptt_id = detail.get("realptt_id")
            if not realptt_id:
                raise ValueError("retry-requested event missing realptt_id")

            logger.info("Retry requested for realptt_id=%s", realptt_id)

            # Search recent week across all user accounts to find the file
            now_utc   = datetime.now(timezone.utc)
            since_str = (now_utc - timedelta(days=7) + timedelta(hours=12)).strftime("%Y-%m-%d")
            until_str = (now_utc + timedelta(hours=13)).strftime("%Y-%m-%d")  # tomorrow NZ
            for user_account in USER_ACCOUNTS:
                files = client.get_all_upload_files_since(user_account, since_str, until_str)
                target = next((f for f in files if f["file_name"] == realptt_id), None)
                if target:
                    session_id = _ingest_file(target, org_id, client)
                    ingested.append(session_id)
                    break
            else:
                raise ValueError(f"realptt_id={realptt_id} not found across any user account")

        else:
            # Scheduled poll: fetch all new files since lookback window
            now_utc = datetime.now(timezone.utc)
            since_utc = now_utc - timedelta(minutes=POLL_LOOKBACK_MINUTES)
            # Dates sent to RealPTT in NZ local time (UTC+12) to match coworker's working integration
            since_date = (since_utc + timedelta(hours=12)).strftime("%Y-%m-%d")
            until_date = (now_utc + timedelta(hours=13)).strftime("%Y-%m-%d")  # tomorrow NZ to be safe
            since_str  = (since_utc + timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")  # NZ for display

            logger.info("Polling %d user accounts for files since %s", len(USER_ACCOUNTS), since_str)

            for user_account in USER_ACCOUNTS:
                try:
                    files = client.get_all_upload_files_since(user_account, since_date, until_date)
                except Exception as exc:
                    logger.error("  Failed to fetch files for %s: %s", user_account, exc)
                    continue
                logger.info("  %s: %d file(s) returned", user_account, len(files))

                for f in files:
                    if _already_ingested(f["file_name"]):
                        logger.debug("  Skip already-ingested: %s", f["file_name"])
                        continue
                    try:
                        session_id = _ingest_file(f, org_id, client)
                        ingested.append(session_id)
                    except Exception as exc:
                        logger.error("  Failed to ingest %s: %s", f["file_name"], exc)

    finally:
        client.logout()

    logger.info("Ingested %d new recording(s): %s", len(ingested), ingested)
    return {"statusCode": 200, "body": json.dumps({"ingested": ingested})}
