import pytest

from app import ai
from app.db import DEFAULT_BOARD
from app.models import BoardData

pytestmark = pytest.mark.live


def chat_and_apply(history, message):
    result = ai.chat(DEFAULT_BOARD, history, message)
    board = BoardData.model_validate(ai.apply_operations(DEFAULT_BOARD, result.operations))
    return result, board


def test_gemini_connectivity():
    answer = ai.ask("What is 2+2? Reply with just the number.")
    assert "4" in answer


def test_question_does_not_change_board():
    result = ai.chat(DEFAULT_BOARD, [], "How many cards are in the Done column? Do not change anything.")
    assert result.operations == []
    assert "2" in result.reply or "two" in result.reply.lower()


def test_adds_a_card_and_moves_another():
    _, board = chat_and_apply(
        [],
        'Add a card called "Write release notes" to Review, and move "Gather customer signals" to In Progress.',
    )
    review_titles = [board.cards[card_id].title for card_id in board.columns[3].cardIds]
    assert "Write release notes" in review_titles
    assert "card-2" in board.columns[2].cardIds
    assert len(board.cards) == 9


def test_moves_a_card_using_history():
    history = [
        {"role": "user", "content": "Which card is about the roadmap?"},
        {"role": "assistant", "content": 'That is "Align roadmap themes" in Backlog.'},
    ]
    _, board = chat_and_apply(history, "Move that card to Done.")
    assert "card-1" in board.columns[4].cardIds
    assert "card-1" not in board.columns[0].cardIds
    assert len(board.cards) == 8
