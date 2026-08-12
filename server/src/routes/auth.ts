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
import { verifyRecaptcha } from '../recaptcha.js';
import { issueOtp, verifyOtp, checkOtp } from '../otp.js';
import { smtpConfigured } from '../mailer.js';

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

authRouter.post('/auth/otp/request', async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid request.' });
  }
  const { email, purpose, recaptchaToken } = parsed.data;

  const ok = await verifyRecaptcha(recaptchaToken ?? '');
  if (!ok) {
    return res.status(403).json({ error: 'Could not verify you are human. Please try again.' });
  }

  if (purpose === 'verify_email' && getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  if (purpose !== 'verify_email' && !getUserByEmail(email)) {
    return res.status(202).json({ sent: false });
  }

  await issueOtp(email, purpose);
  res.status(202).json({ sent: true });
});

authRouter.post('/auth/otp/verify', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid request.' });
  }
  const { email, code, recaptchaToken } = parsed.data;

  const ok = await verifyRecaptcha(recaptchaToken ?? '');
  if (!ok) {
    return res.status(403).json({ error: 'Could not verify you are human. Please try again.' });
  }

  if (getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const matches = await checkOtp(email, code, 'verify_email');
  if (!matches) {
    return res.status(401).json({ error: 'Invalid or expired verification code.' });
  }

  res.json({ verified: true });
});

authRouter.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid registration.' });
  }
  const { email, password, code, recaptchaToken } = parsed.data;

  const ok = await verifyRecaptcha(recaptchaToken ?? '');
  if (!ok) {
    return res.status(403).json({ error: 'Could not verify you are human. Please try again.' });
  }

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

authRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid login.' });
  }
  const { email, password, code, recaptchaToken } = parsed.data;

  const ok = await verifyRecaptcha(recaptchaToken ?? '');
  if (!ok) {
    return res.status(403).json({ error: 'Could not verify you are human. Please try again.' });
  }

  const record = getUserWithHashByEmail(email);
  if (!record) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const matches = await verify(record.passwordHash, password);
  if (!matches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!code) {
    if (smtpConfigured()) {
      await issueOtp(email, 'login');
      return res.status(200).json({ requiresOtp: true, email });
    }
  } else {
    const otpOk = await verifyOtp(email, code, 'login');
    if (!otpOk) {
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }
  }

  const session = createSession(record.id);
  res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTS);
  res.json({ user: { id: record.id, email: record.email, createdAt: record.createdAt } });
});

authRouter.post('/auth/password/reset', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid reset.' });
  }
  const { email, code, newPassword, recaptchaToken } = parsed.data;

  const ok = await verifyRecaptcha(recaptchaToken ?? '');
  if (!ok) {
    return res.status(403).json({ error: 'Could not verify you are human. Please try again.' });
  }

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
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
});

authRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = getUserById(req.userId!);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user });
});

authRouter.get('/auth/users', requireAuth, (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);
  const users = searchUsersByEmail(q, req.userId!);
  res.json(users);
});
