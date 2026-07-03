"""Explainable rule-based risk engine (Backend Spec §10, PRD §8).

Deliberately rule-based so every verdict is explainable: each signal contributes
a fixed weight and a human-readable reason. The score is the sum of matched
signals, clamped to 0–100.
"""
from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

import models

# (label bands mirror PRD §8 / Backend Spec §10)
def label_from_score(score: int) -> str:
    if score <= 30:
        return "Low Risk"
    if score <= 60:
        return "Suspicious"
    if score <= 80:
        return "High Risk"
    return "Critical"


def _neighbors(db: Session, entity_id: str) -> list[models.Entity]:
    rels = db.scalars(
        select(models.Relationship).where(
            or_(
                models.Relationship.from_entity_id == entity_id,
                models.Relationship.to_entity_id == entity_id,
            )
        )
    ).all()
    ids = set()
    for r in rels:
        ids.add(r.to_entity_id if r.from_entity_id == entity_id else r.from_entity_id)
    if not ids:
        return []
    return db.scalars(select(models.Entity).where(models.Entity.id.in_(ids))).all()


def calculate_risk(db: Session, entity: models.Entity | None) -> dict:
    """Return {score, label, confidence, reasons, evidence}."""
    reasons: list[dict] = []
    evidence: list[dict] = []

    if entity is None:
        return {
            "score": 0,
            "label": "Low Risk",
            "confidence": 0.4,
            "reasons": [{"text": "No verified scam evidence found", "weight": 0}],
            "evidence": [],
        }

    reports = list(entity.reports)
    verified_reports = [r for r in reports if r.status == "verified"]
    false_positives = [r for r in reports if r.status == "false_positive"]
    neighbors = _neighbors(db, entity.id)

    score = 0

    # 1. Verified scam source (+40)
    if verified_reports or entity.status == "verified":
        score += 40
        reasons.append({"text": "Verified scam source", "weight": 40})

    # 2. Connected to a flagged wallet (+25)
    flagged_wallet = next(
        (n for n in neighbors if n.entity_type == "wallet" and (n.risk_score or 0) >= 61),
        None,
    )
    if flagged_wallet:
        score += 25
        reasons.append({"text": "Connected to flagged wallet", "weight": 25})
        evidence.append({
            "description": f"Linked to flagged wallet {flagged_wallet.value}",
            "source": "Internal graph", "source_type": "derived", "reliability": 0.85,
        })

    # 3. Linked to a phishing domain (+20)
    phishing_domain = next(
        (n for n in neighbors if n.entity_type == "domain" and (n.risk_score or 0) >= 61),
        None,
    )
    if phishing_domain:
        score += 20
        reasons.append({"text": "Linked to phishing domain", "weight": 20})

    # 4. Multiple user reports (+15)
    if len(reports) >= 2:
        score += 15
        reasons.append({"text": "Multiple user reports", "weight": 15})

    # 5. Similar scam message pattern (+10)
    if entity.entity_type == "message" or any(
        n.entity_type == "message" for n in neighbors
    ):
        score += 10
        reasons.append({"text": "Similar scam message pattern detected", "weight": 10})

    # 6. Scam cluster membership (+20)
    if entity.cluster_id:
        score += 20
        reasons.append({"text": "Member of an active scam cluster", "weight": 20})

    # 7. False-positive marker (-50)
    if false_positives:
        score -= 50
        reasons.append({"text": "Cleared false-positive correction applied", "weight": -50})

    score = max(0, min(score, 100))

    if not reasons:
        reasons.append({"text": "No verified scam evidence found", "weight": 0})

    # Evidence from reports + their sources.
    for r in reports:
        src = db.get(models.Source, r.source_id) if r.source_id else None
        evidence.append({
            "description": r.evidence or r.description,
            "source": src.name if src else "Community report",
            "source_type": src.source_type if src else "user_report",
            "reliability": src.reliability_score if src else 0.6,
        })

    positive_signals = sum(1 for r in reasons if r["weight"] > 0)
    confidence = round(min(0.5 + 0.1 * positive_signals, 0.95), 2)
    if score == 0:
        confidence = 0.4

    return {
        "score": score,
        "label": label_from_score(score),
        "confidence": confidence,
        "reasons": reasons,
        "evidence": evidence,
    }
