import './env.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(UPLOAD_DIR));
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
    const message =
      status >= 500
        ? 'Something went wrong on our side.'
        : (err as { message?: string }).message ?? 'Request failed.';
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  },
);

app.listen(PORT, () => {
  console.log(`\n  SagotKa server → http://localhost:${PORT}\n`);
});
