# Frontend Testing Guide

## Prereqs
- Python 3.10+, Node 20+, `pnpm`, and recommended `uv`.
- Ports: backend `8000`, frontend dev server `5173`.

## Start Backend
```bash
# from repo root
cd backend
uv venv .venv && uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
# health check
curl http://localhost:8000/health
```

## Start Frontend
```bash
# from repo root
cd fe-test
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
# set API base in .env
# VITE_API_BASE=http://localhost:8000
pnpm i
pnpm dev
# open http://localhost:5173
```

## Test Flow in the UI
- Ingest
  - Go to Ingest page → click "Run Ingest".
  - Expect counts loaded (context, glossary, style).
- Retrieve
  - Go to Retrieve page.
  - Example: Query `charging station`; Filters `device=robot_vacuum`, `feature_norm=charging`.
  - Expect 1 hit (sid `S001`): "Returning to charging station.".
- Translate
  - Go to Translate page.
  - Leave `ids` empty; toggles: `RAG=on`, `RULES=on`.
  - Optional hints: `length_max: 40`, `replace_map: {"Returning": "Come back to"}`.
  - Expected selected: "Come back to charging station." (with rules on). With rules off, it stays "Returning to charging station.".

## Tips & Troubleshooting
- CORS/404: Ensure backend on `http://localhost:8000` and `.env` has `VITE_API_BASE` matching.
- Port changes: update `VITE_API_BASE`, then restart `pnpm dev`.
- Inspect requests in browser DevTools → Network (`/v1/ingest`, `/v1/retrieve`, `/v1/translate`).
