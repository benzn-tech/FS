"""
scripts/local_import.py — Import manually downloaded RealPTT files into FieldSightAI
=====================================================================================

Reads files from a local folder structure:
    {root}/users/{UserName}/{video|audio|pictures}/{date}/{DeviceAccount}_{YYYY-MM-DD-HH-MM-SS}.{ext}

Uploads each file to S3 and upserts a session record in the DB.
Deduplicates by realptt_id (= the timestamp portion of the filename, e.g. "2026-01-30-11-55-45").

Usage:
    cd scripts
    python local_import.py --dry-run
    python local_import.py

Environment (loaded from ../.env.local):
    DATABASE_URL, S3_VIDEO_BUCKET, AWS_REGION
"""

import argparse
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
import psycopg2
from dotenv import load_dotenv

_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(_repo_root, ".env.local"))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FILES_ROOT = Path(r"C:\Users\jwild\Documents\FieldSiteAI\3 Beyond Sight\s3_bucket\users")

# Media type from folder name
_FOLDER_TYPE = {
    "video":    "video",
    "audio":    "audio",
    "pictures": "photo",
}
_TYPE_EXT = {"video": ".mp4", "audio": ".wav", "photo": ".jpg"}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("local_import")

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


def already_ingested(cur, realptt_id: str) -> bool:
    cur.execute("SELECT id FROM sessions WHERE realptt_id = %s", (realptt_id,))
    return cur.fetchone() is not None


def lookup_device_mapping(cur, device_account: str) -> tuple[str | None, str | None]:
    cur.execute(
        "SELECT project_id, user_id FROM project_devices WHERE device_account = %s",
        (device_account,),
    )
    row = cur.fetchone()
    if not row:
        return None, None
    return (str(row[0]) if row[0] else None, str(row[1]) if row[1] else None)


def get_org_id(cur) -> str:
    cur.execute("SELECT id FROM organisations LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise RuntimeError("No organisations found")
    return str(row[0])


def upsert_session(cur, *, session_id, org_id, user_id, project_id,
                   realptt_id, src_account, src_name, title, recorded_at,
                   s3_key, media_type, initial_status):
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
CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB

def upload_to_s3(s3_client, file_path: Path, bucket: str, key: str) -> None:
    file_size = file_path.stat().st_size
    if file_size == 0:
        raise ValueError(f"File is empty: {file_path}")

    if file_size < CHUNK_SIZE:
        with open(file_path, "rb") as f:
            s3_client.put_object(Bucket=bucket, Key=key, Body=f.read())
        logger.info("  Upload complete (single-part, %d bytes)", file_size)
    else:
        mpu = s3_client.create_multipart_upload(Bucket=bucket, Key=key)
        upload_id = mpu["UploadId"]
        parts = []
        part_num = 1
        try:
            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    part = s3_client.upload_part(
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
        logger.info("  Upload complete (%d parts, %d bytes)", len(parts), file_size)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_filename(filename: str) -> tuple[str, str] | None:
    """
    Parse '{DeviceAccount}_{YYYY-MM-DD-HH-MM-SS}.ext' → (device_account, realptt_id).
    realptt_id = timestamp string e.g. '2026-01-30-11-55-45'
    Returns None if filename doesn't match expected pattern.
    """
    stem = Path(filename).stem  # strip extension
    # Find the underscore that separates device account from timestamp
    # Timestamp portion is always 19 chars: YYYY-MM-DD-HH-MM-SS
    if "_" not in stem:
        return None
    # Split on last underscore before the timestamp (timestamp starts with 4-digit year)
    parts = stem.split("_", 1)
    if len(parts) != 2:
        return None
    device_account, timestamp = parts[0], parts[1]
    # Normalise: some files use underscore between date and time parts
    timestamp = timestamp.replace("_", "-")
    # Validate timestamp format YYYY-MM-DD-HH-MM-SS
    try:
        datetime.strptime(timestamp, "%Y-%m-%d-%H-%M-%S")
    except ValueError:
        return None
    return device_account, timestamp


def main(dry_run: bool = False) -> None:
    bucket = os.environ.get("S3_VIDEO_BUCKET", "fsai-videos")
    region = os.environ.get("AWS_REGION", "ap-southeast-2")

    if not os.environ.get("DATABASE_URL"):
        logger.error("Missing DATABASE_URL env var")
        sys.exit(1)

    if not FILES_ROOT.exists():
        logger.error("Files root not found: %s", FILES_ROOT)
        sys.exit(1)

    if dry_run:
        logger.info("=== DRY RUN — no S3 uploads or DB writes ===")

    s3 = boto3.Session(profile_name="AdministratorAccess-164088480050").client("s3", region_name=region)
    conn = get_db_conn()
    cur = conn.cursor()
    org_id = get_org_id(cur)
    logger.info("Using org_id=%s, bucket=%s", org_id, bucket)

    total_ingested = 0
    total_skipped  = 0
    total_failed   = 0
    seen_this_run: set[str] = set()

    # Walk: users/{UserName}/{media_folder}/{date}/{filename}
    for user_dir in sorted(FILES_ROOT.iterdir()):
        if not user_dir.is_dir():
            continue
        user_folder_name = user_dir.name  # e.g. "David_Barillaro"

        for media_dir in sorted(user_dir.iterdir()):
            if not media_dir.is_dir():
                continue
            media_type = _FOLDER_TYPE.get(media_dir.name.lower())
            if not media_type:
                logger.warning("Unknown media folder '%s', skipping", media_dir.name)
                continue

            for date_dir in sorted(media_dir.iterdir()):
                if not date_dir.is_dir():
                    continue

                for file_path in sorted(date_dir.iterdir()):
                    if not file_path.is_file():
                        continue

                    parsed = parse_filename(file_path.name)
                    if not parsed:
                        logger.warning("  Unrecognised filename: %s", file_path.name)
                        continue

                    device_account, realptt_id = parsed

                    # Dedup
                    if realptt_id in seen_this_run or already_ingested(cur, realptt_id):
                        logger.debug("  Skip (duplicate): %s", realptt_id)
                        total_skipped += 1
                        continue
                    seen_this_run.add(realptt_id)

                    # Look up device mapping from DB
                    project_id, user_id = lookup_device_mapping(cur, device_account)

                    # Parse recorded_at from timestamp (AEST = UTC+10)
                    try:
                        dt_local = datetime.strptime(realptt_id, "%Y-%m-%d-%H-%M-%S")
                        recorded_at = (dt_local - timedelta(hours=10)).replace(tzinfo=timezone.utc)
                    except ValueError:
                        recorded_at = datetime.now(timezone.utc)

                    session_id     = str(uuid.uuid4())
                    file_ext       = _TYPE_EXT.get(media_type, file_path.suffix)
                    s3_key         = f"{org_id}/{session_id}/raw{file_ext}"
                    src_name       = user_folder_name.replace("_", " ")
                    title          = f"Site {media_type.capitalize()} — {device_account} — {realptt_id}"
                    initial_status = "READY" if media_type == "photo" else "INGESTED"

                    logger.info(
                        "  [%s] %s | device=%s | user=%s | project=%s",
                        media_type, realptt_id, device_account,
                        src_name, project_id or "UNASSIGNED",
                    )

                    if not dry_run:
                        try:
                            upload_to_s3(s3, file_path, bucket, s3_key)
                            upsert_session(
                                cur,
                                session_id=session_id, org_id=org_id,
                                user_id=user_id, project_id=project_id,
                                realptt_id=realptt_id,
                                src_account=device_account, src_name=src_name,
                                title=title, recorded_at=recorded_at, s3_key=s3_key,
                                media_type=media_type, initial_status=initial_status,
                            )
                            conn.commit()
                            total_ingested += 1
                            logger.info("  ✓ session_id=%s", session_id)
                        except Exception as exc:
                            conn.rollback()
                            total_failed += 1
                            logger.error("  ✗ Failed %s: %s", realptt_id, exc)
                    else:
                        total_ingested += 1

    logger.info(
        "=== Import finished | ingested=%d | skipped=%d | failed=%d ===",
        total_ingested, total_skipped, total_failed,
    )
    if total_failed:
        logger.error("%d failure(s) — check logs above", total_failed)
        sys.exit(1)

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import local RealPTT files into FieldSightAI")
    parser.add_argument("--dry-run", action="store_true", help="No uploads or DB writes")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
