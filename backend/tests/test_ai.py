import pytest

from app import ai


@pytest.mark.live
def test_gemini_connectivity():
    answer = ai.ask("What is 2+2? Reply with just the number.")
    assert "4" in answer
