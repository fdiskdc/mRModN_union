"""Small dependency-free signed session tokens for the WeChat client."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Optional


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_session_token(openid: str, secret: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {"sub": openid, "iat": now, "exp": now + ttl_seconds}
    encoded = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _b64encode(hmac.new(secret.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256).digest())
    return f"{encoded}.{signature}"


def verify_session_token(token: str, secret: str, now: Optional[int] = None) -> Optional[dict]:
    if not token or "." not in token or not secret:
        return None
    encoded, signature = token.split(".", 1)
    expected = _b64encode(hmac.new(secret.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        payload = json.loads(_b64decode(encoded))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    current = int(time.time()) if now is None else now
    if not payload.get("sub") or int(payload.get("exp", 0)) <= current:
        return None
    return payload
