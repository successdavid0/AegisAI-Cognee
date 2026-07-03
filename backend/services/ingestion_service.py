"""Seed loading (Backend Spec §5). Idempotent: safe to run on every startup.

Loads the fake-Uniswap-airdrop campaign — the same demo the frontend renders —
into the app DB: cluster, sources, entities, relationships, reports, plus a few
scan/memory events so the dashboard has real activity to show.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

import models

DATA = Path(__file__).resolve().parent.parent / "data"

CLUSTERS = [
    {"id": "cluster_1", "value": "Fake Uniswap Airdrop Campaign", "risk_label": "Critical"},
]

SOURCES = [
    {"id": "src_cryptoscamdb", "name": "CryptoScamDB", "source_type": "threat_feed", "reliability_score": 0.9},
    {"id": "src_community", "name": "Community report", "source_type": "user_report", "reliability_score": 0.6},
    {"id": "src_internal", "name": "Internal graph", "source_type": "derived", "reliability_score": 0.85},
    {"id": "src_whois", "name": "WHOIS heuristic", "source_type": "heuristic", "reliability_score": 0.7},
]

REPORTS = [
    {"id": "rpt_1", "entity_id": "ent_domain_1", "source_id": "src_cryptoscamdb", "scam_type": "Fake Airdrop",
     "description": "Site asked me to approve tokens then drained my wallet.", "confidence": 0.8, "status": "verified", "age_min": 30},
    {"id": "rpt_1b", "entity_id": "ent_domain_1", "source_id": "src_community", "scam_type": "Phishing",
     "description": "Typosquat of uniswap.org promoted in a Telegram group.", "confidence": 0.7, "status": "pending", "age_min": 90},
    {"id": "rpt_2", "entity_id": "ent_handle_1", "source_id": "src_community", "scam_type": "Impersonation",
     "description": "DM'd me pretending to be Uniswap support.", "confidence": 0.7, "status": "pending", "age_min": 120},
    {"id": "rpt_3", "entity_id": "ent_wallet_1", "source_id": "src_internal", "scam_type": "Wallet Drainer",
     "description": "Received my funds after the airdrop scam.", "confidence": 0.9, "status": "verified", "age_min": 600},
    {"id": "rpt_3b", "entity_id": "ent_wallet_1", "source_id": "src_community", "scam_type": "Wallet Drainer",
     "description": "This address swept my tokens seconds after I approved.", "confidence": 0.8, "status": "pending", "age_min": 300},
    {"id": "rpt_4", "entity_id": "ent_domain_2", "source_id": "src_community", "scam_type": "Phishing",
     "description": "Looks like a MetaMask phishing clone.", "confidence": 0.6, "status": "pending", "age_min": 900},
    {"id": "rpt_4b", "entity_id": "ent_domain_2", "source_id": "src_whois", "scam_type": "Phishing",
     "description": "Registered days ago, mimics metamask.io login.", "confidence": 0.55, "status": "pending", "age_min": 1200},
    {"id": "rpt_5", "entity_id": "ent_wallet_fp", "source_id": "src_community", "scam_type": "Other",
     "description": "Might be a scam but I'm not sure, could be my mistake.", "confidence": 0.3, "status": "false_positive", "age_min": 2400},
]

# Recent scans to give the dashboard real activity.
SEED_SCANS = [
    {"value": "uniswap-airdrop-claim.io", "type": "domain", "score": 92, "label": "Critical", "age_min": 6},
    {"value": "0x9a1f2c3d4e5f60718293a4b5c6d7e8f901234567", "type": "wallet", "score": 88, "label": "Critical", "age_min": 22},
    {"value": "@uniswap_airdrop_support", "type": "handle", "score": 74, "label": "High Risk", "age_min": 51},
    {"value": "metamask-wallet-verify.com", "type": "domain", "score": 48, "label": "Suspicious", "age_min": 140},
    {"value": "vitalik.eth", "type": "handle", "score": 8, "label": "Low Risk", "age_min": 190},
]


def _now(offset_min: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=offset_min)


def _parse_date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def load_seed(db: Session) -> None:
    if db.scalar(select(models.Entity).limit(1)):
        return  # already seeded

    for c in CLUSTERS:
        db.add(models.Cluster(**c))
    for s in SOURCES:
        db.add(models.Source(**s))
    db.flush()

    entities = json.loads((DATA / "seed_entities.json").read_text())
    for e in entities:
        db.add(models.Entity(
            id=e["id"], entity_type=e["entity_type"], value=e["value"], chain=e["chain"],
            status=e["status"], risk_label=e["risk_label"], risk_score=e["risk_score"],
            confidence=e["confidence"], cluster_id=e["cluster_id"],
            first_seen=_parse_date(e["first_seen"]), last_seen=_parse_date(e["first_seen"]),
        ))
    db.flush()

    rels = json.loads((DATA / "seed_relationships.json").read_text())
    for r in rels:
        db.add(models.Relationship(
            from_entity_id=r["from"], to_entity_id=r["to"],
            relationship_type=r["relationship_type"], confidence=r["confidence"],
        ))

    for r in REPORTS:
        db.add(models.Report(
            id=r["id"], entity_id=r["entity_id"], source_id=r["source_id"],
            scam_type=r["scam_type"], description=r["description"], evidence=r["description"],
            confidence=r["confidence"], status=r["status"], created_at=_now(r["age_min"]),
        ))
    db.flush()

    # Recompute each entity's stored risk from the rule engine so the values
    # shown in the graph/dashboard match what a scan would produce. Two passes
    # so neighbour scores are populated before the flagged-neighbour checks.
    from services.risk_engine import calculate_risk

    all_entities = db.scalars(select(models.Entity)).all()
    for _ in range(2):
        for ent in all_entities:
            verdict = calculate_risk(db, ent)
            ent.risk_score = verdict["score"]
            ent.risk_label = verdict["label"]
            ent.confidence = verdict["confidence"]
        db.flush()

    for i, sc in enumerate(SEED_SCANS):
        db.add(models.ScanEvent(
            id=f"scan_seed_{i}", input_value=sc["value"], input_type=sc["type"],
            risk_score=sc["score"], risk_label=sc["label"], confidence=0.8,
            explanation_json="{}", created_at=_now(sc["age_min"]),
        ))

    # A couple of memory events so the lifecycle/dashboard isn't empty.
    db.add(models.MemoryEvent(
        id="mem_seed_1", event_type="improve", entity_id="ent_domain_1",
        summary="Linked entities into the Fake Uniswap Airdrop cluster",
        reason="Enrichment matched shared wallet + domain patterns.", created_at=_now(45),
    ))
    db.add(models.MemoryEvent(
        id="mem_seed_2", event_type="forget", entity_id="ent_wallet_fp",
        summary="Downgraded a stale false-positive claim",
        reason="Address cleared by admin review; -50 correction applied.", created_at=_now(20),
    ))

    db.commit()
