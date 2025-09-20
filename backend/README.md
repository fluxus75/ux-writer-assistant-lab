# UX Writer Assistant — Backend (FastAPI)

This is a **file-first** lab backend to test ingest/retrieve/translate flows.

## Quickstart (with `uv`)
```bash
# from repo root
cd backend
uv venv .venv
uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
```

If you don't use `uv`:
```bash
python -m venv .venv
source .venv/bin/activate  # (Windows: .venv\Scripts\activate)
pip install -e .
uvicorn app.main:app --reload --port 8000
```

## Endpoints
- `POST /v1/ingest` — load files from `../data/input` and build in-memory indices
- `POST /v1/retrieve` — simple BM25-ish/keyword retrieval (file-first) 
- `POST /v1/translate` — LLM-backed translation with optional guardrails and retrieval context

## Data Layout
```
data/
  input/
    context.jsonl
    glossary.csv
    style_corpus.csv
    style_rules.yaml
  results/
  history/
  logs/
```

> NOTE: This is a lab scaffold. Replace retrieval with a real Vector DB later (Qdrant/Chroma).

## Configuration

Copy `.env.example` to `.env` and provide your keys before running translation:

```bash
cp .env.example .env
# then edit .env to set LLM_API_KEY (and optional overrides)
```

Environment variables:
- `LLM_PROVIDER` — currently supports `openai`.
- `LLM_MODEL` — chat/completions model name, e.g. `gpt-4o-mini`.
- `LLM_API_KEY` — API key for the provider.
- `LLM_BASE_URL` — optional custom endpoint (for proxies/self-hosted).
- `LLM_TIMEOUT_SECONDS` — request timeout.
- `LLM_TEMPERATURE` — default sampling temperature.
