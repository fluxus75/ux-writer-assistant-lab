"""Feature name normalization using LLM and existing data similarity."""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.services.llm import get_llm_client
from app.services.llm.client import LLMClientError


def normalize_feature_name(
    feature_korean: str,
    device: str,
    session: Session,
) -> str:
    """
    Normalize Korean feature name to English snake_case identifier.

    Strategy:
    1. Check existing features in DB for the same device
    2. If similar feature found (simple matching), reuse existing feature_norm
    3. Otherwise, use LLM to generate normalized English identifier
    4. Validate format and return

    Args:
        feature_korean: Korean feature name (e.g., "충전 복귀")
        device: Device identifier (e.g., "robot_vacuum")
        session: Database session

    Returns:
        Normalized English identifier in snake_case (e.g., "return_to_charging")
    """
    if not feature_korean or not feature_korean.strip():
        return "unknown_feature"

    feature_korean = feature_korean.strip()

    # Step 1: Check for existing similar features
    existing_norm = _find_similar_feature(feature_korean, device, session)
    if existing_norm:
        return existing_norm

    # Step 2: Use LLM to normalize
    try:
        normalized = _llm_normalize(feature_korean, device)
    except LLMClientError:
        # Fallback to simple transliteration
        normalized = _simple_normalize(feature_korean)

    # Step 3: Validate format
    if not _is_valid_identifier(normalized):
        normalized = _simple_normalize(feature_korean)

    return normalized


def _find_similar_feature(
    feature_korean: str,
    device: str,
    session: Session,
) -> Optional[str]:
    """Check if similar feature already exists in DB."""
    # Query existing StyleGuideEntry and ContextSnippet for the same device
    stmt = select(models.StyleGuideEntry.feature_norm).where(
        models.StyleGuideEntry.device == device,
        models.StyleGuideEntry.feature_norm.isnot(None),
    ).distinct()

    existing_norms = [row for row in session.scalars(stmt)]

    # Simple heuristic: if Korean feature contains common keywords, reuse
    feature_lower = feature_korean.lower()

    # Common mappings
    keyword_map = {
        "충전": "charging",
        "청소": "cleaning",
        "시작": "start_cleaning",
        "일시정지": "pause",
        "멈춤": "pause",
        "정지": "stop",
        "복귀": "return",
        "공기질": "air_quality",
        "터보": "turbo",
        "모드": "mode",
        "타이머": "timer",
    }

    for keyword, norm_part in keyword_map.items():
        if keyword in feature_lower:
            # Check if any existing norm contains this part
            for existing in existing_norms:
                if existing and norm_part in existing:
                    return existing

    return None


def _llm_normalize(feature_korean: str, device: str) -> str:
    """Use LLM to generate normalized feature identifier."""
    llm = get_llm_client()

    prompt = f"""You are a UX writing system that normalizes feature names to English identifiers.

Device: {device}
Feature (Korean): {feature_korean}

Generate a normalized English identifier using snake_case.

Rules:
- Use common verbs: start, stop, pause, resume, return, set, get, check, adjust
- Be specific: "충전 복귀" → "return_to_charging" (not just "charging")
- Be consistent: similar features should have similar names
- Keep it concise: 2-4 words maximum
- Only alphanumeric and underscores

Examples:
- "충전대로 복귀" → "return_to_charging"
- "청소 시작" → "start_cleaning"
- "일시정지" → "pause_cleaning"
- "공기질 확인" → "check_air_quality"
- "터보 모드 켜기" → "enable_turbo_mode"
- "타이머 설정" → "set_timer"
- "속도 조절" → "adjust_speed"

Respond with ONLY the identifier (no explanation, no quotes).
"""

    try:
        result = llm.generate(prompt)
        normalized = result.text.strip().lower()
        # Remove any quotes or extra whitespace
        normalized = normalized.strip('"').strip("'").strip()
        return normalized
    except Exception:
        raise LLMClientError("Failed to normalize feature name")


def _simple_normalize(feature_korean: str) -> str:
    """Fallback: simple transliteration-based normalization."""
    # Remove special characters, replace spaces with underscore
    normalized = re.sub(r'[^\w\s]', '', feature_korean)
    normalized = re.sub(r'\s+', '_', normalized.strip())
    normalized = normalized.lower()

    # Ensure it starts with a letter
    if normalized and not normalized[0].isalpha():
        normalized = 'f_' + normalized

    # Truncate to reasonable length
    if len(normalized) > 50:
        normalized = normalized[:50]

    return normalized or "unknown_feature"


def _is_valid_identifier(s: str) -> bool:
    """Check if string is a valid Python/snake_case identifier."""
    if not s:
        return False
    # Must start with letter, contain only alphanumeric and underscores
    return bool(re.match(r'^[a-z][a-z0-9_]*$', s))


__all__ = ["normalize_feature_name"]
