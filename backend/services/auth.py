"""Admin authentication (Backend Spec §11).

State-mutating admin/memory routes require an `X-Admin-Key` header matching
`settings.admin_api_key`. Behaviour when no key is configured:
  * production  -> fail closed (503) so we never ship an open admin surface.
  * development -> allow (keeps the local demo frictionless).
Comparison is constant-time to avoid timing attacks.
"""
from __future__ import annotations

import secrets

from fastapi import Header, HTTPException

from config import settings


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    configured = settings.admin_api_key
    if not configured:
        if settings.is_production:
            raise HTTPException(
                status_code=503,
                detail="Admin actions are disabled: ADMIN_API_KEY is not configured.",
            )
        return  # development convenience — no key set, allow.
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured):
        raise HTTPException(status_code=401, detail="Invalid or missing admin key.")
