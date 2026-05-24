"""
SSM Parameter Store helper — caches values for the Lambda lifetime.
"""
import os
import boto3
from functools import lru_cache

_ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))


@lru_cache(maxsize=32)
def get_param(name: str, with_decryption: bool = True) -> str:
    """Fetch a parameter from SSM, caching the result in memory."""
    response = _ssm.get_parameter(Name=name, WithDecryption=with_decryption)
    return response["Parameter"]["Value"]
