import copy

from fastapi.testclient import TestClient

from app.db import DEFAULT_BOARD
from app.main import app


def test_board_requires_sign_in(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=DEFAULT_BOARD).status_code == 401


def test_get_returns_seeded_board(signed_in):
    response = signed_in.get("/api/board")
    assert response.status_code == 200
    assert response.json() == DEFAULT_BOARD


def test_put_then_get_round_trips(signed_in):
    board = copy.deepcopy(DEFAULT_BOARD)
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][4]["cardIds"].append("card-1")
    board["cards"]["card-9"] = {"id": "card-9", "title": "New", "details": "Added"}
    board["columns"][1]["cardIds"].append("card-9")

    response = signed_in.put("/api/board", json=board)
    assert response.status_code == 200
    assert response.json() == board
    assert signed_in.get("/api/board").json() == board


def put_invalid(client, mutate):
    board = copy.deepcopy(DEFAULT_BOARD)
    mutate(board)
    return client.put("/api/board", json=board)


def test_rejects_missing_fields(signed_in):
    assert put_invalid(signed_in, lambda b: b.pop("cards")).status_code == 422
    assert put_invalid(signed_in, lambda b: b["cards"]["card-1"].pop("title")).status_code == 422


def test_rejects_unknown_fields(signed_in):
    response = put_invalid(signed_in, lambda b: b["columns"][0].update(color="red"))
    assert response.status_code == 422


def test_rejects_card_id_in_column_without_card(signed_in):
    response = put_invalid(signed_in, lambda b: b["columns"][0]["cardIds"].append("card-99"))
    assert response.status_code == 422


def test_rejects_card_not_in_any_column(signed_in):
    response = put_invalid(
        signed_in,
        lambda b: b["cards"].update({"card-9": {"id": "card-9", "title": "T", "details": "D"}}),
    )
    assert response.status_code == 422


def test_rejects_card_in_two_columns(signed_in):
    response = put_invalid(signed_in, lambda b: b["columns"][1]["cardIds"].append("card-1"))
    assert response.status_code == 422


def test_rejects_mismatched_card_key(signed_in):
    response = put_invalid(signed_in, lambda b: b["cards"]["card-1"].update(id="card-x"))
    assert response.status_code == 422


def test_invalid_put_does_not_change_board(signed_in):
    put_invalid(signed_in, lambda b: b["columns"][0]["cardIds"].append("card-99"))
    assert signed_in.get("/api/board").json() == DEFAULT_BOARD


def test_board_persists_across_restarts(signed_in):
    board = copy.deepcopy(DEFAULT_BOARD)
    board["columns"][0]["title"] = "Persisted"
    signed_in.put("/api/board", json=board)

    # A fresh app startup on the same DB file keeps the data (no reseed)
    with TestClient(app) as restarted:
        restarted.post("/api/login", json={"username": "user", "password": "password"})
        assert restarted.get("/api/board").json() == board
