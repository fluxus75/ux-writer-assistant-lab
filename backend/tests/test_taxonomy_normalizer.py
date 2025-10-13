"""Tests for taxonomy normalizer service."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.taxonomy.normalizer import (
    normalize_feature_name,
    _find_similar_feature,
    _is_valid_identifier,
    _simple_normalize,
)


def test_is_valid_identifier():
    """Test identifier validation."""
    assert _is_valid_identifier("charging")
    assert _is_valid_identifier("return_to_charging")
    assert _is_valid_identifier("start_cleaning")
    assert not _is_valid_identifier("123_invalid")
    assert not _is_valid_identifier("Invalid-Name")
    assert not _is_valid_identifier("")


def test_simple_normalize():
    """Test fallback normalization."""
    assert _simple_normalize("충전 복귀") == "충전_복귀"
    assert _simple_normalize("청소 시작!") == "청소_시작"
    assert _simple_normalize("   spaces   ") == "spaces"


def test_find_similar_feature_with_keyword_match(test_session):
    """Test finding similar feature using keyword matching."""
    from app.db.models import StyleGuideEntry

    # Create test data
    entry = StyleGuideEntry(
        id="test_1",
        device="robot_vacuum",
        feature_norm="charging",
        text="Returning to charging station.",
    )
    test_session.add(entry)
    test_session.commit()

    # Should find "charging" for "충전" keyword
    result = _find_similar_feature("충전 복귀", "robot_vacuum", test_session)
    assert result == "charging"


def test_find_similar_feature_no_match(test_session):
    """Test when no similar feature is found."""
    result = _find_similar_feature("완전히 새로운 기능", "robot_vacuum", test_session)
    assert result is None


@patch('app.services.taxonomy.normalizer.get_llm_client')
def test_normalize_feature_name_with_llm(mock_llm, test_session):
    """Test normalization using LLM."""
    # Mock LLM response
    mock_result = MagicMock()
    mock_result.text = "set_timer"
    mock_llm.return_value.generate.return_value = mock_result

    result = normalize_feature_name("타이머 설정", "air_purifier", test_session)
    assert result == "set_timer"
    assert _is_valid_identifier(result)


@patch('app.services.taxonomy.normalizer.get_llm_client')
def test_normalize_feature_name_llm_failure_fallback(mock_llm, test_session):
    """Test fallback when LLM fails."""
    from app.services.llm.client import LLMClientError

    # Mock LLM failure
    mock_llm.return_value.generate.side_effect = LLMClientError("API error")

    result = normalize_feature_name("타이머 설정", "air_purifier", test_session)
    # Should fallback to simple normalization
    assert result == "타이머_설정"


def test_normalize_feature_name_empty_input(test_session):
    """Test normalization with empty input."""
    result = normalize_feature_name("", "robot_vacuum", test_session)
    assert result == "unknown_feature"

    result = normalize_feature_name("   ", "robot_vacuum", test_session)
    assert result == "unknown_feature"
