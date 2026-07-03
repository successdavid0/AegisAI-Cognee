"""Cognee memory service wrapper (Backend Spec §9, TRD §9).

The ONLY module that talks to Cognee. Routes call these functions; they never
import Cognee directly, so we can swap transport later without touching routes.

This targets the Cognee **cloud API** for the configured tenant:
  * remember  → POST /api/v1/remember   (multipart/form-data, X-Api-Key)
  * recall    → POST /api/v1/recall     (application/json, X-Api-Key)
Cognify runs automatically in the background after a remember, so there is no
separate "improve" call; enrichment and corrections are appended as new memory
(memory is append-only — a "forget" is recorded as a correction note).

Until COGNEE_BASE_URL + COGNEE_API_KEY are set, the wrapper runs in graceful
"local-simulation" mode (no network). Every call is non-fatal: transport errors
are caught and returned as structured results, never raised (error contract §11).
"""
from __future__ import annotations

import json
import logging

import httpx

from config import settings

log = logging.getLogger("cognee")

DATASET = settings.cognee_dataset


def status() -> dict:
    return {
        "enabled": settings.cognee_enabled,
        "mode": "cloud" if settings.cognee_enabled else "local-simulation",
        "dataset": DATASET,
        "base_url": settings.cognee_base_url or None,
    }


def _headers() -> dict:
    # Cognee cloud authenticates with X-Api-Key only.
    return {"X-Api-Key": settings.cognee_api_key}


async def _remember_text(text: str, node_set: str, dataset: str = DATASET) -> dict:
    """POST a natural-language memory to /api/v1/remember (multipart)."""
    if not settings.cognee_enabled:
        return {"ok": True, "mode": "local", "simulated": True}
    url = settings.cognee_base_url.rstrip("/") + "/api/v1/remember"
    files = {"data": (f"{node_set}.txt", text.encode("utf-8"), "text/plain")}
    data = {
        "datasetName": dataset,
        "node_set": node_set,
        "run_in_background": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, files=files, data=data, headers=_headers())
            resp.raise_for_status()
            body = resp.json() if resp.content else {}
            return {"ok": True, "mode": "cloud", "data": body}
    except Exception as exc:  # noqa: BLE001 — must never break the request
        log.warning("Cognee remember failed: %s", exc)
        return {"ok": False, "mode": "cloud", "error": str(exc)}


# ---- Public wrapper API (Backend Spec §9) ----
async def remember_memory(payload: dict, dataset: str = DATASET) -> dict:
    """Store scam evidence / report / relationship / scan / correction."""
    node_set = str(payload.get("type", "memory"))
    text = _payload_to_text(payload)
    return await _remember_text(text, node_set, dataset)


async def recall_memory(query: str, dataset: str = DATASET) -> dict:
    """Retrieve related scam memories and context for a query."""
    if not settings.cognee_enabled:
        return {"ok": True, "mode": "local", "simulated": True, "results": []}
    url = settings.cognee_base_url.rstrip("/") + "/api/v1/recall"
    body = {"query": query, "top_k": 5, "datasets": [dataset]}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                url, json=body, headers={**_headers(), "Content-Type": "application/json"}
            )
            resp.raise_for_status()
            results = resp.json() if resp.content else []
            return {"ok": True, "mode": "cloud", "results": results}
    except Exception as exc:  # noqa: BLE001
        # A fresh dataset returns 409 until cognify completes — expected, non-fatal.
        log.info("Cognee recall unavailable (%s)", exc)
        return {"ok": False, "mode": "cloud", "error": str(exc), "results": []}


async def improve_memory(dataset: str = DATASET) -> dict:
    """Enrichment. Cognify runs automatically after remember, so we append an
    enrichment note that Cognee will link into the graph."""
    return await _remember_text(
        "Enrichment pass: linked entities in the Fake Uniswap Airdrop campaign into a "
        "single scam cluster based on shared drainer wallet and domain patterns.",
        node_set="improve",
        dataset=dataset,
    )


async def forget_memory(target: str, reason: str, dataset: str = DATASET) -> dict:
    """Correction. Memory is append-only, so a forget is recorded as a reasoned
    correction note that supersedes the prior claim."""
    return await _remember_text(
        f"Correction ({reason}): the claim about {target} has been downgraded/cleared "
        f"by admin review. Future risk scoring should discount it.",
        node_set="forget",
        dataset=dataset,
    )


def _payload_to_text(payload: dict) -> str:
    """Render a structured payload as the natural-language text Cognee ingests."""
    t = payload.get("type")
    if t == "scan_event":
        return (
            f"Scan of {payload.get('value')} returned risk "
            f"{payload.get('risk_label')} ({payload.get('risk_score')}/100)."
        )
    if t == "report":
        return (
            f"User report: {payload.get('value')} was reported as a "
            f"{payload.get('scam_type')} scam (status: {payload.get('status', 'pending')})."
        )
    return json.dumps(payload)
