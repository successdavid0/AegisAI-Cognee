# AEGIS — Backend (FastAPI)

The intelligence controller for **AEGIS** (Adaptive Entity Graph Intelligence
for Scams). It validates input, extracts
and normalizes entities, calls Cognee, queries the app database, computes an
**explainable rule-based risk score**, builds threat-graph data, records the
memory lifecycle, and returns stable JSON that the Next.js frontend consumes
directly.

Stack: **FastAPI · SQLAlchemy 2 · SQLite · Pydantic v2 · NetworkX · httpx**.

## Contract-first

Response shapes match `web/src/lib/types.ts` field-for-field, so the frontend
works live with **zero changes** — just set `NEXT_PUBLIC_MOCK_ONLY=false`.

## Run

```bash
cd sentinelgraph/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional; sensible defaults built in
uvicorn main:app --reload --port 8000
```

- API: http://localhost:8000  ·  Interactive docs: http://localhost:8000/docs
- SQLite DB (`sentinelgraph.db`) is created and **seeded** on first startup with
  the fake-Uniswap-airdrop campaign — the same demo the frontend renders.
- Delete `sentinelgraph.db` to reset to a pristine seed.

## Endpoints (Backend Spec §4)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/scan` | Detect type → recall → score → persist → remember |
| GET | `/scans/recent` | Recent scan history |
| POST | `/report` | Submit a scam report as a pending claim |
| GET | `/reports/recent` | Recent reports |
| GET | `/graph/{value}?depth=` | Nodes + edges around an entity (+ cluster) |
| GET | `/memory/lifecycle/{scan_id}` | recall/remember/improve/forget events |
| POST | `/memory/improve` | Enrich & link memories into clusters |
| POST | `/memory/forget` | Forget/correct false or stale memory |
| GET | `/admin/reports` | All reports for review |
| POST | `/admin/reports/{id}/verify` · `/reject` · `/duplicate` · `/false-positive` | Review actions |
| GET | `/stats` | Dashboard KPIs |
| GET | `/entity/{value}` | Full entity profile |
| GET | `/health` | Liveness + Cognee status |

## Risk engine (explainable, Backend Spec §10)

Rule-based so every verdict is explainable. Signals and weights:

| Signal | Weight |
| --- | --- |
| Verified scam source | +40 |
| Connected to flagged wallet | +25 |
| Linked to phishing domain | +20 |
| Multiple user reports | +15 |
| Similar scam message pattern | +10 |
| Scam cluster membership | +20 |
| False-positive marker | −50 |

Score clamps to 0–100 → Low (0–30) / Suspicious (31–60) / High (61–80) /
Critical (81–100). Each matched signal returns a `{text, weight}` reason.

## Cognee integration

`services/cognee_service.py` is the **only** module that talks to Cognee (routes
never call it directly, per Spec §9). It exposes `remember_memory`,
`recall_memory`, `improve_memory`, `forget_memory`.

- **No credentials yet** → graceful **local-simulation** mode: no network calls,
  and the memory lifecycle is still fully recorded in the DB (the source of
  truth for the UI). The product works end to end.
- **With credentials** → set `COGNEE_BASE_URL` + `COGNEE_API_KEY` in `.env` to
  activate real Cognee cloud calls. Every call is **non-fatal**: transport errors
  are caught and surfaced in the memory event note, never crashing a request.

```env
COGNEE_BASE_URL=https://tenant-xxxx.aws.cognee.ai
COGNEE_API_KEY=sk-...
COGNEE_DATASET=global-threat-intel
```

> Cloud endpoint paths (`/api/v1/add|search|cognify|forget`) are centralized in
> `cognee_service.py`; adjust there to match the exact Cognee API once the key is
> live — no other file changes needed.

## Layout

```
backend/
  main.py              FastAPI app, CORS, JSON error contract, startup seed
  config.py            env settings (pydantic-settings)
  database.py          engine / session / Base
  models.py            Entity, Cluster, Source, Report, Relationship,
                       ScanEvent, MemoryEvent, ForgetEvent
  schemas.py           Pydantic response models (match web/src/lib/types.ts)
  routes/              scan, report, graph, admin, memory, stats
  services/            entity_extractor, risk_engine, graph_builder,
                       cognee_service, report_service, ingestion_service, common
  data/                seed_entities / seed_relationships / demo_scam_messages
```

## Verified

- ✅ Seeds on startup with no errors; `/health` returns `ok`.
- ✅ 21-point contract check passes: every endpoint returns the exact shape the
  frontend expects (reasons `{text,weight}`, graph edges with `from` alias,
  cluster node, OpAck `events`, entity-type detection, etc.).
- ✅ CORS allows the Next.js origin; frontend runs live against it.
- ✅ Real Cognee cloud calls succeed (`/api/v1/remember` + `/api/v1/recall` → 200).
