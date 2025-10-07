# Day 3 Test Plan — UX Writer Assistant Lab

This document outlines how to validate the functionality that exists in the codebase as of the Day 3 milestone without making further code changes. It covers environment preparation, automated checks, manual API verification, database/vector store validation, and lightweight frontend smoke tests.

## 1. Objectives
- Confirm that the ingestion pipeline seeds Postgres and Qdrant using the bundled sample data.
- Exercise the existing `/health`, `/v1/ingest`, `/v1/retrieve`, and `/v1/translate` endpoints end to end.
- Provide deterministic scripts so teammates can repeat the same checks locally or in CI.
- Capture DB/Qdrant inspection steps to verify that persisted records align with ingest results.
- Smoke test the new Next.js workspace shell to ensure navigation renders under real API conditions.

## 2. Prerequisites
1. **Docker-based services** — follow `docs/day3-dev-environment.md` to launch Postgres and Qdrant (`docker compose up -d`).
2. **Backend virtualenv** — `cd backend && uv venv .venv && uv pip install -e .[dev]`.
3. **CLI tooling** — ensure `curl` and `jq` are available in your shell (required by the smoke script).
4. **Environment variables** — in `backend/.env`, set at least:
   ```env
   DATABASE_URL=postgresql+psycopg2://ux_writer:ux_writer@localhost:5432/ux_writer
   QDRANT_HOST=localhost
   QDRANT_PORT=6333
   EMBEDDING_BACKEND=stub  # use deterministic pseudo-vectors for local testing
   ```
   Optional for translation: supply a real `LLM_API_KEY`. Without it, skip the translation smoke test or run via pytest which stubs the LLM.
5. **Backend server** — start with `uv run uvicorn app.main:app --reload --port 8000`.
6. **Frontend workspace** — optional UI checks require `cd frontend && pnpm install && pnpm dev` (exposes http://localhost:3000).

## 3. Automated Test Suite
Run backend unit/integration tests:
```bash
cd backend
uv run pytest -q
```
This validates ingest persistence, guardrail behaviour, and the FastAPI routes using the in-memory test client.

## 4. Seed & Smoke Script
Use the provided helper script to exercise the live API against the running FastAPI server.
```bash
API_BASE=http://localhost:8000 scripts/dev/run_day3_smoke.sh
```
The script performs:
1. `/health` probe.
2. `/v1/ingest` to load `data/input` into Postgres and Qdrant.
3. `/v1/retrieve` sample query (`dock`).
4. `/v1/translate` call using `docs/testing/sample_payloads/translate-basic.json` (guarded behind LLM availability).
Results are written to `tmp/test-run/<timestamp>/` so responses can be inspected later.

## 5. Database Validation Steps
After running ingest, verify row counts match the API response:
```bash
cd backend
uv run python - <<'PY'
from app.db import session_scope, models
with session_scope() as session:
    print({
        'context_snippets': session.query(models.ContextSnippet).count(),
        'style_guide_entries': session.query(models.StyleGuideEntry).count(),
        'glossary_entries': session.query(models.GlossaryEntry).count(),
    })
PY
```
Alternatively, connect with `psql`:
```bash
psql postgresql://ux_writer:ux_writer@localhost:5432/ux_writer -c "SELECT COUNT(*) FROM style_guide_entries;"
```

## 6. Qdrant Validation Steps
Ensure the collections contain vectors seeded by the ingest run:
```bash
uv run python - <<'PY'
from app.services.rag.config import vector_store_config
client = vector_store_config.create_client()
print(client.get_collections())
for name in ("style_guides", "glossary_terms", "context_snippets"):
    info = client.count(collection_name=name)
    print(name, info.count)
PY
```
The counts should align with the Postgres totals when EMBEDDING_BACKEND=stub (no batching failures).

## 7. Manual API Scenarios
Use the sample payloads under `docs/testing/sample_payloads/` with `curl` or the VS Code REST client:
- `translate-basic.json` — default guardrails off to avoid LLM requirements.
- `translate-rag.json` (optional) — enables RAG (`use_rag=true`) and expects ingest to have run first.

Examples:
```bash
curl -sS -X POST "http://localhost:8000/v1/translate" \
  -H "Content-Type: application/json" \
  -d @docs/testing/sample_payloads/translate-basic.json
```

```bash
curl -sS "http://localhost:8000/v1/retrieve?query=charging&topK=3"
```
Inspect response metadata to confirm guardrail/rag details are populated.

## 8. Frontend Smoke Test Checklist
With the Next.js dev server running on port 3000:
1. Open `/` — verify the timeline overview loads and counts are placeholders.
2. Navigate to `/requests` — confirm the queue table renders.
3. Visit `/workspace` — ensure mock draft cards and guardrail panels display.
4. Visit `/exports` — check export summary cards.
Use browser devtools to inspect network calls once real APIs are wired in future sprints.

## 9. Reporting & Artifacts
- Capture terminal output from the smoke script (`tmp/test-run/.../`) and keep logs for regression tracking.
- File issues for discrepancies in DB counts vs vector store counts or any API error responses.
- Attach screenshots of the frontend pages for visual QA (especially if styling regressions appear).

Following this plan provides coverage of backend persistence, API surface, and the new frontend shell while staying aligned with Day 3 capabilities.
