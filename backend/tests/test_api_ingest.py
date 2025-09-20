import re
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core import state


@pytest.mark.anyio
async def test_ingest_populates_state_and_counts():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/ingest")

    assert resp.status_code == 200
    data = resp.json()

    # run_id format like YYYYMMDD_HHMMSS
    assert re.match(r"^\d{8}_\d{6}$", data.get("run_id", ""))

    counts = data.get("counts", {})
    assert set(counts.keys()) == {"context", "glossary", "style"}
    assert all(isinstance(v, int) and v >= 1 for v in counts.values())

    # Ensure state was updated for this run
    run_id = data["run_id"]
    assert run_id in state.RUN_LOGS
    assert state.RUN_LOGS[run_id]["counts"] == counts

