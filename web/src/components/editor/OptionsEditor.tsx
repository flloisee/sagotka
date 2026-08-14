import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { randomId, type ChoiceOption } from '@sagotka/shared';

export function OptionsEditor({
  options,
  onChange,
  correctOptionId,
  onCorrectChange,
  correctOptionIds,
  onCorrectIdsChange,
  squareMarkers = false,
}: {
  options: ChoiceOption[];
  onChange: (options: ChoiceOption[]) => void;
  correctOptionId?: string;
  onCorrectChange?: (optionId: string) => void;
  correctOptionIds?: string[];
  onCorrectIdsChange?: (optionIds: string[]) => void;
  squareMarkers?: boolean;
}) {
  const update = (id: string, label: string) =>
    onChange(options.map((o) => (o.id === id ? { ...o, label } : o)));
  const remove = (id: string) => {
    if (onCorrectChange && correctOptionId === id) onCorrectChange('');
    if (onCorrectIdsChange && correctOptionIds?.includes(id)) {
      onCorrectIdsChange(correctOptionIds.filter((x) => x !== id));
    }
    onChange(options.filter((o) => o.id !== id));
  };
  const move = (index: number, dir: -1 | 1) => {
    const next = [...options];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () =>
    onChange([...options, { id: randomId(), label: `Option ${options.length + 1}` }]);

  const marking = onCorrectChange !== undefined || onCorrectIdsChange !== undefined;
  const markerRadius = squareMarkers ? 'rounded-[4px]' : 'rounded-full';

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {options.map((o, i) => {
        const isCorrect =
          onCorrectChange !== undefined
            ? o.id === correctOptionId
            : (correctOptionIds ?? []).includes(o.id);
        const toggle = () => {
          if (onCorrectChange !== undefined) {
            onCorrectChange(isCorrect ? '' : o.id);
          } else if (onCorrectIdsChange !== undefined) {
            onCorrectIdsChange(
              isCorrect
                ? (correctOptionIds ?? []).filter((id) => id !== o.id)
                : [...(correctOptionIds ?? []), o.id],
            );
          }
        };
        return (
          <div key={o.id} className="group flex items-center gap-1.5">
            {marking ? (
              <button
                type="button"
                aria-label={`Mark ${o.label || `option ${i + 1}`} as correct`}
                title={isCorrect ? 'Correct answer' : 'Mark as correct answer'}
                onClick={toggle}
                className={`flex size-5 shrink-0 items-center justify-center ${markerRadius} border-2 transition-colors ${
                  isCorrect
                    ? 'border-success bg-success'
                    : 'border-rule-2 bg-paper hover:border-success'
                }`}
              >
                {isCorrect ? (
                  <svg viewBox="0 0 16 16" fill="none" className="size-3">
                    <path d="M3 8.5 6.5 12 13 4.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            ) : (
              <span
                aria-hidden
                className={`flex size-4.5 shrink-0 items-center justify-center ${markerRadius} border border-rule-2`}
              />
            )}
            <input
              value={o.label}
              onChange={(e) => update(o.id, e.target.value)}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              className="h-9 flex-1 rounded-input border border-transparent bg-transparent px-2.5 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-rule focus:border-accent focus:bg-paper focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-3.5" />
              </IconBtn>
              <IconBtn label="Move down" disabled={i === options.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-3.5" />
              </IconBtn>
              <IconBtn label="Remove option" onClick={() => remove(o.id)}>
                <Trash2 className="size-3.5" />
              </IconBtn>
            </div>
          </div>
        );
      })}
      <button
        onClick={add}
        className="inline-flex items-center gap-1.5 self-start rounded-pill px-2.5 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-3/50"
      >
        <Plus className="size-4" />
        Add option
      </button>
    </div>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-6.5 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper-3 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
