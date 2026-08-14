import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, CheckCircle2, ChevronDown, ListOrdered, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { gradeQuestion, type AnswerValue, type Form, type FormResponse, type Question, type QuizFlags } from '@sagotka/shared';
import { api } from '../api';
import { Badge, Button, IconButton, Modal, Spinner, useToasts } from '../components/ui';
import { formatAnswer, formatDateTime } from '../lib';

const PAGE_SIZE = 200;

export function Responses() {
  const { id } = useParams();
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState<'summary' | 'individual'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toDelete, setToDelete] = useState<FormResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, push } = useToasts();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listResponses(id!, { limit: PAGE_SIZE }), api.getForm(id!)])
      .then(([r, f]) => {
        if (cancelled) return;
        setResponses(r.items);
        setTotal(r.total);
        setForm(f);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load responses.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const responseCount = total;

  const loadMore = async () => {
    if (!responses || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.listResponses(id!, {
        limit: PAGE_SIZE,
        offset: responses.length,
      });
      setResponses((prev) => [...(prev ?? []), ...r.items]);
      setTotal(r.total);
    } catch {
      push('Could not load more responses.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteResponse(id!, toDelete.id);
      setResponses((prev) => prev?.filter((r) => r.id !== toDelete.id) ?? null);
      setTotal((n) => Math.max(0, n - 1));
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
      ) : !responses || !form ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : responseCount === 0 ? (
        <EmptyResponses />
      ) : tab === 'summary' ? (
        <ChartsView responses={responses} form={form} total={responseCount} />
      ) : (
        <IndividualView
          responses={responses}
          form={form}
          onDelete={setToDelete}
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          hasMore={responses.length < responseCount}
        />
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

function isEmpty(v: AnswerValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function ChartsView({
  responses,
  form,
  total,
}: {
  responses: FormResponse[];
  form: Form;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {responses.length < total ? (
        <p className="text-xs text-muted">
          Charts are computed from the first {responses.length} of {total} responses. Load more
          responses for a fuller picture.
        </p>
      ) : null}
      {form.questions
        .filter((q) => q.type !== 'section_break')
        .map((q) => (
          <ChartCard key={q.id} question={q} responses={responses} quiz={form.settings.quiz} />
        ))}
    </div>
  );
}

function ChartCard({
  question: q,
  responses,
  quiz,
}: {
  question: Question;
  responses: FormResponse[];
  quiz: boolean;
}) {
  const values = responses
    .map((r) => r.answers[q.id] ?? null)
    .filter((v): v is AnswerValue => v !== undefined);
  const answered = values.filter((v) => !isEmpty(v));
  const answeredCount = answered.length;
  const skipped = responses.length - answeredCount;
  const pct = (n: number) => (answeredCount > 0 ? Math.round((n / answeredCount) * 100) : 0);

  const graded = quiz ? answered.map((v) => gradeQuestion(q, v)) : null;
  const scored = graded?.filter((g) => g.correct !== null);
  const correctCount = graded?.filter((g) => g.correct === true).length;
  const totalPoints = scored && scored.length > 0 ? scored.reduce((s, g) => s + g.points, 0) : undefined;
  const earnedPoints = scored && scored.length > 0 ? scored.reduce((s, g) => s + g.earned, 0) : undefined;

  let content: React.ReactNode;
  if (answeredCount === 0) {
    content = <span className="text-sm text-muted">No answers yet.</span>;
  } else if (q.type === 'multiple_choice' || q.type === 'dropdown' || q.type === 'true_false') {
    content = (
      <DonutChart
        total={answeredCount}
        segments={q.options
          .map((o) => ({ label: o.label, count: answered.filter((v) => v === o.id).length }))
          .filter((s) => s.count > 0)
          .map((s) => ({ ...s, percent: pct(s.count) }))}
      />
    );
  } else if (q.type === 'checkbox') {
    content = (
      <div className="flex flex-col gap-3.5">
        {q.options.map((o, i) => {
          const count = answered.filter((v) => Array.isArray(v) && (v as string[]).includes(o.id)).length;
          return <HBar key={o.id} label={o.label} count={count} percent={pct(count)} color={chartColor(i)} />;
        })}
      </div>
    );
  } else if (q.type === 'rating') {
    content = <RatingChart q={q} answered={answered} pct={pct} />;
  } else if (q.type === 'number') {
    content = <NumberChart answered={answered} pct={pct} />;
  } else if (q.type === 'date') {
    content = <DateChart answered={answered} pct={pct} />;
  } else if (q.type === 'email' || q.type === 'short_text' || q.type === 'paragraph') {
    content = <TextChart answered={answered} pct={pct} />;
  } else if (q.type === 'file_upload') {
    content = <UploadStat answered={answered} />;
  } else {
    content = null;
  }

  return (
    <section className="rounded-card border border-rule bg-paper p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight">{q.title}</h3>
        <span className="label-mono text-muted">
          {correctCount !== undefined ? (
            <>
              {correctCount} correct · {answeredCount} answered · {skipped} skipped
            </>
          ) : (
            <>
              {answeredCount} answered · {skipped} skipped
            </>
          )}
        </span>
      </div>

      {totalPoints !== undefined ? (
        <div className="mt-1 flex items-baseline justify-between text-sm">
          <span className="label-mono text-muted">
            {earnedPoints ?? 0} / {totalPoints} points earned
          </span>
        </div>
      ) : null}

      <div className="mt-5">{content}</div>
    </section>
  );
}

function RatingChart({
  q,
  answered,
  pct,
}: {
  q: Question;
  answered: AnswerValue[];
  pct: (n: number) => number;
}) {
  const max = q.settings?.max ?? 5;
  const nums = answered.filter((v): v is number => typeof v === 'number');
  const avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{avg.toFixed(2)}</span>
        <span className="label-mono text-muted">avg / {max}</span>
      </div>
      <DonutChart
        total={nums.length}
        segments={Array.from({ length: max }, (_, i) => i + 1)
          .map((n) => ({
            label: n === 1 ? '1 star' : `${n} stars`,
            count: nums.filter((v) => v === n).length,
          }))
          .filter((s) => s.count > 0)
          .map((s) => ({ ...s, percent: pct(s.count) }))}
      />
    </div>
  );
}

function NumberChart({ answered, pct }: { answered: AnswerValue[]; pct: (n: number) => number }) {
  const nums = answered.filter((v): v is number => typeof v === 'number');
  const distinct = Array.from(new Set(nums));
  const BIN_COUNT = 8;
  let rows: { label: string; count: number }[];
  if (distinct.length <= 12) {
    rows = distinct
      .sort((a, b) => a - b)
      .map((v) => ({ label: String(v), count: nums.filter((x) => x === v).length }));
  } else {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const width = (max - min) / BIN_COUNT;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => {
      const lo = min + i * width;
      const hi = i === BIN_COUNT - 1 ? max : min + (i + 1) * width;
      return { label: `${fmtNum(lo)}–${fmtNum(hi)}`, count: 0 };
    });
    for (const v of nums) {
      bins[Math.min(BIN_COUNT - 1, Math.floor((v - min) / width))].count++;
    }
    rows = bins.filter((b) => b.count > 0);
  }
  const maxCount = Math.max(...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r, i) => (
        <HBar
          key={r.label}
          label={r.label}
          count={r.count}
          percent={pct(r.count)}
          width={Math.round((r.count / maxCount) * 100)}
          color={chartColor(i)}
        />
      ))}
    </div>
  );
}

function DateChart({ answered, pct }: { answered: AnswerValue[]; pct: (n: number) => number }) {
  const dates = answered.map((v) => String(v));
  const rows = Array.from(new Set(dates))
    .sort((a, b) => (a < b ? -1 : 1))
    .map((d) => ({ label: d, count: dates.filter((x) => x === d).length }));
  const maxCount = Math.max(...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r, i) => (
        <HBar
          key={r.label}
          label={r.label}
          count={r.count}
          percent={pct(r.count)}
          width={Math.round((r.count / maxCount) * 100)}
          color={chartColor(i)}
        />
      ))}
    </div>
  );
}

function TextChart({ answered, pct }: { answered: AnswerValue[]; pct: (n: number) => number }) {
  const buckets = new Map<string, number>();
  for (const v of answered) {
    const key = String(v).trim();
    if (!key) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const rows = [...buckets.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const top = rows.slice(0, 10);
  const rest = rows.length - top.length;
  const maxCount = Math.max(1, ...top.map((r) => r.count));
  if (top.length === 0) {
    return <span className="text-sm text-muted">No answers yet.</span>;
  }
  return (
    <div className="flex flex-col gap-3.5">
      {top.map((r, i) => (
        <HBar
          key={r.label}
          label={r.label}
          count={r.count}
          percent={pct(r.count)}
          width={Math.round((r.count / maxCount) * 100)}
          color={chartColor(i)}
        />
      ))}
      {rest > 0 ? (
        <span className="label-mono text-muted">+ {rest} more unique answers</span>
      ) : null}
    </div>
  );
}

function UploadStat({ answered }: { answered: AnswerValue[] }) {
  const files = answered.reduce<number>((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
  return (
    <div className="flex items-center gap-10">
      <div>
        <div className="text-2xl font-semibold tabular-nums">{files}</div>
        <div className="label-mono mt-0.5 text-muted">files uploaded</div>
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{answered.length}</div>
        <div className="label-mono mt-0.5 text-muted">responses with files</div>
      </div>
    </div>
  );
}

interface DonutSegment {
  label: string;
  count: number;
  percent: number;
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}

function donutColor(i: number, other: boolean): string {
  if (other) return 'var(--muted)';
  return chartColor(i);
}

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const sorted = [...segments].sort((a, b) => b.count - a.count);
  const hasBig = sorted.some((s) => s.percent >= 2);
  const smalls = sorted.filter((s) => s.percent < 2);
  const smallPct = smalls.reduce((s, x) => s + x.percent, 0);
  const slices: (DonutSegment & { other?: boolean })[] =
    hasBig && smallPct > 0
      ? [
          ...sorted.filter((s) => s.percent >= 2),
          { label: 'Other', count: smalls.reduce((s, x) => s + x.count, 0), percent: smallPct, other: true },
        ]
      : sorted;

  const R = 40;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-36 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          role="img"
          aria-label={slices.map((s) => `${s.label}: ${s.count}`).join(', ')}
        >
          {slices.map((s, i) => {
            const len = Math.max(0, (s.percent / 100) * C);
            const el = (
              <circle
                key={`${s.label}-${i}`}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth={15}
                stroke={donutColor(i, s.other ?? false)}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
              >
                <title>{`${s.label}: ${s.count}`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums leading-none">{total}</span>
          <span className="label-mono mt-1 text-muted">answered</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slices.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: donutColor(i, s.other ?? false) }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
            <span className="label-mono shrink-0 text-muted">
              {s.count} · {s.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HBar({
  label,
  count,
  percent,
  width,
  color,
}: {
  label: string;
  count: number;
  percent: number;
  width?: number;
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-ink-2">{label}</span>
        <span className="label-mono shrink-0 text-muted">
          {count} · {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-paper-3">
        <div
          className="h-full rounded-pill transition-all duration-700 ease-out-expo"
          style={{ width: `${width ?? percent}%`, background: color ?? 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function IndividualView({
  responses,
  form,
  onDelete,
  onLoadMore,
  loadingMore,
  hasMore,
}: {
  responses: FormResponse[];
  form: Form;
  onDelete: (r: FormResponse) => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {responses.map((r) => (
        <ResponseCard key={r.id} response={r} form={form} onDelete={onDelete} />
      ))}
      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      ) : null}
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
          <div className="flex flex-wrap items-center gap-3">
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
