# SagotKa

**Ask. Collect. Answer.**

Inspired by the common forms and quiz apps, SagotKa is a self-hosted platform for building forms and scored quizzes, collecting responses, and reviewing results.

<p align="center">
  <img src="web/public/favicon.svg" alt="SagotKa logo" width="72" />
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-4a9d8c?style=flat" />
  <img alt="Express" src="https://img.shields.io/badge/Express-5-4a9d8c?style=flat" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-node%3Asqlite-4a9d8c?style=flat" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-4a9d8c?style=flat" />
  <img alt="npm workspaces" src="https://img.shields.io/badge/npm-workspaces-4a9d8c?style=flat" />
  <img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-4a9d8c?style=flat" />
</p>

Built with React 19, Express 5, and SQLite (via Node's built-in `node:sqlite`), SagotKa is a single-repo npm-workspaces monorepo with three packages: `shared`, `server`, and `web`.

> **Dashboard · Editor · Fill · Responses**

---

## Features

| Feature | What it does |
| --- | --- |
| **Form builder** | 12 question types (short answer, paragraph, multiple choice, true/false, checkboxes, dropdown, email, number, date, file upload, section break, rating), drag-and-drop reordering, question duplication, and a live preview split pane. |
| **Publish & share** | Publish any form to get a public fill link anyone can open, no account needed. |
| **URL aliases** | Give a form a friendly, optional alias (`my-survey`) that replaces the UUID in the public link — `/f/my-survey` instead of `/f/<uuid>`. Aliases are unique, lowercase, alphanumeric with hyphens, up to 50 characters. |
| **Responses** | Summary view with per-question answer distributions, plus an individual response list with full answers and per-response deletion. |
| **Quiz mode** | Turn any form into a scored quiz with correct answers, per-question points, optional time limits, shuffled options, required fullscreen, and results shown to respondents on demand. |
| **Anti-cheat telemetry** | Quiz sessions record tab switches, fullscreen exits, and copy attempts; suspicious submissions are flagged and surfaced on the response detail view. |
| **File uploads** | File-upload questions accept up to 10 files of 50 MB each, served publicly under `/uploads/`. |
| **Collaboration** | Share a form with other users by email; collaborators can open, edit, and duplicate it and view its responses, while only the owner can delete the form or manage the share list. |
| **Accounts & sessions** | Email + password registration with argon2id hashing and httpOnly cookie sessions. Optional OTP codes (email verification, password reset, and second-factor login) delivered via SMTP. |
| **Dark mode** | Theme persisted in `localStorage`; a design system locked via the Hallmark process (see `design.md`) with a single coral accent and composed 150–200 ms motion that honors `prefers-reduced-motion`. |

---

## What this is

SagotKa is a complete forms app with three distinct surfaces:

| Surface | Route | Purpose |
| --- | --- | --- |
| **Dashboard** | `/` | Search, open, share, duplicate, and delete your forms; see response counts and open/closed status. |
| **Editor** | `/forms/:id` | Build questions, configure settings, preview, and publish. Autosaves every change. |
| **Fill** | `/f/:id` | The public, chrome-free respondent experience with progress rail and per-question validation. The form's alias can be used in place of the id (`/f/:alias`). |
| **Responses** | `/forms/:id/responses` | Summary charts and individual responses, including quiz scores and anti-cheat flags. |

---

## Monorepo architecture

```
npm workspaces
   │
   ├── shared  ── raw TypeScript source (zod schemas, types, validateAnswer, quiz grading)
   │                consumed directly by both server and web — never built
   │
   ├── server  ── Express 5 API (tsx, ESM NodeNext) on port 8787
   │                node:sqlite DatabaseSync, argon2id, cookie sessions, SMTP, multer
   │
   └── web     ── React 19 SPA (Vite) on port 5173
                    Tailwind v4 via @tailwindcss/vite, react-router-dom v7
```

> **Shared is never built** — The `shared` package ships as raw TypeScript and is consumed directly by both server and web; there is no build or watch step.

The `shared` package is the single source of truth for the domain: TypeScript interfaces (`Form`, `Question`, `FormResponse`, …), zod schemas for every API request body, answer validation, and quiz grading logic. Because it ships as raw `.ts`, there is no build or watch step — the server imports it through `@sagotka/shared` (tsx resolves the barrel `shared/src/index.ts`) and the Vite dev server uses an alias to the same module.

During development the Vite dev server proxies `/api` and `/uploads` to the Express server, so the browser always talks to a single origin. In production, `npm run build` compiles the web app to `web/dist`, and the Express server serves it (with an SPA fallback) when it detects that directory at boot.

---

## Tech stack

Versions below are what `package-lock.json` currently resolves to.

| Area | Technology | Version |
| --- | --- | --- |
| Language | TypeScript | 5.9.3 |
| UI | React / React DOM | 19.2.8 |
| Routing | react-router-dom | 7.18.2 |
| Build tool | Vite | 6.4.3 |
| Drag & drop | @dnd-kit/core, @dnd-kit/sortable | 6.3.1, 10.0.0 |
| Icons | lucide-react | 0.475.0 |
| Styling | Tailwind CSS + @tailwindcss/vite | 4.3.3 |
| API server | Express | 5.2.1 |
| Database | node:sqlite (`DatabaseSync`) | Node built-in |
| Validation | zod | 3.25.76 |
| Password hashing | @node-rs/argon2 (argon2id) | 2.0.2 |
| File uploads | multer | 2.2.0 |
| Email | nodemailer | 9.0.5 |
| Dev tooling | tsx (server runner), concurrently | 4.23.12, 9.2.4 |

There is no ORM — the server talks to SQLite through prepared statements in `server/src/repo.ts`. There are no tests, linter, or formatter configured; `npm run typecheck` is the only verification step.

---

## Prerequisites

| Requirement | Why |
| --- | --- |
| **Node.js 22.5 or later** | The server uses the built-in `node:sqlite` module, which is not available in earlier releases. The project is developed against Node 24. |
| **npm 7+** | The project uses npm workspaces (lockfile v3). The root `package.json` also declares `allowScripts` entries so Vite's native `esbuild` and `fsevents` binaries are allowed to run their install scripts. |
| **No separate database** | SQLite runs in-process and the data file is created on first boot. |

---

## Getting started

### 1. Install

```bash
npm install
```

This installs all three workspaces (`shared`, `server`, `web`) and hoists dependencies to the root `node_modules`.

### 2. Configure environment variables

Both packages read env vars from their own `.env` files. Everything is optional — the app runs without either one, so you can start coding immediately and add keys later.

**Server (`server/.env` — copy from `server/.env.example`):**

```bash
# SMTP for OTP emails via Gmail App Passwords.
# When unset (dev fallback), OTP codes are logged to the server console instead of emailed.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=<16-character app password>
SMTP_FROM=SagotKa <you@gmail.com>
```

Without SMTP credentials, OTP codes are printed to the server console (look for `[otp] code for you@example.com: 123456`) instead of being emailed — handy for local development.

### 3. Run the dev servers

```bash
npm run dev
```

Starts both apps concurrently with hot reload:

- **Web app:** http://localhost:5173 (Vite dev server; proxies `/api` and `/uploads` to the API)
- **API server:** http://localhost:8787 (Express, run via `tsx watch`)

### 4. Production-like run

```bash
npm run build && npm run start
```

`npm run build` typechecks and compiles the web app into `web/dist`. `npm run start` runs the Express server alone on **port 8787**; if `web/dist` exists it is served with an SPA fallback for any non-`/api` / non-`/uploads` path, so the whole app lives on a single origin.

---

## API overview

All JSON endpoints live under `/api`. Errors are returned as `{ "error": "message" }`. The auth cookie is `sagotka_session` (httpOnly, `SameSite=Lax`, 30-day lifetime). CORS is enabled with credentials support.

### Auth

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/otp/request` | – | Request a 6-digit OTP by `purpose` (`verify_email`, `reset_password`, `login`). Returns `{ sent: boolean }`. |
| POST | `/api/auth/otp/verify` | – | Check a verification code without creating an account. Returns `{ verified: boolean }`. |
| POST | `/api/auth/register` | – | Create an account (requires a verified email code). Sets the session cookie. |
| POST | `/api/auth/login` | – | Log in. When SMTP is configured and no `code` is supplied, returns `{ requiresOtp: true, email }` for a second factor. |
| POST | `/api/auth/password/reset` | – | Reset a password with an OTP; revokes all of the user's sessions. |
| POST | `/api/auth/logout` | – | Destroy the current session and clear the cookie. |
| GET | `/api/auth/me` | required | Return the signed-in user. |
| GET | `/api/auth/users?q=` | required | Search users by email (used when sharing forms). |

### Forms (all require auth)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/forms` | List the user's forms (owned + shared), with response counts. |
| POST | `/api/forms` | Create a form or quiz (`{ title?, mode: 'form' | 'quiz' }`). |
| GET | `/api/forms/:id` | Fetch one form with its response count. |
| PUT | `/api/forms/:id` | Update title, description, settings, or questions. Validated with zod. |
| DELETE | `/api/forms/:id` | Delete a form (owner only; cascades to responses/answers). |
| POST | `/api/forms/:id/duplicate` | Duplicate a form as a new copy owned by the caller. |
| PUT | `/api/forms/:id/alias` | Set or clear the form's link alias (`{ alias: string | null }`); owner only, returns 409 if the alias is already in use. |
| GET | `/api/forms/:id/shares` | List users the form is shared with (owner only). |
| POST | `/api/forms/:id/shares` | Share the form with a user by email (owner only). |
| DELETE | `/api/forms/:id/shares/:userId` | Revoke a share (owner only). |
| GET | `/api/forms/:id/responses` | List all responses, including quiz scores and anti-cheat flags. |
| GET | `/api/forms/:id/summary` | Aggregated summary: answered/skipped counts, choice distribution, quiz grading totals. |
| DELETE | `/api/forms/:id/responses/:responseId` | Delete a single response. |

Form access is governed by `canAccessForm` (owner, share recipient, or legacy owner-less form). Shared collaborators can view and edit the form, duplicate it, and view or delete responses; only the owner can delete the form and manage the share list.

### Public fill & quiz endpoints (no auth)

Every `/api/f/*` identifier below accepts either the form's UUID **or its alias** (`/api/f/my-survey` works wherever `/api/f/<uuid>` does).

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/f/:id` | Fetch a published form for filling (404 for unpublished). |
| POST | `/api/f/:id/quiz/start` | Begin a quiz session; returns `{ sessionToken, startedAt }`. |
| POST | `/api/f/:id/responses` | Submit answers. Validates per-question, grades quizzes, runs anti-cheat checks, and returns `{ responseId, editToken, score? }`. |
| GET | `/api/f/:id/responses/:rid?token=` | Fetch a response for editing (only when the form allows it and it isn't a quiz). |
| PUT | `/api/f/:id/responses/:rid` | Update an existing response via its edit token. |

Editing after submit is gated by the `allowEditResponses` setting; quiz responses can never be edited. Quiz submissions require a session token and reject reused, expired (5 s grace over the time limit), or mismatched sessions.

### Uploads

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/forms/:id/uploads` | only checks the form exists | Multipart upload (`files` field), up to 10 files of 50 MB each. Returns `[{ filename, url, size, type }]`. |

Uploaded files are stored in `server/uploads/` and served publicly at `/uploads/<id>.<ext>`. File references in answers are validated against their declared `size` on submit.

---

## Data model

`node:sqlite` `DatabaseSync` at `server/data/sagotka.db` (WAL mode). Schema is created in `server/src/db.ts`; migrations are additive only, via `ALTER TABLE` guarded by `PRAGMA table_info` checks — tables are never dropped or recreated.

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | id, email (UNIQUE), password_hash, created_at | argon2id password hashes. |
| `sessions` | token (PK), user_id (FK), created_at, expires_at | 30-day lifetime; checked on every authed request. |
| `forms` | id, alias (UNIQUE value), title, description, settings, questions, owner_id (FK, nullable), created_at, updated_at | `settings` and `questions` are JSON text. `alias` is an optional, unique public link alias (lowercase alphanumeric + hyphens, must not be a UUID). |
| `form_shares` | form_id (FK), user_id (FK), created_at | Composite PK; grants shared access to a form. |
| `responses` | id, form_id (FK, cascade), edit_token (UNIQUE), score (JSON), flags (JSON), created_at, updated_at | `score`/`flags` columns added by migration. |
| `answers` | id, response_id (FK, cascade), question_id, value | `value` is the JSON-serialized answer. |
| `otp_codes` | id, email, purpose, code_hash, attempts, expires_at, created_at | 6-digit codes, 10-minute TTL, 5 attempts. |
| `quiz_sessions` | id, form_id (FK), fullscreen_required, started_at, submitted_at, events_json | Server-side record of a quiz attempt. |

**Question types** (`FIELD_TYPES` in `shared/src/index.ts`):

`short_text`, `paragraph`, `multiple_choice`, `true_false`, `checkbox`, `dropdown`, `email`, `number`, `date`, `file_upload`, `section_break`, `rating`

**Form settings** (`FormSettings`):

`published`, `acceptsResponses`, `confirmationMessage`, `allowEditResponses`, `showProgress`, `quiz`, `showResults`, `fullscreenRequired`, `shuffleOptions`, `timeLimitSeconds`

---

## Commands

All commands run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the API (port 8787) and web dev server (port 5173) concurrently with hot reload. |
| `npm run build` | Typecheck + build the **web** app into `web/dist` (server runs from source via tsx). |
| `npm run start` | Run the API server only; serves `web/dist` with SPA fallback if present. |
| `npm run typecheck` | Typecheck `server` (`tsc --noEmit`) and `web` (`tsc -b`); `shared` has no build step. |
| `npm run dev -w @sagotka/server` | API only (`tsx watch src/index.ts`). |
| `npm run dev -w @sagotka/web` | Web only (Vite). |
| `npm run build -w @sagotka/web` | Build the web workspace only. |
| `npm run start -w @sagotka/server` | Run the API server without the web watcher. |

There is no test suite, linter, or formatter — `npm run typecheck` is the only verification step.

---

## Project structure

```
sagotka/
├── package.json                 # workspace root, dev/build/typecheck/start scripts
├── AGENTS.md                    # developer notes & conventions
├── design.md                    # Hallmark-locked design system (source of truth for styling)
├── .hallmark/                   # design process log
├── shared/
│   └── src/index.ts             # barrel: types, zod schemas, validateAnswer, quiz grading
├── server/
│   ├── .env.example
│   ├── data/                    # gitignored; sagotka.db created on boot
│   ├── uploads/                 # gitignored; uploaded files created on boot
│   ├── public/sagotka-logo.png  # static asset (used in OTP emails)
│   └── src/
│       ├── index.ts             # Express bootstrap, middleware, static + SPA serving
│       ├── db.ts                # DatabaseSync setup, schema, additive migrations
│       ├── repo.ts              # all SQL prepared statements (forms, responses, users, sessions, otp)
│       ├── auth.ts              # requireAuth middleware, session cookie name
│       ├── env.ts               # loads server/.env
│       ├── otp.ts               # OTP issue/verify, 6-digit codes, TTL & attempt limits
│       ├── mailer.ts            # nodemailer transport + branded OTP email template
│       ├── anticheat.ts         # quiz flag computation (tabs, fullscreen, copy, duration)
│       ├── summary.ts           # response aggregation for the summary view
│       └── routes/
│           ├── auth.ts          # /api/auth/*
│           ├── forms.ts         # /api/forms/* (requireAuth)
│           ├── public.ts        # /api/f/* (public fill & quiz)
│           └── uploads.ts       # /api/forms/:id/uploads (multer)
└── web/
    ├── .env.example
    ├── index.html
    ├── vite.config.ts           # shared alias, Tailwind plugin, /api + /uploads proxy, allowedHosts
    ├── tsconfig*.json           # project references (app + node)
    └── src/
        ├── main.tsx             # entry; applies persisted theme before render
        ├── App.tsx              # routes + auth guard
        ├── api.ts               # typed API client (fetch + credentials: include)
        ├── auth.tsx             # AuthProvider / useAuth
        ├── lib.ts               # date/answer formatting helpers
        ├── styles/tokens.css    # Tailwind v4 theme tokens (light + dark)
        ├── pages/               # Dashboard, Editor, Responses, Fill, Login, Register, ForgotPassword, NotFound
        └── components/          # ui, AppBar, Logo, FillForm, editor/ (QuestionCard, OptionsEditor, AddQuestion)
```

---

## Gotchas & troubleshooting

> **ESM import extensions** — The server is ESM `NodeNext`: local imports use `.js` extensions (`import { db } from './db.js'`) even though the files are `.ts`. tsx resolves them, but a typecheck pass will **not** catch a missing `.js` extension — the error only appears at runtime. Run the server (or hit a route) to verify wiring.

> **Shared is never built** — It is imported as raw TypeScript by both tsx and the Vite alias. Any new shared code must be exported from `shared/src/index.ts` or it won't be visible to either consumer.

> **Data directories are ephemeral** — `server/data/` and `server/uploads/` are gitignored and recreated on boot. Deleting `server/data/sagotka.db` wipes all forms, users, and responses; there is no backup or export mechanism.

> **External hosts / ngrok** — `web/vite.config.ts` has `server.allowedHosts` containing an ngrok domain (`harmonics-preamble-occupancy.ngrok-free.dev`). Any new external testing host must be added there or Vite will refuse connections.

> **OTP codes in dev** — Without SMTP credentials the server logs the code to the console (`[otp] code for …`). Enable SMTP (Gmail App Passwords are suggested in `.env.example`) to deliver codes by email and to enable the OTP second-factor on login.

> **Node version** — `node:sqlite` requires Node 22.5+. On older Node versions the server will crash at import time with an error about the `node:sqlite` module.

> **SPA fallback** — `npm run start` only serves the web app if `web/dist` exists. Run `npm run build` first for a prod-like single-origin run.

---

## Contributing

SagotKa is a small, convention-heavy codebase — please read `AGENTS.md` and `design.md` before touching code.

- Keep `shared` the single source of truth; export new schemas/types from the barrel.
- Server changes must run under tsx; verify runtime wiring with `npm run dev`, not just typecheck.
- Database changes are additive only: `ALTER TABLE` guarded by `PRAGMA table_info`, never drop or recreate tables.
- Follow the design tokens in `web/src/styles/tokens.css` — never inline raw colors or ad-hoc fonts. Motion is 150–200 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, honoring `prefers-reduced-motion`.
- Before submitting, run `npm run typecheck`. There are no automated tests, so test flows manually (register → create → publish → fill → review responses) in both light and dark mode.

## License

Licensed under the [Apache License, Version 2.0](LICENSE) — see the [LICENSE](LICENSE) file for the full terms.

Copyright © 2026 Francis Llego

SagotKa is a personal project built and maintained by Francis Llego (flloisee). You may use, modify, and distribute it at will, provided you follow the terms of the Apache 2.0 license agreement, which also grants an explicit patent license. Unless required by law or agreed to in writing, the software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.