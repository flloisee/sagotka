import type {
  Form,
  FormListItem,
  FormUpdateInput,
  PublicForm,
  FormResponse,
  SubmitResult,
  Summary,
  FileRef,
  AnswerValue,
  User,
  AuthResult,
  ShareGrant,
  OtpPurpose,
  QuizSubmitPayload,
} from '@sagotka/shared';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = 'Request failed.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type LoginResult = AuthResult | { requiresOtp: true; email: string };

export const api = {
  register: (email: string, password: string, code: string, recaptchaToken?: string) =>
    request<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, code, recaptchaToken }),
    }),
  requestOtp: (email: string, purpose: OtpPurpose, recaptchaToken?: string) =>
    request<{ sent: boolean }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, recaptchaToken }),
    }),
  verifyOtp: (email: string, code: string, recaptchaToken?: string) =>
    request<{ verified: boolean }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, recaptchaToken }),
    }),
  login: (email: string, password: string, recaptchaToken?: string, code?: string) =>
    request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, code, recaptchaToken }),
    }),
  resetPassword: (email: string, code: string, newPassword: string, recaptchaToken?: string) =>
    request<void>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword, recaptchaToken }),
    }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<AuthResult>('/api/auth/me'),
  searchUsers: (q: string) =>
    request<User[]>(`/api/auth/users?q=${encodeURIComponent(q)}`),
  listShares: (id: string) => request<ShareGrant[]>(`/api/forms/${id}/shares`),
  shareForm: (id: string, email: string) =>
    request<ShareGrant[]>(`/api/forms/${id}/shares`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  unshareForm: (id: string, userId: string) =>
    request<void>(`/api/forms/${id}/shares/${userId}`, { method: 'DELETE' }),

  listForms: () => request<FormListItem[]>('/api/forms'),
  createForm: (title?: string, mode?: 'form' | 'quiz') =>
    request<Form>('/api/forms', { method: 'POST', body: JSON.stringify({ title, mode }) }),
  getForm: (id: string) => request<Form & { responseCount: number }>(`/api/forms/${id}`),
  updateForm: (id: string, patch: FormUpdateInput) =>
    request<Form>(`/api/forms/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteForm: (id: string) =>
    request<void>(`/api/forms/${id}`, { method: 'DELETE' }),
  deleteResponse: (formId: string, responseId: string) =>
    request<void>(`/api/forms/${formId}/responses/${responseId}`, { method: 'DELETE' }),
  duplicateForm: (id: string) =>
    request<Form>(`/api/forms/${id}/duplicate`, { method: 'POST' }),

  getPublicForm: (id: string) => request<PublicForm>(`/api/f/${id}`),
  startQuizSession: (id: string) =>
    request<{ sessionToken: string; startedAt: number }>(`/api/f/${id}/quiz/start`, {
      method: 'POST',
    }),
  submitResponse: (
    id: string,
    answers: Record<string, AnswerValue>,
    quiz?: QuizSubmitPayload,
  ) =>
    request<SubmitResult>(`/api/f/${id}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        answers,
        ...(quiz ? { quizSessionToken: quiz.sessionToken, events: quiz.events } : {}),
      }),
    }),
  getEditableResponse: (id: string, responseId: string, token: string) =>
    request<FormResponse>(`/api/f/${id}/responses/${responseId}?token=${encodeURIComponent(token)}`),
  updateResponse: (
    id: string,
    responseId: string,
    token: string,
    answers: Record<string, AnswerValue>,
  ) =>
    request<FormResponse>(`/api/f/${id}/responses/${responseId}`, {
      method: 'PUT',
      body: JSON.stringify({ token, answers }),
    }),

  listResponses: (id: string) => request<FormResponse[]>(`/api/forms/${id}/responses`),
  summary: (id: string) => request<Summary>(`/api/forms/${id}/summary`),
  uploadFiles: async (id: string, files: File[]): Promise<FileRef[]> => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`/api/forms/${id}/uploads`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      let message = 'Upload failed.';
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, message);
    }
    return (await res.json()) as FileRef[];
  },
};
