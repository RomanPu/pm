# Backend

Python FastAPI app, managed with uv (Python 3.13). Runs in Docker via uvicorn on port 8000.

## Structure

- `pyproject.toml`, `uv.lock` - dependencies (`fastapi`, `uvicorn`; dev: `pytest`, `httpx2`)
- `app/main.py` - FastAPI app. API routes live under `/api/*`; the static site in `static/` is mounted at `/` (mounted last so API routes take precedence)
- `static/` - the Next.js static export, copied in by the Docker build (gitignored, not present locally)
- `tests/` - pytest tests using FastAPI `TestClient`. Run inside the container (`docker exec pm-app uv run pytest`) since `static/` only exists there

## Routes

- `GET /api/health` - `{"status": "ok"}`
- `POST /api/login` - body `{username, password}`; checks hardcoded `user` / `password`, sets httponly `session` cookie; 401 on bad credentials
- `POST /api/logout` - ends the session and clears the cookie
- `GET /api/me` - `{"username": ...}` or 401

Sessions are an in-memory dict (lost on restart). Protected routes use the `CurrentUser` dependency.

## Commands

- Tests: `docker exec pm-app uv run pytest`
