import { useEffect, useState } from 'react';
import { ChevronDown, Copy, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FIELD_TYPE_LABELS, QUIZ_TYPES, migrateQuestionType, type FieldType, type Question } from '@sagotka/shared';
import { IconButton, Switch, Input } from '../ui';
import { OptionsEditor } from './OptionsEditor';
import { ICONS } from './AddQuestion';

interface QuestionCardProps {
  question: Question;
  isQuiz?: boolean;
  onChange: (patch: Partial<Question>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function QuestionCard({ question: q, isQuiz = false, onChange, onDuplicate, onDelete }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (q.type === 'section_break') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-card border bg-paper shadow-card ${
          isDragging ? 'border-accent opacity-80' : 'border-rule'
        }`}
      >
        <div className="flex items-center gap-3 border-l-[3px] border-accent px-5 py-4">
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="cursor-grab touch-none text-rule-2 hover:text-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4.5" />
          </button>
          <TypePicker question={q} isQuiz={isQuiz} onChange={onChange} />
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton label="Duplicate question" onClick={onDuplicate}>
              <Copy className="size-4" />
            </IconButton>
            <IconButton label="Delete question" onClick={onDelete}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>
        <div className="px-6 pb-5">
          <EditableTitle
            value={q.title}
            placeholder="Section title"
            onChange={(v) => onChange({ title: v })}
          />
          <EditableDescription
            value={q.description}
            onChange={(v) => onChange({ description: v })}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-card border bg-paper shadow-card transition-shadow ${
        isDragging ? 'border-accent opacity-80' : 'border-rule'
      }`}
    >
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-rule-2 hover:text-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4.5" />
        </button>
        <TypePicker question={q} isQuiz={isQuiz} onChange={onChange} />
        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={q.required}
            onChange={(v) => onChange({ required: v })}
            label="Required"
          />
          <IconButton label="Duplicate question" onClick={onDuplicate}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton label="Delete question" onClick={onDelete}>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="px-5 pb-5 pt-3">
        <EditableTitle
          value={q.title}
          placeholder="Question"
          onChange={(v) => onChange({ title: v })}
        />
        <EditableDescription
          value={q.description}
          onChange={(v) => onChange({ description: v })}
        />
        <TypeSettings question={q} isQuiz={isQuiz} onChange={onChange} />
      </div>
    </div>
  );
}

function EditableTitle({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-input border border-transparent bg-transparent px-1.5 py-1 text-[16px] font-semibold tracking-tight text-ink transition-colors placeholder:text-muted hover:border-rule focus:border-accent focus:bg-paper-2 focus:outline-none focus:ring-2 focus:ring-accent/25"
    />
  );
}

function EditableDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder="Description (optional)"
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-input border border-transparent bg-transparent px-1.5 py-1 text-sm text-muted transition-colors placeholder:text-muted/70 hover:border-rule focus:border-accent focus:bg-paper-2 focus:text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/25"
    />
  );
}

function TypePicker({
  question: q,
  isQuiz,
  onChange,
}: {
  question: Question;
  isQuiz: boolean;
  onChange: (patch: Partial<Question>) => void;
}) {
  const [open, setOpen] = useState(false);
  const types = (Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).filter(
    ([type]) => !isQuiz || QUIZ_TYPES.includes(type),
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Question type"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="label-mono inline-flex h-7 items-center gap-1.5 rounded-input border border-transparent bg-paper-2 pl-2 pr-6 text-muted transition-colors duration-150 hover:border-rule hover:text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      >
        <span aria-hidden="true" className="text-[13px] leading-none text-neutral">
          {ICONS[q.type]}
        </span>
        {FIELD_TYPE_LABELS[q.type]}
        <ChevronDown aria-hidden="true" className="absolute right-1.5 size-3.5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close question-type menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Question type"
            className="absolute left-0 z-40 mt-2 w-56 rounded-card border border-rule bg-paper p-2 shadow-lift"
          >
            <p className="label-mono px-2 pb-1.5 pt-1 text-muted">Question types</p>
            <div className="grid max-h-[14.25rem] grid-cols-1 gap-0.5 overflow-y-auto pr-0.5">
              {types.map(([type, label]) => {
                const selected = type === q.type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      if (type !== q.type) onChange(migrateQuestionType(q, type, isQuiz));
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-input px-2.5 py-2 text-left text-sm transition-colors hover:bg-paper-3 hover:text-ink ${
                      selected ? 'bg-paper-3 text-ink' : 'text-ink-2'
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-3 text-[13px] font-medium text-neutral">
                      {ICONS[type]}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TypeSettings({
  question: q,
  isQuiz,
  onChange,
}: {
  question: Question;
  isQuiz: boolean;
  onChange: (patch: Partial<Question>) => void;
}) {
  const setSetting = (key: string, value: unknown) => {
    onChange({ settings: { ...(q.settings ?? {}), [key]: value } });
  };

  switch (q.type) {
    case 'short_text':
    case 'email':
      return (
        <MiniFields>
          <MiniField label="Placeholder">
            <Input
              value={q.settings?.placeholder ?? ''}
              onChange={(e) => setSetting('placeholder', e.target.value)}
              placeholder="e.g. Your answer"
            />
          </MiniField>
          {isQuiz && q.type === 'short_text' ? <OpenEndedGrade question={q} onChange={onChange} /> : null}
          {isQuiz ? <PointsField question={q} onChange={onChange} /> : null}
        </MiniFields>
      );
    case 'paragraph':
      return (
        <MiniFields>
          <MiniField label="Placeholder">
            <Input
              value={q.settings?.placeholder ?? ''}
              onChange={(e) => setSetting('placeholder', e.target.value)}
              placeholder="e.g. Long-form answer"
            />
          </MiniField>
          <MiniField label="Rows">
            <Input
              type="number"
              min={1}
              max={30}
              value={q.settings?.rows ?? 4}
              onChange={(e) => setSetting('rows', Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            />
          </MiniField>
          {isQuiz ? <OpenEndedGrade question={q} onChange={onChange} /> : null}
          {isQuiz ? <PointsField question={q} onChange={onChange} /> : null}
        </MiniFields>
      );
    case 'number':
      return (
        <MiniFields>
          <MiniField label="Min">
            <Input
              type="number"
              placeholder="None"
              value={q.settings?.min ?? ''}
              onChange={(e) => setSetting('min', e.target.value === '' ? null : Number(e.target.value))}
            />
          </MiniField>
          <MiniField label="Max">
            <Input
              type="number"
              placeholder="None"
              value={q.settings?.max ?? ''}
              onChange={(e) => setSetting('max', e.target.value === '' ? null : Number(e.target.value))}
            />
          </MiniField>
          <MiniField label="Step">
            <Input
              type="number"
              min={0.01}
              value={q.settings?.step ?? 1}
              onChange={(e) => setSetting('step', Number(e.target.value) > 0 ? Number(e.target.value) : 1)}
            />
          </MiniField>
        </MiniFields>
      );
    case 'multiple_choice':
      return (
        <>
          {isQuiz ? (
            <p className="mt-2 text-xs text-muted">
              Select the <span className="font-medium text-success">green checkmark</span> next to the
              correct answer.
            </p>
          ) : null}
          <OptionsEditor
            options={q.options}
            onChange={(options) => onChange({ options })}
            correctOptionId={isQuiz ? q.correctAnswer : undefined}
            onCorrectChange={
              isQuiz ? (optionId) => onChange({ correctAnswer: optionId }) : undefined
            }
          />
          {isQuiz ? <PointsField question={q} onChange={onChange} /> : null}
        </>
      );
    case 'true_false':
      return (
        <>
          {isQuiz ? (
            <p className="mt-2 text-xs text-muted">
              Select the <span className="font-medium text-success">green checkmark</span> next to the
              correct answer.
            </p>
          ) : null}
          <TrueFalseGrade question={q} onChange={onChange} />
          <PointsField question={q} onChange={onChange} className="mt-4" />
        </>
      );
    case 'dropdown':
    case 'checkbox':
      return (
        <OptionsEditor
          options={q.options}
          onChange={(options) => onChange({ options })}
        />
      );
    case 'rating':
      return (
        <MiniFields>
          <MiniField label="Max stars">
            <select
              value={q.settings?.max ?? 5}
              onChange={(e) => setSetting('max', Number(e.target.value))}
              className="h-10 rounded-input border border-rule bg-paper px-3 text-sm text-ink transition-colors hover:border-rule-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              {[3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </select>
          </MiniField>
        </MiniFields>
      );
    case 'file_upload':
      return (
        <MiniFields>
          <MiniField label="Max file size">
            <select
              value={q.settings?.maxFileSizeMb ?? 10}
              onChange={(e) => setSetting('maxFileSizeMb', Number(e.target.value))}
              className="h-10 rounded-input border border-rule bg-paper px-3 text-sm text-ink transition-colors hover:border-rule-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              {[1, 5, 10, 25, 50].map((mb) => (
                <option key={mb} value={mb}>
                  {mb} MB
                </option>
              ))}
            </select>
          </MiniField>
          <div className="flex items-end pb-2">
            <Switch
              checked={q.settings?.multiple !== false}
              onChange={(v) => setSetting('multiple', v)}
              label="Allow multiple files"
            />
          </div>
        </MiniFields>
      );
    default:
      return null;
  }
}

function PointsField({
  question: q,
  onChange,
  className = '',
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
  className?: string;
}) {
  return (
    <MiniField label="Points" className={className}>
      <Input
        type="number"
        min={0}
        max={1000}
        value={q.points ?? 1}
        onChange={(e) => onChange({ points: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
        className="w-24"
      />
    </MiniField>
  );
}

function OpenEndedGrade({
  question: q,
  onChange,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}) {
  const setAccepted = (raw: string) =>
    onChange({ acceptedAnswers: raw.split(',').map((s) => s.trim()).filter(Boolean) });
  return (
    <>
      <MiniField label="Accepted answers">
        <Input
          value={(q.acceptedAnswers ?? []).join(', ')}
          onChange={(e) => setAccepted(e.target.value)}
          placeholder="Comma-separated, e.g. Paris, paris"
        />
      </MiniField>
      <div className="flex items-end pb-2">
        <Switch
          checked={q.caseSensitive === true}
          onChange={(v) => onChange({ caseSensitive: v })}
          label="Case sensitive"
        />
      </div>
    </>
  );
}

function TrueFalseGrade({
  question: q,
  onChange,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}) {
  const correct = q.correctAnswer;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="label-mono text-muted">Correct answer</p>
      <div className="flex gap-2">
        {(['true', 'false'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ correctAnswer: correct === v ? '' : v })}
            className={`rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors ${
              correct === v
                ? 'border-success bg-success/15 text-success'
                : 'border-rule bg-paper text-ink-2 hover:border-rule-2'
            }`}
          >
            {v === 'true' ? 'True' : 'False'}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniFields({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-3">{children}</div>;
}

function MiniField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-36 flex-col gap-1.5 ${className}`}>
      <label className="label-mono text-muted">{label}</label>
      {children}
    </div>
  );
}
