import './env.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOAD_DIR } from './db.js';
import { formsRouter } from './routes/forms.js';
import { publicRouter } from './routes/public.js';
import { uploadsRouter } from './routes/uploads.js';
import { authRouter } from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

const app = express();

// Trust X-Forwarded-For only from the local reverse proxy (ngrok dev tunnel).
app.set('trust proxy', 'loopback');

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
  'https://harmonics-preamble-occupancy.ngrok-free.dev',
  ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'font-src': ["'self'", 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// CSRF defense-in-depth: reject state-changing requests whose Origin does not
// match the Host the browser addressed. SameSite=Lax remains the primary guard.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (
    origin &&
    host &&
    origin !== `http://${host}` &&
    origin !== `https://${host}`
  ) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  next();
});

app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'attachment');
    },
  }),
);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', authRouter);
app.use('/api', formsRouter);
app.use('/api', publicRouter);
app.use('/api', uploadsRouter);

const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = typeof (err as { status?: number }).status === 'number'
      ? (err as { status: number }).status
      : 500;
    if (status >= 500) {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong on our side.' });
      return;
    }
    if (status === 429) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    console.error(err);
    res.status(status).json({ error: 'Request failed.' });
  },
);

app.listen(PORT, () => {
  console.log(`\n  SagotKa server → http://localhost:${PORT}\n`);
});
