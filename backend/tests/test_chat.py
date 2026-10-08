import copy

import pytest
from google.genai import errors

from app import ai
from app.db import DEFAULT_BOARD
from app.models import BoardData

Op = ai.Operation


@pytest.fixture
def fake_ai(monkeypatch):
    """Replace ai.chat; set fake_ai.response (or .error) and inspect fake_ai.calls."""

    class Fake:
        response = ai.AIResponse(reply="Hello")
        error = None
        calls = []

        def __call__(self, board, history, message):
            self.calls.append({"board": board, "history": history, "message": message})
            if self.error:
                raise self.error
            return self.response

    fake = Fake()
    monkeypatch.setattr(ai, "chat", fake)
    return fake


# /api/chat route


def test_chat_requires_sign_in(client, fake_ai):
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401
    assert fake_ai.calls == []


def test_sends_board_history_and_message_to_ai(signed_in, fake_ai):
    history = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello!"},
    ]
    signed_in.post("/api/chat", json={"message": "What is in Done?", "history": history})
    assert fake_ai.calls == [
        {"board": DEFAULT_BOARD, "history": history, "message": "What is in Done?"}
    ]


def test_reply_only_leaves_board_unchanged(signed_in, fake_ai):
    fake_ai.response = ai.AIResponse(reply="You have 8 cards.")
    response = signed_in.post("/api/chat", json={"message": "How many cards?"})
    assert response.status_code == 200
    assert response.json() == {
        "reply": "You have 8 cards.",
        "board_updated": False,
        "board": DEFAULT_BOARD,
    }
    assert signed_in.get("/api/board").json() == DEFAULT_BOARD


def test_operations_are_applied_and_saved(signed_in, fake_ai):
    fake_ai.response = ai.AIResponse(
        reply="Done.",
        operations=[
            Op(action="move", card_id="card-1", column_id="col-done", position=0),
            Op(action="update", card_id="card-2", title="Renamed"),
        ],
    )
    response = signed_in.post("/api/chat", json={"message": "Move and rename"})
    body = response.json()
    assert response.status_code == 200
    assert body["reply"] == "Done."
    assert body["board_updated"] is True
    assert body["board"]["columns"][0]["cardIds"] == ["card-2"]
    assert body["board"]["columns"][4]["cardIds"] == ["card-1", "card-7", "card-8"]
    assert body["board"]["cards"]["card-2"]["title"] == "Renamed"
    assert len(body["board"]["cards"]) == 8
    assert signed_in.get("/api/board").json() == body["board"]


def test_invalid_operation_is_not_applied(signed_in, fake_ai):
    fake_ai.response = ai.AIResponse(
        reply="Moved it.",
        operations=[
            Op(action="move", card_id="card-1", column_id="col-done"),
            Op(action="move", card_id="card-missing", column_id="col-done"),
        ],
    )
    response = signed_in.post("/api/chat", json={"message": "Move cards"})
    body = response.json()
    assert response.status_code == 200
    assert body["board_updated"] is False
    assert body["board"] == DEFAULT_BOARD
    assert "not applied" in body["reply"]
    assert signed_in.get("/api/board").json() == DEFAULT_BOARD


@pytest.mark.parametrize(
    "error",
    [
        errors.ServerError(503, {"error": {"message": "overloaded"}}),
        errors.ClientError(429, {"error": {"message": "quota"}}),
        ValueError("AI response did not match the expected format"),
    ],
)
def test_ai_failure_returns_clear_error(signed_in, fake_ai, error):
    fake_ai.error = error
    response = signed_in.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 503
    assert "AI is unavailable" in response.json()["detail"]
    assert signed_in.get("/api/board").json() == DEFAULT_BOARD


def test_rejects_invalid_history_role(signed_in, fake_ai):
    response = signed_in.post(
        "/api/chat", json={"message": "hi", "history": [{"role": "system", "content": "x"}]}
    )
    assert response.status_code == 422


# apply_operations


def apply(*operations):
    board = ai.apply_operations(DEFAULT_BOARD, list(operations))
    BoardData.model_validate(board)  # result is always a valid board
    return board


def test_no_operations_returns_equal_copy():
    board = apply()
    assert board == DEFAULT_BOARD
    assert board is not DEFAULT_BOARD


def test_does_not_mutate_input():
    snapshot = copy.deepcopy(DEFAULT_BOARD)
    apply(Op(action="delete", card_id="card-1"))
    assert DEFAULT_BOARD == snapshot


def test_create_appends_with_new_id():
    board = apply(Op(action="create", column_id="col-review", title="New", details="D"))
    new_id = board["columns"][3]["cardIds"][-1]
    assert new_id not in DEFAULT_BOARD["cards"]
    assert board["cards"][new_id] == {"id": new_id, "title": "New", "details": "D"}
    assert len(board["cards"]) == 9


def test_create_at_position():
    board = apply(Op(action="create", column_id="col-backlog", title="Top", position=0))
    assert board["cards"][board["columns"][0]["cardIds"][0]]["title"] == "Top"


def test_update_changes_only_given_fields():
    board = apply(Op(action="update", card_id="card-1", details="New details"))
    assert board["cards"]["card-1"] == {
        "id": "card-1",
        "title": "Align roadmap themes",
        "details": "New details",
    }


def test_move_within_and_across_columns():
    board = apply(
        Op(action="move", card_id="card-2", column_id="col-backlog", position=0),
        Op(action="move", card_id="card-5", column_id="col-discovery"),
    )
    assert board["columns"][0]["cardIds"] == ["card-2", "card-1"]
    assert board["columns"][1]["cardIds"] == ["card-3", "card-5"]
    assert board["columns"][2]["cardIds"] == ["card-4"]


def test_delete_removes_card_everywhere():
    board = apply(Op(action="delete", card_id="card-7"))
    assert "card-7" not in board["cards"]
    assert board["columns"][4]["cardIds"] == ["card-8"]


def test_rename_column():
    board = apply(Op(action="rename_column", column_id="col-done", title="Shipped"))
    assert board["columns"][4]["title"] == "Shipped"


def test_untouched_cards_are_kept():
    board = apply(Op(action="create", column_id="col-review", title="Only change"))
    for card_id, card in DEFAULT_BOARD["cards"].items():
        assert board["cards"][card_id] == card


@pytest.mark.parametrize(
    "operation",
    [
        Op(action="update", card_id="card-missing", title="x"),
        Op(action="move", card_id="card-missing", column_id="col-done"),
        Op(action="move", card_id="card-1", column_id="col-missing"),
        Op(action="delete", card_id="card-missing"),
        Op(action="create", column_id="col-missing", title="x"),
        Op(action="rename_column", column_id="col-missing", title="x"),
    ],
)
def test_unknown_ids_raise(operation):
    with pytest.raises(ValueError):
        ai.apply_operations(DEFAULT_BOARD, [operation])
