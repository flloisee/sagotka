import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getFormByIdentifier,
  getResponseByToken,
  createResponse,
  updateResponse,
  hasResponse,
  createQuizSession,
  getQuizSession,
  completeQuizSession,
} from '../repo.js';
import { computeQuizFlags } from '../anticheat.js';
import { responseLimiter, submissionLimiter, formSubmissionLimiter, quizStartLimiter } from '../ratelimit.js';
import {
  submitSchema,
  editResponseSchema,
  validateAnswers,
  gradeQuiz,
  randomId,
  type Form,
  type PublicForm,
  type QuizFlags,
  type QuizGrade,
} from '@sagotka/shared';

export const publicRouter = Router();

const QUIZ_GRACE_MS = 5000;
const IS_PROD = process.env.NODE_ENV === 'production';
const RESPONDENT_COOKIE = IS_PROD ? '__Host-sagotka_respondent' : 'sagotka_respondent';
const RESPONDENT_COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function getOrCreateRespondent(req: Request, res: Response): string {
  const existing = req.cookies?.[RESPONDENT_COOKIE] as string | undefined;
  if (existing) return existing;
  const id = randomId();
  res.cookie(RESPONDENT_COOKIE, id, RESPONDENT_COOKIE_OPTS);
  return id;
}

function toPublicForm(form: Form): PublicForm {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    settings: {
      acceptsResponses: form.settings.acceptsResponses,
      allowEditResponses: form.settings.allowEditResponses,
      confirmationMessage: form.settings.confirmationMessage,
      showProgress: form.settings.showProgress,
      quiz: form.settings.quiz,
      showResults: form.settings.showResults,
      fullscreenRequired: form.settings.fullscreenRequired,
      shuffleOptions: form.settings.shuffleOptions,
      limitToOneResponse: form.settings.limitToOneResponse,
      timeLimitSeconds: form.settings.timeLimitSeconds,
    },
    questions: form.questions.map(
      ({ correctAnswer, acceptedAnswers, caseSensitive, points, ...question }) => question,
    ),
    totalPoints: form.settings.quiz
      ? form.questions
          .filter((q) => q.type !== 'section_break')
          .reduce((sum, q) => sum + (q.points && q.points > 0 ? q.points : 1), 0)
      : 0,
    hasResponded: false,
  };
}

publicRouter.get('/f/:id', (req, res) => {
  const form = getFormByIdentifier(req.params.id);
  if (!form || !form.settings.published) {
    return res.status(404).json({ error: 'This form is not available.' });
  }
  const respondentId = getOrCreateRespondent(req, res);
  const hasResponded =
    form.settings.limitToOneResponse && hasResponse(form.id, respondentId);
  res.json({ ...toPublicForm(form), hasResponded });
});

publicRouter.post('/f/:id/quiz/start', submissionLimiter, quizStartLimiter, (req, res) => {
  const form = getFormByIdentifier(String(req.params.id));
  if (!form || !form.settings.published) {
    return res.status(404).json({ error: 'This form is not available.' });
  }
  if (!form.settings.acceptsResponses) {
    return res.status(409).json({ error: 'This form is no longer accepting responses.' });
  }
  if (!form.settings.quiz) {
    return res.status(422).json({ error: 'This form is not a quiz.' });
  }
  const session = createQuizSession(form.id, form.settings.fullscreenRequired);
  res.status(201).json({ sessionToken: session.token, startedAt: session.startedAt });
});

publicRouter.post('/f/:id/responses', responseLimiter, formSubmissionLimiter, (req, res) => {
  const form = getFormByIdentifier(String(req.params.id));
  if (!form || !form.settings.published) {
    return res.status(404).json({ error: 'This form is not available.' });
  }
  if (!form.settings.acceptsResponses) {
    return res.status(409).json({ error: 'This form is no longer accepting responses.' });
  }
  const respondentId = getOrCreateRespondent(req, res);
  if (form.settings.limitToOneResponse && hasResponse(form.id, respondentId)) {
    return res.status(409).json({ error: 'You have already responded to this form.' });
  }
  const parsed = submitSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Invalid submission payload.' });
  }
  const validation = validateAnswers(form.questions, parsed.data.answers);
  if (!validation.ok) {
    return res.status(422).json({ error: validation.error });
  }
  const score: QuizGrade | undefined = form.settings.quiz
    ? gradeQuiz(form.questions, parsed.data.answers)
    : undefined;

  let flags: QuizFlags | undefined;
  if (form.settings.quiz) {
    const token = parsed.data.quizSessionToken;
    if (!token) {
      return res.status(422).json({ error: 'Quiz session token required.' });
    }
    const session = getQuizSession(token);
    if (!session || session.formId !== form.id) {
      return res.status(422).json({ error: 'Invalid quiz session.' });
    }
    if (session.submittedAt !== null) {
      return res.status(409).json({ error: 'This quiz session has already been used.' });
    }
    if (
      form.settings.timeLimitSeconds > 0 &&
      Date.now() - session.startedAt > form.settings.timeLimitSeconds * 1000 + QUIZ_GRACE_MS
    ) {
      return res.status(403).json({ error: 'Time expired.' });
    }
    const events = parsed.data.events ?? [];
    const submittedAt = Date.now();
    completeQuizSession(token, events, submittedAt);
    flags = computeQuizFlags({ ...session, submittedAt }, events);
  }

  const { response, editToken } = createResponse(form.id, parsed.data.answers, {
    flags,
    score,
    respondentId: form.settings.limitToOneResponse ? respondentId : undefined,
  });
  res.status(201).json({ responseId: response.id, editToken, score });
});

publicRouter.get('/f/:id/responses/:rid', (req, res) => {
  const form = getFormByIdentifier(req.params.id);
  if (!form || !form.settings.published) {
    return res.status(404).json({ error: 'This form is not available.' });
  }
  if (form.settings.quiz) {
    return res.status(403).json({ error: 'Quiz responses cannot be edited.' });
  }
  if (!form.settings.allowEditResponses) {
    return res.status(403).json({ error: 'Editing responses is disabled for this form.' });
  }
  const token = String(req.query.token ?? '');
  const response = getResponseByToken(form.id, token);
  if (!response || response.id !== req.params.rid) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  res.json(response);
});

publicRouter.put('/f/:id/responses/:rid', (req, res) => {
  const form = getFormByIdentifier(req.params.id);
  if (!form || !form.settings.published) {
    return res.status(404).json({ error: 'This form is not available.' });
  }
  if (form.settings.quiz) {
    return res.status(403).json({ error: 'Quiz responses cannot be edited.' });
  }
  if (!form.settings.allowEditResponses) {
    return res.status(403).json({ error: 'Editing responses is disabled for this form.' });
  }
  const parsed = editResponseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Invalid submission payload.' });
  }
  const existing = getResponseByToken(form.id, parsed.data.token);
  if (!existing || existing.id !== req.params.rid) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  const validation = validateAnswers(form.questions, parsed.data.answers);
  if (!validation.ok) {
    return res.status(422).json({ error: validation.error });
  }
  const updated = updateResponse(form.id, existing.id, parsed.data.answers);
  res.json(updated!);
});
