from typing import Dict, Any

def apply_guardrails(text: str, rules: Dict[str, Any], hints: Dict[str, Any] | None = None) -> Dict[str, Any]:
    hints = hints or {}
    result = {"text": text, "passes": True, "violations": []}

    # length_max
    length_max = hints.get("length_max") or rules.get("length_max")
    if isinstance(length_max, int) and len(text) > length_max:
        result["passes"] = False
        result["violations"].append(f"length>{length_max}")

    # forbidden_terms
    forbidden = set((hints.get("forbidden_terms") or []) + (rules.get("forbidden_terms") or []))
    for w in forbidden:
        if w and w.lower() in text.lower():
            result["passes"] = False
            result["violations"].append(f"forbidden:{w}")

    # replace_map
    replace_map = {}
    replace_map.update(rules.get("replace_map") or {})
    replace_map.update(hints.get("replace_map") or {})
    fixed = text
    for k, v in replace_map.items():
        fixed = fixed.replace(k, v)

    result["fixed"] = fixed
    return result
