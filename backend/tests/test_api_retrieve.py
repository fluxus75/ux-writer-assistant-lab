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
            "filters": {"device": "robot_vacuum", "feature_norm": "charging"},
            "topK": 3,
        }
        resp = await client.post("/v1/retrieve", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    items = body.get("items", [])
    assert len(items) == 1
    it = items[0]
    assert it["sid"] == "S001"
    assert "charging station" in it["en_line"].lower()
    assert it["score"] >= 1
    assert it["metadata"]["device"] == "robot_vacuum"
    assert it["metadata"]["feature_norm"] == "charging"


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

