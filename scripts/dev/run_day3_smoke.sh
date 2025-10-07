#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-http://localhost:8000}
OUTPUT_ROOT=${OUTPUT_ROOT:-tmp/test-run}
RUN_ID=$(date +"%Y%m%d_%H%M%S")
RUN_DIR="${OUTPUT_ROOT}/${RUN_ID}"
mkdir -p "${RUN_DIR}"

echo "[smoke] Target API base: ${API_BASE}"

step() {
  echo "[smoke] $1"
}

# 1. Health check
step "Checking /health"
curl -fsS "${API_BASE}/health" | jq . > "${RUN_DIR}/health.json"

touch "${RUN_DIR}/notes.txt"

echo "API_BASE=${API_BASE}" >> "${RUN_DIR}/notes.txt"

echo >> "${RUN_DIR}/notes.txt"
# 2. Ingest
step "Posting to /v1/ingest"
ingest_response=$(curl -fsS -X POST "${API_BASE}/v1/ingest" -H "Accept: application/json")
echo "${ingest_response}" | jq . > "${RUN_DIR}/ingest.json"

echo "Ingest counts:" >> "${RUN_DIR}/notes.txt"
echo "${ingest_response}" | jq '.counts' >> "${RUN_DIR}/notes.txt"

# 3. Retrieve sample query
step "Calling /v1/retrieve"
curl -fsS "${API_BASE}/v1/retrieve?query=dock&topK=3" | jq . > "${RUN_DIR}/retrieve.json"

# 4. Optional translate call
if [[ -n "${LLM_API_KEY:-}" ]]; then
  step "Invoking /v1/translate (translate-basic)"
  curl -fsS -X POST "${API_BASE}/v1/translate" \
    -H "Content-Type: application/json" \
    -d @docs/testing/sample_payloads/translate-basic.json | jq . > "${RUN_DIR}/translate-basic.json"
else
  step "Skipping /v1/translate (LLM_API_KEY not set)"
  echo "Skipped translate; set LLM_API_KEY to enable" > "${RUN_DIR}/translate-skipped.txt"
fi

cat <<SUMMARY >> "${RUN_DIR}/notes.txt"

Smoke test complete.
Artifacts:
  - health.json
  - ingest.json
  - retrieve.json
  - translate-basic.json (optional)
SUMMARY

echo "[smoke] Artifacts stored in ${RUN_DIR}"
