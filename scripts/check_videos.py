import os
from dotenv import load_dotenv
load_dotenv(r'C:\Users\jwild\Claude Code\FieldSightAI\.env.local')
import hashlib, hmac, requests, json
from urllib.parse import urlparse, urlunparse

B = 'https://api.realptt.com'

def sha1(v): return hashlib.sha1(v.encode()).hexdigest()
def hmac1(k, m): return hmac.new(k.encode(), m.encode(), hashlib.sha1).hexdigest()
def inj(url, s):
    p = urlparse(url)
    return urlunparse(p._replace(path=f'{p.path};jsessionid={s}'))

h = requests.Session()
r = h.get(f'{B}/ptt/random', timeout=30).json()['data']
pwd = hmac1(r['random'], sha1(os.environ['REALPTT_PASSWORD']))
h.get(inj(f'{B}/ptt/organization', r['sessionId']),
      params={'method': 'login', 'account': os.environ['REALPTT_ACCOUNT'],
              'pwd': pwd, 'timeZoneOffset': -480}, timeout=30)
sid = r['sessionId']

# Check all 7 user accounts
for user in ['Benl1', 'Benl2', 'Benl3', 'Benl4', 'Benl5', 'Benl6', 'Benl7']:
    resp = h.get(inj(f'{B}/ptt/video', sid),
                 params={'method': 'get', 'start_time': '2020-01-01 00:00:00',
                         'page': 1, 'limit': 5, 'user_account': user},
                 timeout=30).json()
    total = resp['data'].get('total', 0)
    videos = resp['data'].get('videos', [])
    print(f'{user}: total={total}, sample={[v["time"] for v in videos[:2]]}')

# Check audio recordings per group (group_id or user_account is required)
print('\n--- Checking audio recordings per group ---')
for gid, gname in [(182776, 'SouthIsland'), (177843, 'NorthIsland'), (184743, 'Queenstown')]:
    resp2 = h.get(inj(f'{B}/ptt/audio', sid),
                  params={'method': 'get', 'start_time': '2020-01-01 00:00:00',
                          'page': 0, 'limit': 5, 'group_id': gid},
                  timeout=30).json()
    total = resp2['data'].get('pageSize', 0)
    audios = resp2['data'].get('audios', [])
    print(f'{gname} (id={gid}): pageSize={total}, sample times={[a["time"] for a in audios[:2]]}')

# Also check video per group using the uploadFile endpoint with correct date format
print('\n--- Checking uploadFile (video uploads) per user ---')
for user in ['Benl1', 'Benl2', 'Benl3']:
    resp3 = h.get(inj(f'{B}/ptt/uploadFile', sid),
                  params={'method': 'get', 'start_time': '2020-01-01',
                          'end_time': '2026-12-31', 'page': 1, 'limit': 5,
                          'user_account': user, 'sort': 1},
                  timeout=30).json()
    print(f'{user}: {json.dumps(resp3["data"])}' )
