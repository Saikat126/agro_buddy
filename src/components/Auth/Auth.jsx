import React, { useState } from 'react';
import './Auth.css';
import { signIn, signUp, requestPasswordReset, resetPassword } from './AuthAPI';

const logo = process.env.PUBLIC_URL + '/logo.png';

// forceMode — when 'reset', skip the tabs and show the set-new-password form.
//             Passed by App.jsx after finding a ?token= in the URL.
// resetToken — the token from that URL, submitted alongside the new password.
// onResetDone — called after a successful password update so App.jsx can hide the overlay.
// onCancel — when provided, shows a close button so the page can be dismissed without signing in
//            (e.g. a guest who opened it from the navbar and wants to keep browsing).
export default function Auth({ onAuthSuccess, forceMode, resetToken, onResetDone, onCancel }) {

  const [mode, setMode] = useState(forceMode || 'signin');

  const [fields, setFields] = useState({
    name:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });

  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(newMode) {
    if (newMode === mode) return;
    setMode(newMode);
    setFields({ name: '', email: '', password: '', confirmPassword: '' });
    setError('');
    setSuccess('');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setError('');
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // Chrome (and others) will silently auto-populate a saved credential into a matching
  // field the instant the page loads. Making the field readOnly until it's focused stops
  // that auto-fill-on-load while still letting the browser offer its suggestion dropdown
  // once the user actually clicks/taps into the field — same as most other sites.
  function preventAutoFill(e) {
    e.target.removeAttribute('readonly');
  }

  function validate() {
    if (mode === 'signup' && !fields.name.trim()) return 'Please enter your full name.';
    if (!fields.email.trim()) return 'Please enter your email address.';
    if (!/\S+@\S+\.\S+/.test(fields.email)) return 'Please enter a valid email address.';
    if (mode !== 'forgot') {
      if (fields.password.length < 6) return 'Password must be at least 6 characters.';
      if (mode === 'signup' && fields.password !== fields.confirmPassword) return 'Passwords do not match.';
      if (mode === 'reset' && fields.password !== fields.confirmPassword) return 'Passwords do not match.';
    }
    return '';
  }

  // ── Sign in / Sign up ─────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    try {
      setLoading(true);
      setError('');
      if (mode === 'signin') {
        const { user } = await signIn(fields.email, fields.password);
        onAuthSuccess?.(user);
      } else {
        const { user } = await signUp(fields.email, fields.password, fields.name);
        onAuthSuccess?.(user);
      }
    } catch (err) {
      setError(
        mode === 'signin'
          ? 'Invalid email or password.'
          : 'Could not create account. Try a different email.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault();
    if (!fields.email.trim() || !/\S+@\S+\.\S+/.test(fields.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await requestPasswordReset(fields.email);
      setSuccess('Reset link sent! Check your inbox and click the link to set a new password.');
    } catch (err) {
      setError('Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Set new password (recovery mode) ─────────────────────────────────────
  async function handleReset(e) {
    e.preventDefault();
    if (fields.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (fields.password !== fields.confirmPassword) { setError('Passwords do not match.'); return; }
    try {
      setLoading(true);
      setError('');
      await resetPassword(resetToken, fields.password);
      setSuccess('Password updated! You can now login with your new password.');
      setTimeout(() => onResetDone?.(), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const pageStyle = {
    backgroundImage: `linear-gradient(135deg, rgba(15,36,23,0.65) 0%, rgba(13,51,32,0.55) 100%), url(${process.env.PUBLIC_URL}/hero.jpeg)`,
  };

  return (
    <div className="auth-page" style={pageStyle}>
      <div className="auth-card">

        {onCancel && (
          <button className="auth-close-btn" onClick={onCancel} type="button" aria-label="Close">
            ✕
          </button>
        )}

        <div className="auth-brand">
          <img src={logo} alt="Agro Buddy" className="auth-logo" />
          <h1 className="auth-app-name">Agro Buddy</h1>
          <p className="auth-tagline">Your smart farm management companion</p>
        </div>

        {/* Tabs — hidden in forgot/reset modes */}
        {mode !== 'forgot' && mode !== 'reset' && (
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')} type="button">Login</button>
            <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')} type="button">Sign Up</button>
          </div>
        )}

        {/* Forgot password heading */}
        {mode === 'forgot' && (
          <div className="auth-mode-header">
            <h2 className="auth-mode-title">Forgot Password</h2>
            <p className="auth-mode-sub">Enter your email and we'll send you a reset link.</p>
          </div>
        )}

        {/* Reset password heading */}
        {mode === 'reset' && (
          <div className="auth-mode-header">
            <h2 className="auth-mode-title">Set New Password</h2>
            <p className="auth-mode-sub">Choose a new password for your account.</p>
          </div>
        )}

        {/* ── Sign in / Sign up form ── */}
        {(mode === 'signin' || mode === 'signup') && (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="auth-label">
                Full Name
                <input className="input-field" type="text" name="name" value={fields.name} onChange={handleChange} placeholder="e.g. Ahmed Rahman" autoComplete="name" readOnly onFocus={preventAutoFill} />
              </label>
            )}
            <label className="auth-label">
              Email Address
              <input className="input-field" type="email" name="email" value={fields.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" readOnly onFocus={preventAutoFill} />
            </label>
            <label className="auth-label">
              Password
              <input className="input-field" type="password" name="password" value={fields.password} onChange={handleChange} placeholder="Minimum 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} readOnly onFocus={preventAutoFill} />
            </label>
            {mode === 'signup' && (
              <label className="auth-label">
                Confirm Password
                <input className="input-field" type="password" name="confirmPassword" value={fields.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" autoComplete="new-password" readOnly onFocus={preventAutoFill} />
              </label>
            )}

            {/* Forgot password link — only in sign-in mode */}
            {mode === 'signin' && (
              <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}

            {error   && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading
                ? (mode === 'signin' ? 'Logging in…' : 'Creating account…')
                : (mode === 'signin' ? 'Login' : 'Create Account')}
            </button>
          </form>
        )}

        {/* ── Forgot password form ── */}
        {mode === 'forgot' && (
          <form className="auth-form" onSubmit={handleForgot}>
            <label className="auth-label">
              Email Address
              <input className="input-field" type="email" name="email" value={fields.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" readOnly onFocus={preventAutoFill} />
            </label>

            {error   && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            {!success && (
              <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            )}
          </form>
        )}

        {/* ── Set new password form ── */}
        {mode === 'reset' && (
          <form className="auth-form" onSubmit={handleReset}>
            <label className="auth-label">
              New Password
              <input className="input-field" type="password" name="password" value={fields.password} onChange={handleChange} placeholder="Minimum 6 characters" autoComplete="new-password" readOnly onFocus={preventAutoFill} />
            </label>
            <label className="auth-label">
              Confirm New Password
              <input className="input-field" type="password" name="confirmPassword" value={fields.confirmPassword} onChange={handleChange} placeholder="Re-enter new password" autoComplete="new-password" readOnly onFocus={preventAutoFill} />
            </label>

            {error   && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            {!success && (
              <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            )}
          </form>
        )}

        {/* Bottom nav — back to sign in for forgot mode */}
        {mode === 'forgot' && (
          <p className="auth-switch">
            <button className="auth-switch-btn" onClick={() => switchMode('signin')} type="button">← Back to Login</button>
          </p>
        )}

        {/* Let the user request a fresh link if the reset session has expired */}
        {mode === 'reset' && error && (
          <p className="auth-switch">
            <button className="auth-switch-btn" onClick={() => switchMode('forgot')} type="button">
              Request a new reset link
            </button>
          </p>
        )}

        {/* Bottom nav — sign in / sign up toggle */}
        {(mode === 'signin' || mode === 'signup') && (
          <p className="auth-switch">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button className="auth-switch-btn" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} type="button">
              {mode === 'signin' ? 'Sign Up' : 'Login'}
            </button>
          </p>
        )}

      </div>
    </div>
  );
}
