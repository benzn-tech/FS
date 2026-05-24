import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
import psycopg2
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute('SELECT media_type, status, COUNT(*) FROM sessions GROUP BY media_type, status ORDER BY media_type, status')
rows = cur.fetchall()
print("media_type   status               count")
print("-" * 40)
for r in rows:
    print(str(r[0]).ljust(12), str(r[1]).ljust(20), r[2])
cur.execute('SELECT COUNT(*) FROM sessions')
print("\nTotal sessions:", cur.fetchone()[0])
cur.close()
conn.close()
