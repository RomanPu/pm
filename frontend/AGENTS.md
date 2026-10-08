# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 single-board Kanban demo. Built as a static export (`output: "export"` -> `out/`), which the Docker build copies into the backend and FastAPI serves at `/`. Sign-in goes through the backend `/api` routes.

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) fonts
- `src/app/page.tsx` - client page: checks `/api/me` on load, shows `LoginForm` when signed out, otherwise `KanbanBoard` (with logout)
- `src/lib/api.ts` - backend calls: `fetchBoard`, `saveBoard`, `getMe`, `login`, `logout`
- `src/components/LoginForm.tsx` - username/password form, shows an error on bad credentials
- `src/app/globals.css` - Tailwind import and color scheme CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow)
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards; mirrors the backend seed, used by tests), `moveCard` (pure reorder/move logic for drag and drop), `createId`
- `src/components/KanbanBoard.tsx` - client component holding board state; loads it from `GET /api/board` (loading/error state), and every change goes through `updateBoard`, which updates state and queues a `PUT /api/board` (saves run in order; failures show an alert). Handles drag (dnd-kit `DndContext`, `DragOverlay`), column rename, add, edit, and delete card
- `src/components/KanbanColumn.tsx` - droppable column with editable title input, sortable card list, empty-state drop zone, `NewCardForm`
- `src/components/KanbanCard.tsx` - sortable card with title, details, Edit (inline form, drag disabled while editing) and Remove buttons
- `src/components/KanbanCardPreview.tsx` - static card shown in the drag overlay
- `src/components/NewCardForm.tsx` - toggleable form to add a card (title required, details optional)

## Data shape

```ts
BoardData = {
  columns: { id: string; title: string; cardIds: string[] }[];
  cards: Record<string, { id: string; title: string; details: string }>;
}
```

Column order is the array order; card order is `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `*.test.ts(x)` under `src/`; `fetch` is mocked with `vi.stubGlobal`. Run `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/auth.spec.ts` (sign in/out), `tests/kanban.spec.ts` (load, add, edit, remove, rename column, drag; signs in first via `tests/helpers.ts`). Runs against the Docker container at http://localhost:8000 (override with `BASE_URL`); start it first. Run `npm run test:e2e`. Kanban tests reset the stored board to `initialData` before each test (this overwrites the real board in the container), and run with 1 worker since they share one user.

## Notes

- The board is persisted per user via the backend.
- `npm run dev` has no backend, so sign-in does not work there; use the container.
- Test ids: `column-<columnId>`, `card-<cardId>`.
- Cards have `role="button"` from dnd-kit, so their accessible name includes child button labels; use exact names when querying buttons by role.
