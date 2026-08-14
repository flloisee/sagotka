import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Button, ErrorText, Field, Input } from '../components/ui';
import { Logo } from '../components/Logo';

export function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const completeLogin = async (withCode: string | null) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.login(
        email,
        password,
        withCode ? withCode : undefined,
      );
      if ('requiresOtp' in result) {
        setOtpRequired(true);
        return;
      }
      setUser(result.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (otpRequired && !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    await completeLogin(otpRequired ? code : null);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Logo size="lg" className="mb-8 self-center" />

      <div className="rounded-card border border-rule bg-paper p-6 shadow-card sm:p-8">
        <p className="label-mono mb-1 text-accent">Welcome back</p>
        <h1 className="text-display">{otpRequired ? 'Verify it’s you' : 'Sign in to SagotKa'}</h1>
        <p className="mt-2 text-sm text-muted">
          {otpRequired
            ? `We emailed a 6-digit code to ${email}.`
            : 'Access your forms and shared workspaces.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {!otpRequired ? (
            <>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Verification code" hint="Check your email for the 6-digit code.">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  required
                  autoFocus
                />
              </Field>
              <button
                type="button"
                className="-mt-1 self-start text-sm font-medium text-accent hover:text-accent-2 disabled:opacity-50"
                disabled={loading}
                onClick={() => completeLogin(null)}
              >
                Resend code
              </button>
            </>
          )}

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button type="submit" size="lg" full loading={loading} className="mt-2">
            {otpRequired ? 'Verify code' : 'Sign in'}
          </Button>
        </form>

        {!otpRequired ? (
          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="font-medium text-accent hover:text-accent-2">
              Forgot password?
            </Link>
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-accent hover:text-accent-2">
          Create one
        </Link>
      </p>
    </main>
  );
}