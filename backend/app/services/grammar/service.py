"""Grammar and style checking service using LLM."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.services.llm import get_llm_client
from app.services.llm.client import LLMClientError, PromptMessage, PromptRequest


class GrammarCheckError(RuntimeError):
    """Raised when grammar check cannot complete."""


def check_grammar_and_style(
    text: str,
    target_language: str,
    tone: Optional[str] = None,
    style_preferences: Optional[str] = None,
) -> Dict[str, Any]:
    """Check text for grammar, spelling, and style issues using LLM.

    Args:
        text: Text to check
        target_language: Language of the text (e.g., "en", "ko")
        tone: Optional tone guidelines
        style_preferences: Optional style guide preferences

    Returns:
        Dictionary with:
        - has_issues: bool, whether any issues were found
        - issues: list of {type, message, severity}
        - suggestions: list of improvement suggestions
        - confidence: 0.0-1.0, confidence in the analysis

    Raises:
        GrammarCheckError: If LLM call fails or response is invalid
    """
    if not text.strip():
        return {
            "has_issues": False,
            "issues": [],
            "suggestions": [],
            "confidence": 1.0,
        }

    # Build system prompt
    system_prompt = f"""You are a professional copy editor and UX writer.
Your task is to review {target_language} text for the following issues:
1. Grammar errors
2. Spelling mistakes and typos
3. Awkward or unclear phrasing
4. Tone inconsistencies"""

    if tone:
        system_prompt += f"\n5. Check if the tone matches: {tone}"
    if style_preferences:
        system_prompt += f"\n6. Check adherence to style guide: {style_preferences}"

    system_prompt += """

Return your analysis in valid JSON format with this exact structure:
{
  "has_issues": true or false,
  "issues": [
    {"type": "grammar|spelling|style|tone", "message": "description", "severity": "error|warning"}
  ],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "confidence": 0.0 to 1.0
}

Rules:
- Use "error" severity for grammar/spelling mistakes
- Use "warning" severity for style/tone suggestions
- Keep messages concise and actionable
- Provide up to 3 concrete suggestions for improvement
- Set confidence based on how certain you are about the issues
"""

    user_prompt = f"Please review this text:\n\n{text}"

    # Build LLM request
    prompt_request = PromptRequest(
        messages=[
            PromptMessage(role="system", content=system_prompt),
            PromptMessage(role="user", content=user_prompt),
        ],
        temperature=0.1,  # Low temperature for consistent analysis
        max_output_tokens=1000,
    )

    # Call LLM
    try:
        client = get_llm_client()
        result = client.generate(prompt_request)
        response_text = result.text.strip()
    except LLMClientError as exc:
        raise GrammarCheckError(f"LLM call failed: {exc}") from exc

    # Parse JSON response
    try:
        # Try to extract JSON from markdown code blocks if present
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()

        parsed = json.loads(response_text)

        # Validate structure
        if not isinstance(parsed, dict):
            raise ValueError("Response is not a JSON object")

        # Ensure all required fields exist with defaults
        result_dict = {
            "has_issues": bool(parsed.get("has_issues", False)),
            "issues": parsed.get("issues", []),
            "suggestions": parsed.get("suggestions", []),
            "confidence": float(parsed.get("confidence", 0.5)),
        }

        # Validate issues structure
        if not isinstance(result_dict["issues"], list):
            result_dict["issues"] = []

        validated_issues: List[Dict[str, str]] = []
        for issue in result_dict["issues"]:
            if isinstance(issue, dict):
                validated_issues.append({
                    "type": str(issue.get("type", "style")),
                    "message": str(issue.get("message", "Unspecified issue")),
                    "severity": str(issue.get("severity", "warning")),
                })
        result_dict["issues"] = validated_issues

        # Validate suggestions
        if not isinstance(result_dict["suggestions"], list):
            result_dict["suggestions"] = []
        result_dict["suggestions"] = [str(s) for s in result_dict["suggestions"] if s]

        # Clamp confidence to 0.0-1.0
        result_dict["confidence"] = max(0.0, min(1.0, result_dict["confidence"]))

        return result_dict

    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        # If parsing fails, return a safe default indicating we couldn't analyze
        return {
            "has_issues": False,
            "issues": [
                {
                    "type": "system",
                    "message": f"Grammar check could not parse LLM response: {exc}",
                    "severity": "warning",
                }
            ],
            "suggestions": [],
            "confidence": 0.0,
        }


__all__ = ["check_grammar_and_style", "GrammarCheckError"]
