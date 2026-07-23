import React, { useState, useId, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store';

/**
 * LoginPage — /login and /signup
 *
 * DESIGN_SPEC.md §16:
 * "One screen, mode toggle in the corner. Auth is friction — the design's job is to minimize it."
 *
 * "The form sits in a 400px column, vertically centered, on the live twilight surface.
 *  Fields are underlined, not boxed. Labels sit above in mono micro uppercase.
 *  Errors appear inline beneath the field in ember-600."
 *
 * "The submit button is the one place in the product where ember-600 fills a solid shape."
 */

type Mode = 'login' | 'signup';

interface FieldError {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const setUser = useAppStore((s) => s.setUser);

  const modeParam = searchParams.get('mode');
  const mode: Mode = modeParam === 'signup' ? 'signup' : 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);

  // Unique IDs for accessibility
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();
  const generalErrorId = useId();

  // On mode switch, clear errors (not the email field — UX convenience)
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    emailRef.current?.focus();
  }, [mode]);

  const switchMode = (): void => {
    setSearchParams({ mode: mode === 'login' ? 'signup' : 'login' });
  };

  const validate = (): boolean => {
    const next: FieldError = {};

    if (!email.includes('@')) {
      next.email = 'Enter a valid email address.';
    }
    if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (mode === 'signup' && password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // include httpOnly refresh cookie
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          accessToken: string;
          user: { id: string; email: string };
        };
        setUser({
          id: data.user.id,
          email: data.user.email,
          accessToken: data.accessToken,
        });
        navigate('/');
        return;
      }

      const data = (await res.json()) as { error?: string };

      // §16 inline errors — state what happened and what to do
      if (mode === 'login' && (res.status === 401 || res.status === 400)) {
        setErrors({
          general: 'Incorrect email or password.',
        });
      } else if (res.status === 409 || data.error?.includes('already')) {
        setErrors({
          email: 'That email is already registered. Log in instead?',
        });
      } else if (res.status >= 400 && res.status < 500) {
        setErrors({ general: data.error ?? 'Something went wrong. Try again.' });
      } else {
        setErrors({ general: 'Something went wrong. Try again in a moment.' });
      }
    } catch {
      setErrors({ general: "We can't reach the server right now. Check your connection." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4"
      aria-labelledby="auth-heading"
    >
      {/* Mode toggle — corner, reads as part of the line per §16 */}
      <div className="w-full max-w-[400px] flex justify-end mb-8">
        <button
          type="button"
          onClick={switchMode}
          className="type-micro text-sky-400 hover:text-sky-100 transition-colors"
          style={{ transitionDuration: 'var(--dur-micro)' }}
        >
          {mode === 'login' ? 'CREATE ACCOUNT' : 'LOG IN INSTEAD'}
        </button>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-[400px] flex flex-col gap-8"
        aria-labelledby="auth-heading"
        aria-describedby={errors.general ? generalErrorId : undefined}
        noValidate
      >
        {/* Heading */}
        <h1 id="auth-heading" className="type-title text-sky-100" aria-live="polite">
          {mode === 'login' ? 'Log in to ASTRANET' : 'Create your account'}
        </h1>

        {/* Email field — underlined, not boxed */}
        <div className="flex flex-col gap-2">
          <label htmlFor={emailId} className="type-micro text-brass-500">
            EMAIL
          </label>
          <input
            ref={emailRef}
            id={emailId}
            type="email"
            autoComplete={mode === 'login' ? 'email' : 'email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={[
              'bg-transparent border-0 border-b pb-2',
              'type-body text-sky-100',
              'focus:outline-none focus:ring-0',
              errors.email ? 'border-b-ember-600' : 'border-b-sky-600 focus:border-b-brass-300',
            ].join(' ')}
            style={{
              borderBottomColor: errors.email ? '#C4362A' : undefined,
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              transition: `border-color var(--dur-micro) var(--ease-micro)`,
            }}
          />
          {errors.email ? (
            <p id={emailErrorId} role="alert" className="type-caption" style={{ color: '#C4362A' }}>
              {errors.email}
              {errors.email.includes('Log in instead') ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="underline"
                    style={{
                      color: '#C4362A',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSearchParams({ mode: 'login' })}
                  >
                    Log in
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-2">
          <label htmlFor={passwordId} className="type-micro text-brass-500">
            PASSWORD
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            className="bg-transparent border-0 border-b pb-2 type-body text-sky-100 focus:outline-none focus:ring-0"
            style={{
              borderBottomColor: errors.password ? '#C4362A' : '#3E4A4A',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              transition: `border-color var(--dur-micro) var(--ease-micro)`,
            }}
          />
          {errors.password ? (
            <p
              id={passwordErrorId}
              role="alert"
              className="type-caption"
              style={{ color: '#C4362A' }}
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        {/* Confirm password — signup only */}
        {mode === 'signup' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={confirmPasswordId} className="type-micro text-brass-500">
              CONFIRM PASSWORD
            </label>
            <input
              id={confirmPasswordId}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? confirmPasswordErrorId : undefined}
              className="bg-transparent border-0 border-b pb-2 type-body text-sky-100 focus:outline-none focus:ring-0"
              style={{
                borderBottomColor: errors.confirmPassword ? '#C4362A' : '#3E4A4A',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                transition: `border-color var(--dur-micro) var(--ease-micro)`,
              }}
            />
            {errors.confirmPassword ? (
              <p
                id={confirmPasswordErrorId}
                role="alert"
                className="type-caption"
                style={{ color: '#C4362A' }}
              >
                {errors.confirmPassword}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* General error — §16: "errors state what happened and what to do" */}
        {errors.general ? (
          <p
            id={generalErrorId}
            role="alert"
            className="type-caption mt-2"
            style={{ color: '#C4362A' }} /* ember-600 */
          >
            {errors.general}
            {errors.general.includes('Log in') ? (
              <>
                {' '}
                <Link
                  to="/login?mode=login"
                  className="underline"
                  style={{ color: '#C4362A' }}
                  onClick={() => setSearchParams({ mode: 'login' })}
                >
                  Log in
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {/* Submit — §16: "the one place where ember-600 fills a solid shape" */}
        <button
          type="submit"
          disabled={submitting}
          className="type-micro text-sky-100 rounded-md py-3 px-6 mt-2"
          style={{
            backgroundColor: submitting
              ? '#7E241C'
              : '#C4362A' /* ember-800 when disabled, ember-600 normally */,
            cursor: submitting ? 'not-allowed' : 'pointer',
            border: 'none',
            transition: `background-color var(--dur-micro) var(--ease-micro)`,
          }}
          aria-disabled={submitting}
        >
          {submitting
            ? mode === 'login'
              ? 'LOGGING IN...'
              : 'CREATING ACCOUNT...'
            : mode === 'login'
              ? 'LOG IN'
              : 'CREATE ACCOUNT'}
        </button>
      </form>
    </main>
  );
}
