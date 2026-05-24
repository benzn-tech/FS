"""
scripts/bulk_import.py — One-time historical RealPTT video import
=================================================================

RealPTT stores body cam footage in /ptt/uploadFile (not /ptt/video).
This script fetches all Video-type upload files per user account,
deduplicates by file_name (the actual recording timestamp — same video
can appear under multiple IDs due to re-uploads), streams each unique
video to S3, and upserts a session record in the DB.

The existing pipeline takes over from here: the S3 PUT event triggers
trigger_transcription.py → process_transcript.py automatically.

Usage:
    cd scripts
    pip install psycopg2-binary boto3 requests python-dotenv
    python bulk_import.py --dry-run         # preview only
    python bulk_import.py                   # live run
    python bulk_import.py --start-page 4   # resume from page N (per user)

Environment (loaded from ../.env.local):
    DATABASE_URL       — PostgreSQL DSN
    S3_VIDEO_BUCKET    — e.g. fsai-videos
    REALPTT_ACCOUNT    — RealPTT org login account
    REALPTT_PASSWORD   — RealPTT org login password
    AWS_REGION         — e.g. ap-southeast-2
    RATE_LIMIT_SECS    — sleep between uploads (default 1.0)

Notes:
    - Deduplication: file_name is the canonical recording identifier.
      Same file_name across multiple IDs = same recording uploaded
      multiple times. We store the lowest ID as realptt_id and skip
      subsequent duplicates.
    - Only file_type="Video" files are imported.
    - Date filter: only videos with upload_time >= START_DATE are imported.
    - Sessions ingested with user_id/project_id from project_devices
      mapping (NULL if unmapped).
"""

import argparse
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import boto3
import psycopg2
import requests
from dotenv import load_dotenv

_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(_repo_root, ".env.local"))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
START_DATE    = "2026-01-13 00:00:00"   # upload_time cutoff (server time)
USER_ACCOUNTS = ["Benl1", "Benl2", "Benl3", "Benl4", "Benl5", "Benl6", "Benl7"]
PAGE_SIZE     = 20
RATE_LIMIT_SECS = float(os.environ.get("RATE_LIMIT_SECS", "1.0"))
CHUNK_SIZE    = 10 * 1024 * 1024   # 10 MB multipart chunk

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bulk_import")

# ---------------------------------------------------------------------------
# RealPTT client
# ---------------------------------------------------------------------------
import hashlib
import hmac
from urllib.parse import urlparse, urlunparse

REALPTT_BASE   = "https://api.realptt.com"
TIMEZONE_OFFSET = -480
REQUEST_TIMEOUT = 30


def _hex_sha1(value: str) -> str:
    return hashlib.sha1(value.encode()).hexdigest()


def _hex_hmac_sha1(key: str, message: str) -> str:
    return hmac.new(key.encode(), message.encode(), hashlib.sha1).hexdigest()


def _inject_jsessionid(url: str, session_id: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"{parsed.path};jsessionid={session_id}"))


class RealPTTClient:
    def __init__(self, account: str, password: str):
        self.account    = account
        self.password   = password
        self.session_id: str | None = None
        self._http      = requests.Session()

    def _get(self, path: str, params: dict | None = None, authenticated: bool = True,
             _retry: bool = True) -> dict:
        url = f"{REALPTT_BASE}{path}"
        if authenticated and self.session_id:
            url = _inject_jsessionid(url, self.session_id)
        resp = self._http.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        code = data.get("code", -1)
        if code == 1001 and _retry:
            # Session expired — re-login and retry once
            logger.warning("Session expired (1001) — re-logging in...")
            self.login()
            return self._get(path, params=params, authenticated=authenticated, _retry=False)
        if code not in (0, 2):
            raise RuntimeError(f"RealPTT API error {code}: {data.get('msg')} (path={path})")
        return data.get("data", {})

    def login(self) -> None:
        logger.info("Logging in to RealPTT as %s", self.account)
        random_data    = self._get("/ptt/random", authenticated=False)
        self.session_id = random_data["sessionId"]
        hashed_pwd     = _hex_hmac_sha1(random_data["random"], _hex_sha1(self.password))
        self._get("/ptt/organization", params={
            "method": "login", "account": self.account,
            "pwd": hashed_pwd, "timeZoneOffset": TIMEZONE_OFFSET,
        })
        logger.info("RealPTT login successful")

    def logout(self) -> None:
        try:
            self._get("/ptt/organization", params={"method": "logout"})
        except Exception:
            pass
        finally:
            self.session_id = None

    def get_upload_files_page(self, user_account: str, page: int) -> tuple[list[dict], int]:
        """
        Returns (files, total_pages) for the given user and page.
        Sorted DESC (newest first) so we can stop early once past START_DATE.
        """
        data = self._get("/ptt/uploadFile", params={
            "method":       "get",
            "user_account": user_account,
            "start_time":   START_DATE[:10],   # date only: YYYY-MM-DD
            "end_time":     "2026-04-01",      # date only: YYYY-MM-DD
            "page":         page,
            "limit":        PAGE_SIZE,
            "sort":         1,                  # 1 = DESC
        })
        files      = data.get("uploadFiles", [])
        total_pages = int(data.get("pageSize", 1))
        return files, total_pages

    def download_stream(self, down_path: str, timeout: int = 120):
        """
        Stream a file download. The down_path URL must have jsessionid injected.
        Returns a requests Response (streaming).
        """
        url = _inject_jsessionid(down_path, self.session_id)
        return self._http.get(url, stream=True, timeout=timeout)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db_conn():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL env var not set")
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn


def already_ingested_by_filename(cur, file_name: str) -> bool:
    """Deduplicate by file_name (the actual recording timestamp)."""
    cur.execute("SELECT id FROM sessions WHERE realptt_id = %s", (file_name,))
    return cur.fetchone() is not None


def lookup_device_mapping(cur, src_account: str) -> tuple[str | None, str | None]:
    cur.execute(
        "SELECT project_id, user_id FROM project_devices WHERE device_account = %s",
        (src_account,),
    )
    row = cur.fetchone()
    if not row:
        return None, None
    return (str(row[0]) if row[0] else None, str(row[1]) if row[1] else None)


def get_org_id(cur) -> str:
    cur.execute("SELECT id FROM organisations LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise RuntimeError("No organisations found — seed the DB first")
    return str(row[0])


def upsert_session(cur, *, session_id, org_id, user_id, project_id,
                   realptt_id, src_account, src_name, title, recorded_at,
                   s3_key, media_type="video", initial_status="INGESTED"):
    cur.execute(
        """
        INSERT INTO sessions
          (id, org_id, user_id, project_id, realptt_id, realptt_account, realptt_user_name,
           title, recorded_at, video_s3_key, media_type, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (realptt_id) DO NOTHING
        """,
        (session_id, org_id, user_id, project_id, realptt_id,
         src_account, src_name, title, recorded_at, s3_key,
         media_type, initial_status),
    )


# ---------------------------------------------------------------------------
# S3 upload
# ---------------------------------------------------------------------------

def stream_to_s3(s3_client, response, bucket: str, key: str) -> None:
    # Buffer the full response first so we know the size
    data = response.content
    if not data:
        raise ValueError("EMPTY_FILE: Downloaded file is empty — URL may be expired or file unavailable")

    if len(data) < CHUNK_SIZE:
        # Small file — single PUT upload
        s3_client.put_object(Bucket=bucket, Key=key, Body=data)
        logger.info("  Upload complete (single-part, %d bytes)", len(data))
        return

    # Large file — multipart upload
    mpu      = s3_client.create_multipart_upload(Bucket=bucket, Key=key)
    upload_id = mpu["UploadId"]
    parts    = []
    part_num = 1
    try:
        for i in range(0, len(data), CHUNK_SIZE):
            chunk = data[i:i + CHUNK_SIZE]
            part  = s3_client.upload_part(
                Bucket=bucket, Key=key, UploadId=upload_id,
                PartNumber=part_num, Body=chunk,
            )
            parts.append({"PartNumber": part_num, "ETag": part["ETag"]})
            part_num += 1
        s3_client.complete_multipart_upload(
            Bucket=bucket, Key=key, UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )
    except Exception:
        s3_client.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)
        raise
    logger.info("  Upload complete (%d parts, %d bytes)", len(parts), len(data))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_upload_time(upload_time: str) -> datetime:
    """Parse upload_time string (server local time) → UTC datetime."""
    # RealPTT server appears to be UTC+8 (same timezone offset as login)
    dt_local = datetime.strptime(upload_time, "%Y-%m-%d %H:%M:%S")
    return (dt_local - timedelta(hours=8)).replace(tzinfo=timezone.utc)


def main(dry_run: bool = False, start_page: int = 1) -> None:
    account  = os.environ.get("REALPTT_ACCOUNT")
    password = os.environ.get("REALPTT_PASSWORD")
    bucket   = os.environ.get("S3_VIDEO_BUCKET", "fsai-videos")
    region   = os.environ.get("AWS_REGION", "ap-southeast-2")

    for var, val in [("REALPTT_ACCOUNT", account), ("REALPTT_PASSWORD", password),
                     ("DATABASE_URL", os.environ.get("DATABASE_URL"))]:
        if not val:
            logger.error("Missing required env var: %s", var)
            sys.exit(1)

    if dry_run:
        logger.info("=== DRY RUN — no S3 uploads or DB writes ===")

    client = RealPTTClient(account, password)
    client.login()

    s3   = boto3.client("s3", region_name=region)
    conn = get_db_conn()
    cur  = conn.cursor()
    org_id = get_org_id(cur)
    logger.info("Using org_id=%s, bucket=%s", org_id, bucket)

    total_ingested   = 0
    total_skipped    = 0
    total_failed     = 0
    failed_empty     = 0
    failed_timeout   = 0
    failed_other     = 0
    seen_this_run: set[str] = set()  # dedup within the current run

    try:
        for user_account in USER_ACCOUNTS:
            logger.info("--- Processing user: %s ---", user_account)
            project_id, user_id = lookup_device_mapping(cur, user_account)
            if project_id:
                logger.info("  Device mapped to project=%s user=%s", project_id, user_id)
            else:
                logger.warning("  No project mapping — sessions will be unassigned")

            page = start_page
            while True:
                logger.info("  Fetching page %d...", page)
                files, total_pages = client.get_upload_files_page(user_account, page)

                if not files:
                    logger.info("  No more files for %s.", user_account)
                    break

                _EXT_TYPE = {
                    ".mp4": "video", ".avi": "video", ".mov": "video",
                    ".wav": "audio", ".mp3": "audio", ".aac": "audio",
                    ".jpg": "photo", ".jpeg": "photo", ".png": "photo",
                }
                _TYPE_EXT = {"video": ".mp4", "audio": ".wav", "photo": ".jpg"}

                for f in files:
                    file_name   = f["file_name"]
                    upload_time = f["upload_time"]
                    down_path   = f["down_path"]

                    # Derive media type from file extension in the download URL
                    media_type = "video"
                    for ext, mtype in _EXT_TYPE.items():
                        if ext in down_path.lower():
                            media_type = mtype
                            break

                    if file_name in seen_this_run or already_ingested_by_filename(cur, file_name):
                        logger.debug("  Skip (duplicate): %s", file_name)
                        total_skipped += 1
                        continue
                    seen_this_run.add(file_name)

                    # Parse recording time from file_name: YYYY-MM-DD-HH-MM-SS (AEST)
                    try:
                        recorded_at_local = datetime.strptime(file_name, "%Y-%m-%d-%H-%M-%S")
                        recorded_at = (recorded_at_local - timedelta(hours=10)).replace(tzinfo=timezone.utc)
                    except ValueError:
                        recorded_at = parse_upload_time(upload_time)

                    session_id     = str(uuid.uuid4())
                    file_ext       = _TYPE_EXT.get(media_type, ".mp4")
                    s3_key         = f"{org_id}/{session_id}/raw{file_ext}"
                    type_label     = media_type.capitalize()
                    title          = f"Site {type_label} — {user_account} — {file_name}"
                    initial_status = "READY" if media_type == "photo" else "INGESTED"

                    logger.info(
                        "  Ingesting [%s] file_name=%s | user=%s | recorded=%s | project=%s",
                        media_type, file_name, user_account,
                        recorded_at.strftime("%Y-%m-%d %H:%M UTC"),
                        project_id or "UNASSIGNED",
                    )

                    if not dry_run:
                        try:
                            with client.download_stream(down_path, timeout=300) as resp:
                                resp.raise_for_status()
                                stream_to_s3(s3, resp, bucket, s3_key)

                            upsert_session(
                                cur,
                                session_id=session_id, org_id=org_id,
                                user_id=user_id, project_id=project_id,
                                realptt_id=file_name,
                                src_account=user_account, src_name=user_account,
                                title=title, recorded_at=recorded_at, s3_key=s3_key,
                                media_type=media_type, initial_status=initial_status,
                            )
                            conn.commit()
                            total_ingested += 1
                            logger.info("  ✓ [%s] session_id=%s", media_type, session_id)
                        except Exception as exc:
                            conn.rollback()
                            err = str(exc)
                            if "EMPTY_FILE" in err or "502" in err or "Bad Gateway" in err:
                                # File expired/unavailable on RealPTT servers — skip silently
                                failed_empty += 1
                                logger.debug("  - Unavailable on RealPTT: %s", file_name)
                                seen_this_run.add(file_name)  # don't retry in this run
                                continue  # skip the rate-limit sleep for unavailable files
                            elif "timed out" in err.lower() or "timeout" in err.lower():
                                failed_timeout += 1
                                logger.warning("  ✗ Timeout (large file): %s", file_name)
                            else:
                                failed_other += 1
                                logger.error("  ✗ Failed %s: %s", file_name, exc)
                            total_failed += 1
                    else:
                        total_ingested += 1
                        logger.info("  [dry-run] Would ingest [%s] session_id=%s", media_type, session_id)

                    time.sleep(RATE_LIMIT_SECS)

                if page >= total_pages:
                    logger.info("  Reached last page (%d/%d) for %s.", page, total_pages, user_account)
                    break

                page += 1

    finally:
        client.logout()
        cur.close()
        conn.close()

    logger.info(
        "=== Import finished | ingested=%d | skipped=%d | failed=%d "
        "(empty=%d, timeout=%d, other=%d) ===",
        total_ingested, total_skipped, total_failed,
        failed_empty, failed_timeout, failed_other,
    )
    if failed_timeout:
        logger.warning("%d timeout(s) — re-run to retry large files", failed_timeout)
    if failed_empty:
        logger.warning("%d empty file(s) — these are unavailable on RealPTT servers and can be ignored", failed_empty)
    if failed_other:
        logger.error("%d unexpected failure(s) — check logs above", failed_other)
    if failed_timeout or failed_other:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk import RealPTT videos into FieldSightAI")
    parser.add_argument("--dry-run",    action="store_true", help="No uploads or DB writes")
    parser.add_argument("--start-page", type=int, default=1, help="Resume from page N (default 1)")
    args = parser.parse_args()
    main(dry_run=args.dry_run, start_page=args.start_page)
