# AGENTS.md

SagotKa: self-hosted forms + quiz app (React + Express), inspired by common forms and quiz apps. npm-workspaces monorepo: `shared/`, `server/`, `web/`.

## Commands (run from repo root)

- `npm run dev` — server (port **8787**) + web (port **5173**) concurrently
- `npm run typecheck` — typechecks server and web (shared has none)
- `npm run build` — builds **web only**; server runs from source via tsx
- `npm run start` — server only; if `web/dist` exists it is served (SPA fallback), so a prod-like run is `npm run build && npm run start`
- No tests, linter, or formatter are configured — typecheck is the only verification

## Architecture

- **`shared/` is consumed as raw TypeScript source, never built.** It's a single barrel `shared/src/index.ts` (zod schemas, types, `validateAnswer`). Server (tsx) and web (vite alias in `web/vite.config.ts`) both import it directly. Any new shared code must be exported from the barrel; no build/watch step needed.
- **Server** is ESM NodeNext (`"type": "module"`): imports of local files use `.js` extensions (e.g. `./repo.js`) even though the source files are `.ts`. tsx resolves them. Keep this convention.
- **DB**: built-in `node:sqlite` `DatabaseSync` — **synchronous**, no async API, no ORM. File is `server/data/sagotka.db` (WAL mode). Schema and additive migrations live in `server/src/db.ts`; add columns via `ALTER TABLE` guarded by `PRAGMA table_info` checks — never drop/recreate tables. `server/data/` and `server/uploads/` are gitignored and recreated on boot.
- **Auth**: httpOnly cookie `sagotka_session`, argon2id password hashes. `formsRouter.use(requireAuth)` protects `/api/forms/*`. Unauthenticated by design: `/api/f/*` (public fill/edit) and `/api/forms/:id/uploads` (only checks the form exists; uploaded files are served publicly at `/uploads/`).
- **URL aliases**: forms can have an optional, unique `alias` (lowercase alphanumeric + hyphens, 1–50 chars, must not look like a UUID) usable in place of the UUID in public `/api/f/*` URLs — `getFormByIdentifier` tries by id then by alias. Set/clear via `PUT /api/forms/:id/alias` (owner only, 409 if taken); uniqueness is backed by a unique index on `forms.alias` (additive migration in `db.ts`). The web UI for it lives in `ShareLinkModal.tsx`.

## Web conventions

- Tailwind v4 via `@tailwindcss/vite`, configured CSS-first. All color/font tokens live in `web/src/styles/tokens.css` (mapped into `@theme`, exposed as `bg-paper`, `text-ink`, `text-accent`, etc.). **Never inline raw colors or ad-hoc fonts** — see `design.md` (Hallmark-locked).
- Dark mode = `.dark` class on `<html>`; toggled from `sagotka-theme` localStorage in `main.tsx`. Test both modes.
- Motion: 150–200 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, no bounce; `prefers-reduced-motion` is honored globally.
- `web/vite.config.ts` has `server.allowedHosts` containing an ngrok domain — add any new external testing host there.

## Gotchas

- Server imports are picked up by tsx at runtime, so a typecheck pass does **not** catch missing `.js`-extension import errors at boot — actually run `npm run dev` (or a route) to verify runtime wiring.
- `web/build` runs `tsc -b` (project references in `web/tsconfig.json`); `*.tsbuildinfo` files are gitignored.
