from typing import Any, Dict, List


def _tokenize(text: str) -> List[str]:
    return [tok for tok in text.strip().split() if tok]


def apply_guardrails(text: str, rules: Dict[str, Any], hints: Dict[str, Any] | None = None) -> Dict[str, Any]:
    hints = hints or {}
    result: Dict[str, Any] = {"text": text, "passes": True, "violations": []}

    merged_rules = {**rules}
    if "forbidden_terms" in merged_rules and not isinstance(merged_rules["forbidden_terms"], list):
        merged_rules["forbidden_terms"] = list(merged_rules["forbidden_terms"])

    length_min = hints.get("length_min") or merged_rules.get("length_min")
    length_max = hints.get("length_max") or merged_rules.get("length_max")
    if isinstance(length_min, int) and len(text) < length_min:
        result["passes"] = False
        result["violations"].append(f"length<{length_min}")
    if isinstance(length_max, int) and len(text) > length_max:
        result["passes"] = False
        result["violations"].append(f"length>{length_max}")

    forbidden_terms = set()
    for source in (merged_rules.get("forbidden_terms"), hints.get("forbidden_terms")):
        if not source:
            continue
        if isinstance(source, (list, tuple, set)):
            forbidden_terms.update(str(term).lower() for term in source if term)
        else:
            forbidden_terms.add(str(source).lower())
    lowered = text.lower()
    for word in forbidden_terms:
        if word and word in lowered:
            result["passes"] = False
            result.setdefault("violations", []).append(f"forbidden:{word}")

    replace_map: Dict[str, str] = {}
    replace_map.update(merged_rules.get("replace_map") or {})
    replace_map.update(hints.get("replace_map") or {})
    fixed = text
    for src, dst in replace_map.items():
        if src:
            fixed = fixed.replace(src, dst)

    style_rules = merged_rules.get("style") or {}
    if style_rules:
        tokens = _tokenize(fixed)
        if style_rules.get("max_words") is not None and len(tokens) > int(style_rules["max_words"]):
            result["passes"] = False
            result["violations"].append(f"words>{int(style_rules['max_words'])}")
        person = str(style_rules.get("person") or "").lower()
        if person == "impersonal":
            pronouns = {" i ", " we ", " i'm ", " we've ", " i'd ", " we'll ", " my ", " our "}
            if any(pronoun in f" {fixed.lower()} " for pronoun in pronouns):
                result["passes"] = False
                result["violations"].append("person:impersonal")
        punctuation = str(style_rules.get("punctuation") or "").lower()
        if punctuation == "period" and not fixed.rstrip().endswith("."):
            result["passes"] = False
            result["violations"].append("punctuation:period")
        if punctuation == "no_exclaim" and "!" in fixed:
            result["passes"] = False
            result["violations"].append("punctuation:no_exclaim")
        casing = str(style_rules.get("casing") or "").lower()
        if casing == "sentence" and fixed[:1] and not fixed[:1].isupper():
            result["passes"] = False
            result["violations"].append("casing:sentence")

    result["fixed"] = fixed
    return result


__all__ = ["apply_guardrails"]
