import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FilePenLine } from 'lucide-react';
import type { AnswerValue, PublicForm, QuizSubmitPayload } from '@sagotka/shared';
import { api } from '../api';
import { FillForm } from '../components/FillForm';
import { Spinner } from '../components/ui';
import { Logo } from '../components/Logo';

export function Fill() {
  const { id, responseId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const editMode = Boolean(responseId);

  const [form, setForm] = useState<PublicForm | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, AnswerValue> | undefined>();
  const [editLink, setEditLink] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await api.getPublicForm(id!);
        if (cancelled) return;
        setForm(f);
        if (editMode) {
          setLoadingEdit(true);
          try {
            const resp = await api.getEditableResponse(id!, responseId!, token);
            if (cancelled) return;
            setInitialAnswers(resp.answers);
          } catch (e) {
            if (!cancelled) setLoadError((e as Error).message);
          } finally {
            if (!cancelled) setLoadingEdit(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message || 'This form is not available.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, editMode, responseId, token]);

  const submit = async (
    answers: Record<string, AnswerValue>,
    quiz?: QuizSubmitPayload,
  ) => {
    if (editMode) {
      return api.updateResponse(id!, responseId!, token, answers);
    }
    const result = await api.submitResponse(id!, answers, quiz);
    if (form?.settings.allowEditResponses && !form?.settings.quiz) {
      setEditLink(
        `/f/${id}/edit/${result.responseId}?token=${encodeURIComponent(result.editToken)}`,
      );
    }
    return result;
  };

  if (loading) {
    return (
      <FillShell>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </FillShell>
    );
  }

  if (loadError || !form) {
    return (
      <FillShell>
        <div className="rounded-card border border-rule bg-paper p-10 text-center shadow-card">
          <h1 className="text-display">Form unavailable</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            {loadError ?? 'This form could not be found, or the link is not valid.'}
          </p>
        </div>
      </FillShell>
    );
  }

  if (!form.settings.acceptsResponses) {
    return (
      <FillShell>
        <div className="rounded-card border border-rule bg-paper p-10 text-center shadow-card">
          <FilePenLine className="mx-auto mb-5 size-9 text-muted" />
          <h1 className="text-display">Responses are closed</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            This form is no longer accepting responses.
          </p>
        </div>
      </FillShell>
    );
  }

  if (form.settings.limitToOneResponse && !editMode && form.hasResponded) {
    return (
      <FillShell>
        <div className="rounded-card border border-rule bg-paper p-10 text-center shadow-card">
          <FilePenLine className="mx-auto mb-5 size-9 text-muted" />
          <h1 className="text-display">Already responded</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            You have already responded to this form. Each person can only respond once.
          </p>
        </div>
      </FillShell>
    );
  }

  return (
    <FillShell>
      {editMode && loadingEdit ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <FillForm
          form={form}
          editMode={editMode}
          editLink={editLink}
          initialAnswers={initialAnswers}
          onSubmit={submit}
          startQuizSession={() => api.startQuizSession(form.id)}
          uploadFiles={(files) => api.uploadFiles(form.id, files)}
        />
      )}
    </FillShell>
  );
}

function FillShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="flex justify-center py-6">
        <Logo size="sm" className="px-3 py-1.5" />
      </div>
      <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
