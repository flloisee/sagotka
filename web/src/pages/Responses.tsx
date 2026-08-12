import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, CheckCircle2, ChevronDown, ListOrdered, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import type { Form, FormResponse, QuizFlags, Summary } from '@sagotka/shared';
import { api } from '../api';
import { Badge, Button, IconButton, Modal, Spinner, useToasts } from '../components/ui';
import { formatAnswer, formatDateTime } from '../lib';

export function Responses() {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState<'summary' | 'individual'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FormResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, push } = useToasts();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.summary(id!), api.listResponses(id!), api.getForm(id!)])
      .then(([s, r, f]) => {
        if (cancelled) return;
        setSummary(s);
        setResponses(r);
        setForm(f);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load responses.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const responseCount = summary?.responseCount ?? 0;

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteResponse(id!, toDelete.id);
      setResponses((prev) => prev?.filter((r) => r.id !== toDelete.id) ?? null);
      api.summary(id!).then(setSummary).catch(() => push('Could not update summary.', 'error'));
      push('Response deleted.');
    } catch {
      push('Could not delete response.', 'error');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link
          to={`/forms/${id}`}
          aria-label="Back to editor"
          className="inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors hover:bg-paper-3 hover:text-ink"
        >
          <ArrowLeft className="size-4.5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{form?.title ?? 'Form'}</h1>
          <p className="label-mono text-muted">{responseCount} responses</p>
        </div>
      </div>

      <div className="mb-6 inline-grid grid-cols-2 gap-1 rounded-pill bg-paper-3 p-1">
        <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
          <BarChart3 className="size-3.5" /> Summary
        </TabButton>
        <TabButton active={tab === 'individual'} onClick={() => setTab('individual')}>
          <ListOrdered className="size-3.5" /> Individual
        </TabButton>
      </div>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !summary || !responses || !form ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : responseCount === 0 ? (
        <EmptyResponses />
      ) : tab === 'summary' ? (
        <SummaryView summary={summary} />
      ) : (
        <IndividualView responses={responses} form={form} onDelete={setToDelete} />
      )}

      {toasts}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} onEnter={confirmDelete} title="Delete response?">
        <p className="text-sm text-ink-2">
          Response{' '}
          <span className="font-medium text-ink">#{toDelete?.id.slice(0, 8)}</span> will be
          permanently removed.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>
            Delete response
          </Button>
        </div>
      </Modal>
    </main>
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-paper text-ink shadow-sm' : 'text-muted'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyResponses() {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-rule-2 px-6 py-20 text-center">
      <BarChart3 className="mb-4 size-8 text-muted" />
      <h2 className="text-lg font-semibold tracking-tight">No responses yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Publish the form and share the fill link to start collecting responses.
      </p>
    </div>
  );
}

function SummaryView({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-4">
      {summary.questions.map((q) => (
        <section key={q.questionId} className="rounded-card border border-rule bg-paper p-5 shadow-card sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-tight">{q.title}</h3>
            <span className="label-mono shrink-0 text-muted">
              {q.correctCount !== undefined ? (
                <>
                  {q.correctCount} correct · {q.answered} answered · {q.skipped} skipped
                </>
              ) : (
                <>
                  {q.answered} answered · {q.skipped} skipped
                </>
              )}
            </span>
          </div>

          {q.totalPoints !== undefined ? (
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="label-mono text-muted">
                {q.earnedPoints ?? 0} / {q.totalPoints} points earned
              </span>
            </div>
          ) : null}

          {q.choiceStats ? (
            <div className="mt-5 flex flex-col gap-3.5">
              {q.choiceStats.map((opt) => (
                <div key={opt.optionId}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink-2">{opt.label}</span>
                    <span className="label-mono text-muted">
                      {opt.count} · {opt.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-paper-3">
                    <div
                      className="h-full rounded-pill bg-accent transition-all duration-700 ease-out-expo"
                      style={{ width: `${opt.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {q.recentValues.length === 0 ? (
                <span className="text-sm text-muted">No answers yet.</span>
              ) : (
                q.recentValues.map((v, i) => (
                  <span
                    key={i}
                    className="rounded-pill bg-paper-2 px-3 py-1 text-sm text-ink-2"
                  >
                    {typeof v === 'string'
                      ? v
                      : q.type === 'rating' && typeof v === 'number' && Number.isInteger(v) && v > 0
                        ? '★'.repeat(v)
                        : JSON.stringify(v)}
                  </span>
                ))
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function IndividualView({
  responses,
  form,
  onDelete,
}: {
  responses: FormResponse[];
  form: Form;
  onDelete: (r: FormResponse) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {responses.map((r) => (
        <ResponseCard key={r.id} response={r} form={form} onDelete={onDelete} />
      ))}
    </div>
  );
}

function ResponseCard({
  response,
  form,
  onDelete,
}: {
  response: FormResponse;
  form: Form;
  onDelete: (r: FormResponse) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-card border border-rule bg-paper shadow-card">
      <div className="flex items-center justify-between gap-3 pl-5 pr-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 py-4 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            {response.score ? (
              <Badge tone="accent">
                {response.score.earnedPoints} / {response.score.totalPoints}
              </Badge>
            ) : null}
            <Badge tone="neutral">#{response.id.slice(0, 8)}</Badge>
            <span className="text-sm text-muted">{formatDateTime(response.createdAt)}</span>
          </div>
          <ChevronDown
            className={`size-4.5 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <IconButton label="Delete response" onClick={() => onDelete(response)}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
      {open ? (
        <div className="border-t border-rule px-5 py-4">
          <dl className="flex flex-col divide-y divide-rule">
            {form.questions
              .filter((q) => q.type !== 'section_break')
              .map((q) => {
                const grade = response.score?.questions.find((g) => g.questionId === q.id);
                return (
                  <div key={q.id} className="flex flex-col gap-0.5 py-2.5">
                    <dt className="text-xs font-medium text-muted">{q.title}</dt>
                    <dd className="flex items-center gap-2 text-[15px] text-ink">
                      {grade?.correct === true ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : grade?.correct === false ? (
                        <XCircle className="size-4 shrink-0 text-danger" />
                      ) : null}
                      <span>{formatAnswer(q, response.answers[q.id])}</span>
                      {grade?.correct !== null && grade?.correct !== undefined ? (
                        <span className="label-mono ml-auto shrink-0 text-muted">
                          {grade.earned}/{grade.points}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
          </dl>
          {response.flags ? (
            <FlagsReadout flags={response.flags} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function FlagsReadout({ flags }: { flags: QuizFlags }) {
  const items: { label: string; value: number }[] = [
    { label: 'Tab switches', value: flags.tabSwitches },
    { label: 'Fullscreen exits', value: flags.fullscreenExits },
    { label: 'Copy attempts', value: flags.copyAttempts },
  ];
  const duration = flags.durationMs ? `${Math.max(1, Math.round(flags.durationMs / 1000))}s` : null;
  const suspicious = flags.tabSwitches + flags.fullscreenExits > 0 || Boolean(flags.fullscreenDenied);
  return (
    <div
      className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-input border px-3.5 py-2.5 text-xs ${
        suspicious ? 'border-danger/30 bg-danger/10' : 'border-rule bg-paper-2'
      }`}
    >
      <span className={`flex items-center gap-1.5 font-medium ${suspicious ? 'text-danger' : 'text-muted'}`}>
        <ShieldAlert className="size-3.5" />
        {suspicious ? 'Suspicious activity' : 'No suspicious activity'}
      </span>
      {items.map(
        (it) =>
          it.value > 0 ? (
            <span key={it.label} className="text-ink-2">
              {it.label}: <span className="font-semibold text-ink">{it.value}</span>
            </span>
          ) : null,
      )}
      {flags.fullscreenDenied ? (
        <span className="text-ink-2">
          Denied fullscreen: <span className="font-semibold text-danger">Yes</span>
        </span>
      ) : null}
      {duration ? (
        <span className="text-ink-2">
          Duration: <span className="font-semibold text-ink">{duration}</span>
        </span>
      ) : null}
    </div>
  );
}
