# SagotKa Security Audit

**Date:** 2026-08-14
**Scope:** All source in `server/src/`, `shared/src/`, `web/src/`, configs, and git state. Research-only; no files modified.
**App:** Self-hosted forms + quiz app (React + Express). Auth via httpOnly cookie sessions, argon2id passwords, file uploads served publicly. (reCAPTCHA v3 was removed after this audit.)

---

## Risk summary

Overall risk is **moderate-to-high**. The codebase has a solid foundation — fully parameterized SQL, argon2id, validated inputs, React default escaping, and sound session hygiene — but the system-level controls that matter for a self-hosted, internet-exposed app are missing:

- No rate limiting anywhere; SMTP-less deployments silently drop 2FA.
- The public quiz API leaks answer keys.
- The unrestricted upload endpoint lets any authenticated user plant same-origin XSS/HTML in a directory served as static content.

**Most urgent fixes:** strip grading fields from the public form payload, add an upload allowlist (plus CSP and `nosniff`), and add rate limiting to auth and submission endpoints.

---

## Critical

None.

---

## High

### 1. Quiz answer key disclosed to the public form API

- **Files:** `server/src/routes/public.ts:62` (via `toPublicForm`, returned by `GET /api/f/:id` at `public.ts:67-76`)
- **Description:** `toPublicForm` copies `questions: form.questions` verbatim into the `PublicForm` payload. The stored `Question` objects include `correctAnswer`, `acceptedAnswers`, `caseSensitive`, and `points` (`shared/src/index.ts:57-61, 396-399`), and the zod schema permits them to be saved (`shared/src/index.ts:396-399`). Any anonymous attacker can `GET /api/f/<id>` on a published quiz and read the full answer key, defeating the entire quiz grading system. There is no `hasResponded`-style gate or stripping of grading fields.
- **Fix:** In `toPublicForm`, strip `correctAnswer`, `acceptedAnswers`, `caseSensitive`, and `points` from each question before returning, e.g. `questions: form.questions.map(({ correctAnswer, acceptedAnswers, caseSensitive, points, ...q }) => q)`.

### 2. Stored XSS via unrestricted file uploads served as HTML/SVG on the app origin

- **Files:** `server/src/routes/uploads.ts:16-19` (multer with no `fileFilter`), served statically at `server/src/index.ts:28` (`app.use('/uploads', express.static(UPLOAD_DIR))`)
- **Description:** The upload endpoint accepts **any file type** (no extension/MIME allowlist). A user uploads `evil.html` (or `evil.svg`); it is stored as `/uploads/<uuid>.html` and `express.static` serves it with `Content-Type: text/html` (or `image/svg+xml`). Any browser that navigates to that URL renders attacker-controlled HTML/JS **on the sagotka origin**, where it can call `fetch('/api/forms')`, `fetch('/api/auth/me')`, etc., with the victim's `sagotka_session` cookie automatically attached (httpOnly does not block same-origin requests). The uploader receives the exact URL in the response (`uploads.ts:37-44`), and the only precondition is an authenticated account plus any known form ID (fill links are public, so any published form ID works). This is a same-origin stored XSS / phishing host. There is no CSP to mitigate (see finding 9).
- **Fix:** Restrict uploads to a safe allowlist (e.g. images: `jpg/png/gif/webp/pdf`), validate magic bytes (not just extension/MIME), and/or serve `/uploads/` with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, plus a restrictive `Content-Security-Policy`. Consider storing files outside the web root or under a randomized per-file subdirectory.

### 3. No rate limiting anywhere → password brute force

- **Files:** `server/src/index.ts` (no rate-limit middleware in the whole app); note that reCAPTCHA v3 (a former defense-in-depth check on auth endpoints) has since been **removed** — the only anti-brute-force control is rate limiting, which does not exist
- **Description:** There is no `express-rate-limit` (or equivalent) on `/api/auth/login` (`routes/auth.ts:114`), `/api/auth/otp/request` (`auth.ts:35`), `/api/auth/otp/verify` (`auth.ts:60`), or the public submission endpoints (`public.ts:78, 93`). In the default configuration (SMTP unset), login is a pure username/password brute-force target: unlimited guesses, no lockout, no throttling. Note also that with SMTP unset, the 2FA step is silently skipped (`auth.ts:136-141` — the `requiresOtp` branch only runs `if (smtpConfigured())`), so a correct password guess logs in directly. Even with SMTP configured, the `{ requiresOtp: true }` response is a **password oracle**: the attacker can brute-force passwords and learn which one is correct, then only needs the OTP.
- **Fix:** Add per-IP and per-account rate limiting on all `/api/auth/*` routes (and public submission endpoints), and consider requiring 2FA even when SMTP is unconfigured (or refusing login entirely without SMTP).

---

## Medium

### 4. Session cookie missing `Secure` flag (and no `__Host-` prefix)

- **Files:** `server/src/routes/auth.ts:28-33` (`COOKIE_OPTS`: `httpOnly`, `sameSite: 'lax'`, `path`, `maxAge` — no `secure`); same for the respondent cookie at `server/src/routes/public.ts:30-35`
- **Description:** The `sagotka_session` cookie is transmitted over plain HTTP. Any deployment not terminating TLS right at the app (LAN use, HTTP reverse proxy, ngrok free tier mixed with direct HTTP access, MITM on shared networks) allows session hijacking by sniffing. The self-hosted nature of this app makes plain-HTTP deployment likely.
- **Fix:** Set `secure: true` when `NODE_ENV === 'production'` (or `app.get('trust proxy')`-aware logic), and consider the `__Host-` prefix (which also requires `secure` + no `domain`).

### 5. Login is a timing-based user enumeration oracle

- **File:** `server/src/routes/auth.ts:127-134`
- **Description:** When the email does not exist, the handler returns `401` immediately without running the argon2 `verify()` (which costs tens of ms). When the email exists, `verify()` runs. This measurable response-time difference lets an attacker enumerate registered accounts. Combined with finding 3, it also lets the attacker avoid wasting guesses on non-existent accounts.
- **Fix:** Always run an argon2 `verify` against a fixed dummy hash when the user is not found, and return the same response/status.

### 6. Account enumeration via OTP endpoints (and response-body differences)

- **Files:** `server/src/routes/auth.ts:48-50` (`purpose === 'verify_email'` returns 409 "account already exists" vs 202 for new), `auth.ts:73-75` (`/auth/otp/verify` returns 409 if the user exists), `auth.ts:52-54` (reset/login request returns `{sent:false}` vs `{sent:true}`)
- **Description:** The registration flow explicitly distinguishes existing accounts (409) from new ones (202), and the password-reset flow leaks existence through the response body. Combined with finding 5, an attacker can build a complete list of registered emails.
- **Fix:** Return identical status codes and bodies regardless of account existence (e.g., always 202 with a generic body for all purposes), and log existence internally only.

### 7. OTP email bombing / forced code invalidation (no throttling on OTP issuance)

- **Files:** `server/src/routes/auth.ts:56` → `server/src/otp.ts:25-36`
- **Description:** `/auth/otp/request` can be called repeatedly for any existing email. `issueOtp` **regenerates and refreshes** the code each time (`otp.ts:29-35`, `refreshOtp` at `repo.ts:640-646`) and sends a fresh email per call. An attacker who knows an account exists can (a) flood the victim's inbox with reset/login codes, and (b) continuously invalidate the victim's legitimately requested code (each refresh replaces `code_hash`). No per-email or per-IP throttling exists.
- **Fix:** Rate-limit OTP issuance per email and per IP (e.g., min 60 s between sends, max N per hour), and do not auto-refresh an existing unexpired code.

### 8. Unauthenticated storage DoS on public endpoints (responses + quiz sessions)

- **Files:** `server/src/routes/public.ts:93-148` (`POST /api/f/:id/responses`), `public.ts:78-91` (`POST /api/f/:id/quiz/start`)
- **Description:** These endpoints are fully unauthenticated, have no rate limiting, and each call inserts rows: 1 `responses` row + N `answers` rows per submission (`repo.ts:301-325`), or 1 `quiz_sessions` row (`repo.ts:396-403`). An attacker can loop to grow the DB without bound (a 10 MB body allows thousands of answer rows per request, and `answers` is `z.record(z.string(), z.any())` — no key-count or per-value size limits, `shared/src/index.ts:419-423`). `node:sqlite` is synchronous, so DB growth also blocks the single-threaded server.
- **Fix:** Add rate limiting and per-form submission caps; validate answer-record size (`z.record(...).refine(obj => Object.keys(obj).length <= N)` and value lengths); add pagination/archival for responses.

### 9. Missing security headers (no helmet/CSP/X-Frame-Options/nosniff)

- **File:** `server/src/index.ts` (no helmet or header middleware anywhere)
- **Description:** The app sets none of: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`. This raises the impact of finding 2 (no CSP to stop uploaded HTML from running scripts), enables clickjacking of the login/editor UI, and allows MIME-sniffing.
- **Fix:** Use `helmet` (with a strict CSP, at least `default-src 'self'`) and serve uploaded files with `X-Content-Type-Options: nosniff` + attachment disposition.

### 10. Login 2FA silently disabled when SMTP is not configured

- **File:** `server/src/routes/auth.ts:136-141`
- **Description:** When SMTP is unset, `smtpConfigured()` is false, so the `requiresOtp` branch is skipped and a password-only login succeeds. Self-hosted deployments without SMTP (a documented fallback, `.env.example:11`) get no second factor at all — making finding 3 (unlimited brute force) a direct account takeover path. (Also note `mailer.ts:111` logs OTP codes to stdout when SMTP is unset — a code leak if logs are shared.)
- **Fix:** Fail closed: require SMTP + OTP for login, or explicitly warn/lock out the 2FA-less mode in production.

---

## Low

### 11. Reflecting CORS (`origin: true`) with credentials

- **File:** `server/src/index.ts:19-24`
- **Description:** `cors({ origin: true, credentials: true })` reflects any Origin, including `null` and malicious sites. Exploitation is currently limited because `sameSite: 'lax'` prevents the session cookie from being attached to cross-site fetches (so cross-origin readers can't authenticate), and the public endpoints don't require credentials. It is still a defense-in-depth gap and a footgun if cookie settings change.
- **Fix:** Restrict `origin` to an explicit allowlist derived from config (the app's own origin) or use `origin: (origin, cb) => ...` allowlisting.

### 12. `limitToOneResponse` is trivially bypassable (client-side cookie only)

- **Files:** `server/src/routes/public.ts:101-104` (respondent cookie `sagotka_respondent`, `public.ts:29-43`); enforcement via `hasResponse` at `public.ts:73-74`
- **Description:** "One response per person" is enforced purely by a self-issued cookie. Clearing the cookie, using incognito, or changing the value bypasses the limit, so the feature's anti-abuse promise does not hold.
- **Fix:** This is a product-integrity issue, not a security boundary, but if it matters: bind to an IP/fingerprint or require login for one-response forms.

### 13. Quiz anti-cheat is fully client-trusting

- **File:** `server/src/anticheat.ts:11-46`, events supplied by the client at `public.ts:136-139`
- **Description:** `computeQuizFlags` trusts the `events` array sent by the browser (max 500 events, types enum-only). A cheater submits an empty events array (or fabricates a `fullscreen-enter` event) and receives zero flags. Flagged/clean status is cosmetic only.
- **Fix:** Accept that this is client-trusting; document it, and consider adding server-side invariants (e.g., minimum plausible answer time derived from `startedAt`).

### 14. Uploaded files are never deleted (orphan disk leak) and uploads only check "form exists"

- **Files:** `server/src/routes/uploads.ts:23-27` (auth is enforced by the `formsRouter.use('/forms', requireAuth)` middleware chain at `server/src/routes/forms.ts:31`, but the handler checks only `getForm(req.params.id)` — **not ownership/collaboration**); no cleanup in `deleteForm` (`repo.ts:201-204`) or `deleteResponse` (`repo.ts:356-364`)
- **Description:** (a) Any authenticated user can upload to *any* form they know the ID of (IDs leak via public fill links), using another user's form as a free hosting/storage sink. (b) Deleting a form or response never removes files from `UPLOAD_DIR`, so disk fills up over time (aggravated by finding 3's absence of rate limiting).
- **Fix:** In the upload handler, verify `canAccessForm(req.userId, formId)`; delete files when their referencing form/response is deleted; add a storage-quota per user.

### 15. Authenticated user enumeration via user search

- **Files:** `server/src/repo.ts:465-472` (`searchUsersByEmail`), route at `server/src/routes/auth.ts:195-199`
- **Description:** Any authenticated user can search emails with `LIKE '%<q>%'` — including wildcard queries like `%`, `_`, or `a%` to enumerate the entire user directory (email addresses), which feeds social engineering and further enumeration.
- **Fix:** Escape `%`/`_` in the query and/or return only exact-prefix matches; consider rate limiting this endpoint.

### 16. No CSRF tokens / Origin check (mitigated by SameSite=Lax, but no defense in depth)

- **Files:** all mutating routes (`routes/auth.ts`, `routes/forms.ts`, `routes/public.ts`, `routes/uploads.ts`); cookie config `auth.ts:30`
- **Description:** All state-changing requests rely solely on `SameSite=Lax`. This does block cross-site POST/PUT/DELETE cookie attachment in modern browsers, so there is no practical CSRF exploit today. However, there is no CSRF token and no Origin/Referer verification, so any future change to cookie flags (e.g., `SameSite=None` for embedding) would silently open CSRF.
- **Fix:** Add a double-submit CSRF token or reject requests whose `Origin` header (when present) doesn't match the configured host.

### 17. 4xx error handler echoes internal exception messages

- **File:** `server/src/index.ts:54-57`
- **Description:** For any error with `status < 500`, the handler returns `err.message` verbatim. Express/parser/multer errors (e.g., malformed JSON body, unexpected SQLite constraint text surfaced via a thrown error with a `status`) can leak internal details.
- **Fix:** Return a generic message for all errors and log the detail server-side; only keep specific, curated messages.

### 18. Weak `randomId()` fallback

- **File:** `shared/src/index.ts:350-355`
- **Description:** If `crypto.randomUUID` is unavailable, IDs fall back to `id-${Date.now()}-${Math.random()...}` — predictable and used for session tokens, edit tokens, quiz session tokens, and upload names. Only reachable on very old Node runtimes (Node ≥ 19 has global `crypto.randomUUID`), but the fallback silently weakens every security token.
- **Fix:** Throw instead of falling back, or require a modern Node version.

### 19. Unpaginated response listing

- **Files:** `server/src/repo.ts:366-373` (`listResponses` returns all rows), `server/src/routes/forms.ts:161-165`
- **Description:** A form with tens of thousands of responses returns everything (all answers JSON-parsed) in one response — memory pressure and a slow authenticated endpoint that can be hit repeatedly.
- **Fix:** Add `LIMIT/OFFSET` or cursor pagination.

---

## Strengths (done correctly)

1. **SQL injection: effectively none.** Every query in `server/src/repo.ts` uses `db.prepare(...)` with `?` placeholders — user input is never string-interpolated into SQL. Verified across all 30+ statements (forms, responses, sessions, users, OTPs, shares, quiz sessions). Migrations use hardcoded DDL.
2. **Passwords: argon2id** with OWASP-minimum default parameters (`server/src/routes/auth.ts:107,176`), never logged or returned; `password_hash` excluded from user responses (`repo.ts:431-433`).
3. **Sessions:** DB-backed, 122-bit random tokens (`crypto.randomUUID`), server-side expiry checked on every request (`repo.ts:503-510`), logout deletes the row (`auth.ts:182-187`), password reset invalidates all sessions (`auth.ts:178`), `httpOnly` + `SameSite=Lax`.
4. **OTP codes:** 6 digits from `crypto.randomInt`, hashed with argon2 at rest, 5-attempt limit, 10-minute TTL, single-use (`otp.ts`, `repo.ts:586-587`).
5. **Input validation:** zod `safeParse` on every auth and form-mutation body (`routes/auth.ts` and `routes/forms.ts`), plus per-question-type answer validation on the server for submissions (`shared/src/index.ts:519-632`), not just the client. Alias has a strict regex and UUID-reservation check (`shared/src/index.ts:475-487`).
6. **Authorization on authenticated routes:** `requireAuth` guards all `/api/forms/*` (`forms.ts:31`), and each handler then checks `canAccessForm`/`isFormOwner` (`forms.ts:41-51`). Destructive/owner-only operations (delete, alias, sharing) additionally require `isFormOwner`. Response deletion is scoped by `form_id` (`repo.ts:356-364`).
7. **Edit tokens are unguessable and scoped:** response edits require the random edit token *and* a matching `rid` and `form_id` (`public.ts:161-166, 184-187`); quiz sessions are single-use, form-scoped, and time-limited (`public.ts:123-135`).
8. **XSS in the web app: clean.** No `dangerouslySetInnerHTML`, `innerHTML`, or `v-html` anywhere in `web/src`; all user content (question titles, answers, filenames) renders through React's default escaping. Verified by grep.
9. **Upload filenames are sanitized** against path traversal: stored as `<crypto uuid><ext>` where `ext` is `path.extname()` output sliced to 12 chars (`uploads.ts:10-13`) — cannot contain path separators, and `express.static` is traversal-safe.
10. **No SSRF:** the server makes no outbound HTTP requests (reCAPTCHA v3, the former sole outbound call, has been removed); the mailer only reads a local logo file.
11. **No hardcoded secrets in the repo.** `server/.env` (which currently contains a real-looking Gmail app password and user) is gitignored and confirmed **not tracked** by git (`git check-ignore -v` → `.gitignore:5:.env`; `git ls-files` shows only `.env.example` files).
12. **Safe error handling for 500s** ("Something went wrong on our side."), no stack traces leaked.
13. **DB hygiene:** WAL mode, foreign keys on, additive idempotent migrations, unique index backing alias uniqueness.

---

## Remediation checklist (by priority)

- [x] **P0** — Strip grading fields (`correctAnswer`, `acceptedAnswers`, `caseSensitive`, `points`) from `toPublicForm`.
- [x] **P0** — Upload allowlist + magic-byte validation; serve `/uploads/` with `nosniff` + `Content-Disposition: attachment`; add CSP.
- [x] **P0** — Rate limit `/api/auth/*` (login, OTP request/verify) and public submission endpoints.
- [x] **P1** — Fail closed on 2FA when SMTP is unset (or refuse login without SMTP).
- [x] **P1** — Cookie `Secure` flag (+ `__Host-` prefix) in production.
- [x] **P1** — Constant-time dummy-argon2 verify on unknown email; uniform OTP responses (no 409/`{sent}` leaks).
- [x] **P1** — Throttle OTP issuance per email/IP; stop auto-refreshing unexpired codes.
- [x] **P1** — Bound submission payloads (`z.record` size/length caps); per-form submission caps.
- [x] **P1** — Add `helmet` (CSP, X-Frame-Options, nosniff, HSTS, Referrer-Policy).
- [x] **P2** — Restrict CORS origin allowlist; upload ownership check + orphan file cleanup; paginate response listing.
- [x] **P2** — CSRF token or Origin check; escape `%`/`_` in user search; generic 4xx error messages; drop weak `randomId` fallback.
