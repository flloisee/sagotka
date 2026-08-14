import { Router } from 'express';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import {
  registerSchema,
  loginSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '@sagotka/shared';
import {
  createUser,
  getUserByEmail,
  getUserWithHashByEmail,
  getUserById,
  createSession,
  deleteSession,
  deleteSessionsForUser,
  searchUsersByEmail,
  updatePassword,
} from '../repo.js';
import { requireAuth, SESSION_COOKIE, type AuthedRequest } from '../auth.js';
import { issueOtp, verifyOtp, checkOtp } from '../otp.js';
import { smtpConfigured } from '../mailer.js';
import {
  authLimiter,
  loginLimiter,
  loginAccountLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  registerLimiter,
  passwordResetLimiter,
  searchLimiter,
} from '../ratelimit.js';

export const authRouter = Router();

const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

// Argon2 verify is expensive (~tens of ms). Run it against a fixed dummy hash
// when the email is unknown so login timing does not reveal account existence.
const DUMMY_PASSWORD = 'sagotka-dummy-password-for-timing';
let dummyVerifyPromise: Promise<boolean> | null = null;
function dummyVerify(): Promise<boolean> {
  if (!dummyVerifyPromise) {
    dummyVerifyPromise = hash(DUMMY_PASSWORD, { algorithm: Algorithm.Argon2id }).then((h) =>
      verify(h, DUMMY_PASSWORD),
    );
  }
  return dummyVerifyPromise;
}

authRouter.post('/auth/otp/request', otpRequestLimiter, async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid request.' });
  }
  const { email, purpose } = parsed.data;

  const accountExists = Boolean(getUserByEmail(email));
  const shouldIssue =
    purpose === 'verify_email' ? !accountExists : accountExists;
  if (shouldIssue) {
    await issueOtp(email, purpose);
  }

  // Identical response regardless of account existence.
  res.status(202).json({ sent: true });
});

authRouter.post('/auth/otp/verify', otpVerifyLimiter, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid request.' });
  }
  const { email, code } = parsed.data;

  const matches = await checkOtp(email, code, 'verify_email');
  res.json({ verified: matches });
});

authRouter.post('/auth/register', authLimiter, registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid registration.' });
  }
  const { email, password, code } = parsed.data;

  if (getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const otpOk = await verifyOtp(email, code, 'verify_email');
  if (!otpOk) {
    return res.status(401).json({ error: 'Invalid or expired verification code.' });
  }

  const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });
  const user = createUser(email, passwordHash);
  const session = createSession(user.id);
  res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTS);
  res.status(201).json({ user });
});

authRouter.post('/auth/login', authLimiter, loginLimiter, loginAccountLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid login.' });
  }
  const { email, password, code } = parsed.data;

  const record = getUserWithHashByEmail(email);
  const matches = record
    ? await verify(record.passwordHash, password)
    : await dummyVerify();
  if (!record || !matches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!code) {
    // Fail closed: a password alone never logs in. OTP is always required, and
    // without SMTP the code is printed to the server console (dev fallback).
    if (smtpConfigured() || !IS_PROD) {
      await issueOtp(email, 'login');
      return res.status(200).json({ requiresOtp: true, email });
    }
    return res.status(503).json({
      error: 'Login is unavailable because email (SMTP) is not configured.',
    });
  }

  const otpOk = await verifyOtp(email, code, 'login');
  if (!otpOk) {
    return res.status(401).json({ error: 'Invalid or expired code.' });
  }

  const session = createSession(record.id);
  res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTS);
  res.json({ user: { id: record.id, email: record.email, createdAt: record.createdAt } });
});

authRouter.post('/auth/password/reset', authLimiter, passwordResetLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid reset.' });
  }
  const { email, code, newPassword } = parsed.data;

  const otpOk = await verifyOtp(email, code, 'reset_password');
  if (!otpOk) {
    return res.status(401).json({ error: 'Invalid or expired reset code.' });
  }

  const record = getUserByEmail(email);
  if (!record) {
    return res.status(401).json({ error: 'Invalid or expired reset code.' });
  }

  const passwordHash = await hash(newPassword, { algorithm: Algorithm.Argon2id });
  updatePassword(record.id, passwordHash);
  deleteSessionsForUser(record.id);
  res.status(204).end();
});

authRouter.post('/auth/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTS);
  res.status(204).end();
});

authRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = getUserById(req.userId!);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user });
});

authRouter.get('/auth/users', requireAuth, searchLimiter, (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);
  const users = searchUsersByEmail(q, req.userId!);
  res.json(users);
});
