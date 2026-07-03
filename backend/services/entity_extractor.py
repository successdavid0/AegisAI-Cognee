"""Entity extraction — classify and normalize scan input (Backend Spec §5).

Detects wallet, contract, transaction hash, URL, domain, social handle, or
message. Contracts vs wallets are indistinguishable by shape alone, so a plain
40-hex address is classified as `wallet`; the DB may later reclassify it.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

_WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_TX_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")
_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$")
_HANDLE_HOST_RE = re.compile(r"^(t\.me|telegram|twitter|x)\.com/", re.IGNORECASE)


def detect_entity_type(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return "unknown"
    if _WALLET_RE.match(v):
        return "wallet"
    if _TX_RE.match(v):
        return "tx"
    if v.startswith("@") or _HANDLE_HOST_RE.match(v):
        return "handle"
    if re.match(r"^https?://", v, re.IGNORECASE):
        return "url"
    if _DOMAIN_RE.match(v):
        return "domain"
    if len(v.split()) > 3:
        return "message"
    return "unknown"


def normalize_entity(value: str, entity_type: str) -> str:
    """Canonicalize a value for stable matching."""
    v = (value or "").strip()
    if entity_type in {"wallet", "contract", "tx"}:
        return v.lower()
    if entity_type == "domain":
        return v.lower().rstrip("/")
    if entity_type == "url":
        parsed = urlparse(v)
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"
    if entity_type == "handle":
        return v if v.startswith("@") else v.lower()
    return v
