import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2, X } from 'lucide-react';

/* ---------- Button (8 states: default · hover · focus · active · disabled · loading · error · success) ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-2 active:bg-accent-2 disabled:bg-paper-3 disabled:text-muted',
  secondary:
    'border border-rule bg-paper text-ink hover:bg-paper-2 active:bg-paper-3 disabled:text-muted disabled:hover:bg-paper',
  ghost:
    'text-ink-2 hover:bg-paper-3 hover:text-ink active:bg-paper-2 disabled:text-muted',
  danger:
    'bg-danger text-white hover:opacity-90 active:opacity-80 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-[15px] gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  success?: boolean;
  full?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  full = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const state = loading ? 'opacity-80 cursor-wait' : '';
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center rounded-pill font-medium transition-all duration-150 ease-out-expo
        ${VARIANTS[variant]} ${SIZES[size]} ${state} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : success ? <CheckMark /> : null}
      {children}
    </button>
  );
}

function CheckMark() {
  return (
    <span className="inline-flex size-4 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
        <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors duration-150
        hover:bg-paper-3 hover:text-ink active:bg-paper-2 disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin text-muted ${className}`} aria-label="Loading" />;
}

/* ---------- Badge ---------- */

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-paper-3 text-neutral',
    accent: 'bg-accent-3 text-accent',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- Switch ---------- */

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer select-none items-center gap-3 ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-150 ease-out-expo ${
          checked ? 'bg-accent' : 'bg-paper-3 border border-rule'
        }`}
      >
        <span
          className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-150 ease-out-expo ${
            checked ? 'left-[calc(100%-1.25rem)]' : 'left-1'
          }`}
        />
      </button>
      {label ? <span className="text-sm text-ink-2">{label}</span> : null}
    </label>
  );
}

/* ---------- Form controls ---------- */

const FIELD_BASE =
  'w-full rounded-input border border-rule bg-paper text-[15px] text-ink placeholder:text-muted transition-colors duration-150 ' +
  'hover:border-rule-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_BASE} h-10 px-3.5 ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_BASE} px-3.5 py-2.5 leading-relaxed ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_BASE} h-10 appearance-none bg-no-repeat px-3.5 pr-9 ${className}`}
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23777%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")',
        backgroundPosition: 'right 0.85rem center',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ---------- Error text ---------- */

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-danger">{children}</p>;
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  onEnter,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  onEnter?: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const [gone, setGone] = useState(!open);
  useEffect(() => {
    if (open) setGone(false);
  }, [open]);

  useEffect(() => {
    if (!open || !onEnter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'BUTTON' || tag === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      onEnter();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onEnter]);

  if (gone && !open) return null;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[calc(100dvh-3rem)] flex-col rounded-card border border-rule bg-paper p-6 shadow-lift`}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

let toastSeq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const push = (text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  const el = toasts.length ? (
    <div className="pointer-events-none fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-pill px-4 py-2 text-sm text-white shadow-lift ${
            t.tone === 'success' ? 'bg-ink' : 'bg-danger'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  ) : null;
  return { toasts: el, push };
}
