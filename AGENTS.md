# Repository Guidelines

## Project Structure & Module Organization
- `backend/` — FastAPI app.
  - Entry: `app/main.py`; routes in `app/api/v1/*.py`.
  - Core helpers: `app/core/*.py`; models/contracts in `app/models/contracts.py`.
  - Business logic: `app/services/{ingest,retrieve,translate,guardrails}/service.py`.
- `data/input/` — test data used by `/v1/ingest` (JSONL, CSV, YAML).
- `fe-test/` — Vite + React test UI.
  - Pages: `src/pages/{Ingest,Retrieve,Translate}.tsx`; API helper: `src/lib/api.ts`.

Add new endpoints under `backend/app/api/v1/<feature>.py` and the matching logic in `backend/app/services/<feature>/service.py`.

## Build, Test, and Development Commands
Backend (with `uv`):
```bash
cd backend
uv venv .venv && uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
# health
curl http://localhost:8000/health
```
Frontend (Vite):
```bash
cd fe-test
cp .env.example .env  # set VITE_API_BASE
pnpm i && pnpm dev    # open http://localhost:5173
```
Tests (backend):
```bash
cd backend
uv run pytest -q
```

## Coding Style & Naming Conventions
- Python: PEP 8, 4‑space indent, type hints for public functions. Modules/files `snake_case.py`; classes `PascalCase`; functions/vars `snake_case`.
- API files: `app/api/v1/<feature>.py`; services: `app/services/<feature>/service.py`.
- TypeScript/React: components `PascalCase.tsx`; functions `camelCase`; keep UI logic in pages and API calls in `src/lib/api.ts`.
- Keep functions small; prefer pure helpers in `core/` and thin routers in `api/`.

## Testing Guidelines
- Framework: `pytest` (+ `httpx` for FastAPI clients).
- Location: `backend/tests/` (e.g., `test_api_ingest.py`, `test_services_translate.py`).
- Run: `uv run pytest`; aim to cover endpoints and service functions. Frontend has no tests yet; feel free to add Vitest if needed.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- PRs: clear description, scope, and rationale; link issues; include API samples (request/response) and, if UI changes, screenshots.

## Security & Configuration Tips
- Don’t commit secrets. Keep `.env` local. Sample data lives in `data/input/`.
- The FE reads `VITE_API_BASE`; backend defaults to `localhost:8000`.
