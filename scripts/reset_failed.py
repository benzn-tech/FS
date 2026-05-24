"""Reset FAILED sessions back to INGESTED and bump retry_count for unique job name."""
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute("""
    UPDATE sessions
       SET status = 'INGESTED',
           error_message = NULL,
           retry_count = COALESCE(retry_count, 0) + 1
     WHERE status = 'FAILED'
""")
conn.commit()
print(f"Reset {cur.rowcount} session(s) to INGESTED (retry_count incremented)")
cur.close()
conn.close()
