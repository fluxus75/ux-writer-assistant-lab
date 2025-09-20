# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (FastAPI with uv)
```bash
cd backend
uv venv .venv && uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health  # health check
```

### Frontend (Vite + React + TypeScript)
```bash
cd fe-test
cp .env.example .env  # set VITE_API_BASE=http://localhost:8000
pnpm i
pnpm dev  # opens http://localhost:5173
pnpm build
```

### Testing
```bash
cd backend
uv run pytest -q  # run all tests
uv run pytest tests/test_api_ingest.py  # run specific test file
```

## Architecture Overview

This is a UX Writer Assistant lab bundle with a FastAPI backend and React test frontend. The system handles three main workflows: ingesting content data, retrieving relevant context, and translating text with style guidelines.

### Backend Structure (`backend/`)
- **Entry point**: `app/main.py` - FastAPI app with CORS middleware
- **API routes**: `app/api/v1/{ingest,retrieve,translate}.py` - REST endpoints
- **Business logic**: `app/services/{ingest,retrieve,translate,guardrails}/service.py` - Core functionality
- **Models**: `app/models/contracts.py` - Pydantic models for requests/responses  
- **Core utilities**: `app/core/{io_utils,state}.py` - File I/O and state management
- **Data files**: `../data/input/{context.jsonl,glossary.csv,style_corpus.csv,style_rules.yaml}`

### Frontend Structure (`fe-test/`)
- **Pages**: `src/pages/{Ingest,Retrieve,Translate}.tsx` - UI for each workflow
- **API client**: `src/lib/api.ts` - HTTP client for backend calls
- **Entry**: `src/main.tsx` - React app initialization

### Key Workflows
1. **Ingest** (`/v1/ingest`): Loads data files into memory state for retrieval/translation
2. **Retrieve** (`/v1/retrieve`): Keyword-based search with device/feature/style filters
3. **Translate** (`/v1/translate`): Text transformation using RAG context + style rules/guardrails

### Code Conventions
- **Python**: PEP 8, snake_case functions/vars, PascalCase classes, type hints required
- **TypeScript**: PascalCase components, camelCase functions, keep API calls in `api.ts`
- **File organization**: New endpoints go in `app/api/v1/<feature>.py` with logic in `app/services/<feature>/service.py`
- **Testing**: pytest in `backend/tests/`, prefix test files with `test_`

### Data Dependencies
The backend requires data files in `data/input/` to be present and properly formatted. Run `/v1/ingest` after any data file changes to reload the in-memory state.