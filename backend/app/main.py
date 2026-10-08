import secrets
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

STATIC_DIR = Path(__file__).parent.parent / "static"
SESSION_COOKIE = "session"

# MVP: hardcoded credentials and in-memory sessions (sign-in is lost on restart)
USERS = {"user": "password"}
sessions: dict[str, str] = {}

app = FastAPI()


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
    if USERS.get(credentials.username) != credentials.password:
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


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
