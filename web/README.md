# AEGIS — Web (Next.js)

Professional web frontend for **AEGIS** (Adaptive Entity Graph Intelligence for
Scams), an AI-powered scam-intelligence
product built around Cognee's living memory graph. Users scan suspicious wallets
/ domains / URLs / contracts / social handles / messages, get an **explainable**
risk verdict, explore the **threat graph** of connected entities, and watch the
**Cognee memory lifecycle** (recall · remember · improve · forget).

Built with the Frontend Spec's *stretch* stack: **Next.js 16 (App Router) +
TypeScript + Tailwind v4 + React Flow (@xyflow/react)**, with Framer Motion and
lucide-react, on a dark "threat-intelligence console" design system.

This is the **frontend only**. It consumes the FastAPI backend over HTTP and
never touches Cognee or the database directly (Frontend Spec §9).

## Backend-optional by design

The backend is not built yet. Every call in `src/lib/api.ts` transparently falls
back to **seeded demo data** (`src/lib/mock.ts`) when the backend is unreachable,
so the whole UI is fully demonstrable today. A **LIVE / DEMO** badge on each page
shows the data source. The seeded data models the PRD demo story: a fake Uniswap
airdrop domain wired to a drainer wallet, an impersonating Telegram support
handle, a malicious contract, and the scam cluster tying them together.

## Run

```bash
cd sentinelgraph/web
npm install          # already done in this workspace
npm run dev          # http://localhost:3000
```

Production build / serve:

```bash
npm run build        # uses --turbopack
npm start
```

### Switching to the live backend

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_MOCK_ONLY=false and NEXT_PUBLIC_API_URL to your backend
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend base URL |
| `NEXT_PUBLIC_MOCK_ONLY` | `true` | Force seeded demo data (no network) |

## Pages (Frontend Spec §4)

| Route | Page | Backend endpoints |
| --- | --- | --- |
| `/` | Dashboard | `GET /stats`, `/scans/recent`, `/reports/recent` |
| `/scan` | Scan | `POST /scan`, `GET /memory/lifecycle/{id}`, `/graph/{v}` |
| `/graph` | Threat Graph (React Flow) | `GET /graph/{v}` |
| `/report` | Report Scam | `POST /report` |
| `/memory` | Memory Lifecycle | `GET /memory/lifecycle/{id}`, `POST /memory/improve`, `/memory/forget` |
| `/admin` | Admin Review | `GET /admin/reports` + admin actions |
| `/entity` · `/entity/[value]` | Entity Lookup / Detail | `GET /entity/{v}`, `/graph/{v}` |

## Project layout

```
src/
  app/                     App Router pages (one folder per route)
  components/
    layout/                AppShell, Sidebar, Topbar
    ui/                    primitives (Panel, Button, RiskBadge…), RiskGauge
    scan/                  RiskCard, ReasonList, EvidenceTable, RelatedEntities
    graph/                 ThreatGraph (React Flow custom nodes + radial layout)
    memory/                MemoryTimeline
    report/                ReportForm
    admin/                 AdminTable
  lib/
    api.ts                 typed client + mock fallback (returns { data, live })
    mock.ts                seeded fake-airdrop campaign
    types.ts               backend contract types
    risk.ts                risk/node color + label tokens
    store.ts               UI-only cross-page store (latest scan, memory log)
    useData.ts             data-loading hook
    utils.ts               cn(), formatting helpers
  app/globals.css          design system (tokens, glass panels, aurora)
```

## Architecture rules honored

- Frontend → FastAPI → Services → Database/Cognee. Never frontend → Cognee/DB.
- No scoring logic or secrets in the frontend; the backend owns scoring.
- User-submitted URLs are never executed; text is rendered as content, not HTML.
- Every API call degrades to seeded data / a friendly state instead of throwing.

## Wiring the real backend

`src/lib/api.ts` and `src/lib/types.ts` document the exact request/response
shapes expected. `src/lib/mock.ts` returns those same shapes, so going live is a
matter of matching these payloads (or adjusting both in lockstep) and setting
`NEXT_PUBLIC_MOCK_ONLY=false`.

## Verified

- ✅ `npm run build` passes (10 routes, TypeScript clean).
- ✅ `npx eslint` clean.
- ✅ Dev server serves every route `200` with expected content and zero runtime errors.
- ✅ Runs live against the FastAPI backend (CORS verified).
