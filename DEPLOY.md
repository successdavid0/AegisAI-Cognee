# Deploying AEGIS

Backend → **Render** (Docker web service + persistent disk). Frontend → **Vercel** (Next.js).
Config lives in [`render.yaml`](./render.yaml), [`backend/Dockerfile`](./backend/Dockerfile),
and [`web/vercel.json`](./web/vercel.json).

Deploy the **backend first** (you need its URL for the frontend), then the frontend, then come
back and set `CORS_ORIGINS` to the frontend URL.

---

## 1. Backend on Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml` and creates the
   `aegis-backend` Docker service with a 1 GB disk at `/data`.
3. Set the env vars marked "set in dashboard" below (the rest come from `render.yaml`).
4. Deploy. Health check: `GET https://<service>.onrender.com/health` → `{"status":"ok"}`.
5. (Optional) Populate real threat intel on the persistent disk — Render **Shell**:
   `python scripts/import_cryptoscamdb.py --limit 1000` (persists across redeploys).

### Backend env vars

| Key | Value | Source |
|---|---|---|
| `APP_ENV` | `production` | render.yaml |
| `DATABASE_URL` | `sqlite:////data/sentinelgraph.db` | render.yaml (persistent disk) |
| `RATE_LIMIT` | `20/minute` | render.yaml |
| `COGNEE_DATASET` | `global-threat-intel` | render.yaml |
| `ADMIN_API_KEY` | auto-generated strong value | render.yaml `generateValue` — **copy it from the dashboard**, you'll paste it into the Admin page |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` | **dashboard** (set after step 2 below) |
| `COGNEE_BASE_URL` | `https://tenant-….aws.cognee.ai` | **dashboard (secret)** |
| `COGNEE_API_KEY` | your **rotated** Cognee key | **dashboard (secret)** |
| `OPENAI_API_KEY` | only if using Cognee local SDK mode | **dashboard (secret)** |

> ⚠️ Rotate the Cognee API key before launch — the old one sat in a local `.env` in plaintext.
> Without `ADMIN_API_KEY`, admin/memory mutations fail closed (503) by design.

---

## 2. Frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Set **Root Directory = `web`** (the Next.js app lives there). `web/vercel.json` handles the rest.
3. Add the env vars below (Production scope) and deploy.

### Frontend env vars (see [`web/.env.production.example`](./web/.env.production.example))

| Key | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<service>.onrender.com` | the Render backend URL, no trailing slash |
| `NEXT_PUBLIC_MOCK_ONLY` | `false` | use the live backend, not seeded mock data |

> `NEXT_PUBLIC_*` are inlined at **build time** — changing them requires a redeploy.

---

## 3. Wire the two together

1. Copy the Vercel URL → set Render `CORS_ORIGINS` to it → redeploy backend (or it redeploys on save).
2. Open the app → **Admin** page → paste the `ADMIN_API_KEY` (stored in your browser's
   sessionStorage, sent as `X-Admin-Key`; never shipped in the JS bundle).
3. Smoke test: run a scan, verify a report on the Admin page (should succeed with the key,
   401 without), and confirm the Memory page shows Cognee activity.

## Notes
- **SQLite + disk** persists across redeploys but Render disks require a paid instance. For a
  free/throwaway demo, drop the `disk:` block, set `plan: free`, and
  `DATABASE_URL=sqlite:///./sentinelgraph.db` (data resets on redeploy; demo seed reloads).
- **Scaling beyond one instance?** SQLite won't share across instances — switch `DATABASE_URL`
  to managed Postgres (Render/Neon/Supabase); no code changes (SQLAlchemy abstracts the engine).
