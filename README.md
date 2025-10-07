# UX Writer Assistant — Lab Bundle (Backend + Test FE)

This bundle contains a FastAPI backend, a **test-only** frontend, and a Next.js workspace shell.

## Prereqs
- Python 3.10+ (recommend `uv`)
- Node 20+ and `pnpm`

## 1) Backend (FastAPI) — run with `uv`
```bash
cd backend
uv venv .venv
uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
# health check
curl http://localhost:8000/health
```

> Data files live at `../data/input`. You can edit them and re-run `/v1/ingest`.
>
> Alembic migrations live in `backend/alembic/`. Run `uv run alembic upgrade head` after changing ORM models.

Key workflow endpoints (Day 5):

- `POST /v1/requests` — create a UX copy request (requires `X-User-Role: designer`).
- `GET /v1/requests` — list requests (designer/writer/admin roles).
- `POST /v1/drafts` — generate AI drafts and persist versions (writer/designer roles).
- `POST /v1/approvals` — approve or reject a request (designer/admin).

## 2) Test Frontend (Vite + React + TS)
```bash
cd ../fe-test
cp .env.example .env   # adjust API base if needed
pnpm i
pnpm dev
# open http://localhost:5173
```

## 3) Product Frontend Shell (Next.js 14)
```bash
cd ../frontend
pnpm install
pnpm dev
# open http://localhost:3000
```

Environment variables for the Next.js shell:

- `NEXT_PUBLIC_API_BASE` — backend base URL (default `http://localhost:8000`).
- `NEXT_PUBLIC_API_ROLE` — role header used for fetches (`designer` by default).
- `NEXT_PUBLIC_API_USER_ID` — user id header (defaults to `designer-1`).

## 3) Test Flow
1. **Ingest**: FE → Ingest page → click **Run Ingest** (or `POST /v1/ingest`)
2. **Retrieve**: FE → Retrieve page → set filters (device/feature_norm/style_tag) → **Retrieve**
3. **Translate**: FE → Translate page → set `ids`, toggles (RAG/RULES), `length_max` → **Translate**

## Notes
- This is a **lab scaffold**. Retrieval now routes between feature-mode and style-prior using Postgres/Qdrant with bge-m3 embeddings.
- Guardrails currently enforce length/forbidden/replacements. Day 6+ will expand tone/person checks.
