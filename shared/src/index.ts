import { z } from 'zod';

export const FIELD_TYPES = [
  'short_text',
  'paragraph',
  'multiple_choice',
  'true_false',
  'checkbox',
  'dropdown',
  'email',
  'number',
  'date',
  'file_upload',
  'section_break',
  'rating',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormSettings {
  published: boolean;
  acceptsResponses: boolean;
  confirmationMessage: string;
  allowEditResponses: boolean;
  showProgress: boolean;
  quiz: boolean;
  showResults: boolean;
  fullscreenRequired: boolean;
  shuffleOptions: boolean;
  limitToOneResponse: boolean;
  timeLimitSeconds: number;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface QuestionSettings {
  placeholder?: string;
  rows?: number;
  min?: number | null;
  max?: number | null;
  step?: number;
  multiple?: boolean;
  maxFileSizeMb?: number;
}

export interface Question {
  id: string;
  type: FieldType;
  title: string;
  description: string;
  required: boolean;
  options: ChoiceOption[];
  settings?: QuestionSettings;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  points?: number;
}

export interface Form {
  id: string;
  title: string;
  description: string;
  settings: FormSettings;
  questions: Question[];
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  alias: string | null;
}

export interface FormListItem extends Form {
  responseCount: number;
  shared?: boolean;
}

export type PublicFormSettings = Pick<
  FormSettings,
  | 'acceptsResponses'
  | 'allowEditResponses'
  | 'confirmationMessage'
  | 'showProgress'
  | 'quiz'
  | 'showResults'
  | 'fullscreenRequired'
  | 'shuffleOptions'
  | 'limitToOneResponse'
  | 'timeLimitSeconds'
>;

export interface PublicForm {
  id: string;
  title: string;
  description: string;
  settings: PublicFormSettings;
  questions: Question[];
  hasResponded: boolean;
}

export type AnswerValue = string | string[] | number | FileRef[] | null;

export interface FileRef {
  filename: string;
  url: string;
  size: number;
  type: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthResult {
  user: User;
}

export interface ShareGrant {
  userId: string;
  email: string;
  sharedAt: string;
}

export interface QuizFlags {
  tabSwitches: number;
  fullscreenExits: number;
  copyAttempts: number;
  durationMs: number;
  fullscreenDenied?: boolean;
}

export const QUIZ_EVENT_TYPES = [
  'hidden',
  'visible',
  'fullscreen-enter',
  'fullscreen-exit',
  'copy',
] as const;

export type QuizEventType = (typeof QUIZ_EVENT_TYPES)[number];

export interface QuizEvent {
  type: QuizEventType;
  clientTime: number;
}

export interface QuizSubmitPayload {
  sessionToken: string;
  events: QuizEvent[];
}

export interface QuestionGrade {
  questionId: string;
  correct: boolean | null;
  points: number;
  earned: number;
}

export interface QuizGrade {
  totalPoints: number;
  earnedPoints: number;
  questions: QuestionGrade[];
}

export interface FormResponse {
  id: string;
  formId: string;
  createdAt: string;
  updatedAt: string;
  answers: Record<string, AnswerValue>;
  score?: QuizGrade;
  flags?: QuizFlags;
}

export interface SubmitResult {
  responseId: string;
  editToken: string;
  score?: QuizGrade;
}

export interface ChoiceStat {
  optionId: string;
  label: string;
  count: number;
  percent: number;
}

export interface QuestionSummary {
  questionId: string;
  type: FieldType;
  title: string;
  answered: number;
  skipped: number;
  choiceStats?: ChoiceStat[];
  recentValues: AnswerValue[];
  correctCount?: number;
  totalPoints?: number;
  earnedPoints?: number;
}

export interface Summary {
  formId: string;
  responseCount: number;
  questions: QuestionSummary[];
}

export interface FormUpdateInput {
  title?: string;
  description?: string;
  settings?: Partial<FormSettings>;
  questions?: Question[];
}

export const DEFAULT_SETTINGS: FormSettings = {
  published: false,
  acceptsResponses: true,
  confirmationMessage: 'Thanks — your response has been recorded.',
  allowEditResponses: false,
  showProgress: true,
  quiz: false,
  showResults: true,
  fullscreenRequired: false,
  shuffleOptions: true,
  limitToOneResponse: false,
  timeLimitSeconds: 0,
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: 'Short answer',
  paragraph: 'Paragraph',
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  email: 'Email',
  number: 'Number',
  date: 'Date',
  file_upload: 'File upload',
  section_break: 'Section break',
  rating: 'Rating',
};

export function newQuestion(type: FieldType, quiz = false): Question {
  const base: Question = {
    id: randomId(),
    type,
    title: FIELD_TYPE_LABELS[type],
    description: '',
    required: false,
    options: [],
    settings: {},
    points: quiz ? 1 : undefined,
  };
  switch (type) {
    case 'multiple_choice':
    case 'dropdown':
    case 'checkbox':
      base.options = [
        { id: randomId(), label: 'Option 1' },
        { id: randomId(), label: 'Option 2' },
      ];
      if (quiz && type === 'multiple_choice') {
        base.options = [
          { id: randomId(), label: 'Option 1' },
          { id: randomId(), label: 'Option 2' },
          { id: randomId(), label: 'Option 3' },
          { id: randomId(), label: 'Option 4' },
        ];
      }
      break;
    case 'true_false':
      base.options = [
        { id: 'true', label: 'True' },
        { id: 'false', label: 'False' },
      ];
      break;
    case 'paragraph':
      base.settings = { rows: 4 };
      break;
    case 'number':
      base.settings = { step: 1 };
      break;
    case 'file_upload':
      base.settings = { multiple: true, maxFileSizeMb: 10 };
      break;
    case 'rating':
      base.settings = { max: 5 };
      break;
    default:
      break;
  }
  return base;
}

export const QUIZ_TYPES: FieldType[] = [
  'multiple_choice',
  'true_false',
  'short_text',
  'paragraph',
  'section_break',
];

function isCustomChoice(type: FieldType): boolean {
  return type === 'multiple_choice' || type === 'checkbox' || type === 'dropdown';
}

export function migrateQuestionType(
  question: Question,
  targetType: FieldType,
  quiz = false,
): Question {
  if (targetType === question.type) return question;
  const next = newQuestion(targetType, quiz);
  next.id = question.id;
  next.title = question.title;
  next.description = question.description;
  next.required = question.required;
  if (isCustomChoice(targetType) && isCustomChoice(question.type) && question.options.length > 0) {
    next.options = question.options;
  }
  return next;
}

export function newForm(title = 'Untitled form'): Form {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    title,
    description: '',
    settings: { ...DEFAULT_SETTINGS },
    questions: [newQuestion('short_text')],
    ownerId: null,
    createdAt: now,
    updatedAt: now,
    alias: null,
  };
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- zod schemas (server-side input validation) ----------

const settingsSchema = z.object({
  published: z.boolean().optional(),
  acceptsResponses: z.boolean().optional(),
  confirmationMessage: z.string().max(500).optional(),
  allowEditResponses: z.boolean().optional(),
  showProgress: z.boolean().optional(),
  quiz: z.boolean().optional(),
  showResults: z.boolean().optional(),
  fullscreenRequired: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  limitToOneResponse: z.boolean().optional(),
  timeLimitSeconds: z.number().int().min(0).max(86400).optional(),
});

const choiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(200),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  title: z.string().max(500),
  description: z.string().max(2000),
  required: z.boolean(),
  options: z.array(choiceOptionSchema).max(200),
  settings: z
    .object({
      placeholder: z.string().max(300).optional(),
      rows: z.number().int().min(1).max(30).optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      step: z.number().positive().optional(),
      multiple: z.boolean().optional(),
      maxFileSizeMb: z.number().int().min(1).max(50).optional(),
    })
    .optional(),
  correctAnswer: z.string().max(1000).optional(),
  acceptedAnswers: z.array(z.string().max(1000)).max(50).optional(),
  caseSensitive: z.boolean().optional(),
  points: z.number().int().min(0).max(1000).optional(),
});

export const formUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  settings: settingsSchema.optional(),
  questions: z.array(questionSchema).max(300).optional(),
});

export const createFormSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  mode: z.enum(['form', 'quiz']).optional(),
});

const quizEventSchema = z.object({
  type: z.enum(QUIZ_EVENT_TYPES),
  clientTime: z.number().int(),
});

export const submitSchema = z.object({
  answers: z.record(z.string(), z.any()),
  quizSessionToken: z.string().min(1).optional(),
  events: z.array(quizEventSchema).max(500).optional(),
});

export const editResponseSchema = z.object({
  token: z.string().min(1),
  answers: z.record(z.string(), z.any()),
});

// ---------- auth ----------

const emailSchema = z.string().trim().email().max(254);
const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

export const OTP_PURPOSES = ['verify_email', 'reset_password', 'login'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const requestOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(OTP_PURPOSES),
  recaptchaToken: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  recaptchaToken: z.string().optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  code: otpCodeSchema,
  recaptchaToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().max(128),
  code: otpCodeSchema.optional(),
  recaptchaToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: z.string().min(8).max(128),
  recaptchaToken: z.string().optional(),
});

export const shareByEmailSchema = z.object({
  email: emailSchema,
});

const aliasSchema = z
  .string()
  .trim()
  .max(50)
  .transform((v) => v.toLowerCase())
  .refine(
    (v) => /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(v),
    'Use lowercase letters, numbers, and hyphens.',
  )
  .refine(
    (v) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v),
    'This alias is reserved.',
  );

export const setFormAliasSchema = z.object({
  alias: z.union([aliasSchema, z.null()]),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---------- answer validation ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

function isFileRef(v: unknown): v is FileRef {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.filename === 'string' &&
    typeof o.url === 'string' &&
    typeof o.size === 'number' &&
    typeof o.type === 'string'
  );
}

export function validateAnswer(
  question: Question,
  value: unknown,
): ValidationResult {
  const label = question.title || FIELD_TYPE_LABELS[question.type];
  const required = question.required;

  if (question.type === 'section_break') {
    return { ok: true };
  }

  if (value === null || value === undefined || value === '') {
    if (required) return { ok: false, error: `${label} is required.` };
    return { ok: true };
  }

  switch (question.type) {
    case 'short_text':
    case 'paragraph': {
      if (typeof value !== 'string')
        return { ok: false, error: `${label} must be text.` };
      if (required && value.trim().length === 0)
        return { ok: false, error: `${label} is required.` };
      return { ok: true };
    }
    case 'multiple_choice':
    case 'dropdown':
    case 'true_false': {
      if (typeof value !== 'string')
        return { ok: false, error: `Pick an option for ${label}.` };
      if (!question.options.some((o) => o.id === value))
        return { ok: false, error: `Pick a valid option for ${label}.` };
      return { ok: true };
    }
    case 'checkbox': {
      if (!Array.isArray(value))
        return { ok: false, error: `Choose at least one option for ${label}.` };
      const ids = new Set(question.options.map((o) => o.id));
      if (required && value.length === 0)
        return { ok: false, error: `Choose at least one option for ${label}.` };
      if (!value.every((v) => typeof v === 'string' && ids.has(v)))
        return { ok: false, error: `One of your choices for ${label} is invalid.` };
      return { ok: true };
    }
    case 'email': {
      if (typeof value !== 'string' || !EMAIL_RE.test(value.trim()))
        return { ok: false, error: `Enter a valid email address for ${label}.` };
      return { ok: true };
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (typeof value !== 'number' || !Number.isFinite(n))
        return { ok: false, error: `${label} must be a number.` };
      const { min, max, step } = question.settings ?? {};
      if (min !== undefined && min !== null && n < min)
        return { ok: false, error: `${label} must be at least ${min}.` };
      if (max !== undefined && max !== null && n > max)
        return { ok: false, error: `${label} must be at most ${max}.` };
      if (step && step > 0) {
        const rem = Math.abs(n / step - Math.round(n / step));
        if (rem > 1e-9)
          return { ok: false, error: `${label} must be in steps of ${step}.` };
      }
      return { ok: true };
    }
    case 'date': {
      if (typeof value !== 'string')
        return { ok: false, error: `${label} must be a date.` };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return { ok: false, error: `${label} must be a valid date.` };
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime()))
        return { ok: false, error: `${label} must be a valid date.` };
      return { ok: true };
    }
    case 'file_upload': {
      const files = Array.isArray(value) ? value : value === '' ? [] : [value];
      if (required && files.length === 0)
        return { ok: false, error: `Upload a file for ${label}.` };
      if (!files.every(isFileRef))
        return { ok: false, error: `Upload valid files for ${label}.` };
      const maxMb = question.settings?.maxFileSizeMb ?? 10;
      const tooBig = files.some((f: FileRef) => f.size > maxMb * 1024 * 1024);
      if (tooBig)
        return { ok: false, error: `Files for ${label} exceed ${maxMb} MB.` };
      return { ok: true };
    }
    case 'rating': {
      const n = typeof value === 'number' ? value : Number(value);
      if (typeof value !== 'number' || !Number.isFinite(n) || !Number.isInteger(n))
        return { ok: false, error: `${label} must be a whole number of stars.` };
      const max = question.settings?.max ?? 5;
      if (n < 1)
        return { ok: false, error: `${label} must be at least 1.` };
      if (n > max)
        return { ok: false, error: `${label} must be at most ${max}.` };
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export function validateAnswers(
  questions: Question[],
  answers: Record<string, unknown>,
): ValidationResult {
  for (const q of questions) {
    if (q.type === 'section_break') continue;
    const result = validateAnswer(q, answers[q.id] ?? null);
    if (!result.ok) return result;
  }
  return { ok: true };
}

// ---------- quiz grading ----------

export function gradeQuestion(question: Question, answer: unknown): QuestionGrade {
  const points = question.points && question.points > 0 ? question.points : 1;
  const unscored: QuestionGrade = {
    questionId: question.id,
    correct: null,
    points: 0,
    earned: 0,
  };
  const hasAnswer =
    typeof question.correctAnswer === 'string' &&
    question.correctAnswer.length > 0;
  const accepted = (question.acceptedAnswers ?? []).filter((a) => a.trim().length > 0);
  if (!hasAnswer && accepted.length === 0) return unscored;

  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const correct = typeof answer === 'string' && answer === question.correctAnswer;
    return { questionId: question.id, correct, points, earned: correct ? points : 0 };
  }

  if (question.type === 'short_text' || question.type === 'paragraph') {
    if (typeof answer !== 'string')
      return { questionId: question.id, correct: false, points, earned: 0 };
    const norm = (s: string) =>
      question.caseSensitive ? s.trim() : s.trim().toLowerCase();
    const target = norm(answer);
    const correct = accepted.some((a) => norm(a) === target);
    return { questionId: question.id, correct, points, earned: correct ? points : 0 };
  }

  return unscored;
}

export function gradeQuiz(
  questions: Question[],
  answers: Record<string, AnswerValue>,
): QuizGrade {
  const grades = questions.map((q) => gradeQuestion(q, answers[q.id] ?? null));
  const scored = grades.filter((g) => g.correct !== null);
  return {
    totalPoints: scored.reduce((s, g) => s + g.points, 0),
    earnedPoints: scored.reduce((s, g) => s + g.earned, 0),
    questions: grades,
  };
}
