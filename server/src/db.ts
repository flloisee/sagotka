import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'sagotka.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    settings    TEXT NOT NULL DEFAULT '{}',
    questions   TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS responses (
    id         TEXT PRIMARY KEY,
    form_id    TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    edit_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS answers (
    id          TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    value       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS form_shares (
    form_id    TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (form_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    purpose    TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_sessions (
    id                  TEXT PRIMARY KEY,
    form_id             TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    fullscreen_required INTEGER NOT NULL DEFAULT 0,
    started_at          INTEGER NOT NULL,
    submitted_at        INTEGER,
    events_json         TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_responses_form ON responses(form_id);
  CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_form_shares_user ON form_shares(user_id);
  CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
  CREATE INDEX IF NOT EXISTS idx_quiz_sessions_form ON quiz_sessions(form_id);
`);

// ---------- migrations (additive, idempotent) ----------

const formColumns = db.prepare('PRAGMA table_info(forms)').all() as { name: string }[];
if (!formColumns.some((c) => c.name === 'owner_id')) {
  db.exec('ALTER TABLE forms ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_forms_owner ON forms(owner_id)');

const shareColumns = db.prepare('PRAGMA table_info(form_shares)').all() as { name: string }[];
if (!shareColumns.some((c) => c.name === 'created_at')) {
  db.exec('ALTER TABLE form_shares ADD COLUMN created_at TEXT NOT NULL DEFAULT ""');
}

const responseColumns = db.prepare('PRAGMA table_info(responses)').all() as { name: string }[];
if (!responseColumns.some((c) => c.name === 'score')) {
  db.exec('ALTER TABLE responses ADD COLUMN score TEXT NOT NULL DEFAULT ""');
}
if (!responseColumns.some((c) => c.name === 'flags')) {
  db.exec("ALTER TABLE responses ADD COLUMN flags TEXT NOT NULL DEFAULT '{}'");
}
if (!responseColumns.some((c) => c.name === 'respondent_id')) {
  db.exec('ALTER TABLE responses ADD COLUMN respondent_id TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_responses_respondent ON responses(form_id, respondent_id)');
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_one_per_respondent
   ON responses(form_id, respondent_id)
   WHERE respondent_id IS NOT NULL`,
);
