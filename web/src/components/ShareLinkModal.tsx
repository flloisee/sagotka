import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import type { Form } from '@sagotka/shared';
import { api } from '../api';
import { Button, ErrorText, Input, Modal, useToasts } from './ui';

type ShareableForm = Pick<Form, 'id' | 'title' | 'alias' | 'settings'>;

const ALIAS_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function ShareLinkModal({
  open,
  onClose,
  form,
  onUpdate,
  onUnpublish,
}: {
  open: boolean;
  onClose: () => void;
  form: ShareableForm | null;
  onUpdate: (updated: Form) => void;
  onUnpublish?: () => void;
}) {
  const { toasts, push } = useToasts();
  const [aliasInput, setAliasInput] = useState('');
  const [aliasError, setAliasError] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);

  useEffect(() => {
    if (!open || !form) return;
    setAliasInput(form.alias ?? '');
    setAliasError('');
  }, [open, form]);

  if (!form) return null;

  const origin = window.location.origin;
  const originPath = origin.replace(/^https?:\/\//, '');
  const fillUrl = `${origin}/f/${form.id}`;
  const aliasUrl = form.alias ? `${origin}/f/${form.alias}` : null;
  const displayUrl = aliasUrl ?? fillUrl;

  const copy = () => {
    navigator.clipboard?.writeText(displayUrl).catch(() => {});
    push('Fill link copied.');
  };

  const saveAlias = async () => {
    const value = aliasInput.trim();
    if (value && !ALIAS_RE.test(value)) {
      setAliasError('Use lowercase letters, numbers, and hyphens.');
      return;
    }
    if (value && UUID_RE.test(value)) {
      setAliasError('This alias is reserved.');
      return;
    }
    setAliasSaving(true);
    setAliasError('');
    try {
      const updated = await api.setAlias(form.id, value ? value.toLowerCase() : null);
      onUpdate(updated);
      push(value ? 'Short link saved.' : 'Short link removed.');
    } catch (e) {
      setAliasError(e instanceof Error ? e.message : 'Could not save the short link.');
    } finally {
      setAliasSaving(false);
    }
  };

  if (!form.settings.published) {
    return (
      <Modal open={open} onClose={onClose} onEnter={onClose} title="Almost there">
        <p className="text-sm text-ink-2">
          This form isn&apos;t published yet. Publishing creates a public fill link
          that anyone can open.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} onEnter={copy} title="Share this form">
      <p className="text-sm text-ink-2">Anyone with this link can fill it in:</p>
      <div className="mt-3 flex items-center gap-2">
        <Input readOnly value={displayUrl} onFocus={(e) => e.target.select()} className="min-w-0" />
        <Button onClick={copy}>Copy</Button>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-input border border-rule bg-paper-2 p-4">
        <div>
          <label htmlFor="alias-input" className="text-[13px] font-medium text-ink-2">
            Custom short link
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="label-mono min-w-0 truncate text-muted">{originPath}/f/</span>
            <Input
              id="alias-input"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value.toLowerCase())}
              placeholder="e.g. team-lunch"
              maxLength={50}
              autoComplete="off"
              className="min-w-0"
            />
            <Button size="sm" variant="secondary" onClick={saveAlias} loading={aliasSaving}>
              {form.alias ? 'Update' : 'Save'}
            </Button>
          </div>
          {aliasError ? <ErrorText>{aliasError}</ErrorText> : null}
          {!aliasError ? (
            <p className="mt-1.5 text-xs text-muted">
              A memorable link you control. The unique form link always stays valid.
            </p>
          ) : null}
        </div>
      </div>

      {onUnpublish ? (
        <div className="mt-5 flex items-center gap-2 rounded-input bg-paper-2 px-3.5 py-3">
          <XCircle className="size-4.5 shrink-0 text-danger" />
          <span className="text-sm text-ink-2">Stop collecting responses and unpublish.</span>
          <button onClick={onUnpublish} className="ml-auto shrink-0 text-sm font-medium text-danger hover:underline">
            Unpublish
          </button>
        </div>
      ) : null}

      {toasts}
    </Modal>
  );
}