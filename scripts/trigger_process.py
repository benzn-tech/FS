"""Manually invoke process_transcript for completed/failed Transcribe jobs."""
import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

# Map job_name -> session_id (job name may have -r1 suffix)
# Completed jobs that need processing:
JOBS = [
    {"job_name": "775fbe4b-2ac3-4d95-8e27-7fd63ea5cfbe-r1", "session_id": "775fbe4b-2ac3-4d95-8e27-7fd63ea5cfbe", "status": "COMPLETED"},
    {"job_name": "2b54acc7-8aca-4232-bd0d-edf08970952d-r1",  "session_id": "2b54acc7-8aca-4232-bd0d-edf08970952d",  "status": "FAILED",    "reason": "The input media file length is too small."},
    {"job_name": "32155eea-9eb7-4da1-ade7-81d528869cd9",     "session_id": "32155eea-9eb7-4da1-ade7-81d528869cd9",  "status": "FAILED",    "reason": "Transcription job failed"},
    {"job_name": "77999a62-ac3e-4c16-9ff4-cb6c9ed0df35",     "session_id": "77999a62-ac3e-4c16-9ff4-cb6c9ed0df35",  "status": "COMPLETED"},
]

session = boto3.Session(profile_name='AdministratorAccess-164088480050')
lam = session.client('lambda', region_name='ap-southeast-2')

for job in JOBS:
    payload = {
        "source": "aws.transcribe",
        "detail-type": "Transcribe Job State Change",
        "detail": {
            "TranscriptionJobName": job["job_name"],
            "TranscriptionJobStatus": job["status"],
        }
    }
    if "reason" in job:
        payload["detail"]["FailureReason"] = job["reason"]

    resp = lam.invoke(
        FunctionName='fieldsightai-process-transcript',
        InvocationType='RequestResponse',
        Payload=json.dumps(payload).encode()
    )
    result = json.loads(resp['Payload'].read())
    print(f"[{job['status']}] {job['session_id'][:8]}... -> HTTP {resp['StatusCode']} | {result}")
