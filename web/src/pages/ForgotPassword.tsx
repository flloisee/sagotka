import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { executeCaptcha, captchaSiteKey } from '../recaptcha';
import { Button, ErrorText, Field, Input } from '../components/ui';
import { Logo } from '../components/Logo';

type Step = 'email' | 'code' | 'done';

export function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const token = captchaSiteKey() ? await executeCaptcha('password_reset') : undefined;
      await api.requestOtp(email, 'reset_password', token);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const token = captchaSiteKey() ? await executeCaptcha('password_reset') : undefined;
      await api.resetPassword(email, code, newPassword, token);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Logo size="lg" className="mb-8 self-center" />

      <div className="rounded-card border border-rule bg-paper p-6 shadow-card sm:p-8">
        {step === 'email' ? (
          <>
            <p className="label-mono mb-1 text-accent">Reset password</p>
            <h1 className="text-display">Forgot your password?</h1>
            <p className="mt-2 text-sm text-muted">
              Enter the email on your account and we’ll send a reset code.
            </p>
            <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
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
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button type="submit" size="lg" full loading={loading} className="mt-2">
                Send reset code
              </Button>
            </form>
          </>
        ) : step === 'code' ? (
          <>
            <p className="label-mono mb-1 text-accent">Reset password</p>
            <h1 className="text-display">Enter the code</h1>
            <p className="mt-2 text-sm text-muted">A 6-digit code was emailed to you.</p>
            <form onSubmit={reset} className="mt-6 flex flex-col gap-4">
              <Field label="Verification code">
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
                />
              </Field>
              <Field label="New password" hint="At least 8 characters.">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button type="submit" size="lg" full loading={loading} className="mt-2">
                Reset password
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="label-mono mb-1 text-accent">All done</p>
            <h1 className="text-display">Password reset</h1>
            <p className="mt-2 text-sm text-muted">
              Your password has been updated and you’ve been signed out everywhere.
            </p>
            <Link to="/login">
              <Button size="lg" full className="mt-6">
                Back to sign in
              </Button>
            </Link>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-accent hover:text-accent-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}