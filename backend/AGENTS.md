# Backend

Python FastAPI app, managed with uv (Python 3.13). Runs in Docker via uvicorn on port 8000.

## Structure

- `pyproject.toml`, `uv.lock` - dependencies (`fastapi`, `uvicorn`, `google-genai`; dev: `pytest`, `httpx2`)
- `app/main.py` - FastAPI app and routes. API routes live under `/api/*`; the static site in `static/` is mounted at `/` (mounted last so API routes take precedence). Startup (lifespan) calls `db.init_db()`
- `app/db.py` - SQLite via stdlib `sqlite3`: schema, seed (user `user` / `password` with the demo board), scrypt password hashing, `check_credentials`, `get_board`, `save_board`. DB file at `data/app.db` (`/app/data` in the container, the `pm-data` volume)
- `app/ai.py` - Gemini via `google-genai`; model `gemini-3.8-flash`; `ask(prompt)` returns the text reply. The client reads `GEMINI_API_KEY` from the environment (passed in with `--env-file .env`)
- `app/models.py` - Pydantic `BoardData`, `Column`, `Card` (extra fields forbidden; validates that column `cardIds` and `cards` match exactly, each card in one column)
- `static/` - the Next.js static export, copied in by the Docker build (gitignored, not present locally)
- `tests/` - pytest. `conftest.py` gives every test a fresh temp DB and clears sessions; fixtures `client` and `signed_in`

See `docs/DATABASE.md` for the schema.

## Routes

- `GET /api/health` - `{"status": "ok"}`
- `POST /api/login` - body `{username, password}`; checks the `users` table, sets httponly `session` cookie; 401 on bad credentials
- `POST /api/logout` - ends the session and clears the cookie
- `GET /api/me` - `{"username": ...}` or 401
- `GET /api/board` - the signed-in user's board (`BoardData`)
- `PUT /api/board` - replace the signed-in user's board; 422 if invalid

Sessions are an in-memory dict (lost on restart). Protected routes use the `CurrentUser` dependency.

## Commands

- Tests: `docker exec pm-app uv run pytest` (skips tests marked `live`)
- Live AI tests (real Gemini calls): `docker exec pm-app uv run pytest -m live`
