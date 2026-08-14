import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, FilePlus2, GraduationCap, Search, Share2, Trash2, Users, X } from 'lucide-react';
import type { FormListItem, ShareGrant } from '@sagotka/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatDate } from '../lib';
import { ShareLinkModal } from '../components/ShareLinkModal';
import {
  Badge,
  Button,
  ErrorText,
  IconButton,
  Input,
  Modal,
  Spinner,
  useToasts,
} from '../components/ui';

export function Dashboard() {
  const { user } = useAuth();
  const [forms, setForms] = useState<FormListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<FormListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareForm, setShareForm] = useState<FormListItem | null>(null);
  const [linkForm, setLinkForm] = useState<FormListItem | null>(null);
  const navigate = useNavigate();
  const { toasts, push } = useToasts();

  useEffect(() => {
    api.listForms().then(setForms).catch(() => push('Could not load forms.', 'error'));
  }, []);

  const filtered = useMemo(() => {
    if (!forms) return null;
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.title.toLowerCase().includes(q));
  }, [forms, query]);

  const createForm = async () => {
    const form = await api.createForm();
    navigate(`/forms/${form.id}`);
  };

  const createQuiz = async () => {
    const form = await api.createForm(undefined, 'quiz');
    navigate(`/forms/${form.id}`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteForm(toDelete.id);
      setForms((prev) => prev?.filter((f) => f.id !== toDelete.id) ?? null);
      push('Form deleted.');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const copyLink = (form: FormListItem) => {
    setLinkForm(form);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-mono mb-2 text-accent">Workspace</p>
          <h1 className="text-display">Your forms</h1>
          <p className="mt-2 text-muted">
            {forms
              ? `${forms.length} form${forms.length === 1 ? '' : 's'} · publish to share a fill link`
              : 'Loading your forms…'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="lg" variant="secondary" onClick={createQuiz}>
            <GraduationCap className="size-4" />
            New quiz
          </Button>
          <Button size="lg" onClick={createForm}>
            <FilePlus2 className="size-4" />
            New form
          </Button>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search forms…"
          className="pl-10"
          aria-label="Search forms"
        />
      </div>

      {filtered === null ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasForms={!!forms?.length} onCreate={createForm} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              isOwner={f.ownerId === user?.id}
              onOpen={() => navigate(`/forms/${f.id}`)}
              onCopy={() => copyLink(f)}
              onDelete={() => setToDelete(f)}
              onShare={() => setShareForm(f)}
            />
          ))}
        </div>
      )}

      {toasts}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} onEnter={confirmDelete} title="Delete form?">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{toDelete?.title}</span> and its{' '}
          {toDelete?.responseCount ?? 0} response{toDelete?.responseCount === 1 ? '' : 's'} will be permanently removed.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>
            Delete form
          </Button>
        </div>
      </Modal>

      <ShareFormModal
        form={shareForm}
        isOpen={!!shareForm}
        onClose={() => setShareForm(null)}
      />

      <ShareLinkModal
        open={!!linkForm}
        onClose={() => setLinkForm(null)}
        form={linkForm}
        onUpdate={(updated) =>
          setForms((prev) =>
            prev?.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)) ?? null,
          )
        }
      />
    </main>
  );
}

function FormCard({
  form,
  isOwner,
  onOpen,
  onCopy,
  onDelete,
  onShare,
}: {
  form: FormListItem;
  isOwner: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const status = form.settings.published
    ? form.settings.acceptsResponses
      ? { label: 'Open', tone: 'success' as const }
      : { label: 'Closed', tone: 'danger' as const }
    : { label: 'Draft', tone: 'neutral' as const };

  return (
    <article
      onClick={onOpen}
      className="group flex flex-col cursor-pointer rounded-card border border-rule bg-paper p-5 shadow-card transition-all duration-150 ease-out-expo hover:-translate-y-px hover:shadow-lift"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {form.shared && isOwner === false ? (
            <Badge tone="accent">Shared</Badge>
          ) : null}
        </div>
        <span className="label-mono text-muted">{formatDate(form.updatedAt)}</span>
      </div>

      <button type="button" className="text-left">
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight text-ink group-hover:text-accent">
          {form.title}
        </h3>
        {form.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{form.description}</p>
        ) : null}
      </button>

      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="label-mono text-muted">
          {form.responseCount} response{form.responseCount === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <Link
            to={`/forms/${form.id}/responses`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors hover:bg-paper-3 hover:text-ink"
            aria-label="View responses"
            title="Responses"
          >
            <BarChart3 className="size-4" />
          </Link>
          {isOwner ? (
            <>
              <IconButton label="Add collaborators" onClick={(e) => { e.stopPropagation(); onShare(); }}>
                <Users className="size-4" />
              </IconButton>
              <IconButton label="Share link" onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                <Share2 className="size-4" />
              </IconButton>
              <IconButton label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="size-4" />
              </IconButton>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ShareFormModal({
  form,
  isOpen,
  onClose,
}: {
  form: FormListItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const { push } = useToasts();

  useEffect(() => {
    if (!isOpen || !form) return;
    setQ('');
    setResults([]);
    setError('');
    api.listShares(form.id).then(setShares).catch(() => setShares([]));
  }, [isOpen, form]);

  if (!form) return null;

  const search = async (term: string) => {
    setQ(term);
    const t = term.trim();
    if (!t) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const users = await api.searchUsers(t);
      setResults(users);
      setError('');
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const grant = async (email: string) => {
    try {
      const next = await api.shareForm(form.id, email);
      setShares(next);
      setQ('');
      setResults([]);
      push(`Shared "${form.title}" with ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the form.');
    }
  };

  const revoke = async (userId: string) => {
    try {
      await api.unshareForm(form.id, userId);
      setShares((prev) => prev.filter((s) => s.userId !== userId));
      push('Access removed.');
    } catch {
      setError('Could not remove access.');
    }
  };

  const alreadyShared = (email: string) => shares.some((s) => s.email === email);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      onEnter={results.length ? () => grant(results[0].email) : undefined}
      title={`Share “${form.title}”`}
      wide
    >
      <p className="text-sm text-muted">
        People you share with can view responses and open the form, but cannot edit or delete it.
      </p>

      <div className="mt-5">
        <label htmlFor="share-search" className="text-[13px] font-medium text-ink-2">
          Share with a user by email
        </label>
        <div className="relative mt-1.5">
          <Input
            id="share-search"
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="you@example.com"
            autoComplete="off"
          />
          {searching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">…</span>
          ) : null}
        </div>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {results.length > 0 ? (
        <ul className="mt-3 overflow-hidden rounded-input border border-rule bg-paper-2">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between border-b border-rule px-3 py-2 last:border-b-0">
              <span className="text-sm text-ink">{u.email}</span>
              {alreadyShared(u.email) ? (
                <span className="label-mono text-xs text-muted">Shared</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => grant(u.email)}>
                  Share
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : q.trim() && !searching ? (
        <p className="mt-3 text-sm text-muted">No matching users.</p>
      ) : null}

      <div className="mt-5">
        <p className="label-mono mb-2 text-muted">Currently shared with</p>
        {shares.length === 0 ? (
          <p className="text-sm text-muted">Not shared with anyone yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-input border border-rule">
            {shares.map((s) => (
              <li key={s.userId} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-ink">{s.email}</span>
                <IconButton label="Remove access" onClick={() => revoke(s.userId)}>
                  <X className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function EmptyState({ hasForms, onCreate }: { hasForms: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-rule-2 px-6 py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-3">
        <FilePlus2 className="size-6 text-accent" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        {hasForms ? 'No matching forms' : 'Your first form starts here'}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {hasForms
          ? 'Try a different search term.'
          : 'Create a form, add questions, hit publish — and a shareable fill link is ready.'}
      </p>
      {hasForms ? null : (
        <Button size="lg" className="mt-6" onClick={onCreate}>
          <FilePlus2 className="size-4" />
          Create your first form
        </Button>
      )}
    </div>
  );
}
