from __future__ import annotations

import pytest
import pytest
from httpx import ASGITransport, AsyncClient

from app.db import models, session_scope
from app.main import app
from app.services import llm as llm_registry
from app.services.llm.client import LLMResult, PromptRequest


class _StubLLM:
    def __init__(self, text: str) -> None:
        self.text = text
        self.last_prompt: PromptRequest | None = None

    def generate(self, prompt: PromptRequest) -> LLMResult:
        self.last_prompt = prompt
        return LLMResult(text=self.text, latency_ms=12.34, raw={})


@pytest.fixture(autouse=True)
def stub_llm(monkeypatch: pytest.MonkeyPatch) -> _StubLLM:
    stub = _StubLLM("Returning to charging station.")
    monkeypatch.setattr(llm_registry, "_CLIENT", stub, raising=False)
    return stub


@pytest.mark.anyio
async def test_translate_llm_with_guardrails(stub_llm: _StubLLM) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "text": "로봇이 충전 거점으로 돌아갑니다.",
            "source_language": "ko",
            "target_language": "en",
            "options": {"use_rag": True, "guardrails": True},
        }
        resp = await client.post("/v1/translate", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["selected"].startswith("Returning")
    assert body["metadata"]["llm"]["model"]
    assert isinstance(body["metadata"]["retrieval"]["items"], list)
    assert body["metadata"].get("novelty_mode") in {True, False}
    assert body["candidates"][0]["guardrail"] is None or isinstance(body["candidates"][0]["guardrail"], dict)
    # Ensure prompt captured the request languages
    assert stub_llm.last_prompt is not None
    prompt_text = "\n".join(msg.content for msg in stub_llm.last_prompt.messages)
    assert "Source language: ko" in prompt_text
    assert "Target language: en" in prompt_text


@pytest.mark.anyio
async def test_translate_applies_guardrail_replacements() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "text": "로봇이 충전 거점으로 돌아갑니다.",
            "source_language": "ko",
            "target_language": "en",
            "hints": {
                "length_max": 10,
                "replace_map": {"Returning": "Come back to"},
            },
            "options": {"use_rag": False, "guardrails": True},
        }
        resp = await client.post("/v1/translate", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["selected"].startswith("Come back to")
    guardrails = body["metadata"]["guardrails"]
    assert guardrails is not None
    assert guardrails["passes"] is False
    assert any(v for v in guardrails["violations"] if v.startswith("length"))


@pytest.mark.anyio
async def test_translate_without_guardrails() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "text": "로봇이 충전 거점으로 돌아갑니다.",
            "source_language": "ko",
            "target_language": "en",
            "hints": {"replace_map": {"Returning": "X"}},
            "options": {"guardrails": False},
        }
        resp = await client.post("/v1/translate", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["selected"] == "Returning to charging station."
    assert body["metadata"]["guardrails"] is None


@pytest.mark.anyio
async def test_translate_uses_db_style_rules(stub_llm: _StubLLM) -> None:
    with session_scope() as session:
        session.merge(
            models.User(
                id="designer-1",
                role=models.UserRole.DESIGNER,
                name="Designer",
                email="designer@example.com",
            )
        )
        session.add(
            models.GuardrailRule(
                id="gr-1",
                scope=models.GuardrailScope.GLOBAL,
                rule_type=models.GuardrailRuleType.STYLE,
                payload_json={"person": "impersonal", "punctuation": "period"},
                created_by="designer-1",
            )
            )

    stub_llm.text = "I will return now!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "text": "내가 돌아갈게",
            "source_language": "ko",
            "target_language": "en",
            "options": {"use_rag": False, "guardrails": True},
        }
        resp = await client.post("/v1/translate", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    guardrail = body["metadata"]["guardrails"]
    assert guardrail is not None
    assert guardrail["passes"] is False
    assert any("person:impersonal" in violation for violation in guardrail["violations"])
    assert any("punctuation:period" in violation for violation in guardrail["violations"])
    assert body["selected"] == "I will return now!"
