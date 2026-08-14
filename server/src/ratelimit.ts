import { rateLimit, ipKeyGenerator, type Options } from 'express-rate-limit';

function limiter(
  options: { windowMs: number; limit: number } & Partial<Options>,
): ReturnType<typeof rateLimit> {
  const { windowMs, limit, ...rest } = options;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
    ...rest,
  });
}

export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: 'Too many attempts. Please try again later.' },
});

export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
});

export const loginAccountLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many login attempts for this account. Please try again later.' },
  keyGenerator: (req) => String((req.body as { email?: string } | undefined)?.email ?? ''),
});

export const otpRequestLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many code requests. Please try again later.' },
});

export const otpVerifyLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: 'Too many attempts. Please try again later.' },
});

export const registerLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

export const passwordResetLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many reset attempts. Please try again later.' },
});

export const searchLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Too many search requests. Please try again later.' },
});

export const submissionLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Too many requests. Please try again later.' },
});

export const responseLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 50,
  message: { error: 'Too many submissions. Please try again later.' },
});

export const formSubmissionLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many submissions for this form. Please try again later.' },
  keyGenerator: (req) => `${String(req.params.id)}:${ipKeyGenerator(req.ip ?? 'unknown')}`,
});

export const quizStartLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: { error: 'Too many quiz sessions. Please try again later.' },
  keyGenerator: (req) => `${String(req.params.id)}:${ipKeyGenerator(req.ip ?? 'unknown')}`,
});
