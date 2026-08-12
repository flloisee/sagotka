import { Router } from 'express';
import {
  listFormsForUser,
  getForm,
  createForm,
  updateForm,
  deleteForm,
  duplicateForm,
  listResponses,
  countResponses,
  deleteResponse,
  canAccessForm,
  isFormOwner,
  shareForm,
  unshareForm,
  listShares,
  getUserByEmail,
  setFormAlias,
} from '../repo.js';
import { buildSummary } from '../summary.js';
import {
  createFormSchema,
  formUpdateSchema,
  shareByEmailSchema,
  setFormAliasSchema,
} from '@sagotka/shared';
import { requireAuth, type AuthedRequest } from '../auth.js';

export const formsRouter = Router();

formsRouter.use('/forms', requireAuth);

function notFound(res: import('express').Response, msg = 'Form not found.') {
  return res.status(404).json({ error: msg });
}

function forbidden(res: import('express').Response, msg = 'You do not have access to this form.') {
  return res.status(403).json({ error: msg });
}

function accessDenied(
  req: AuthedRequest,
  res: import('express').Response,
  formId: string,
): boolean {
  if (!canAccessForm(req.userId!, formId)) {
    forbidden(res);
    return true;
  }
  return false;
}

function formId(req: AuthedRequest): string {
  return String(req.params.id);
}

formsRouter.get('/forms', (req: AuthedRequest, res) => {
  res.json(listFormsForUser(req.userId!));
});

formsRouter.post('/forms', (req: AuthedRequest, res) => {
  const parsed = createFormSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Invalid form payload.' });
  }
  const form = createForm({
    title: parsed.data.title ?? (parsed.data.mode === 'quiz' ? 'Untitled quiz' : 'Untitled form'),
    ownerId: req.userId!,
    mode: parsed.data.mode,
  });
  res.status(201).json(form);
});

formsRouter.get('/forms/:id', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  const form = getForm(formId(req));
  if (!form) return notFound(res);
  res.json({ ...form, responseCount: countResponses(form.id) });
});

formsRouter.put('/forms/:id', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  const parsed = formUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid payload.' });
  }
  const form = updateForm(formId(req), parsed.data);
  if (!form) return notFound(res);
  res.json(form);
});

formsRouter.delete('/forms/:id', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!isFormOwner(req.userId!, formId(req))) return forbidden(res);
  if (!deleteForm(formId(req))) return notFound(res);
  res.status(204).end();
});

formsRouter.post('/forms/:id/duplicate', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  const copy = duplicateForm(formId(req), req.userId!);
  if (!copy) return notFound(res);
  res.status(201).json(copy);
});

// ---------- link alias (owner-only) ----------

formsRouter.put('/forms/:id/alias', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!isFormOwner(req.userId!, formId(req))) return forbidden(res);
  const parsed = setFormAliasSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(422).json({ error: first?.message ?? 'Invalid alias.' });
  }
  const alias = parsed.data.alias;
  if (!setFormAlias(formId(req), alias)) {
    return res.status(409).json({ error: 'This link alias is already in use.' });
  }
  const form = getForm(formId(req));
  if (!form) return notFound(res);
  res.json(form);
});

// ---------- sharing (owner-only) ----------

formsRouter.get('/forms/:id/shares', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!isFormOwner(req.userId!, formId(req))) return forbidden(res);
  res.json(listShares(formId(req)));
});

formsRouter.post('/forms/:id/shares', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!isFormOwner(req.userId!, formId(req))) return forbidden(res);
  const parsed = shareByEmailSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'A valid email is required.' });
  }
  const target = getUserByEmail(parsed.data.email);
  if (!target) {
    return res.status(404).json({ error: 'No user with that email exists.' });
  }
  if (target.id === req.userId) {
    return res.status(422).json({ error: 'You already own this form.' });
  }
  shareForm(formId(req), target.id);
  res.status(201).json(listShares(formId(req)));
});

formsRouter.delete('/forms/:id/shares/:userId', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!isFormOwner(req.userId!, formId(req))) return forbidden(res);
  if (!unshareForm(formId(req), String(req.params.userId))) {
    return notFound(res, 'Share not found.');
  }
  res.status(204).end();
});

formsRouter.get('/forms/:id/responses', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!getForm(formId(req))) return notFound(res);
  res.json(listResponses(formId(req)));
});

formsRouter.get('/forms/:id/summary', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  const form = getForm(formId(req));
  if (!form) return notFound(res);
  res.json(buildSummary(form));
});

formsRouter.delete('/forms/:id/responses/:responseId', (req: AuthedRequest, res) => {
  if (accessDenied(req, res, formId(req))) return;
  if (!getForm(formId(req))) return notFound(res);
  if (!deleteResponse(formId(req), String(req.params.responseId))) {
    return notFound(res, 'Response not found.');
  }
  res.status(204).end();
});
