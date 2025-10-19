"""Quick test for multiple candidates generation."""

from app.services.llm.client import PromptRequest, PromptMessage, LLMResult

# Test dataclass initialization
print("Testing PromptRequest with n parameter...")
request = PromptRequest(
    messages=[
        PromptMessage(role="system", content="You are a translator"),
        PromptMessage(role="user", content="Translate: Hello")
    ],
    temperature=0.7,
    n=3
)
print(f"[OK] PromptRequest created with n={request.n}")

# Test LLMResult with candidates
print("\nTesting LLMResult with candidates...")
result = LLMResult(
    text="Hola",
    latency_ms=100.0,
    raw=None,
    candidates=["Hola", "Hola!", "Hola, amigo"]
)
print(f"[OK] LLMResult created with {len(result.candidates)} candidates")
print(f"  Primary text: {result.text}")
print(f"  All candidates: {result.candidates}")

# Test LLMResult without candidates (should use text)
print("\nTesting LLMResult without candidates...")
result2 = LLMResult(
    text="Bonjour",
    latency_ms=50.0,
    raw=None
)
print(f"[OK] LLMResult created, candidates auto-populated: {result2.candidates}")

print("\n[SUCCESS] All dataclass tests passed!")
