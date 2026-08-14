import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  gradeQuiz,
  validateAnswers,
  type AnswerValue,
  type ChoiceOption,
  type FileRef,
  type FormResponse,
  type PublicForm,
  type Question,
  type QuizEvent,
  type QuizSubmitPayload,
  type QuizGrade,
  type SubmitResult,
} from '@sagotka/shared';
import { Button, ErrorText } from './ui';
import { CheckCircle2, Clock, FileUp, Star, Trash2, XCircle } from 'lucide-react';
import { formatHms } from '../lib';

interface FillFormProps {
  form: PublicForm;
  editMode?: boolean;
  previewMode?: boolean;
  editLink?: string;
  initialAnswers?: Record<string, AnswerValue>;
  onSubmit: (
    answers: Record<string, AnswerValue>,
    quiz?: QuizSubmitPayload,
  ) => Promise<SubmitResult | FormResponse | void>;
  startQuizSession?: () => Promise<{ sessionToken: string; startedAt: number }>;
  uploadFiles?: (files: File[]) => Promise<FileRef[]>;
}

interface FillSection {
  key: string;
  title: string;
  description: string;
  questions: Question[];
}

export function FillForm({
  form,
  editMode = false,
  previewMode = false,
  editLink,
  initialAnswers,
  onSubmit,
  startQuizSession,
  uploadFiles,
}: FillFormProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => ({
    ...(initialAnswers ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const visibleQuestions = useMemo(
    () => form.questions.filter((q) => q.type !== 'section_break'),
    [form.questions],
  );
  const answeredCount = visibleQuestions.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== null && v !== '';
  }).length;

  const sections = useMemo<FillSection[]>(() => {
    const list: FillSection[] = [];
    let cur: FillSection = {
      key: 'form',
      title: form.title,
      description: form.description,
      questions: [],
    };
    const push = () => {
      if (cur.questions.length > 0 || cur.title.trim() !== '' || cur.description.trim() !== '') {
        list.push(cur);
      }
    };
    for (const q of form.questions) {
      if (q.type === 'section_break') {
        push();
        cur = { key: q.id, title: q.title, description: q.description, questions: [] };
      } else {
        cur.questions.push(q);
      }
    }
    push();
    return list.length > 0
      ? list
      : [{ key: 'form', title: form.title, description: form.description, questions: [] }];
  }, [form.title, form.description, form.questions]);

  const [page, setPage] = useState(0);
  const safePage = Math.min(page, sections.length - 1);
  const section = sections[safePage];
  const multiPage = sections.length > 1;
  const lastPage = safePage === sections.length - 1;

  const prevPageRef = useRef(0);
  useEffect(() => {
    if (prevPageRef.current !== safePage) {
      window.scrollTo(0, 0);
    }
    prevPageRef.current = safePage;
  }, [safePage]);

  const setValue = (qid: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    setErrors((prev) => {
      if (!prev[qid]) return prev;
      const next = { ...prev };
      delete next[qid];
      return next;
    });
  };

  const submit = async () => {
    const result = validateAnswers(form.questions, answers);
    if (!result.ok) {
      const question = form.questions.find((q) => validateAnswers([q], answers).ok === false);
      if (question) setErrors({ [question.id]: result.error ?? 'Required.' });
      else setServerError(result.error ?? 'Please complete the form.');
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(answers);
      setDone(true);
    } catch (e) {
      setServerError((e as Error).message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    const result = validateAnswers(section.questions, answers);
    if (!result.ok) {
      const question = section.questions.find((q) => validateAnswers([q], answers).ok === false);
      if (question) setErrors({ [question.id]: result.error ?? 'Required.' });
      else setServerError(result.error ?? 'Please complete the form.');
      return;
    }
    setPage((p) => p + 1);
  };

  if (form.settings.quiz && !editMode) {
    return (
      <QuizFill
        form={form}
        onSubmit={onSubmit}
        startQuizSession={startQuizSession}
        previewMode={previewMode}
      />
    );
  }

  if (done) {
    return (
      <div className="rounded-card border border-rule bg-paper p-8 shadow-card sm:p-10">
        <CheckCircle2 className="mb-5 size-10 text-success" />
        <h2 className="text-display">All done.</h2>
        <p className="mt-3 max-w-md text-[15px] text-ink-2">
          {editMode ? 'Your response has been updated.' : form.settings.confirmationMessage}
        </p>
        {!editMode ? (
          <div className="mt-7 flex flex-wrap gap-3">
            {!form.settings.limitToOneResponse ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setDone(false);
                  setAnswers({});
                  setPage(0);
                }}
              >
                Submit another response
              </Button>
            ) : null}
            {editLink ? (
              <Link to={editLink}>
                <Button variant="ghost">Edit your response</Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-card border border-rule bg-paper shadow-card">
      {form.settings.showProgress && sections.length > 0 ? (
        <div className="border-b border-rule px-6 pb-4 pt-5 sm:px-8">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            {multiPage ? (
              <span className="label-mono">
                Section {safePage + 1} of {sections.length}
              </span>
            ) : (
              <>
                <span>Progress</span>
                <span className="label-mono">
                  {answeredCount} of {visibleQuestions.length} answered
                </span>
              </>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-pill bg-paper-3">
            <div
              className="h-full rounded-pill bg-accent transition-all duration-300 ease-out-expo"
              style={{
                width: multiPage
                  ? `${((safePage + 1) / sections.length) * 100}%`
                  : `${(answeredCount / visibleQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-rule">
        <header className="px-6 py-6 sm:px-8 sm:py-7">
          <h1 className="text-display">{section.title}</h1>
          {section.description ? (
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{section.description}</p>
          ) : null}
        </header>

        {section.questions.map((q) => (
          <FillField
            key={q.id}
            question={q}
            value={answers[q.id]}
            error={errors[q.id]}
            disabled={submitting}
            onChange={(v) => setValue(q.id, v)}
            uploadFiles={uploadFiles}
          />
        ))}

        <div className="px-6 py-6 sm:px-8">
          {serverError ? <div className="mb-4"><ErrorText>{serverError}</ErrorText></div> : null}
          <div className="flex items-center gap-3">
            {safePage > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={submitting}
              >
                Back
              </Button>
            ) : null}
            {lastPage ? (
              <Button
                size="lg"
                className="ml-auto"
                onClick={submit}
                loading={submitting}
                disabled={!form.settings.acceptsResponses}
              >
                {editMode ? 'Save changes' : 'Submit'}
              </Button>
            ) : (
              <Button
                size="lg"
                className="ml-auto"
                onClick={goNext}
                disabled={!form.settings.acceptsResponses}
              >
                Next
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            {form.settings.acceptsResponses ? 'Your answers are recorded on this device.' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function FillField({
  question: q,
  value,
  error,
  disabled,
  onChange,
  uploadFiles,
}: {
  question: Question;
  value: AnswerValue;
  error?: string;
  disabled: boolean;
  onChange: (v: AnswerValue) => void;
  uploadFiles?: (files: File[]) => Promise<FileRef[]>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const inputBase =
    'w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted ' +
    'transition-colors duration-150 hover:border-rule-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-50';

  const selectedOptionIds = Array.isArray(value) ? (value as string[]) : [];

  const onFiles = async (files: FileList | null) => {
    if (!files || !uploadFiles) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const refs = await uploadFiles(list);
      const existing = Array.isArray(value) ? (value as FileRef[]) : [];
      const merged =
        q.settings?.multiple !== false ? [...existing, ...refs] : refs;
      onChange(merged);
    } catch (e) {
      setUploadErr((e as Error).message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  let control: React.ReactNode;
  switch (q.type) {
    case 'short_text':
    case 'email':
      control = (
        <input
          type={q.type === 'email' ? 'email' : 'text'}
          className={inputBase}
          placeholder={q.settings?.placeholder ?? (q.type === 'email' ? 'name@example.com' : 'Your answer')}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={q.type === 'email' ? 'email' : 'off'}
        />
      );
      break;
    case 'paragraph':
      control = (
        <textarea
          className={`${inputBase} min-h-24 resize-y leading-relaxed`}
          rows={q.settings?.rows ?? 4}
          placeholder={q.settings?.placeholder ?? 'Long-form answer'}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'number':
      control = (
        <input
          type="number"
          className={inputBase}
          placeholder={q.settings?.placeholder ?? 'Number'}
          value={typeof value === 'number' || typeof value === 'string' ? (value as string | number) : ''}
          disabled={disabled}
          min={q.settings?.min ?? undefined}
          max={q.settings?.max ?? undefined}
          step={q.settings?.step ?? undefined}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
      break;
    case 'date':
      control = (
        <input
          type="date"
          className={`${inputBase} [color-scheme:light] dark:[color-scheme:dark]`}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
      break;
    case 'rating':
      control = (
        <RatingControl
          max={q.settings?.max ?? 5}
          value={typeof value === 'number' ? value : 0}
          disabled={disabled}
          onChange={(n) => onChange(n)}
        />
      );
      break;
    case 'multiple_choice':
    case 'true_false':
      control = (
        <RadioList
          name={q.id}
          options={q.options}
          selected={typeof value === 'string' ? value : null}
          disabled={disabled}
          onChange={(id) => onChange(id)}
        />
      );
      break;
    case 'dropdown':
      control = (
        <select
          className={`${inputBase} appearance-none bg-no-repeat pr-9`}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23777%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")',
            backgroundPosition: 'right 0.85rem center',
          }}
        >
          <option value="" disabled>
            Choose…
          </option>
          {q.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'checkbox':
      control = (
        <CheckList
          options={q.options}
          selected={selectedOptionIds}
          disabled={disabled}
          onChange={(ids) => onChange(ids)}
        />
      );
      break;
    case 'file_upload':
      control = (
        <FileUploadControl
          value={Array.isArray(value) ? (value as FileRef[]) : []}
          uploading={uploading}
          disabled={disabled || !uploadFiles}
          maxMb={q.settings?.maxFileSizeMb ?? 10}
          multiple={q.settings?.multiple !== false}
          error={uploadErr}
          onChange={(refs) => onChange(refs)}
          onFiles={onFiles}
        />
      );
      break;
    default:
      control = null;
  }

  return (
    <section className="px-6 py-6 sm:px-8">
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          {q.title}
          {q.required ? <span className="ml-1 text-accent" aria-hidden>*</span> : null}
        </h3>
      </div>
      {q.description ? <p className="mb-3 mt-1 text-sm text-muted">{q.description}</p> : null}
      <div className="mt-3 max-w-xl">{control}</div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {q.type === 'file_upload' && !uploadFiles ? (
        <p className="mt-1.5 text-xs text-muted">File uploads are unavailable in preview.</p>
      ) : null}
    </section>
  );
}

function RatingControl({
  max,
  value,
  disabled,
  onChange,
}: {
  max: number;
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`rounded-input p-1 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 ${
            n <= value ? 'text-accent' : 'text-muted'
          }`}
        >
          <Star className={`size-7 ${n <= value ? 'fill-current' : ''}`} />
        </button>
      ))}
      {value > 0 ? (
        <span className="label-mono ml-2 text-muted" aria-hidden>
          {value}/{max}
        </span>
      ) : null}
    </div>
  );
}

function RadioList({
  name,
  options,
  selected,
  disabled,
  onChange,
}: {
  name: string;
  options: Question['options'];
  selected: string | null;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <label key={o.id} className="group flex cursor-pointer items-center gap-3">
          <span
            className={`flex size-4.5 items-center justify-center rounded-full border transition-colors ${
              selected === o.id
                ? 'border-accent bg-accent'
                : 'border-rule-2 bg-paper group-hover:border-accent'
            }`}
          >
            {selected === o.id ? <span className="size-1.5 rounded-full bg-accent-ink" /> : null}
          </span>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={selected === o.id}
            disabled={disabled}
            onChange={() => onChange(o.id)}
          />
          <span className="text-[15px]">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckList({
  options,
  selected,
  disabled,
  onChange,
}: {
  options: Question['options'];
  selected: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <label key={o.id} className="group flex cursor-pointer items-center gap-3">
          <span
            className={`flex size-4.5 items-center justify-center rounded-[4px] border transition-colors ${
              selected.includes(o.id)
                ? 'border-accent bg-accent'
                : 'border-rule-2 bg-paper group-hover:border-accent'
            }`}
          >
            {selected.includes(o.id) ? (
              <svg viewBox="0 0 16 16" fill="none" className="size-3">
                <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-ink" />
              </svg>
            ) : null}
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(o.id)}
            disabled={disabled}
            onChange={() => toggle(o.id)}
          />
          <span className="text-[15px]">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function FileUploadControl({
  value,
  uploading,
  disabled,
  maxMb,
  multiple,
  error,
  onChange,
  onFiles,
}: {
  value: FileRef[];
  uploading: boolean;
  disabled: boolean;
  maxMb: number;
  multiple: boolean;
  error?: string | null;
  onChange: (refs: FileRef[]) => void;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-input border border-dashed border-rule-2 px-4 py-8 text-center transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-accent hover:bg-accent-3/40'
        }`}
      >
        <FileUp className={`size-5 ${uploading ? 'animate-pulse text-accent' : 'text-muted'}`} />
        <span className="mt-1 text-sm font-medium text-ink-2">
          {uploading ? 'Uploading…' : value.length > 0 ? 'Add more files' : 'Click to upload'}
        </span>
        <span className="text-xs text-muted">Up to {maxMb} MB per file{multiple ? ', multiple allowed' : ''}</span>
        <input
          type="file"
          className="sr-only"
          multiple={multiple}
          disabled={disabled || uploading}
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      {value.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {value.map((f, i) => (
            <li key={`${f.url}-${i}`} className="flex items-center justify-between gap-2 rounded-input bg-paper-2 px-3 py-2 text-sm">
              <span className="truncate text-ink-2">{f.filename}</span>
              <button
                type="button"
                aria-label={`Remove ${f.filename}`}
                className="text-muted transition-colors hover:text-danger"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

/* ---------- Quiz mode: one question at a time, forward-only, anticheat flags ---------- */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isEmptyAnswer(v: AnswerValue): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return formatHms(s);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function QuizFill({
  form,
  onSubmit,
  startQuizSession,
  previewMode,
}: {
  form: PublicForm;
  onSubmit: FillFormProps['onSubmit'];
  startQuizSession: FillFormProps['startQuizSession'];
  previewMode?: boolean;
}) {
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'results'>('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [qError, setQError] = useState<string | null>(null);
  const [introError, setIntroError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<QuizGrade | null>(null);
  const [warned, setWarned] = useState<{ tab: boolean; fullscreen: boolean }>({
    tab: false,
    fullscreen: false,
  });

  const eventsRef = useRef<QuizEvent[]>([]);
  const sessionRef = useRef<{ sessionToken: string; startedAt: number } | null>(null);
  const submitRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const autoSubmittedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const timeLimitSeconds = form.settings.timeLimitSeconds ?? 0;

  const pushEvent = (type: QuizEvent['type']) => {
    eventsRef.current = [...eventsRef.current, { type, clientTime: Date.now() }];
  };

  const questions = form.questions;

  const realQuestions = useMemo(
    () => questions.filter((q) => q.type !== 'section_break'),
    [questions],
  );

  const lastRealIdx = useMemo(
    () => questions.reduce((last, q, i) => (q.type === 'section_break' ? last : i), -1),
    [questions],
  );

  const optionOrder = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!form.settings.shuffleOptions) return map;
    for (const q of questions) {
      if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'checkbox') {
        map[q.id] = shuffle(q.options.map((o) => o.id));
      }
    }
    return map;
  }, [form.settings.shuffleOptions, questions]);

  const displayQuestions = useMemo(
    () =>
      questions.map((q) => {
        const order = optionOrder[q.id];
        if (!order) return q;
        const byId = new Map(q.options.map((o) => [o.id, o]));
        const options = order
          .map((id) => byId.get(id))
          .filter((o): o is ChoiceOption => Boolean(o));
        return { ...q, options };
      }),
    [questions, optionOrder],
  );

  useEffect(() => {
    if (phase !== 'quiz') return;

    const onVisibility = () => {
      pushEvent(document.hidden ? 'hidden' : 'visible');
      if (document.hidden) setWarned((w) => ({ ...w, tab: true }));
    };
    const onFullscreen = () => {
      pushEvent(document.fullscreenElement ? 'fullscreen-enter' : 'fullscreen-exit');
      if (!document.fullscreenElement) setWarned((w) => ({ ...w, fullscreen: true }));
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [phase]);

  const deadline =
    timeLimitSeconds > 0 && sessionRef.current
      ? sessionRef.current.startedAt + timeLimitSeconds * 1000
      : null;

  useEffect(() => {
    if (phase !== 'quiz' || deadline === null) {
      setRemainingMs(null);
      return;
    }
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          void submitRef.current(true);
        }
        return;
      }
      setRemainingMs(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, deadline]);

  const blockClipboard = (e: React.ClipboardEvent | React.KeyboardEvent) => {
    pushEvent('copy');
    e.preventDefault();
  };

  const start = async () => {
    if (previewMode) {
      sessionRef.current = { sessionToken: 'preview', startedAt: Date.now() };
    } else {
      if (!startQuizSession) {
        setIntroError('Quiz session is unavailable. Please try again.');
        return;
      }
      try {
        sessionRef.current = await startQuizSession();
      } catch (e) {
        setIntroError((e as Error).message || 'Could not start the quiz. Please try again.');
        return;
      }
    }
    autoSubmittedRef.current = false;
    setPhase('quiz');
    if (form.settings.fullscreenRequired && !previewMode) {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* user denied — no fullscreen-enter event fires, which the server flags */
      }
    }
  };

  const setAnswer = (qid: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    setQError(null);
  };

  const next = () => {
    const q = questions[idx];
    if (q.type !== 'section_break' && q.required && isEmptyAnswer(answers[q.id])) {
      setQError(`${q.title} is required.`);
      return;
    }
    if (idx < questions.length - 1) setIdx(idx + 1);
  };

  const submit = async (force = false) => {
    const q = questions[idx];
    if (
      !force &&
      q.type !== 'section_break' &&
      q.required &&
      isEmptyAnswer(answers[q.id])
    ) {
      setQError(`${q.title} is required.`);
      return;
    }
    setSubmitting(true);
    setQError(null);
    try {
      const session = sessionRef.current;
      if (!session) {
        setQError('Quiz session expired. Please reload the page and restart.');
        setSubmitting(false);
        return;
      }
      const result = await onSubmit(answers, {
        sessionToken: session.sessionToken,
        events: eventsRef.current,
      });
      setScore(
        (result && 'score' in result && result.score) || gradeQuiz(realQuestions, answers),
      );
      setPhase('results');
    } catch (e) {
      setQError((e as Error).message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };
  submitRef.current = submit;

  if (phase === 'intro') {
    const totalPoints = form.totalPoints ?? 0;
    return (
      <div className="rounded-card border border-rule bg-paper p-8 text-center shadow-card sm:p-12">
        <p className="label-mono mb-3 text-accent">Quiz</p>
        <h1 className="text-display">{form.title}</h1>
        {form.description ? (
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
            {form.description}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-muted">
          <span>
            {realQuestions.length} question{realQuestions.length === 1 ? '' : 's'}
          </span>
          {form.settings.shuffleOptions ? <span>· shuffled options</span> : null}
          <span>· {totalPoints} point{totalPoints === 1 ? '' : 's'}</span>
          {timeLimitSeconds > 0 ? (
            <span>· {formatHms(timeLimitSeconds)} time limit</span>
          ) : null}
        </div>
        <div className="mt-8">
          <Button size="lg" onClick={start}>
            Start quiz
          </Button>
        </div>
        {introError ? (
          <div className="mt-4">
            <ErrorText>{introError}</ErrorText>
          </div>
        ) : null}
        {form.settings.fullscreenRequired ? (
          <p className="mt-4 text-xs text-muted">
            This quiz runs in fullscreen and tracks tab switches and copy attempts.
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === 'results') {
    if (form.settings.showResults && score) {
      return <QuizResults form={form} answers={answers} score={score} />;
    }
    return (
      <div className="rounded-card border border-rule bg-paper p-8 text-center shadow-card sm:p-12">
        <CheckCircle2 className="mx-auto mb-5 size-10 text-success" />
        <h2 className="text-display">All done.</h2>
        <p className="mt-3 max-w-md text-[15px] text-ink-2">
          {form.settings.confirmationMessage}
        </p>
      </div>
    );
  }

  const q = displayQuestions[idx];
  const realPos = realQuestions.findIndex((x) => x.id === q.id);
  const last = idx >= lastRealIdx;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onCopy={blockClipboard}
      onCut={blockClipboard}
      onPaste={blockClipboard}
      className="rounded-card border border-rule bg-paper shadow-card select-none"
    >
      <div className="flex flex-col gap-2 border-b border-rule px-6 pb-4 pt-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="label-mono">
            {realPos >= 0
              ? `Question ${realPos + 1} of ${realQuestions.length}`
              : 'Section'}
          </span>
          <span className="flex flex-wrap items-center gap-4">
            {remainingMs !== null && timeLimitSeconds > 0 ? (
              <span
                className={`label-mono flex items-center gap-1.5 ${
                  remainingMs <= 30000 ? 'text-danger' : 'text-accent'
                }`}
              >
                <Clock className="size-3.5" />
                {formatCountdown(remainingMs)}
              </span>
            ) : null}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-paper-3">
          <div
            className="h-full rounded-pill bg-accent transition-all duration-300 ease-out-expo"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
        {(warned.tab || warned.fullscreen) && !submitting ? (
          <div className="mt-1 flex items-center gap-2 rounded-input bg-accent-3/70 px-3 py-2 text-xs text-accent">
            <span>⚠</span>
            <span>
              {warned.tab && warned.fullscreen
                ? 'Tab switching and leaving fullscreen are recorded.'
                : warned.tab
                  ? 'Tab switching is recorded. Keep this tab focused.'
                  : 'Leaving fullscreen is recorded.'}
            </span>
          </div>
        ) : null}
      </div>

      {q.type === 'section_break' ? (
        <div className="flex flex-col gap-3 px-6 py-10 sm:px-8 sm:py-12">
          <p className="label-mono text-accent">Section</p>
          <h2 className="text-display">{q.title}</h2>
          {q.description ? (
            <p className="max-w-xl text-[15px] leading-relaxed text-ink-2">{q.description}</p>
          ) : null}
        </div>
      ) : (
        <FillField
          question={q}
          value={answers[questions[idx].id]}
          error={qError ?? undefined}
          disabled={submitting}
          onChange={(v) => setAnswer(questions[idx].id, v)}
        />
      )}

      <div className="flex items-center justify-between border-t border-rule px-6 py-4 sm:px-8">
        <span className="text-xs text-muted">Answers can&apos;t be changed after submitting.</span>
        {last ? (
          <Button onClick={() => void submit()} loading={submitting}>
            Submit
          </Button>
        ) : (
          <Button onClick={next}>Next</Button>
        )}
      </div>
    </div>
  );
}

function QuizResults({
  form,
  answers,
  score,
}: {
  form: PublicForm;
  answers: Record<string, AnswerValue>;
  score: QuizGrade;
}) {
  const percent = score.totalPoints > 0 ? Math.round((score.earnedPoints / score.totalPoints) * 100) : 0;
  return (
    <div className="rounded-card border border-rule bg-paper p-8 shadow-card sm:p-10">
      <p className="label-mono mb-3 text-accent">Your results</p>
      <div className="flex items-end gap-3">
        <span className="text-display">{score.earnedPoints}</span>
        <span className="pb-1.5 text-lg text-muted">/ {score.totalPoints}</span>
        <span className="label-mono mb-1.5 ml-auto text-muted">{percent}%</span>
      </div>
      <div className="mt-4 flex flex-col divide-y divide-rule">
        {score.questions.map((g) => {
          const q = form.questions.find((x) => x.id === g.questionId);
          if (!q) return null;
          const yourAnswer = answerLabel(q, answers[q.id]);
          const correctLabel = g.correctLabel;
          return (
            <div key={g.questionId} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] font-medium">
                  {g.correct === null ? (
                    <span className="text-muted">—</span>
                  ) : g.correct ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-danger" />
                  )}
                  <span>{q.title}</span>
                </span>
                <span className="label-mono shrink-0 text-muted">
                  {g.correct === null ? 'Not graded' : `${g.earned} / ${g.points}`}
                </span>
              </div>
              <div className="text-sm text-ink-2">
                Your answer: <span className="text-ink">{yourAnswer || '—'}</span>
              </div>
              {g.correct === false && correctLabel ? (
                <div className="text-sm text-ink-2">
                  Correct: <span className="font-medium text-success">{correctLabel}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function answerLabel(q: Question, value: AnswerValue | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    return q.options.find((o) => o.id === value)?.label ?? String(value);
  }
  if (q.type === 'checkbox' && Array.isArray(value)) {
    const labels = (value as string[])
      .map((id) => q.options.find((o) => o.id === id)?.label)
      .filter((l): l is string => Boolean(l));
    return labels.length > 0 ? labels.join(', ') : '—';
  }
  return String(value);
}
