import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { getForm } from '../repo.js';
import { UPLOAD_DIR } from '../db.js';
import { randomId } from '@sagotka/shared';

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
});

export const uploadsRouter = Router();

uploadsRouter.post('/forms/:id/uploads', (req, res) => {
  const form = getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: 'Form not found.' });
  }
  upload.array('files', 10)(req, res, (err: unknown) => {
    if (err) {
      const message =
        typeof (err as { message?: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Upload failed.';
      return res.status(413).json({ error: message });
    }
    const files = (req.files as Express.Multer.File[]) ?? [];
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
