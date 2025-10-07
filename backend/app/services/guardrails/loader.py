"""Utilities for loading guardrail rules with scope awareness."""

from __future__ import annotations

from typing import Dict, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models


def _rule_applies(rule: models.GuardrailRule, request: models.Request | None) -> bool:
    if rule.scope == models.GuardrailScope.GLOBAL:
        return True
    if request is None:
        return False
    payload = rule.payload_json or {}
    if rule.scope == models.GuardrailScope.FEATURE:
        candidate = payload.get("feature_norm") or payload.get("feature_name")
        feature = (request.constraints_json or {}).get("feature_norm") or request.feature_name
        return bool(candidate) and candidate == feature
    if rule.scope == models.GuardrailScope.REQUEST:
        target = payload.get("request_id")
        return bool(target) and target == request.id
    return False


def _merge_guardrail_sources(*sources: Dict[str, object]) -> Dict[str, object]:
    merged: Dict[str, object] = {
        "forbidden_terms": set(),
        "replace_map": {},
        "length_min": None,
        "length_max": None,
        "style": {},
    }
    for source in sources:
        if not source:
            continue
        forbidden = source.get("forbidden_terms") or []
        if isinstance(forbidden, dict):
            forbidden = forbidden.values()
        for term in forbidden:
            if term:
                merged["forbidden_terms"].add(str(term))
        replace_map = source.get("replace_map") or {}
        if isinstance(replace_map, dict):
            merged["replace_map"].update({str(k): str(v) for k, v in replace_map.items()})
        if source.get("length_min") is not None:
            current = merged["length_min"]
            length_min = int(source.get("length_min"))
            merged["length_min"] = length_min if current is None else max(int(current), length_min)
        if source.get("length_max") is not None:
            current = merged["length_max"]
            length_max = int(source.get("length_max"))
            merged["length_max"] = length_max if current is None else min(int(current), length_max)
        style = source.get("style") or {}
        if isinstance(style, dict):
            merged_style = merged.setdefault("style", {})
            merged_style.update(style)
    merged["forbidden_terms"] = sorted(merged["forbidden_terms"])
    return merged


def load_guardrail_rules(
    session: Session,
    *,
    request: models.Request | None = None,
    extra_sources: Iterable[Dict[str, object]] | None = None,
) -> Dict[str, object]:
    """Return merged guardrail configuration from DB + optional extras."""

    stmt = select(models.GuardrailRule)
    records = session.scalars(stmt)
    aggregated: Dict[str, object] = {
        "forbidden_terms": [],
        "replace_map": {},
        "length_min": None,
        "length_max": None,
        "style": {},
    }

    for rule in records:
        if not _rule_applies(rule, request):
            continue
        payload = rule.payload_json or {}
        if rule.rule_type == models.GuardrailRuleType.FORBIDDEN_TERM:
            terms = payload.get("terms") or payload.get("term")
            if isinstance(terms, (list, tuple, set)):
                aggregated.setdefault("forbidden_terms", []).extend(str(t) for t in terms if t)
            elif terms:
                aggregated.setdefault("forbidden_terms", []).append(str(terms))
        elif rule.rule_type == models.GuardrailRuleType.REPLACE:
            replacements = payload.get("replace_map") or {}
            aggregated.setdefault("replace_map", {}).update({str(k): str(v) for k, v in replacements.items() if v})
        elif rule.rule_type == models.GuardrailRuleType.LENGTH:
            if payload.get("min") is not None:
                aggregated["length_min"] = (
                    max(int(payload["min"]), int(aggregated["length_min"]))
                    if aggregated["length_min"] is not None
                    else int(payload["min"])
                )
            if payload.get("max") is not None:
                aggregated["length_max"] = (
                    min(int(payload["max"]), int(aggregated["length_max"]))
                    if aggregated["length_max"] is not None
                    else int(payload["max"])
                )
        elif rule.rule_type == models.GuardrailRuleType.STYLE:
            style_payload = {str(k): v for k, v in payload.items() if v is not None}
            aggregated.setdefault("style", {}).update(style_payload)

    extras = list(extra_sources or [])
    extras.insert(0, aggregated)
    return _merge_guardrail_sources(*extras)


__all__ = ["load_guardrail_rules"]

