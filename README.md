<div align="center">

# 🛡️ AEGIS

### Adaptive Entity Graph Intelligence for Scams

**AI-powered scam intelligence with a _living memory graph_.**

Scan a wallet, domain, URL, contract, social handle, or message → get an
**explainable** risk verdict → see **how threats connect** → and watch the
**Cognee memory lifecycle** learn in real time.

<br/>

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)
![Cognee](https://img.shields.io/badge/Memory-Cognee-7C5CFF)
![License](https://img.shields.io/badge/License-MIT-green)

_Built for the **Cognee Hackathon** — showcasing Cognee as the **core product
mechanism**, not a side database._

</div>

---

## 📑 Table of contents

- [The problem](#-the-problem)
- [What AEGIS does](#-what-aegis-does)
- [Why AEGIS wins: deep Cognee integration](#-why-aegis-wins-deep-cognee-integration)
- [How we used Cognee (technical deep-dive)](#-how-we-used-cognee-technical-deep-dive)
- [Feature checklist](#-feature-checklist)
- [Architecture](#-architecture)
- [The pages](#-the-pages)
- [Risk engine](#-risk-engine-explainable-by-design)
- [Quickstart](#-quickstart)
- [Demo walkthrough](#-demo-walkthrough-the-winning-story)
- [API reference](#-api-reference)
- [Tech stack](#-tech-stack)
- [Strengths](#-strengths)
- [Known limitations (current MVP)](#-known-limitations-current-mvp)
- [Roadmap](#-roadmap)
- [Security & data handling](#-security--data-handling)
- [Repo layout & branches](#-repo-layout--branches)
- [License](#-license)

---

## 🎯 The problem

Crypto and phishing scams are **networked**. A fake airdrop domain, its drainer
wallet, an impersonating "support" handle, and a malicious contract are all
**one campaign** — but you'd never know it from today's tools.

- ❌ Most scam checkers are **static blacklists** — they tell you *if* something is
  listed, never **why** it's dangerous or **what it connects to**.
- ❌ They give a verdict with **no evidence** — a black box you're asked to trust.
- ❌ Naive AI memory systems **rot**: false positives, duplicates, and stale claims
  are never corrected, so the system gets *worse* over time.

## 💡 What AEGIS does

AEGIS turns every scan, report, and correction into a **living scam-intelligence
graph** powered by **Cognee**. It doesn't just answer "risky or not" — it:

- 🧠 **Remembers** evidence as durable memory
- 🔎 **Recalls** connected threats on every scan
- ✨ **Improves** relationships into scam clusters
- 🧹 **Forgets** false or stale claims — and the risk score updates

> **It's not a blacklist. It's a memory that gets smarter every time it's used —
> and honest enough to correct itself.**

---

## 🏆 Why AEGIS wins: deep Cognee integration

Judges asked for **visible, meaningful use of the Cognee lifecycle**. In AEGIS,
all four operations are **first-class product features with a live UI**, not a
hidden vector store:

| Cognee op | Where it lives in AEGIS | Visible to the user? |
| --- | --- | :---: |
| **Recall** | Every scan pulls connected threats from the graph | ✅ Lifecycle timeline |
| **Remember** | Scans & reports are written back as new memory | ✅ Lifecycle timeline |
| **Improve** | Enrichment links entities into scam clusters | ✅ Admin + Memory page |
| **Forget** | False-positive corrections downgrade stale claims | ✅ Admin + score drop |

There's a dedicated **Memory Lifecycle** page that renders every operation as a
timeline — so anyone can *watch the memory think*.

---

## 🧬 How we used Cognee (technical deep-dive)

Cognee is the **long-term memory brain** of AEGIS. All calls are isolated in a
single wrapper — `backend/services/cognee_service.py` — so routes never touch
Cognee directly (clean, swappable, testable).

### The dataset
Everything lives in one Cognee dataset: **`global-threat-intel`**. Memories are
tagged with a **`node_set`** so they're filterable by kind:
`scan_event`, `report`, `improve`, `forget`.

### The real cloud calls we make

| AEGIS action | Cognee endpoint | How |
| --- | --- | --- |
| **Remember** a scan/report/correction | `POST /api/v1/remember` | `multipart/form-data` upload (`datasetName`, `node_set`, `run_in_background`, + text file), auth via `X-Api-Key` |
| **Recall** related threats | `POST /api/v1/recall` | JSON `{ query, top_k, datasets }` |
| **Cognify** (build the graph) | _automatic_ | runs in the background after every `remember` |

We convert structured events into **natural language** before storing, because
Cognee reasons over text — e.g. a scan becomes:
> _"Scan of uniswap-airdrop-claim.io returned risk Critical (100/100)."_

### Design decisions that matter

- ✅ **Append-only corrections.** Cognee memory is additive, so a **"forget"** is
  recorded as a **reasoned correction note** that supersedes the prior claim —
  the honest way to "unlearn" in a knowledge graph.
- ✅ **Non-fatal by design.** Every Cognee call is wrapped in graceful error
  handling. A fresh dataset returns `409` on recall until cognify finishes — we
  treat that as expected, never crash a request, and note it on the timeline.
- ✅ **Graceful local-simulation mode.** With no credentials, AEGIS still runs the
  full lifecycle (persisted in the app DB) so it's **always demoable**. Drop in a
  key and the exact same flows hit real Cognee cloud — **zero code changes**.
- ✅ **Source of truth split.** The app DB records the *audit trail* of lifecycle
  events for the UI; Cognee holds the *semantic memory*. Both stay in sync.

```env
# backend/.env — activate real Cognee
COGNEE_BASE_URL=https://tenant-xxxx.aws.cognee.ai
COGNEE_API_KEY=your_key_here
COGNEE_DATASET=global-threat-intel
```

---

## ✅ Feature checklist

**Scanning & scoring**
- ✅ Scan wallets, domains, URLs, smart contracts, social handles, and messages
- ✅ Automatic entity-type detection & normalization
- ✅ Explainable 0–100 risk score with per-signal reasons and weights
- ✅ Evidence list with sources and reliability
- ✅ Related-entity surfacing from the graph

**Graph & intelligence**
- ✅ Interactive threat graph (React Flow) with typed relationships
- ✅ Scam-cluster detection and visualization
- ✅ Adjustable graph depth + click-to-inspect nodes

**Memory lifecycle (Cognee)**
- ✅ Live recall / remember / improve / forget timeline
- ✅ One-click "Improve" (cluster enrichment) and "Forget" (correction)

**Community & moderation**
- ✅ Public scam reporting (stored as unverified claims)
- ✅ Admin review: verify · reject · duplicate · **mark false positive**
- ✅ False-positive correction visibly **lowers future risk**

**Product & DX**
- ✅ Dashboard with live KPIs and recent activity
- ✅ Full entity profiles (reports, relationships, memory, scans, graph)
- ✅ **LIVE / DEMO** data badges on every page
- ✅ Backend-optional demo mode (seeded data) — always presentable

---

## 🧱 Architecture

```
┌──────────────────┐    HTTPS/JSON   ┌────────────────────────┐   Cognee Cloud API   ┌──────────────┐
│    Next.js 16    │ ───────────────►│        FastAPI          │ ───────────────────► │    Cognee    │
│  web/  ·  :3000  │ ◄───────────────│   backend/  ·  :8000    │ ◄─────────────────── │ memory graph │
│                  │                 │                         │  remember / recall   │              │
│  • React Flow    │                 │  • Entity extractor     │  (multipart + JSON)  │ global-      │
│  • Tailwind v4   │                 │  • Rule-based risk eng. │                      │ threat-intel │
│  • Typed API +   │                 │  • Graph builder (NetX) │                      └──────────────┘
│    mock fallback │                 │  • Cognee wrapper       │
└──────────────────┘                 │  • SQLite + SQLAlchemy  │
                                      └────────────────────────┘
```

**Principles**
- ✅ Frontend **only** talks to the backend — never to Cognee or the DB directly.
- ✅ Backend owns validation, scoring, graph building, persistence, and **every**
  Cognee call (isolated in one wrapper).
- ✅ **Contract-first**: response shapes are defined once in
  `web/src/lib/types.ts` and matched exactly by the backend — the frontend is a
  **drop-in** the moment the backend is live.

---

## 🖥️ The pages

| Page | What it shows | Key endpoints |
| --- | --- | --- |
| **Dashboard** | KPIs, recent scans/reports, memory activity | `GET /stats`, `/scans/recent`, `/reports/recent` |
| **Scan** | Risk card, reasons, evidence, related entities, lifecycle preview | `POST /scan`, `GET /memory/lifecycle/{id}` |
| **Threat Graph** | Interactive graph + node/relationship inspector | `GET /graph/{value}` |
| **Report Scam** | Submit a scam claim (kept unverified) | `POST /report` |
| **Memory Lifecycle** | Live recall/remember/improve/forget timeline | `GET /memory/lifecycle/{id}`, `POST /memory/improve`, `/memory/forget` |
| **Admin Review** | Verify / reject / duplicate / false-positive | `GET /admin/reports` + actions |
| **Entity Detail** | Full profile: reports, relationships, memory, scans, graph | `GET /entity/{value}` |

---

## 🧮 Risk engine (explainable by design)

Deliberately **rule-based** so every verdict is transparent — no black box.

| Signal | Weight |
| --- | ---: |
| Verified scam source | **+40** |
| Connected to flagged wallet | **+25** |
| Linked to phishing domain | **+20** |
| Scam cluster membership | **+20** |
| Multiple user reports | **+15** |
| Similar scam message pattern | **+10** |
| False-positive correction | **−50** |

Score clamps to **0–100** → 🟢 **Low** (0–30) · 🟡 **Suspicious** (31–60) ·
🟠 **High** (61–80) · 🔴 **Critical** (81–100). Each matched signal is returned as
a human-readable `{ text, weight }` reason the UI renders.

---

## 🚀 Quickstart

> **Prerequisites:** Node **18+**, Python **3.11+**, and two terminals.

### 1 — Backend (`:8000`)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # optional: add your Cognee key
uvicorn main:app --reload --port 8000
```
✅ SQLite DB is **auto-created and seeded** on first run with a full demo scam
campaign. Interactive API docs at **http://localhost:8000/docs**.

### 2 — Frontend (`:3000`)
```bash
cd web
npm install
cp .env.example .env.local         # already points at localhost:8000
npm run dev
```
✅ Open **http://localhost:3000**.

### 3 — (Optional) Go live with Cognee
Add credentials to `backend/.env` (see [How we used Cognee](#-how-we-used-cognee-technical-deep-dive))
and restart the backend. Without them, AEGIS runs in **local-simulation mode** —
still fully functional.

> 💡 **Zero-config demo:** set `NEXT_PUBLIC_MOCK_ONLY=true` and the frontend runs
> on rich seeded data with the backend off. Every page badges **LIVE / DEMO**.

---

## 🎬 Demo walkthrough (the winning story)

1. **Scan** `uniswap-airdrop-claim.io` → 🔴 **Critical (100)** with reasons + evidence.
2. AEGIS **recalls** the connected drainer wallet, impersonating Telegram handle,
   and malicious contract.
3. Open the **Threat Graph** → the entire **scam cluster** is wired together.
4. **Report** a new sighting → stored as a **pending, unverified** claim.
5. **Admin → Improve** → the report is linked into the cluster.
6. **Admin → Mark false positive** → Cognee **forgets/corrects** the claim, and the
   future risk score **drops**. 🎯

---

## 🔌 API reference

```
POST   /scan                              → explainable risk verdict
POST   /report                            → submit an unverified claim
GET    /graph/{value}?depth=              → nodes + edges (+ cluster)
GET    /memory/lifecycle/{scan_id}        → recall/remember/improve/forget events
POST   /memory/improve                    → enrich & cluster memory
POST   /memory/forget                     → correct false/stale memory
GET    /admin/reports                     → all reports
POST   /admin/reports/{id}/verify|reject|duplicate|false-positive
GET    /stats                             → dashboard KPIs
GET    /scans/recent  ·  /reports/recent  → recent activity
GET    /entity/{value}                    → full entity profile
GET    /health                            → liveness + Cognee status
```
Full interactive reference at **`/docs`**. Response shapes: `web/src/lib/types.ts`.

---

## 🛠️ Tech stack

| Layer | Tech |
| --- | --- |
| **Frontend** | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · React Flow · Framer Motion · lucide-react |
| **Backend** | FastAPI · SQLAlchemy 2 · Pydantic v2 · SQLite · NetworkX · httpx |
| **Memory** | **Cognee** (living knowledge graph, cloud API) |

---

## 💪 Strengths

- ✅ **Deep, _visible_ Cognee usage** — all four lifecycle ops are core UI features.
- ✅ **Explainable by design** — rule-based scoring, every point traced to a reason.
- ✅ **Graph-native** — real relationship visualization, not just a list.
- ✅ **Handles false positives responsibly** — claims stay unverified; corrections
  actively lower risk (fights memory pollution).
- ✅ **Contract-first & decoupled** — typed API shared by both sides; drop-in.
- ✅ **Always demoable** — seeded demo data + graceful Cognee fallback.
- ✅ **Production-minded** — clean service separation, JSON error contract, CORS,
  secrets isolated, non-fatal external calls.
- ✅ **Polished, professional UI** — a serious "threat-intelligence console," not a
  toy dashboard.

## ⚠️ Known limitations (current MVP)

We'd rather be honest than oversell — here's what's **not** done yet:

- ⚠️ **Rule-based, not ML.** Scoring is intentionally transparent, which trades off
  nuance vs. a learned model.
- ⚠️ **Cognee recall is surfaced but not yet _fused into the score_.** The verdict
  is currently DB-driven; recall context is shown but doesn't re-weight the score.
- ⚠️ **Cold-start recall.** A fresh Cognee dataset returns `409` until the async
  cognify pipeline finishes, so the very first recalls can be empty (handled
  gracefully, but worth knowing).
- ⚠️ **Seed data, not live feeds.** Demo runs on a seeded campaign; real-time threat
  feeds (Chainabuse, PhishTank, Etherscan labels) are not wired yet.
- ⚠️ **Heuristic entity typing.** A 40-hex address can't be distinguished as
  wallet vs. contract by shape alone; we default to wallet.
- ⚠️ **No auth/RBAC yet.** The admin surface is open in the MVP.
- ⚠️ **SQLite (single-node).** Fine for the demo; Postgres is the production path.

## 🗺️ Roadmap

- 🔜 **Fuse Cognee recall into scoring** — let semantic recall re-weight the verdict.
- 🔜 **Live threat feeds** — Chainabuse, CryptoScamDB, PhishTank, block-explorer labels.
- 🔜 **ML-assisted scoring** alongside the explainable rules.
- 🔜 **Auth + RBAC** for admin/analyst roles; audit logging.
- 🔜 **Postgres** + Docker Compose for reproducible deploys.
- 🔜 **Browser extension** for inline warnings while browsing.

---

## 🔐 Security & data handling

- ✅ No scoring logic or secrets in the frontend — the backend owns everything.
- ✅ User-submitted URLs are **never executed**.
- ✅ User reports are **unverified claims** until an analyst reviews them.
- ✅ Secrets live only in `backend/.env` (gitignored); `.env.example` ships blank.
- ✅ JSON-only error contract — no stack traces leaked to clients.

---

## 📁 Repo layout & branches

| Path | What |
| --- | --- |
| `web/` | Next.js frontend (App Router, TS, Tailwind v4, React Flow) — see `web/README.md` |
| `backend/` | FastAPI backend (SQLAlchemy, Cognee wrapper) — see `backend/README.md` |

| Branch | Contents |
| --- | --- |
| `main` | full monorepo (`web/` + `backend/`) |
| `frontend` | frontend only, flattened to root (deploy-ready, e.g. Vercel) |
| `backend` | backend only, flattened to root (deploy-ready, e.g. Render/Fly) |

---

## 📄 License

MIT — see `LICENSE`.

<div align="center">
<br/>

**AEGIS** — because scam intelligence should _remember_. 🛡️

</div>
