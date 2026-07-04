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
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from database import SessionLocal, init_db
from ratelimit import limiter
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

    # Startup self-check — lands in the deploy logs so a misconfigured
    # environment (missing/mispasted secrets, wrong tenant URL) is visible
    # immediately, not only when a user hits the status page.
    log.info(
        "AEGIS backend starting: env=%s db=%s cors_origins=%s",
        settings.app_env, settings.database_url.split(":", 1)[0], settings.origins,
    )
    cog = cognee_service.status()
    log.info(
        "Cognee config: enabled=%s mode=%s dataset=%s base_url=%s api_key=%s",
        cog["enabled"], cog["mode"], cog["dataset"], cog["base_url"],
        cognee_service.key_fingerprint(),
    )
    if cog["enabled"]:
        ping = await cognee_service.ping()
        info = await cognee_service.dataset_info()
        if ping.get("reachable") and info.get("records") is not None:
            log.info(
                "Cognee LIVE: %s records in '%s' (latency %s ms, processing %s)",
                info["records"], cog["dataset"], ping.get("latency_ms"),
                info.get("processing_status"),
            )
        else:
            log.error(
                "Cognee NOT reachable from this deployment: ping=%s dataset_info=%s",
                ping, info,
            )
    else:
        log.warning(
            "Cognee DISABLED (local-simulation): set COGNEE_BASE_URL and "
            "COGNEE_API_KEY to connect the real memory base."
        )
    log.info("AEGIS backend ready.")
    yield


app = FastAPI(
    title="AEGIS API",
    description="AEGIS — Adaptive Entity Graph Intelligence for Scams. "
    "AI-powered scam intelligence with a living Cognee memory graph.",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting (slowapi) — the limiter is shared with the /scan + /report routes.
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,  # app uses no cookies; safer with restricted origins
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---- JSON-only error contract (Backend Spec §11) ----
@app.exception_handler(RateLimitExceeded)
async def rate_limit_error(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": True, "message": "Too many requests. Please slow down.", "details": None},
    )



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
