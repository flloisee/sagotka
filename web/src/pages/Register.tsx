import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { executeCaptcha, captchaSiteKey } from '../recaptcha';
import { Button, ErrorText, Field, Input } from '../components/ui';
import { Logo } from '../components/Logo';

export function Register() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (sending || loading) return;
    setError('');
    setSending(true);
    try {
      const token = captchaSiteKey() ? await executeCaptcha('register') : undefined;
      await api.requestOtp(email, 'verify_email', token);
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (verifying || loading) return;
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }
    setVerifying(true);
    try {
      const token = captchaSiteKey() ? await executeCaptcha('register') : undefined;
      await api.verifyOtp(email, code, token);
      setCodeVerified(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }
    setLoading(true);
    try {
      const token = captchaSiteKey() ? await executeCaptcha('register') : undefined;
      const { user } = await api.register(email, password, code, token);
      setUser(user);
      navigate('/');
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
        <p className="label-mono mb-1 text-accent">Create an account</p>
        <h1 className="text-display">Get started</h1>
        <p className="mt-2 text-sm text-muted">Build forms, collect responses, and share with your team.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={codeSent}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={sending}
              disabled={!email || codeSent}
              onClick={sendCode}
            >
              {codeSent ? 'Code sent' : 'Send verification code'}
            </Button>
          </div>

          {codeSent ? (
            <>
              <Field label="Verification code" hint="A 6-digit code was emailed to you.">
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
                  readOnly={codeVerified}
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  loading={verifying}
                  disabled={!code || codeVerified}
                  onClick={verifyCode}
                >
                  {codeVerified ? 'Code verified' : 'Verify code'}
                </Button>
              </div>

              {codeVerified ? (
                <>
                  <Field label="Password" hint="At least 8 characters.">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </Field>
                  <Field label="Confirm password">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </Field>
                </>
              ) : null}
            </>
          ) : null}

          {error ? <ErrorText>{error}</ErrorText> : null}

          {codeSent && codeVerified ? (
            <Button type="submit" size="lg" full loading={loading} className="mt-2">
              Create account
            </Button>
          ) : null}
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent hover:text-accent-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}