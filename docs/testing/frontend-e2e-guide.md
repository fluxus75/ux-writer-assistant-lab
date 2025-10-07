# Frontend E2E Exercise (Next.js Workspace)

This guide explains how to validate the request → draft → approval loop from the **Next.js workspace** (not the legacy `fe-test` harness).

## Prerequisites

1. **Backend**: FastAPI server running on `http://localhost:8000` with Docker-based Postgres + Qdrant as described in `docs/day3-dev-environment.md`.
2. **Seed data**: Execute `curl -X POST http://localhost:8000/v1/ingest` once to load the sample style corpus, glossary, and context snippets.
3. **Users**: Insert at least one designer and writer row. During development you can reuse the helper below via the Python shell:

   ```bash
   cd backend
   uv run python - <<'PY'
   from app.db import session_scope, models

   with session_scope() as session:
       session.merge(models.User(id="designer-1", role=models.UserRole.DESIGNER, name="Designer", email="designer@example.com"))
       session.merge(models.User(id="writer-1", role=models.UserRole.WRITER, name="Writer", email="writer@example.com"))
   PY
   ```

4. **Frontend**: Install and run the workspace shell.

   ```bash
   cd frontend
   pnpm install
   pnpm dev  # serves http://localhost:3000
   ```

5. **Environment bridge**: The Next.js app proxies API calls through `/api`. Configure the base URL once:

   ```bash
   cp .env.example .env.local
   echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" >> .env.local
   ```

## Walkthrough

1. **Sign in simulation** – the lab UI uses header fields instead of real auth. Open browser dev tools and set the following headers for every request (Chrome: ModHeader, Firefox: Requestly):
   - `X-User-Role`: `designer` (or `writer` when switching personas)
   - `X-User-Id`: `designer-1` / `writer-1`

2. **Create a request**
   - Navigate to `http://localhost:3000/requests`.
   - Click **New Request** and fill the form with the same values contained in `docs/testing/sample_payloads/request-create.json`.
   - Submit as the designer. The new request should appear in the queue.

3. **Generate drafts**
   - Switch headers to the writer persona.
   - Open the request detail page and click **Generate AI Draft**. The workspace invokes `/v1/drafts`, stores candidate versions, and surfaces guardrail messages in the right panel.

4. **Leave a comment**
   - While still on the writer role, use the comment sidebar to leave a note. The UI calls `/v1/comments` and updates the thread instantly.

5. **Approve the copy**
   - Switch headers back to the designer.
   - Review the draft, optionally resolve the comment, and press **Approve**. The status badge should change to “Approved” and an audit entry is stored.

6. **Export overview**
   - Visit `http://localhost:3000/exports` to confirm the newly approved request appears in the export queue (CSV export will be enabled in later sprints).

## Troubleshooting

- **Missing users** – The backend enforces RBAC via headers. Ensure the user IDs used by the headers exist in Postgres.
- **LLM credentials** – `/v1/drafts` invokes the translation pipeline. For offline demos, configure the stub LLM via environment variables or set `LLM_API_KEY` for real calls.
- **Vector store connectivity** – If retrieval cards show “No references”, confirm Qdrant is reachable and the ingest step succeeded.

## Related Resources

- Backend smoke automation: `scripts/dev/run_day3_smoke.sh`
- Sample payloads: `docs/testing/sample_payloads/`
- Workflow API reference: `backend/app/api/v1/`
