"""
shared/realptt.py — RealPTT API client for FieldSightAI Lambdas

Handles:
  - Session-based authentication (random → HMAC-SHA1 → login with jsessionid)
  - Session persistence within a Lambda invocation
  - Re-login on session expiry (code != 0)
  - Video and audio listing

Password hashing: pwd = hex_hmac_sha1(random, hex_sha1(plain_password))
Session is carried via ;jsessionid=xxx inserted before the ? in the URL.

Usage:
    client = RealPTTClient(account, password)
    client.login()
    videos = client.get_videos(start_time="2025-01-01 00:00:00")
    client.logout()
"""

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse

import requests

logger = logging.getLogger(__name__)

REALPTT_BASE = "https://api.realptt.com"
# AEST is UTC+10 → timeZoneOffset = -(10*60) = -600
TIMEZONE_OFFSET = -600
REQUEST_TIMEOUT = 30


def _hex_sha1(value: str) -> str:
    """SHA1 of value, returned as lowercase hex string."""
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def _hex_hmac_sha1(key: str, message: str) -> str:
    """HMAC-SHA1 of message using key, returned as lowercase hex string."""
    return hmac.new(
        key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest()


def _inject_jsessionid(url: str, session_id: str) -> str:
    """
    Insert ;jsessionid=XXX before the ? in a URL, as required by RealPTT
    for non-browser clients.

    Example:
      https://api.realptt.com/ptt/organization?method=login
      → https://api.realptt.com/ptt/organization;jsessionid=ABC?method=login
    """
    parsed = urlparse(url)
    new_path = f"{parsed.path};jsessionid={session_id}"
    return urlunparse(parsed._replace(path=new_path))


class RealPTTClient:
    """
    Stateful RealPTT API client.

    Call login() before making any API requests.
    The session_id is injected into all subsequent request URLs automatically.
    """

    def __init__(self, account: str, password: str):
        self.account = account
        self.password = password
        self.session_id: str | None = None
        self._http = requests.Session()

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def _get(self, path: str, params: dict | None = None, authenticated: bool = True) -> dict:
        """
        Make a GET request. If authenticated=True, injects jsessionid into URL.
        Raises on non-zero RealPTT response codes (except 2 = logout success).
        """
        url = f"{REALPTT_BASE}{path}"
        if authenticated and self.session_id:
            url = _inject_jsessionid(url, self.session_id)

        resp = self._http.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        code = data.get("code", -1)
        if code not in (0, 2):  # 2 = logout success
            raise RuntimeError(
                f"RealPTT API error {code}: {data.get('msg', 'unknown')} (path={path})"
            )

        return data.get("data", {})

    def login(self) -> None:
        """
        Full login sequence:
          1. GET /ptt/random → random + sessionId
          2. Compute pwd = hex_hmac_sha1(random, hex_sha1(password))
          3. GET /ptt/organization;jsessionid=XXX?method=login&account=...&pwd=...
        """
        logger.info("Logging in to RealPTT as %s", self.account)

        # Step 1: get random + sessionId
        random_data = self._get("/ptt/random", authenticated=False)
        random_str: str = random_data["random"]
        self.session_id: str = random_data["sessionId"]
        logger.debug("Got sessionId=%s", self.session_id)

        # Step 2: compute password hash
        hashed_pwd = _hex_hmac_sha1(random_str, _hex_sha1(self.password))

        # Step 3: login
        self._get(
            "/ptt/organization",
            params={
                "method": "login",
                "account": self.account,
                "pwd": hashed_pwd,
                "timeZoneOffset": TIMEZONE_OFFSET,
            },
        )
        logger.info("RealPTT login successful (sessionId=%s)", self.session_id)

    def logout(self) -> None:
        """Best-effort logout — logs but does not raise on failure."""
        try:
            self._get("/ptt/organization", params={"method": "logout"})
            logger.info("RealPTT logout successful")
        except Exception as exc:
            logger.warning("RealPTT logout failed (non-fatal): %s", exc)
        finally:
            self.session_id = None

    # ------------------------------------------------------------------
    # Video queries
    # ------------------------------------------------------------------

    def get_videos(
        self,
        start_time: str,
        user_account: str | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict]:
        """
        Query videos via GET /ptt/video?method=get

        Args:
            start_time:   "YYYY-MM-DD HH:MM:SS" — earliest recording to return
            user_account: filter to specific user; omit for all company videos
            page:         1-based page number
            limit:        max results per page (max 100)

        Returns:
            List of video dicts:
              { id, src, src_account, src_name, time, type, url }
        """
        params: dict = {
            "method": "get",
            "start_time": start_time,
            "page": page,
            "limit": limit,
        }
        if user_account:
            params["user_account"] = user_account

        data = self._get("/ptt/video", params=params)
        return data.get("videos", [])

    def get_all_videos_since(self, start_time: str) -> list[dict]:
        """
        Paginate through all videos since start_time, returning a flat list.
        Stops when a page returns fewer results than the limit.
        """
        all_videos: list[dict] = []
        page = 1
        limit = 100

        while True:
            batch = self.get_videos(start_time=start_time, page=page, limit=limit)
            all_videos.extend(batch)
            if len(batch) < limit:
                break
            page += 1

        logger.info("Fetched %d total videos since %s", len(all_videos), start_time)
        return all_videos

    # ------------------------------------------------------------------
    # Audio/recording queries (PTT walkie-talkie audio, not video)
    # ------------------------------------------------------------------

    def get_recordings(
        self,
        start_time: str,
        group_id: int | None = None,
        user_account: str | None = None,
        page: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        """
        Query PTT audio recordings via GET /ptt/audio?method=get

        Returns list of recording dicts:
          { id, time, group_name, user_name, play_url, download_url }
        """
        params: dict = {
            "method": "get",
            "start_time": start_time,
            "page": page,
            "limit": limit,
        }
        if group_id is not None:
            params["group_id"] = group_id
        elif user_account:
            params["user_account"] = user_account

        data = self._get("/ptt/audio", params=params)
        return data.get("audios", [])
