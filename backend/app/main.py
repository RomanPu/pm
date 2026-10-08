import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from google.genai import errors
from pydantic import BaseModel

from app import ai, db
from app.models import BoardData

STATIC_DIR = Path(__file__).parent.parent / "static"
SESSION_COOKIE = "session"

# MVP: in-memory sessions (sign-in is lost on restart)
sessions: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)


class Credentials(BaseModel):
    username: str
    password: str


def current_user(request: Request) -> str:
    username = sessions.get(request.cookies.get(SESSION_COOKIE, ""))
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


CurrentUser = Annotated[str, Depends(current_user)]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, response: Response):
    if not db.check_credentials(credentials.username, credentials.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_urlsafe(32)
    sessions[token] = credentials.username
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request, response: Response):
    sessions.pop(request.cookies.get(SESSION_COOKIE, ""), None)
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}


@app.get("/api/me")
def me(username: CurrentUser):
    return {"username": username}


@app.get("/api/board")
def get_board(username: CurrentUser) -> BoardData:
    return BoardData.model_validate(db.get_board(username))


@app.put("/api/board")
def put_board(board: BoardData, username: CurrentUser) -> BoardData:
    db.save_board(username, board.model_dump())
    return board


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board_updated: bool
    board: BoardData


@app.post("/api/chat")
def chat(request: ChatRequest, username: CurrentUser) -> ChatResponse:
    board = db.get_board(username)
    history = [message.model_dump() for message in request.history]
    try:
        result = ai.chat(board, history, request.message)
    except (errors.APIError, ValueError):
        raise HTTPException(status_code=503, detail="The AI is unavailable right now. Please try again.")

    if not result.operations:
        return ChatResponse(reply=result.reply, board_updated=False, board=board)
    try:
        new_board = BoardData.model_validate(ai.apply_operations(board, result.operations))
    except ValueError:
        reply = result.reply + "\n\n(The board change was invalid and was not applied.)"
        return ChatResponse(reply=reply, board_updated=False, board=board)
    db.save_board(username, new_board.model_dump())
    return ChatResponse(reply=result.reply, board_updated=True, board=new_board)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
