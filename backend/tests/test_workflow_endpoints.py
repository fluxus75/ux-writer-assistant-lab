import pytest
from httpx import ASGITransport, AsyncClient

import pytest
from httpx import ASGITransport, AsyncClient

from sqlalchemy import select

from app.db import models, session_scope
from app.main import app
from app.services import llm as llm_registry
from app.services.llm.client import LLMResult, PromptRequest


HEADERS_DESIGNER = {"X-User-Role": "designer", "X-User-Id": "designer-1"}
HEADERS_WRITER = {"X-User-Role": "writer", "X-User-Id": "writer-1"}
HEADERS_ADMIN = {"X-User-Role": "admin", "X-User-Id": "admin-1"}


class _StubLLM:
    def __init__(self, text: str) -> None:
        self.text = text
        self.last_prompt: PromptRequest | None = None

    def generate(self, prompt: PromptRequest) -> LLMResult:
        self.last_prompt = prompt
        return LLMResult(text=self.text, latency_ms=12.0, raw={})


@pytest.fixture(autouse=True)
def stub_llm(monkeypatch: pytest.MonkeyPatch) -> _StubLLM:
    stub = _StubLLM("Returning to charging station.")
    monkeypatch.setattr(llm_registry, "_CLIENT", stub, raising=False)
    return stub


@pytest.mark.anyio
async def test_request_creation_and_listing(seed_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "title": "Robot vacuum returns",
            "feature_name": "charging",
            "context_description": "Return to base notification",
            "tone": "concise",
            "style_preferences": "system",
            "constraints": {"device": "robot_vacuum", "feature_norm": "charging", "style_tag": "concise.system.action"},
            "assigned_writer_id": "writer-1",
        }
        create_resp = await client.post("/v1/requests", json=payload, headers=HEADERS_DESIGNER)

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["status"] == "drafting"
    assert created["assigned_writer_id"] == "writer-1"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        list_resp = await client.get("/v1/requests", headers=HEADERS_WRITER)

    assert list_resp.status_code == 200
    body = list_resp.json()
    assert body["items"][0]["id"] == created["id"]


@pytest.mark.anyio
async def test_draft_generation_and_approval(seed_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        request_payload = {
            "title": "Robot vacuum returns",
            "feature_name": "charging",
            "constraints": {"device": "robot_vacuum", "feature_norm": "charging", "style_tag": "concise.system.action"},
            "assigned_writer_id": "writer-1",
        }
        create_resp = await client.post("/v1/requests", json=request_payload, headers=HEADERS_DESIGNER)
        request_id = create_resp.json()["id"]

        draft_payload = {
            "request_id": request_id,
            "text": "로봇이 충전 거점으로 돌아갑니다.",
            "source_language": "ko",
            "target_language": "en",
            "num_candidates": 2,
        }
        draft_resp = await client.post("/v1/drafts", json=draft_payload, headers=HEADERS_WRITER)

    assert draft_resp.status_code == 201
    draft_body = draft_resp.json()
    assert len(draft_body["versions"]) == 2
    assert draft_body["request_status"] == "in_review"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        approval_payload = {
            "request_id": request_id,
            "decision": "approved",
            "comment": "Looks good",
        }
        approval_resp = await client.post("/v1/approvals", json=approval_payload, headers=HEADERS_DESIGNER)

    assert approval_resp.status_code == 201
    approval_body = approval_resp.json()
    assert approval_body["request_status"] == "approved"

    with session_scope() as session:
        audit_entries = list(
            session.execute(
                select(models.AuditLog).where(models.AuditLog.entity_id == request_id)
            ).scalars()
        )
        assert any(entry.action.startswith("approval") for entry in audit_entries)
        assert any(entry.action == "created" for entry in audit_entries)


@pytest.mark.anyio
async def test_comment_creation_and_resolution(seed_users):
    with session_scope() as session:
        session.merge(
            models.User(
                id="admin-1",
                role=models.UserRole.ADMIN,
                name="Admin",  # minimal admin for resolving comments
                email="admin@example.com",
            )
        )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        request_payload = {
            "title": "Robot vacuum returns",
            "feature_name": "charging",
            "constraints": {"device": "robot_vacuum"},
        }
        create_resp = await client.post("/v1/requests", json=request_payload, headers=HEADERS_DESIGNER)
        request_id = create_resp.json()["id"]

        comment_payload = {
            "request_id": request_id,
            "body": "Please clarify the tone.",
        }
        comment_resp = await client.post("/v1/comments", json=comment_payload, headers=HEADERS_WRITER)

    assert comment_resp.status_code == 201
    comment_id = comment_resp.json()["id"]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        list_resp = await client.get(f"/v1/requests/{request_id}/comments", headers=HEADERS_WRITER)
        resolve_resp = await client.post(f"/v1/comments/{comment_id}/resolve", headers=HEADERS_ADMIN)

    assert list_resp.status_code == 200
    assert any(item["id"] == comment_id for item in list_resp.json()["items"])
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"

