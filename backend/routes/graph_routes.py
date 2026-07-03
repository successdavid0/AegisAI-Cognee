"""Graph route (Backend Spec §4, TRD §7)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import schemas
from database import get_db
from services.graph_builder import build_entity_graph

router = APIRouter(tags=["graph"])


@router.get("/graph/{entity_value:path}", response_model=schemas.GraphData)
def graph(entity_value: str, depth: int = 1, db: Session = Depends(get_db)):
    data = build_entity_graph(db, entity_value, depth=depth)
    return schemas.GraphData(
        root=data["root"],
        nodes=[schemas.GraphNode(**n) for n in data["nodes"]],
        edges=[schemas.GraphEdge(**e) for e in data["edges"]],
    )
