import os
from typing import Dict, Any
from app.core import io_utils, state

DATA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..", "data"))

def do_ingest() -> Dict[str, Any]:
    inp = os.path.join(DATA_ROOT, "input")
    ctx = io_utils.read_jsonl(os.path.join(inp, "context.jsonl"))
    glo = io_utils.read_csv(os.path.join(inp, "glossary.csv"))
    sty = io_utils.read_csv(os.path.join(inp, "style_corpus.csv"))
    rules = io_utils.read_yaml(os.path.join(inp, "style_rules.yaml"))

    # Replace in-memory
    state.CONTEXT[:] = ctx
    state.GLOSSARY[:] = glo
    state.STYLE[:] = sty

    run_id = io_utils.new_run_id()
    state.RUN_LOGS[run_id] = {"counts": {"context": len(ctx), "glossary": len(glo), "style": len(sty)}, "rules": rules}
    return {"run_id": run_id, "counts": state.RUN_LOGS[run_id]["counts"]}
