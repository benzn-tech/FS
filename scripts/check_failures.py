"""Show error messages for failed sessions."""
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute("SELECT id, media_type, video_s3_key, error_message FROM sessions WHERE status = 'FAILED'")
rows = cur.fetchall()
for r in rows:
    print(f"ID:        {r[0]}")
    print(f"Type:      {r[1]}")
    print(f"S3 key:    {r[2]}")
    print(f"Error:     {r[3]}")
    print()
cur.close()
conn.close()
