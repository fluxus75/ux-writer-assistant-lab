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

# 5. Optional workflow flow (requires seeded users and LLM for draft generation)
if [[ -n "${WORKFLOW_SMOKE:-}" && -n "${DESIGNER_ID:-}" && -n "${WRITER_ID:-}" ]]; then
  step "Running workflow smoke (requests → drafts → approvals → comments)"

  request_payload=$(jq --arg writer "${WRITER_ID}" '.assigned_writer_id = $writer' docs/testing/sample_payloads/request-create.json)
  request_resp=$(curl -fsS -X POST "${API_BASE}/v1/requests" \
    -H "Content-Type: application/json" \
    -H "X-User-Role: designer" \
    -H "X-User-Id: ${DESIGNER_ID}" \
    -d "${request_payload}")
  echo "${request_resp}" | jq . > "${RUN_DIR}/request.json"
  request_id=$(echo "${request_resp}" | jq -r '.id')

  if [[ "${request_id}" == "null" || -z "${request_id}" ]]; then
    echo "Failed to create request; skipping downstream workflow" >> "${RUN_DIR}/notes.txt"
  else
    if [[ -n "${LLM_API_KEY:-}" ]]; then
      draft_payload=$(jq --arg req "${request_id}" '.request_id = $req' docs/testing/sample_payloads/draft-generate.json)
      draft_resp=$(curl -fsS -X POST "${API_BASE}/v1/drafts" \
        -H "Content-Type: application/json" \
        -H "X-User-Role: writer" \
        -H "X-User-Id: ${WRITER_ID}" \
        -d "${draft_payload}")
      echo "${draft_resp}" | jq . > "${RUN_DIR}/draft.json"
    else
      echo "Draft step skipped (LLM_API_KEY not set)" > "${RUN_DIR}/draft-skipped.txt"
    fi

    approval_payload=$(jq --arg req "${request_id}" '.request_id = $req' docs/testing/sample_payloads/approval-decision.json)
    approval_resp=$(curl -fsS -X POST "${API_BASE}/v1/approvals" \
      -H "Content-Type: application/json" \
      -H "X-User-Role: designer" \
      -H "X-User-Id: ${DESIGNER_ID}" \
      -d "${approval_payload}")
    echo "${approval_resp}" | jq . > "${RUN_DIR}/approval.json"

    comment_payload=$(jq --arg req "${request_id}" '.request_id = $req' docs/testing/sample_payloads/comment-create.json)
    comment_resp=$(curl -fsS -X POST "${API_BASE}/v1/comments" \
      -H "Content-Type: application/json" \
      -H "X-User-Role: writer" \
      -H "X-User-Id: ${WRITER_ID}" \
      -d "${comment_payload}")
    echo "${comment_resp}" | jq . > "${RUN_DIR}/comment.json"

    comment_id=$(echo "${comment_resp}" | jq -r '.id')
    if [[ "${comment_id}" != "null" && -n "${comment_id}" && -n "${ADMIN_ID:-}" ]]; then
      resolve_resp=$(curl -fsS -X POST "${API_BASE}/v1/comments/${comment_id}/resolve" \
        -H "X-User-Role: admin" \
        -H "X-User-Id: ${ADMIN_ID}")
      echo "${resolve_resp}" | jq . > "${RUN_DIR}/comment-resolve.json"
    fi
  fi
else
  echo "Workflow smoke skipped (set WORKFLOW_SMOKE=1 and DESIGNER_ID/WRITER_ID)" >> "${RUN_DIR}/notes.txt"
fi

cat <<SUMMARY >> "${RUN_DIR}/notes.txt"

Smoke test complete.
Artifacts:
  - health.json
  - ingest.json
  - retrieve.json
  - translate-basic.json (optional)
  - request.json / draft.json / approval.json / comment.json (optional workflow)
SUMMARY

echo "[smoke] Artifacts stored in ${RUN_DIR}"
