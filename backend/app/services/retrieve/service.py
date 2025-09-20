from typing import List, Dict, Any, Optional
from app.core import state
import time

def _score(line: str, query: str) -> float:
    q = query.lower().strip()
    s = line.lower()
    return sum(1.0 for tok in q.split() if tok in s)

def retrieve(query: str, filters: Optional[Dict[str, str]] = None, topK: int = 3) -> Dict[str, Any]:
    t0 = time.time()
    filt = filters or {}
    items = []
    for row in state.STYLE:
        if filt.get("device") and row.get("device") != filt["device"]:
            continue
        if filt.get("feature_norm") and row.get("feature_norm") != filt["feature_norm"]:
            continue
        if filt.get("style_tag") and row.get("style_tag") != filt["style_tag"]:
            continue
        score = _score(row.get("en_line", ""), query)
        if score > 0 or not query:
            items.append({"sid": row.get("sid"), "en_line": row.get("en_line"), "metadata": {"device": row.get("device"), "feature_norm": row.get("feature_norm"), "style_tag": row.get("style_tag")}, "score": score})
    items.sort(key=lambda x: x["score"], reverse=True)
    items = items[: max(1, topK)]
    latency_ms = int((time.time() - t0) * 1000)
    return {"items": items, "latency_ms": latency_ms}
