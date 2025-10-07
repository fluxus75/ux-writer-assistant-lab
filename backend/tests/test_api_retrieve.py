import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.anyio
async def test_retrieve_with_filters_and_query():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # ensure data is loaded
        await client.post("/v1/ingest")

        payload = {
            "query": "charging station",
            "filters": {"device": "robot_vacuum", "feature_norm": "charging", "style_tag": "concise.system.action"},
            "topK": 3,
        }
        resp = await client.post("/v1/retrieve", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    items = body.get("items", [])
    assert len(items) >= 1
    assert any("charging" in entry["en_line"].lower() for entry in items)
    for item in items:
        assert item["metadata"]["device"] == "robot_vacuum"
    assert body["mode"] in {"feature", "style"}
    assert "feature_confidence" in body
    assert body.get("candidate_count") == len(items)


@pytest.mark.anyio
async def test_retrieve_empty_query_topk_limit():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/ingest")
        resp = await client.post("/v1/retrieve", json={"query": "", "topK": 2})

    assert resp.status_code == 200
    body = resp.json()
    items = body.get("items", [])
    assert len(items) == 2
    for it in items:
        assert {"sid", "en_line", "metadata", "score"}.issubset(it.keys())

