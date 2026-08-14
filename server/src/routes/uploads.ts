import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { openSync, readSync, closeSync, unlinkSync } from 'node:fs';
import { getForm, canAccessForm } from '../repo.js';
import { UPLOAD_DIR } from '../db.js';
import { randomId } from '@sagotka/shared';
import type { AuthedRequest } from '../auth.js';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    cb(null, `${randomId()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error('File type not allowed.') as Error & { code?: string };
      err.code = 'FILE_TYPE_NOT_ALLOWED';
      cb(err);
      return;
    }
    cb(null, true);
  },
});

function magicBytesMatch(filePath: string, ext: string): boolean {
  const head = Buffer.alloc(16);
  let read = 0;
  try {
    const fd = openSync(filePath, 'r');
    read = readSync(fd, head, 0, 16, 0);
    closeSync(fd);
  } catch {
    return false;
  }
  const headView = head.subarray(0, read);
  const startsWith = (bytes: number[]) =>
    headView.length >= bytes.length && bytes.every((b, i) => headView[i] === b);
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return startsWith([0xff, 0xd8, 0xff]);
    case '.png':
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case '.gif':
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case '.webp': {
      if (!startsWith([0x52, 0x49, 0x46, 0x46])) return false;
      return headView.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    case '.pdf':
      return headView.subarray(0, 5).toString('ascii') === '%PDF-';
    default:
      return false;
  }
}

export const uploadsRouter = Router();

uploadsRouter.post('/forms/:id/uploads', (req: AuthedRequest, res) => {
  const formId = String(req.params.id);
  if (!canAccessForm(req.userId!, formId)) {
    return res.status(403).json({ error: 'You do not have access to this form.' });
  }
  if (!getForm(formId)) {
    return res.status(404).json({ error: 'Form not found.' });
  }

  upload.array('files', 10)(req, res, (err: unknown) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const cleanup = () => {
      for (const f of files) {
        try {
          unlinkSync(f.path);
        } catch {
          /* best-effort cleanup */
        }
      }
    };

    if (err) {
      cleanup();
      const code = (err as { code?: string }).code;
      const message =
        code === 'FILE_TYPE_NOT_ALLOWED'
          ? 'File type not allowed.'
          : code === 'LIMIT_FILE_SIZE'
            ? 'File is too large.'
            : code === 'LIMIT_FILE_COUNT'
              ? 'Too many files.'
              : 'Upload failed.';
      return res.status(code === 'FILE_TYPE_NOT_ALLOWED' ? 415 : 413).json({ error: message });
    }

    const invalid = files.some((f) => {
      const ext = path.extname(f.filename).toLowerCase();
      return !magicBytesMatch(f.path, ext);
    });
    if (invalid) {
      cleanup();
      return res.status(415).json({ error: 'One or more files are not valid images or PDFs.' });
    }

    res.status(201).json(
      files.map((f) => ({
        filename: f.originalname,
        url: `/uploads/${f.filename}`,
        size: f.size,
        type: f.mimetype,
      })),
    );
  });
});
