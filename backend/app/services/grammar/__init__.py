"""Grammar and style checking service."""

from .service import GrammarCheckError, check_grammar_and_style

__all__ = ["check_grammar_and_style", "GrammarCheckError"]
