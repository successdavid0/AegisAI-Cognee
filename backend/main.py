"""SentinelGraph FastAPI backend — entry point.

Run:  uvicorn main:app --reload --port 8000

Wires CORS for the Next.js frontend, JSON-only error handling (Backend Spec
§11), startup DB init + seed, and all route modules. The frontend consumes this
directly once NEXT_PUBLIC_MOCK_ONLY=false.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from database import SessionLocal, init_db
from routes import (
    admin_routes, graph_routes, memory_routes, report_routes, scan_routes, stats_routes,
)
from services import cognee_service
from services.ingestion_service import load_seed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sentinelgraph")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        load_seed(db)
    finally:
        db.close()
    log.info("AEGIS backend ready. Cognee: %s", cognee_service.status())
    yield


app = FastAPI(
    title="AEGIS API",
    description="AEGIS — Adaptive Entity Graph Intelligence for Scams. "
    "AI-powered scam intelligence with a living Cognee memory graph.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- JSON-only error contract (Backend Spec §11) ----
@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": str(exc.detail), "details": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": True, "message": "Invalid request.", "details": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "Something went wrong.", "details": None},
    )


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "cognee": cognee_service.status()}


for r in (scan_routes, report_routes, graph_routes, admin_routes, memory_routes, stats_routes):
    app.include_router(r.router)
