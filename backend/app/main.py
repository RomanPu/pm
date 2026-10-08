import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import db
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


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
