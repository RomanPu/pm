import copy
import json
import secrets
from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

MODEL = "gemini-3.8-flash"

SYSTEM_PROMPT = """You are the assistant inside a Kanban project management app.
You help the user manage their board: answer questions about it, and create, edit, move, or delete cards when asked.

Always reply to the user in "reply", briefly and plainly.
Only if the user asked for a change to the board, list the changes in "operations"; otherwise leave it empty.
Cards and columns you do not mention in an operation stay exactly as they are.

Operations and their required fields:
- create: "column_id", "title", "details" (optional "position", 0 = top; default bottom)
- update: "card_id", plus "title" and/or "details" to change
- move: "card_id", "column_id" (optional "position", 0 = top; default bottom)
- delete: "card_id" (only when the user asks to delete or remove it)
- rename_column: "column_id", "title"
Every create and move MUST include "column_id", taken from the board below.

Columns are fixed: never add or remove columns. Use the ids from the board below.

The user's current board (each column lists its card ids in display order, top first):
"""


class Operation(BaseModel):
    action: Literal["create", "update", "move", "delete", "rename_column"]
    card_id: str | None = Field(None, description="Required for update, move, delete")
    column_id: str | None = Field(None, description="Required for create, move, rename_column")
    position: int | None = Field(None, description="Index in the column, 0 = top; omit for bottom")
    title: str | None = Field(None, description="Required for create and rename_column")
    details: str | None = None


class AIResponse(BaseModel):
    reply: str
    operations: list[Operation] = []


def apply_operations(board: dict, operations: list[Operation]) -> dict:
    """Return a new board with the operations applied. Raises ValueError on unknown ids."""
    board = copy.deepcopy(board)
    columns = {column["id"]: column for column in board["columns"]}
    cards = board["cards"]

    def column(column_id):
        if column_id not in columns:
            raise ValueError(f"Unknown column {column_id}")
        return columns[column_id]

    def card(card_id):
        if card_id not in cards:
            raise ValueError(f"Unknown card {card_id}")
        return cards[card_id]

    def remove_from_columns(card_id):
        for col in board["columns"]:
            if card_id in col["cardIds"]:
                col["cardIds"].remove(card_id)

    def insert(card_id, column_id, position):
        card_ids = column(column_id)["cardIds"]
        card_ids.insert(len(card_ids) if position is None else position, card_id)

    for op in operations:
        if op.action == "create":
            card_id = f"card-{secrets.token_hex(4)}"
            column(op.column_id)
            cards[card_id] = {"id": card_id, "title": op.title or "Untitled", "details": op.details or ""}
            insert(card_id, op.column_id, op.position)
        elif op.action == "update":
            target = card(op.card_id)
            if op.title is not None:
                target["title"] = op.title
            if op.details is not None:
                target["details"] = op.details
        elif op.action == "move":
            card(op.card_id)
            column(op.column_id)
            remove_from_columns(op.card_id)
            insert(op.card_id, op.column_id, op.position)
        elif op.action == "delete":
            card(op.card_id)
            remove_from_columns(op.card_id)
            del cards[op.card_id]
        elif op.action == "rename_column":
            column(op.column_id)["title"] = op.title or columns[op.column_id]["title"]
    return board


def ask(prompt: str) -> str:
    # genai.Client reads GEMINI_API_KEY from the environment
    client = genai.Client()
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text


def chat(board: dict, history: list[dict], message: str) -> AIResponse:
    """history: [{"role": "user" | "assistant", "content": str}, ...]"""
    contents = [
        {"role": "model" if item["role"] == "assistant" else "user", "parts": [{"text": item["content"]}]}
        for item in history
    ]
    contents.append({"role": "user", "parts": [{"text": message}]})
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT + json.dumps(board),
        response_mime_type="application/json",
        response_schema=AIResponse,
    )
    # Keep a reference to the client: it closes its connection when garbage collected
    client = genai.Client()
    response = client.models.generate_content(model=MODEL, contents=contents, config=config)
    if response.parsed is None:
        raise ValueError("AI response did not match the expected format")
    return response.parsed
