import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FIELD_TYPE_LABELS, QUIZ_TYPES, type FieldType } from '@sagotka/shared';

export const ICONS: Record<FieldType, string> = {
  short_text: 'Aa',
  paragraph: '¶',
  multiple_choice: '◉',
  true_false: '✓',
  checkbox: '☑',
  dropdown: '▾',
  email: '@',
  number: '#',
  date: '📅',
  file_upload: '↑',
  section_break: '—',
  rating: '★',
};

export function AddQuestion({ onAdd, isQuiz = false }: { onAdd: (type: FieldType) => void; isQuiz?: boolean }) {
  const [open, setOpen] = useState(false);
  const types = (Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).filter(
    ([type]) => !isQuiz || QUIZ_TYPES.includes(type),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-rule-2 bg-transparent px-4 py-3.5 text-sm font-medium text-neutral transition-colors hover:border-accent hover:bg-accent-3/40 hover:text-accent"
        aria-expanded={open}
      >
        <Plus className="size-4" />
        Add question
      </button>

      {open ? (
        <>
          <button
            aria-label="Close add-question menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 z-40 mt-2 rounded-card border border-rule bg-paper p-2 shadow-lift">
            <p className="label-mono px-2 pb-1.5 pt-1 text-muted">Question types</p>
            <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
              {types.map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => {
                    onAdd(type);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-input px-2.5 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-3 text-[13px] font-medium text-neutral">
                    {ICONS[type]}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
