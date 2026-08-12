import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  PenLine,
  Settings2,
  Link as LinkIcon,
} from 'lucide-react';
import {
  newQuestion,
  type FieldType,
  type Form,
  type FormSettings,
  type Question,
} from '@sagotka/shared';
import { api } from '../api';
import { Button, IconButton, Input, Modal, Switch, Textarea, useToasts } from '../components/ui';
import { QuestionCard } from '../components/editor/QuestionCard';
import { AddQuestion } from '../components/editor/AddQuestion';
import { FillForm } from '../components/FillForm';
import { ShareLinkModal } from '../components/ShareLinkModal';
import { formatDate } from '../lib';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function Editor() {
  const { id } = useParams();
  const [form, setForm] = useState<Form | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [previewOn, setPreviewOn] = useState(true);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toasts, push } = useToasts();

  const formRef = useRef<Form | null>(null);
  formRef.current = form;
  const saveSeq = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let cancelled = false;
    api
      .getForm(id!)
      .then((f) => {
        if (cancelled) return;
        setForm(f);
        setSaveState('idle');
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // debounced autosave
  useEffect(() => {
    if (!form || saveState === 'idle') return;
    const t = setTimeout(() => {
      persist();
    }, 700);
    return () => clearTimeout(t);
  }, [form]);

  const persist = useCallback(async () => {
    const current = formRef.current;
    if (!current) return;
    const seq = ++saveSeq.current;
    setSaveState('saving');
    try {
      await api.updateForm(current.id, {
        title: current.title,
        description: current.description,
        settings: current.settings,
        questions: current.questions,
      });
      if (seq === saveSeq.current) setSaveState('saved');
    } catch {
      if (seq === saveSeq.current) setSaveState('error');
    }
  }, []);

  const patchForm = useCallback((patch: Partial<Form>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaveState('saving');
  }, []);

  const patchSettings = useCallback((patch: Partial<FormSettings>) => {
    setForm((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev));
    setSaveState('saving');
  }, []);

  const patchQuestion = useCallback((qid: string, patch: Partial<Question>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
          }
        : prev,
    );
    setSaveState('saving');
  }, []);

  const addQuestion = useCallback((type: FieldType) => {
    const q = newQuestion(type, !!formRef.current?.settings.quiz);
    setForm((prev) =>
      prev ? { ...prev, questions: [...prev.questions, q], updatedAt: new Date().toISOString() } : prev,
    );
    setSaveState('saving');
  }, []);

  const duplicateQuestion = useCallback((q: Question) => {
    const copy = {
      ...newQuestion(q.type, !!formRef.current?.settings.quiz),
      title: `${q.title} (copy)`,
      options: q.options.map((o) => ({ ...o })),
      correctAnswer: q.correctAnswer,
      acceptedAnswers: q.acceptedAnswers,
      caseSensitive: q.caseSensitive,
      points: q.points,
    };
    setForm((prev) => {
      if (!prev) return prev;
      const idx = prev.questions.findIndex((x) => x.id === q.id);
      const questions = [...prev.questions];
      questions.splice(idx + 1, 0, copy);
      return { ...prev, questions };
    });
    setSaveState('saving');
  }, []);

  const deleteQuestion = useCallback((qid: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.filter((q) => q.id !== qid);
      if (questions.length === 0) {
        return { ...prev, questions: [newQuestion('short_text')] };
      }
      return { ...prev, questions };
    });
    setSaveState('saving');
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.questions.findIndex((q) => q.id === active.id);
      const newIndex = prev.questions.findIndex((q) => q.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return {
        ...prev,
        questions: arrayMove(prev.questions, oldIndex, newIndex),
        updatedAt: new Date().toISOString(),
      };
    });
    setSaveState('saving');
  }, []);

  const publish = useCallback(async () => {
    await persist();
    patchSettings({ published: true });
    setShareOpen(true);
  }, [persist, patchSettings]);

  const publicForm = useMemo(() => {
    if (!form) return null;
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
      questions: form.questions,
      hasResponded: false,
    };
  }, [form]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-display">Form not found</h1>
        <p className="mt-3 text-sm text-muted">It may have been deleted.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24">
        <div className="h-6 w-48 animate-pulse rounded-full bg-paper-3" />
        <div className="mt-6 space-y-3">
          <div className="h-36 animate-pulse rounded-card bg-paper-2" />
          <div className="h-36 animate-pulse rounded-card bg-paper-2" />
        </div>
      </main>
    );
  }

  const saveLabel = {
    idle: 'Saved',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
  }[saveState];

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link
            to="/"
            aria-label="Back to dashboard"
            className="inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors hover:bg-paper-3 hover:text-ink"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate px-2 py-1 text-[17px] font-semibold tracking-tight text-ink">
            {form.title}
          </h1>
          <span
            className={`label-mono hidden shrink-0 sm:inline ${saveState === 'error' ? 'text-danger' : 'text-muted'}`}
          >
            {saveLabel}
          </span>
          <IconButton label="Form settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4.5" />
          </IconButton>
          <Link
            to={`/forms/${form.id}/responses`}
            aria-label="View responses"
            title="Responses"
            className="inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors hover:bg-paper-3 hover:text-ink"
          >
            <BarChart3 className="size-4.5" />
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreviewOn((v) => !v)}
            className={previewOn ? 'bg-accent-3 text-accent hover:bg-accent-3' : ''}
            aria-pressed={previewOn}
          >
            <Eye className="size-4" />
            <span className="hidden md:inline">Preview</span>
          </Button>
          <Button size="sm" onClick={publish} success={form.settings.published}>
            {form.settings.published ? <CheckCircle2 className="size-4" /> : <LinkIcon className="size-4" />}
            {form.settings.published ? 'Published' : 'Publish'}
          </Button>
        </div>
        {previewOn ? (
          <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6 lg:hidden">
            <div className="grid grid-cols-2 gap-1 rounded-pill bg-paper-3 p-1">
              <TabButton active={mobileTab === 'edit'} onClick={() => setMobileTab('edit')}>
                <PenLine className="size-3.5" /> Edit
              </TabButton>
              <TabButton active={mobileTab === 'preview'} onClick={() => setMobileTab('preview')}>
                <Eye className="size-3.5" /> Preview
              </TabButton>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-10">
          <div className={previewOn ? (mobileTab === 'edit' ? 'block' : 'hidden lg:block') : 'block'}>
            <div className="mx-auto max-w-3xl">
              <FormHero form={form} onChange={patchForm} />
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={form.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="mt-4 flex flex-col gap-3">
                    {form.questions.map((q) => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        isQuiz={form.settings.quiz}
                        onChange={(patch) => patchQuestion(q.id, patch)}
                        onDuplicate={() => duplicateQuestion(q)}
                        onDelete={() => deleteQuestion(q.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="mt-4">
                <AddQuestion onAdd={addQuestion} isQuiz={form.settings.quiz} />
              </div>
            </div>
          </div>

          {previewOn ? (
            <div className={`mt-10 lg:mt-0 ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
              <div className="lg:sticky lg:top-24">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-mono text-muted">Live preview</p>
                  <span className="label-mono text-muted">Updated {formatDate(form.updatedAt)}</span>
                </div>
                <FillForm
                  form={publicForm!}
                  onSubmit={async () => {}}
                  initialAnswers={{}}
                  previewMode
                />
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <ShareLinkModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        form={form}
        onUpdate={setForm}
        onUnpublish={() => {
          patchSettings({ published: false });
          setShareOpen(false);
          push('Form unpublished.');
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        form={form}
        onChange={patchSettings}
      />

      {toasts}
    </div>
  );
}

function FormHero({ form, onChange }: { form: Form; onChange: (patch: Partial<Form>) => void }) {
  return (
    <section className="rounded-card border border-rule bg-paper p-6 shadow-card sm:p-8">
      <p className="label-mono mb-3 text-accent">
        {form.settings.published
          ? form.settings.quiz
            ? 'Published quiz'
            : 'Published form'
          : form.settings.quiz
            ? 'Draft quiz'
            : 'Draft'}
      </p>
      <input
        value={form.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Form title"
        aria-label="Form title"
        className="w-full rounded-input border border-transparent bg-transparent px-1 py-1 text-[22px] font-semibold tracking-tight text-ink transition-colors placeholder:text-muted hover:border-rule focus:border-accent focus:bg-paper-2 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:text-2xl"
      />
      <input
        value={form.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Describe what this form is about…"
        aria-label="Form description"
        className="mt-2 w-full rounded-input border border-transparent bg-transparent px-1 py-1 text-[15px] text-muted transition-colors placeholder:text-muted/70 hover:border-rule focus:border-accent focus:bg-paper-2 focus:text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-paper text-ink shadow-sm' : 'text-muted'
      }`}
    >
      {children}
    </button>
  );
}

function TimePartField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <Input
        className="h-9 w-16 px-0 text-center tabular-nums"
        value={String(value)}
        inputMode="numeric"
        maxLength={2}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '');
          onChange(Math.max(0, Math.min(max, raw ? Number(raw) : 0)));
        }}
        aria-label={label}
      />
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </label>
  );
}

function SettingsModal({
  open,
  onClose,
  form,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  form: Form;
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  const tl = form.settings.timeLimitSeconds;
  const tlHours = Math.floor(tl / 3600);
  const tlMinutes = Math.floor((tl % 3600) / 60);
  const tlSeconds = tl % 60;
  const setTimeLimit = (h: number, m: number, s: number) =>
    onChange({ timeLimitSeconds: Math.min(24 * 3600, h * 3600 + m * 60 + s) });
  return (
    <Modal open={open} onClose={onClose} title="Form settings">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Quiz mode</p>
            <p className="text-xs text-muted">
              Turns this into a scored quiz with correct answers and anti-cheat measures.
            </p>
          </div>
          <Switch checked={form.settings.quiz} onChange={(v) => onChange({ quiz: v })} />
        </div>

        {form.settings.quiz ? (
          <div className="flex flex-col gap-5 rounded-input border border-rule bg-paper-2 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show results to respondents</p>
                <p className="text-xs text-muted">
                  When off, only you can see scores and per-question results.
                </p>
              </div>
              <Switch
                checked={form.settings.showResults}
                onChange={(v) => onChange({ showResults: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require fullscreen</p>
                <p className="text-xs text-muted">
                  Quiz runs fullscreen; leaving fullscreen is recorded as a flag.
                </p>
              </div>
              <Switch
                checked={form.settings.fullscreenRequired}
                onChange={(v) => onChange({ fullscreenRequired: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Shuffle answer options</p>
                <p className="text-xs text-muted">
                  Show multiple-choice options in a random order for each taker.
                </p>
              </div>
              <Switch
                checked={form.settings.shuffleOptions}
                onChange={(v) => onChange({ shuffleOptions: v })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Time limit</span>
              <div className="flex items-center gap-2">
                <TimePartField
                  label="hh"
                  value={tlHours}
                  max={24}
                  onChange={(h) => setTimeLimit(h, tlMinutes, tlSeconds)}
                />
                <span className="text-sm text-muted">:</span>
                <TimePartField
                  label="mm"
                  value={tlMinutes}
                  max={59}
                  onChange={(m) => setTimeLimit(tlHours, m, tlSeconds)}
                />
                <span className="text-sm text-muted">:</span>
                <TimePartField
                  label="ss"
                  value={tlSeconds}
                  max={59}
                  onChange={(s) => setTimeLimit(tlHours, tlMinutes, s)}
                />
              </div>
              <p className="text-xs text-muted">
                00:00:00 means no limit. The quiz auto-submits when time runs out.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Accepting responses</p>
            <p className="text-xs text-muted">When off, respondents see a closed screen.</p>
          </div>
          <Switch checked={form.settings.acceptsResponses} onChange={(v) => onChange({ acceptsResponses: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Limit to one response</p>
            <p className="text-xs text-muted">Each person can only respond once (tracked per device).</p>
          </div>
          <Switch checked={form.settings.limitToOneResponse} onChange={(v) => onChange({ limitToOneResponse: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Allow editing after submit</p>
            <p className="text-xs text-muted">Respondents get a link to change their answers.</p>
          </div>
          <Switch checked={form.settings.allowEditResponses} onChange={(v) => onChange({ allowEditResponses: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show progress bar</p>
            <p className="text-xs text-muted">Display how far along respondents are.</p>
          </div>
          <Switch checked={form.settings.showProgress} onChange={(v) => onChange({ showProgress: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmation" className="text-sm font-medium">
            Confirmation message
          </label>
          <Textarea
            id="confirmation"
            rows={2}
            value={form.settings.confirmationMessage}
            onChange={(e) => onChange({ confirmationMessage: e.target.value })}
            placeholder="Thanks — your response has been recorded."
          />
        </div>
      </div>
    </Modal>
  );
}
