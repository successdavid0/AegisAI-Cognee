"""Graph builder — nodes + edges around an entity (Backend Spec §5, TRD §4).

Uses NetworkX for a clean BFS expansion, then serializes to the frontend's
GraphData shape (nodes + edges, with the scam-cluster node attached).
"""
from __future__ import annotations

import networkx as nx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

import models
from services.entity_extractor import detect_entity_type, normalize_entity


def _node_dict(e: models.Entity) -> dict:
    return {
        "id": e.id,
        "value": e.value,
        "type": e.entity_type,
        "risk_label": e.risk_label,
        "risk_score": e.risk_score,
    }


def build_entity_graph(db: Session, value: str, depth: int = 1) -> dict:
    etype = detect_entity_type(value)
    norm = normalize_entity(value, etype)
    root = db.scalar(select(models.Entity).where(models.Entity.value == norm))
    if root is None:
        root = db.scalar(select(models.Entity).where(models.Entity.value == value))

    if root is None:
        # Unknown entity: return a lone node so the UI can still center on it.
        return {
            "root": value,
            "nodes": [{
                "id": "ent_" + str(abs(hash(value)) % 10_000_000),
                "value": value, "type": etype,
                "risk_label": "Unknown", "risk_score": None,
            }],
            "edges": [],
        }

    g = nx.Graph()
    g.add_node(root.id)
    frontier = {root.id}
    all_rel_ids: set[int] = set()

    for _ in range(max(1, depth)):
        if not frontier:
            break
        rels = db.scalars(
            select(models.Relationship).where(
                or_(
                    models.Relationship.from_entity_id.in_(frontier),
                    models.Relationship.to_entity_id.in_(frontier),
                )
            )
        ).all()
        next_frontier: set[str] = set()
        for r in rels:
            all_rel_ids.add(r.id)
            g.add_edge(r.from_entity_id, r.to_entity_id)
            for nid in (r.from_entity_id, r.to_entity_id):
                if nid not in g.nodes or nid not in frontier:
                    next_frontier.add(nid)
        frontier = next_frontier - set(frontier)

    entities = db.scalars(
        select(models.Entity).where(models.Entity.id.in_(list(g.nodes)))
    ).all()
    nodes = [_node_dict(e) for e in entities]

    edges = []
    seen_edges = set()
    for rid in all_rel_ids:
        r = db.get(models.Relationship, rid)
        if not r:
            continue
        key = frozenset((r.from_entity_id, r.to_entity_id))
        if key in seen_edges:
            continue
        seen_edges.add(key)
        edges.append({
            "from": r.from_entity_id,
            "to": r.to_entity_id,
            "relationship_type": r.relationship_type,
            "confidence": r.confidence,
        })

    # Attach the scam cluster node + membership edges.
    cluster_ids = {e.cluster_id for e in entities if e.cluster_id}
    for cid in cluster_ids:
        cluster = db.get(models.Cluster, cid)
        if not cluster:
            continue
        nodes.append({
            "id": cluster.id, "value": cluster.value, "type": "cluster",
            "risk_label": cluster.risk_label, "risk_score": None,
        })
        for e in entities:
            if e.cluster_id == cid:
                edges.append({
                    "from": cluster.id, "to": e.id,
                    "relationship_type": "cluster_member", "confidence": 0.8,
                })

    return {"root": root.value, "nodes": nodes, "edges": edges}
