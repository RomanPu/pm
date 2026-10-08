# Project Plan

Status legend: `[ ]` todo, `[x]` done. Each part ends with user review before moving on.

## Architecture summary

- One Docker container. Multi-stage build: Node stage runs `next build` with `output: "export"`; Python stage (uv) runs FastAPI with uvicorn and serves the exported static site at `/` and the API under `/api/*`.
- Container listens on port 8000. App is at http://localhost:8000.
- SQLite database file at `/app/data/app.db`, mounted from a Docker volume so data survives restarts. Created on startup if missing.
- AI: Google Gemini API, most suitable free-tier Flash model (planned `gemini-3.8-flash`; free-tier access confirmed by the live test in Part 8), key from `GEMINI_API_KEY` in the root `.env`, passed to the container with `--env-file .env`. Never committed.
- Auth: hardcoded `user` / `password`. Backend sets an httponly session cookie; `/api/*` routes (except login) require it.

## Part 1: Plan

- [x] Read AGENTS.md, docs, and existing frontend code
- [x] Create `frontend/AGENTS.md` describing the existing frontend
- [x] Enrich this plan with substeps, tests, and success criteria
- [x] User reviews and approves this plan

Success criteria: user approval.

## Part 2: Scaffolding

- [x] `backend/`: uv project (`pyproject.toml`, `uv.lock`), `app/main.py` with FastAPI app
- [x] `GET /api/health` returns `{"status": "ok"}`
- [x] Serve a placeholder `static/index.html` ("hello world") at `/` that calls `/api/health` and shows the result
- [x] `Dockerfile` at project root (Python base image + uv, `uv sync --frozen`, uvicorn on 0.0.0.0:8000)
- [x] `.dockerignore` (node_modules, .next, out, .env, .git, data)
- [x] `scripts/start.ps1`, `scripts/stop.ps1` (PC); `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux): build image, run container detached with `--env-file .env`, port 8000, data volume; stop removes the container
- [x] pytest set up in backend with a test for `/api/health`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`
- [x] Verify in Docker: `start.ps1` builds and runs the container, `uv run pytest` passes inside it, hello world page shows API status `ok`, `stop.ps1` removes the container

Tests:
- `uv run pytest` passes (run inside the container)
- Manual: `scripts/start.ps1`, open http://localhost:8000, see hello world plus the API response; `scripts/stop.ps1` stops it

Success criteria: one command starts the container and the page plus API call work in the browser; one command stops it.

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`; confirm `npm run build` produces `frontend/out/`
- [x] Dockerfile gets a Node build stage; copy `out/` into the Python image; FastAPI serves it at `/` (replacing the placeholder)
- [x] Add card editing (title and details) - a business requirement the demo lacks
- [x] Unit tests: `moveCard` edge cases, rename, add, edit, delete
- [x] Point Playwright `baseURL` at the container (`BASE_URL=http://localhost:8000`) for integration runs, keep dev server option for local work
- [x] Verified: 15 unit tests, 6 e2e tests against the container, 2 backend tests in the container, tsc and eslint clean

Tests:
- `npm run test:unit` passes
- `npm run test:e2e` passes against the running container (load board, add, edit, delete, drag between columns, rename column)

Success criteria: demo Kanban board served by FastAPI from the container at `/`, all tests green.

## Part 4: Fake user sign in

- [x] `POST /api/login` checks `user` / `password`, sets httponly session cookie; `POST /api/logout` clears it; `GET /api/me` returns the user or 401
- [x] Frontend: on load call `/api/me`; show a login form if 401, otherwise the board; logout button in the header
- [x] Wrong credentials show an error message
- [x] Verified: 8 backend tests, 20 unit tests, 10 e2e tests against the container (e2e now always targets the container, since the dev server has no backend)

Tests:
- Backend: login success/failure, `/api/me` with and without cookie, logout
- Unit: login form renders, submits, shows error
- E2E: unauthenticated visit shows login; bad password errors; good login shows board; logout returns to login; reload stays signed in

Success criteria: board is reachable only after signing in; logout works.

## Part 5: Database modeling

- [x] Propose schema in `docs/DATABASE.md` with an example in `docs/schema.json`
- [x] Approach (JSON document approved in Part 1): tables `users (id, username unique, password_hash, created_at)` and `boards (id, user_id unique -> users.id, data JSON text, updated_at)`. The board is stored as one JSON document matching the frontend `BoardData` shape. One board per user for the MVP; `user_id` on boards keeps the door open for multiple users.
- [x] Seed: user `user` and a default board (current `initialData`) created when the DB is first initialized
- [x] User sign-off on the schema (sessions in memory, one board per user, chat history not stored)

Success criteria: user approves the documented schema.

## Part 6: Backend

- [x] `app/db.py`: create the SQLite DB and tables if missing, seed default user and board (stdlib `sqlite3`, no ORM)
- [x] Pydantic models for `BoardData`, `Column`, `Card`
- [x] `GET /api/board` returns the signed-in user's board
- [x] `PUT /api/board` validates and replaces the signed-in user's board
- [x] Login checks credentials against the `users` table
- [x] Verified: 24 backend tests in the container; manual PUT survives `stop.ps1` + `start.ps1` (Docker volume); 10 e2e tests still pass

Tests (pytest, temp DB per test):
- DB created from scratch when the file does not exist
- Get board returns seeded data; put then get round-trips
- Invalid payload rejected with 422; unauthenticated requests get 401
- Data persists across app restarts (same DB file)

Success criteria: all backend tests pass; board changes persist in SQLite.

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts`: `fetchBoard`, `saveBoard`
- [x] `KanbanBoard` loads the board from the API on mount and saves after each change (rename, add, edit, delete, move); saves are queued so they reach the server in order
- [x] Simple loading state and visible error message if a save fails
- [x] Verified: 23 unit tests, 12 e2e tests (incl. persistence after reload), board survives container stop/start in the real UI

Tests:
- Unit: board renders data from mocked API; each action triggers a save with the correct payload
- E2E against the container: make changes, reload, changes persist; restart the container, changes still persist

Success criteria: the Kanban board is fully persistent per user.

## Part 8: AI connectivity

- [x] Add the Gemini SDK (`google-genai`) to the backend
- [x] `app/ai.py`: small client wrapper reading `GEMINI_API_KEY` and the model name
- [x] Pytest-only check (no extra route) sends "What is 2+2?" and checks the answer
- [x] Verified: `docker exec pm-app uv run pytest -m live` passes with `gemini-3.8-flash`; 5/5 direct calls returned "4". One earlier call got a temporary 503 (model overloaded), so Part 9 must return a clear error to the user when the AI call fails

Tests:
- Live connectivity test asks "2+2" and asserts "4" in the reply (marked so it can be skipped without a key)

Success criteria: a real Gemini call succeeds from inside the container.

## Part 9: AI with board context and structured outputs

- [x] `POST /api/chat` takes `{ message, history: [{role, content}] }`
- [x] Backend sends a system prompt, the current board JSON, the history, and the user message
- [x] Structured output schema: `{ reply: string, operations: Operation[] }` where each operation is create / update / move / delete card or rename_column. The backend applies them to the stored board, validates the result, and saves it. Changed from the original "AI returns the whole board" design: in testing the AI occasionally dropped untouched cards when rewriting the full board (silent data loss). With operations, cards the AI does not mention cannot be lost, and deletes are explicit
- [x] Response: `{ reply, board_updated: bool, board }`
- [x] AI errors (overload 503, rate limit 429, unparseable output) return 503 with a clear message; the board is not changed
- [x] Model switched to `gemini-3.5-flash`: `gemini-3.8-flash` free tier allows only 20 requests/day. `gemini-3.5-flash` free tier is 5 requests/minute (daily cap not published; check AI Studio)

Tests:
- Unit (AI mocked): reply only leaves the board unchanged; operations are applied and saved; an invalid operation (unknown id) is rejected and nothing is saved; AI failures return 503; each operation type, positions, untouched cards preserved
- Live (`-m live`): question changes nothing; add a card and move another; move a card referenced through conversation history
- [x] Verified: 48 unit tests; 4 live tests pass; real `POST /api/chat` adds a card and moves another with all other cards intact. The Gemini project is now on the paid tier (prepaid credits), so the free-tier limits above no longer apply

Success criteria: the AI can create, edit, and move one or more cards through structured outputs, verified by tests.

## Part 10: AI chat sidebar

- [ ] Sidebar component (collapsible) with message list, input, and send button, using the color scheme
- [ ] Conversation history held in frontend state and sent with each request
- [ ] When `board_updated` is true, refresh the board from the response
- [ ] Loading indicator while waiting; error message on failure

Tests:
- Unit: sends message, renders reply, updates board when `board_updated`
- E2E (AI mocked via route interception): chat round trip and board refresh
- Manual: live chat asks the AI to add and move cards and the board updates

Success criteria: full AI chat in the sidebar; AI changes appear on the board without a reload.
