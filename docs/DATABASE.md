# Database

SQLite, one file at `/app/data/app.db` inside the container (the `pm-data` Docker volume, so it survives restarts). The backend creates the file, tables, and seed data on startup if they do not exist. Access via Python's built-in `sqlite3`, no ORM.

## Approach

Each user's board is stored as a single JSON document, in exactly the `BoardData` shape the frontend already uses. Reads and writes replace the whole document. This keeps the API to two routes (`GET` / `PUT /api/board`) and lets the AI return a complete updated board in one structured output.

Trade-off: no per-card queries or partial updates in SQL. Not needed for the MVP (one small board per user).

## Tables

```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,  -- BoardData as JSON
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `users`: supports multiple users later; the MVP seeds only `user`.
- `password_hash`: salted hash using stdlib `hashlib.scrypt`, stored as `salt$hash` (hex). No plain-text passwords.
- `boards.user_id` is `UNIQUE`: one board per user for the MVP. Dropping that constraint later allows multiple boards.

## Board document

See `docs/schema.json` for the JSON Schema and an example. Rules the backend validates (via Pydantic) on every write:

- `columns`: ordered array of `{id, title, cardIds}`; array order is display order
- `cards`: object keyed by card id, each `{id, title, details}`
- Every id in any `cardIds` exists in `cards`, and each card appears in exactly one column

## Seeding

On first startup: insert user `user` with the hashed password `password`, and a board with the current demo data (5 columns, 8 cards from `frontend/src/lib/kanban.ts` `initialData`).

## Not in the database

Sessions stay in memory as in Part 4 (sign-in is lost on restart). Chat history stays in the frontend (Part 10).
