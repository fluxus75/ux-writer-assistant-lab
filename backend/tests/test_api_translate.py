from __future__ import annotations

import pytest
import pytest
from httpx import ASGITransport, AsyncClient

from app.db import models, session_scope
from app.main import app
from app.services import llm as llm_registry
from app.services.llm.client import LLMResult, PromptRequest


class _StubLLM:
    def __init__(self, text: str, candidates: list[str] | None = None) -> None:
        self.text = text
        self.candidates = candidates or [text]
        self.last_prompt: PromptRequest | None = None

    def generate(self, prompt: PromptRequest) -> LLMResult:
        self.last_prompt = prompt
        # Return multiple candidates if requested
        if prompt.n and prompt.n > 1:
            return LLMResult(text=self.candidates[0], candidates=self.candidates, latency_ms=12.34, raw={})
        return LLMResult(text=self.text, candidates=[self.text], latency_ms=12.34, raw={})


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


@pytest.mark.anyio
async def test_translate_multiple_candidates_selective_fix(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that only the first candidate gets replace_map applied, others keep original text."""
    # Create stub with multiple diverse candidates
    stub = _StubLLM(
        text="The robot is charging",
        candidates=[
            "The robot is charging",
            "Robot charges now",
            "The robot is being charged",
        ]
    )
    monkeypatch.setattr(llm_registry, "_CLIENT", stub, raising=False)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        payload = {
            "text": "로봇이 충전 중입니다",
            "source_language": "ko",
            "target_language": "en",
            "hints": {
                "replace_map": {"robot": "device", "charging": "powering", "charged": "powered"}
            },
            "options": {
                "use_rag": False,
                "guardrails": True,
                "num_candidates": 3,
            },
        }
        resp = await client.post("/v1/translate", json=payload)

    assert resp.status_code == 200
    body = resp.json()

    # Check we got 3 candidates
    assert len(body["candidates"]) == 3

    # First candidate should have replace_map applied
    assert body["candidates"][0]["text"] == "The device is powering"
    assert body["candidates"][0]["guardrail"]["passes"] is True

    # Second candidate should keep original text (no replace_map)
    assert body["candidates"][1]["text"] == "Robot charges now"
    # But violations should still be checked
    assert body["candidates"][1]["guardrail"] is not None

    # Third candidate should keep original text
    assert body["candidates"][2]["text"] == "The robot is being charged"
    assert body["candidates"][2]["guardrail"] is not None

    # Verify diversity is maintained (they should be different)
    texts = [c["text"] for c in body["candidates"]]
    assert len(set(texts)) == 3, "All candidates should be different"
