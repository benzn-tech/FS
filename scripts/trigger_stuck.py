"""Manually trigger transcription for all INGESTED sessions."""
import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute("SELECT id, media_type, video_s3_key FROM sessions WHERE status = 'INGESTED'")
rows = cur.fetchall()
print(f"Found {len(rows)} INGESTED sessions")

session = boto3.Session(profile_name='AdministratorAccess-164088480050')
lam = session.client('lambda', region_name='ap-southeast-2')

for sid, mtype, s3key in rows:
    payload = {
        'Records': [{
            's3': {
                'bucket': {'name': 'fsai-videos'},
                'object': {'key': s3key}
            }
        }]
    }
    resp = lam.invoke(
        FunctionName='fieldsightai-trigger-transcription',
        InvocationType='Event',
        Payload=json.dumps(payload).encode()
    )
    print(f"  [{mtype}] {s3key} -> HTTP {resp['StatusCode']}")

cur.close()
conn.close()
print("Done — wait ~2 min then run check_db.py")
