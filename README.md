# UX Writer Assistant — Lab Bundle (Backend + Test FE)

This bundle contains a FastAPI backend, a **test-only** frontend, and a Day 3 Next.js workspace shell.

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

## 3) Test Flow
1. **Ingest**: FE → Ingest page → click **Run Ingest** (or `POST /v1/ingest`)
2. **Retrieve**: FE → Retrieve page → set filters (device/feature_norm/style_tag) → **Retrieve**
3. **Translate**: FE → Translate page → set `ids`, toggles (RAG/RULES), `length_max` → **Translate**

## Notes
- This is a **lab scaffold**. Retrieval is keyword-based today; Day 3 adds Postgres/Qdrant wiring and an ONNX-ready embedding pipeline.
- Guardrails are minimal (length, forbidden, replace). Extend with tense/person rules next.
