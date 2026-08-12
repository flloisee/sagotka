import { db } from './db.js';
import {
  type Form,
  type FormListItem,
  type FormResponse,
  type FormSettings,
  type Question,
  type AnswerValue,
  type User,
  type ShareGrant,
  type QuizGrade,
  type QuizFlags,
  type QuizEvent,
  DEFAULT_SETTINGS,
  newQuestion,
  randomId,
} from '@sagotka/shared';
import { type QuizSession } from './anticheat.js';

interface FormRow {
  id: string;
  title: string;
  description: string;
  settings: string;
  questions: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  alias: string | null;
}

interface ResponseRow {
  id: string;
  form_id: string;
  edit_token: string;
  created_at: string;
  updated_at: string;
  score: string;
  flags: string;
}

interface AnswerRow {
  response_id: string;
  question_id: string;
  value: string;
}

function parseForm(row: FormRow): Form {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    settings: { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) } as FormSettings,
    questions: JSON.parse(row.questions) as Question[],
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alias: row.alias || null,
  };
}

// ---------- forms ----------

export function listFormsForUser(userId: string): FormListItem[] {
  const rows = db
    .prepare(
      `SELECT f.*,
              (SELECT COUNT(*) FROM responses r WHERE r.form_id = f.id) AS response_count,
              CASE WHEN EXISTS (SELECT 1 FROM form_shares fs WHERE fs.form_id = f.id AND fs.user_id = ?)
                   THEN 1 ELSE 0 END AS is_shared
       FROM forms f
       WHERE f.owner_id IS NULL OR f.owner_id = ? OR
             EXISTS (SELECT 1 FROM form_shares fs WHERE fs.form_id = f.id AND fs.user_id = ?)
       ORDER BY f.updated_at DESC`,
    )
    .all(userId, userId, userId) as unknown as (FormRow & {
    response_count: number;
    is_shared: number;
  })[];
  return rows.map((r) => ({
    ...parseForm(r),
    responseCount: r.response_count,
    shared: r.is_shared === 1 && r.owner_id !== userId,
  }));
}

export function canAccessForm(userId: string, formId: string): boolean {
  const row = db
    .prepare(
      `SELECT f.owner_id,
              EXISTS (SELECT 1 FROM form_shares fs WHERE fs.form_id = f.id AND fs.user_id = ?) AS shared
       FROM forms f WHERE f.id = ?`,
    )
    .get(userId, formId) as { owner_id: string | null; shared: number } | undefined;
  if (!row) return false;
  return row.owner_id === null || row.owner_id === userId || row.shared === 1;
}

export function isFormOwner(userId: string, formId: string): boolean {
  const row = db
    .prepare('SELECT owner_id FROM forms WHERE id = ?')
    .get(formId) as { owner_id: string | null } | undefined;
  return row?.owner_id === userId;
}

export function getForm(id: string): Form | null {
  const row = db
    .prepare('SELECT * FROM forms WHERE id = ?')
    .get(id) as FormRow | undefined;
  return row ? parseForm(row) : null;
}

export function getFormByIdentifier(identifier: string): Form | null {
  const byId = getForm(identifier);
  if (byId) return byId;
  return getFormByAlias(identifier);
}

export function getFormByAlias(alias: string): Form | null {
  const row = db
    .prepare('SELECT * FROM forms WHERE alias = ?')
    .get(alias) as FormRow | undefined;
  return row ? parseForm(row) : null;
}

export function setFormAlias(formId: string, alias: string | null): boolean {
  if (alias !== null) {
    const existing = getFormByAlias(alias);
    if (existing && existing.id !== formId) return false;
  }
  db.prepare('UPDATE forms SET alias = ? WHERE id = ?').run(alias, formId);
  return true;
}

export function createForm(input: {
  title: string;
  ownerId: string | null;
  mode?: 'form' | 'quiz';
}): Form {
  const now = new Date().toISOString();
  const isQuiz = input.mode === 'quiz';
  const form: Form = {
    id: randomId(),
    title: input.title,
    description: '',
    settings: { ...DEFAULT_SETTINGS, quiz: isQuiz },
    questions: isQuiz ? [newQuestion('true_false', true)] : [],
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,
    alias: null,
  };
  db.prepare(
    `INSERT INTO forms (id, title, description, settings, questions, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    form.id,
    form.title,
    form.description,
    JSON.stringify(form.settings),
    JSON.stringify(form.questions),
    form.ownerId,
    form.createdAt,
    form.updatedAt,
  );
  return form;
}

export function updateForm(
  id: string,
  patch: Partial<Pick<Form, 'title' | 'description' | 'questions'>> & {
    settings?: Partial<FormSettings>;
  },
): Form | null {
  const existing = getForm(id);
  if (!existing) return null;
  const next: Form = {
    ...existing,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    settings: patch.settings
      ? { ...existing.settings, ...patch.settings }
      : existing.settings,
    questions: patch.questions ?? existing.questions,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE forms SET title = ?, description = ?, settings = ?, questions = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.title,
    next.description,
    JSON.stringify(next.settings),
    JSON.stringify(next.questions),
    next.updatedAt,
    id,
  );
  return next;
}

export function deleteForm(id: string): boolean {
  const res = db.prepare('DELETE FROM forms WHERE id = ?').run(id);
  return res.changes > 0;
}

export function duplicateForm(id: string, ownerId: string): Form | null {
  const existing = getForm(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: Form = {
    ...existing,
    id: randomId(),
    title: `${existing.title} (copy)`,
    ownerId,
    createdAt: now,
    updatedAt: now,
    alias: null,
  };
  db.prepare(
    `INSERT INTO forms (id, title, description, settings, questions, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    copy.id,
    copy.title,
    copy.description,
    JSON.stringify(copy.settings),
    JSON.stringify(copy.questions),
    copy.ownerId,
    copy.createdAt,
    copy.updatedAt,
  );
  return copy;
}

// ---------- responses ----------

export function countResponses(formId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM responses WHERE form_id = ?')
    .get(formId) as { n: number };
  return row.n;
}

export function getResponseById(
  formId: string,
  responseId: string,
): FormResponse | null {
  const row = db
    .prepare('SELECT * FROM responses WHERE id = ? AND form_id = ?')
    .get(responseId, formId) as ResponseRow | undefined;
  if (!row) return null;
  return buildResponse(row);
}

export function hasResponse(formId: string, respondentId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM responses WHERE form_id = ? AND respondent_id = ? LIMIT 1')
    .get(formId, respondentId);
  return Boolean(row);
}

export function getResponseByToken(
  formId: string,
  editToken: string,
): FormResponse | null {
  const row = db
    .prepare('SELECT * FROM responses WHERE edit_token = ? AND form_id = ?')
    .get(editToken, formId) as ResponseRow | undefined;
  if (!row) return null;
  return buildResponse(row);
}

function buildResponse(row: ResponseRow): FormResponse {
  const answers = db
    .prepare('SELECT question_id, value FROM answers WHERE response_id = ?')
    .all(row.id) as unknown as AnswerRow[];
  const answerMap: Record<string, AnswerValue> = {};
  for (const a of answers) {
    answerMap[a.question_id] = JSON.parse(a.value) as AnswerValue;
  }
  return {
    id: row.id,
    formId: row.form_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answers: answerMap,
    ...(row.score ? { score: JSON.parse(row.score) as QuizGrade } : {}),
    ...(hasFlags(row.flags) ? { flags: JSON.parse(row.flags) as QuizFlags } : {}),
  };
}

function hasFlags(raw: string): boolean {
  if (!raw) return false;
  try {
    return Object.keys(JSON.parse(raw) as Record<string, unknown>).length > 0;
  } catch {
    return false;
  }
}

export function createResponse(
  formId: string,
  answers: Record<string, AnswerValue>,
  meta?: { flags?: QuizFlags; score?: QuizGrade; respondentId?: string },
): { response: FormResponse; editToken: string } {
  const now = new Date().toISOString();
  const id = randomId();
  const editToken = randomId();
  db.prepare(
    `INSERT INTO responses (id, form_id, edit_token, created_at, updated_at, score, flags, respondent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    formId,
    editToken,
    now,
    now,
    meta?.score ? JSON.stringify(meta.score) : '',
    meta?.flags ? JSON.stringify(meta.flags) : '{}',
    meta?.respondentId ?? null,
  );
  insertAnswers(id, answers);
  const response = getResponseById(formId, id)!;
  return { response, editToken };
}

export function updateResponse(
  formId: string,
  responseId: string,
  answers: Record<string, AnswerValue>,
  meta?: { flags?: QuizFlags; score?: QuizGrade },
): FormResponse | null {
  const existing = getResponseById(formId, responseId);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE responses SET updated_at = ?, score = ?, flags = ? WHERE id = ?').run(
    now,
    meta?.score ? JSON.stringify(meta.score) : '',
    meta?.flags ? JSON.stringify(meta.flags) : '{}',
    responseId,
  );
  db.prepare('DELETE FROM answers WHERE response_id = ?').run(responseId);
  insertAnswers(responseId, answers);
  return getResponseById(formId, responseId)!;
}

function insertAnswers(responseId: string, answers: Record<string, AnswerValue>): void {
  const stmt = db.prepare(
    'INSERT INTO answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)',
  );
  for (const [questionId, value] of Object.entries(answers)) {
    stmt.run(randomId(), responseId, questionId, JSON.stringify(value));
  }
}

export function deleteResponse(formId: string, responseId: string): boolean {
  const row = db
    .prepare('SELECT id FROM responses WHERE id = ? AND form_id = ?')
    .get(responseId, formId) as { id: string } | undefined;
  if (!row) return false;
  db.prepare('DELETE FROM answers WHERE response_id = ?').run(responseId);
  const res = db.prepare('DELETE FROM responses WHERE id = ?').run(responseId);
  return res.changes > 0;
}

export function listResponses(formId: string): FormResponse[] {
  const rows = db
    .prepare(
      `SELECT * FROM responses WHERE form_id = ? ORDER BY created_at DESC`,
    )
    .all(formId) as unknown as ResponseRow[];
  return rows.map(buildResponse);
}

// ---------- quiz sessions ----------

interface QuizSessionRow {
  id: string;
  form_id: string;
  fullscreen_required: number;
  started_at: number;
  submitted_at: number | null;
  events_json: string;
}

function parseQuizSession(row: QuizSessionRow): QuizSession {
  return {
    token: row.id,
    formId: row.form_id,
    fullscreenRequired: row.fullscreen_required === 1,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
  };
}

export function createQuizSession(formId: string, fullscreenRequired: boolean): QuizSession {
  const token = randomId();
  db.prepare(
    `INSERT INTO quiz_sessions (id, form_id, fullscreen_required, started_at, events_json)
     VALUES (?, ?, ?, ?, '[]')`,
  ).run(token, formId, fullscreenRequired ? 1 : 0, Date.now());
  return getQuizSession(token)!;
}

export function getQuizSession(token: string): QuizSession | null {
  const row = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(token) as
    | QuizSessionRow
    | undefined;
  return row ? parseQuizSession(row) : null;
}

export function completeQuizSession(
  token: string,
  events: QuizEvent[],
  submittedAt: number,
): void {
  db.prepare(
    'UPDATE quiz_sessions SET submitted_at = ?, events_json = ? WHERE id = ?',
  ).run(submittedAt, JSON.stringify(events), token);
}

// ---------- users ----------

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

function parseUser(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function getUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | UserRow
    | undefined;
  return row ? parseUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;
  return row ? parseUser(row) : null;
}

export function getUserWithHashByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;
  return row ? { ...parseUser(row), passwordHash: row.password_hash } : null;
}

export function createUser(email: string, passwordHash: string): User {
  const now = new Date().toISOString();
  const id = randomId();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, email, passwordHash, now);
  return { id, email, createdAt: now };
}

export function searchUsersByEmail(email: string, excludeId: string, limit = 10): User[] {
  const rows = db
    .prepare(
      `SELECT * FROM users WHERE email LIKE ? AND id != ? ORDER BY email LIMIT ?`,
    )
    .all(`%${email}%`, excludeId, limit) as unknown as UserRow[];
  return rows.map(parseUser);
}

export function updatePassword(userId: string, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export function deleteSessionsForUser(userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---------- sessions ----------

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const now = new Date().toISOString();
  const token = randomId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(token, userId, now, expiresAt);
  return { token, expiresAt };
}

export function getSessionUserId(token: string): string | null {
  const row = db
    .prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?',
    )
    .get(token, new Date().toISOString()) as { user_id: string } | undefined;
  return row ? row.user_id : null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---------- sharing ----------

export function shareForm(formId: string, userId: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO form_shares (form_id, user_id, created_at) VALUES (?, ?, ?)',
  ).run(formId, userId, new Date().toISOString());
}

export function unshareForm(formId: string, userId: string): boolean {
  const res = db.prepare(
    'DELETE FROM form_shares WHERE form_id = ? AND user_id = ?',
  ).run(formId, userId);
  return res.changes > 0;
}

export function listShares(formId: string): ShareGrant[] {
  const rows = db
    .prepare(
      `SELECT u.id AS user_id, u.email, fs.created_at AS shared_at
       FROM form_shares fs JOIN users u ON u.id = fs.user_id
       WHERE fs.form_id = ? ORDER BY u.email`,
    )
    .all(formId) as unknown as
    | { user_id: string; email: string; shared_at: string }[];
  return rows.map((r) => ({ userId: r.user_id, email: r.email, sharedAt: r.shared_at }));
}

export function isFormSharedWith(userId: string, formId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM form_shares WHERE form_id = ? AND user_id = ?')
    .get(formId, userId) as { '1': number } | undefined;
  return !!row;
}

// ---------- otp codes ----------

export type OtpPurpose = 'verify_email' | 'reset_password' | 'login';

interface OtpRow {
  id: string;
  email: string;
  purpose: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
}

export interface OtpCode {
  id: string;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  createdAt: string;
}

function parseOtp(row: OtpRow): OtpCode {
  return {
    id: row.id,
    email: row.email,
    purpose: row.purpose as OtpPurpose,
    codeHash: row.code_hash,
    attempts: row.attempts,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function deleteExpiredOtps(): void {
  db.prepare('DELETE FROM otp_codes WHERE expires_at <= ?').run(new Date().toISOString());
}

export function getUnexpiredOtp(email: string, purpose: OtpPurpose): OtpCode | null {
  deleteExpiredOtps();
  const row = db
    .prepare(
      'SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(email, purpose, new Date().toISOString()) as OtpRow | undefined;
  return row ? parseOtp(row) : null;
}

export function createOtp(input: {
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: string;
}): OtpCode {
  const now = new Date().toISOString();
  const id = randomId();
  db.prepare(
    `INSERT INTO otp_codes (id, email, purpose, code_hash, attempts, expires_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, input.email, input.purpose, input.codeHash, input.expiresAt, now);
  return {
    id,
    email: input.email,
    purpose: input.purpose,
    codeHash: input.codeHash,
    attempts: 0,
    expiresAt: input.expiresAt,
    createdAt: now,
  };
}

export function getOtpForVerify(email: string, purpose: OtpPurpose): OtpCode | null {
  deleteExpiredOtps();
  const row = db
    .prepare(
      'SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(email, purpose, new Date().toISOString()) as OtpRow | undefined;
  return row ? parseOtp(row) : null;
}

export function incrementOtpAttempts(id: string): void {
  db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(id);
}

export function refreshOtp(id: string, codeHash: string, expiresAt: string): void {
  db.prepare('UPDATE otp_codes SET code_hash = ?, expires_at = ?, attempts = 0 WHERE id = ?').run(
    codeHash,
    expiresAt,
    id,
  );
}

export function deleteOtp(id: string): void {
  db.prepare('DELETE FROM otp_codes WHERE id = ?').run(id);
}
