# Codebase Overview

## Top-level applications
- **FastAPI backend (`backend/`)** provides ingestion, retrieval, translation, and workflow APIs. It runs with `uvicorn`, seeds data from `data/input`, and documents setup plus role-protected endpoints in the lab README files.【F:README.md†L1-L30】【F:backend/README.md†L6-L33】
- **Vite + React test UI (`fe-test/`)** offers focused pages to trigger ingest, hybrid retrieval, and translation options against the backend for development validation.【F:README.md†L31-L58】【F:fe-test/src/pages/Ingest.tsx†L1-L26】【F:fe-test/src/pages/Retrieve.tsx†L1-L44】【F:fe-test/src/pages/Translate.tsx†L1-L214】
- **Next.js workspace shell (`frontend/`)** mirrors the emerging product UX with an App Router layout, request list, writer workspace, and exports dashboard wired to role-aware fetches.【F:frontend/README.md†L1-L41】【F:frontend/app/layout.tsx†L1-L18】【F:frontend/components/AppShell.tsx†L1-L62】【F:frontend/app/page.tsx†L1-L49】【F:frontend/app/requests/page.tsx†L1-L86】【F:frontend/app/workspace/page.tsx†L1-L326】【F:frontend/app/exports/page.tsx†L1-L60】

## Backend architecture
### Application setup & configuration
- `app/main.py` constructs the FastAPI app, attaches the role header middleware, enables permissive CORS, and mounts all versioned routers plus the `/health` probe.【F:backend/app/main.py†L1-L28】
- Runtime settings are centralized in `app/core/settings.py`, exposing cached `pydantic-settings` for LLM, database, and vector-store configuration.【F:backend/app/core/settings.py†L1-L49】
- Header-based RBAC lives in `app/core/auth.py`, which records `X-User-Role`/`X-User-Id` on the request, validates allowed roles, and loads the current user record via database dependency injection.【F:backend/app/core/auth.py†L1-L75】
- Utility modules keep ingest helpers and in-memory caches close to the core: `app/core/io_utils.py` parses JSONL/CSV/YAML inputs and stamps run IDs, while `app/core/state.py` maintains context, glossary, style, and run log snapshots for guardrails and translation prompts.【F:backend/app/core/io_utils.py†L1-L24】【F:backend/app/core/state.py†L1-L8】

### Persistence & domain model
- SQLAlchemy engine/session management is handled in `app/db/session.py`, providing a shared engine, `session_scope` context manager, and FastAPI dependency for request-scoped sessions.【F:backend/app/db/session.py†L1-L50】
- ORM models in `app/db/models.py` capture the full workflow surface: style/context/glossary assets, users, requests, drafts + versions, approvals, comments, guardrail rules, RAG ingestion metadata, export jobs, and audit logs along with the enums that encode workflow state transitions.【F:backend/app/db/models.py†L1-L305】
- Pydantic ingestion contracts in `app/models/contracts.py` define the shape of context, glossary, style, and hint payloads prior to persistence or guardrail evaluation.【F:backend/app/models/contracts.py†L1-L39】

### Domain services
- **Ingestion** (`app/services/ingest/service.py`) loads lab datasets from `data/input`, resets Postgres tables, refreshes in-memory caches, and optionally batches embeddings into Qdrant collections when a vector client is available.【F:backend/app/services/ingest/service.py†L1-L248】
- **Retrieval** (`app/services/retrieve/service.py`) blends keyword and vector scores, applies MMR diversity, and tailors feature vs. style modes based on confidence and filters before returning scored snippets plus latency metadata.【F:backend/app/services/retrieve/service.py†L1-L240】
- **Translation** (`app/services/translate/service.py`) builds prompts with optional RAG context, invokes the singleton LLM client, materializes multiple candidates, and applies guardrails/length/style fixes while logging retrieval and guardrail metadata.【F:backend/app/services/translate/service.py†L1-L201】
- **Guardrails** combine scoped database rules with extras, merge forbidden/replacement/length/style policies, and enforce them against generated text.【F:backend/app/services/guardrails/loader.py†L1-L118】【F:backend/app/services/guardrails/service.py†L1-L75】
- **Drafts** wrap translation results to persist draft versions, update request status to review, and log audit events.【F:backend/app/services/drafts/service.py†L1-L117】
- **Requests** manage creation, listing, retrieval, and reassignment validation for UX copy work items.【F:backend/app/services/requests/service.py†L1-L90】
- **Approvals** restrict decisions to designers/admins, transition request status, and emit audit entries.【F:backend/app/services/approvals/service.py†L1-L52】
- **Comments** validate collaboration notes, support draft-version association, and track resolution state with audit logging.【F:backend/app/services/comments/service.py†L1-L78】
- **Audit logging** centralizes structured event writes for later analysis via `record_audit_event`.【F:backend/app/services/audit/service.py†L1-L35】
- **LLM integration & embeddings** provide singleton OpenAI clients and configurable embedding backends (stub or ONNX) plus vector-store configuration defaults for Qdrant collections.【F:backend/app/services/llm/__init__.py†L1-L38】【F:backend/app/services/llm/client.py†L1-L84】【F:backend/app/services/rag/config.py†L1-L125】【F:backend/app/services/rag/embedding.py†L1-L114】

### API layer
- Versioned routers translate HTTP payloads into service calls: ingest, retrieve, translate, requests, drafts, approvals, and comments each expose typed request/response models and enforce role dependencies before delegating to their service modules.【F:backend/app/api/v1/ingest.py†L1-L11】【F:backend/app/api/v1/retrieve.py†L1-L33】【F:backend/app/api/v1/translate.py†L1-L20】【F:backend/app/api/v1/requests.py†L1-L152】【F:backend/app/api/v1/drafts.py†L1-L104】【F:backend/app/api/v1/approvals.py†L1-L69】【F:backend/app/api/v1/comments.py†L1-L97】

### Data pipeline notes
- Seed assets live under `data/input` and are parsed via the ingestion service before being written to SQL tables and optional Qdrant collections. Run metadata, guardrail rules, and counts are cached for downstream guardrail enforcement and retrieval traces.【F:backend/app/services/ingest/service.py†L121-L248】

## Quality & testing
- Async API tests cover ingest state/DB persistence, retrieval scoring, translation guardrail behaviour, workflow endpoints (requests, drafts, approvals, comments), and the health probe. Fixtures reset in-memory state and database tables between runs while seeding designer/writer test users.【F:backend/tests/test_api_health.py†L1-L15】【F:backend/tests/test_api_ingest.py†L1-L44】【F:backend/tests/test_api_retrieve.py†L1-L45】【F:backend/tests/test_api_translate.py†L1-L144】【F:backend/tests/test_workflow_endpoints.py†L1-L156】【F:backend/tests/conftest.py†L1-L80】

## Frontend notes
- The Vite test UI interacts with backend routes through a shared `postJSON` helper and simple React state, enabling quick validation of ingest counts, retrieval filters, and translation guardrail knobs.【F:fe-test/src/lib/api.ts†L1-L49】【F:fe-test/src/pages/Ingest.tsx†L1-L26】【F:fe-test/src/pages/Retrieve.tsx†L1-L44】【F:fe-test/src/pages/Translate.tsx†L1-L214】
- The Next.js shell wraps screens in an `AppShell` layout, fetches server-side request lists with role headers, previews writer workspace flows (including retrieval and draft triggers), and showcases export job widgets for downstream delivery planning.【F:frontend/app/layout.tsx†L1-L18】【F:frontend/components/AppShell.tsx†L1-L62】【F:frontend/app/requests/page.tsx†L1-L86】【F:frontend/app/workspace/page.tsx†L1-L326】【F:frontend/app/exports/page.tsx†L1-L60】
