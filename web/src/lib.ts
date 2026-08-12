import { type AnswerValue, type Question } from '@sagotka/shared';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatAnswer(q: Question, value: AnswerValue | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === '') return '—';
  if (q.type === 'checkbox' || q.type === 'file_upload') {
    if (!Array.isArray(value) || value.length === 0) return '—';
    if (q.type === 'file_upload') {
      return value
        .map((f) => {
          const ref = f as { filename?: string; url?: string };
          return ref.filename ?? ref.url ?? 'file';
        })
        .join(', ');
    }
    return value
      .map((id) => q.options.find((o) => o.id === id)?.label ?? id)
      .join(', ');
  }
  if (q.type === 'multiple_choice' || q.type === 'dropdown' || q.type === 'true_false') {
    return q.options.find((o) => o.id === value)?.label ?? String(value);
  }
  if (q.type === 'rating' && typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return '★'.repeat(value);
  }
  return String(value);
}
