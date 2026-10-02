import React, { useState, useEffect } from 'react';
import './Auth.css';
import { signIn, signUp, requestPasswordReset, resetPassword, verifyEmail, resendVerification, checkUsernameAvailable } from './AuthAPI';
import { capitalizedValue } from '../shared/textCase';

const logo = process.env.PUBLIC_URL + '/logo.png';

// Cross-tab channel name used so the "check your email" tab can hear about
// verification finishing in a different tab (see the two effects below).
const VERIFY_CHANNEL = 'agro-buddy-email-verified';

// forceMode — 'reset' skips the tabs and shows the set-new-password form
//             (App.jsx passes this after finding a ?token= in the URL);
//             'verify' skips the tabs and shows a static confirmation message
//             for an email-verification link (App.jsx passes this after
//             finding a ?verify= in the URL) — this tab has nothing else to
//             do, since the original signup tab auto-updates itself via the
//             cross-tab broadcast below.
// resetToken/verifyToken — the token from that URL.
// onResetDone — called once the reset flow finishes so App.jsx can hide the overlay.
// onCancel — when provided, shows a close button so the page can be dismissed without signing in
//            (e.g. a guest who opened it from the navbar and wants to keep browsing).
export default function Auth({ onAuthSuccess, forceMode, resetToken, onResetDone, verifyToken, onCancel }) {

  const [mode, setMode] = useState(forceMode || 'signin');

  const [fields, setFields] = useState({
    name:            '',
    username:        '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });

  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Live username availability, checked as the sign-up form's Username
  // field is typed into. null = not checked yet / cleared, not an error.
  const [usernameCheck, setUsernameCheck] = useState({ checking: false, available: null, error: '' });

  // Set when a sign-in attempt fails specifically because the account isn't
  // verified yet (rather than a wrong password) — shows a "resend" option
  // instead of the generic invalid-credentials message.
  const [unverified, setUnverified] = useState(false);

  // Set when registration succeeded (the account genuinely exists) but the
  // verification email itself failed to send — surfaced as a notice on the
  // "Check Your Email" screen pointing at the Resend button, instead of
  // silently showing the same copy as if the email had actually gone out.
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [resending,  setResending]  = useState(false);

  function switchMode(newMode) {
    if (newMode === mode) return;
    setMode(newMode);
    setFields({ name: '', username: '', email: '', password: '', confirmPassword: '' });
    setError('');
    setSuccess('');
    setUnverified(false);
    setEmailSendFailed(false);
    setUsernameCheck({ checking: false, available: null, error: '' });
  }

  function handleChange(e) {
    const { name } = e.target;
    setError('');
    // Usernames are compared as typed (no auto-capitalization) — unlike
    // the Full Name field, where capitalizedValue's title-casing is wanted.
    const value = name === 'username' ? e.target.value : capitalizedValue(e);
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // Debounced live availability check as the sign-up Username field is typed.
  useEffect(() => {
    if (mode !== 'signup') return;
    const username = fields.username.trim();
    if (!username) { setUsernameCheck({ checking: false, available: null, error: '' }); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setUsernameCheck({ checking: false, available: false, error: '3–20 characters: letters, numbers, underscores only.' });
      return;
    }
    setUsernameCheck({ checking: true, available: null, error: '' });
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailable(username);
      setUsernameCheck({
        checking: false,
        available: result.available,
        error: result.available === false ? (result.error || 'That username is already taken.') : '',
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [fields.username, mode]);

  // Chrome (and others) will silently auto-populate a saved credential into a matching
  // field the instant the page loads. Making the field readOnly until it's focused stops
  // that auto-fill-on-load while still letting the browser offer its suggestion dropdown
  // once the user actually clicks/taps into the field — same as most other sites.
  function preventAutoFill(e) {
    e.target.removeAttribute('readonly');
  }

  function validate() {
    if (mode === 'signup' && !fields.name.trim()) return 'Please enter your full name.';
    if (mode === 'signup') {
      if (!fields.username.trim()) return 'Please choose a username.';
      if (usernameCheck.available === false) return usernameCheck.error || 'That username is not available.';
      if (usernameCheck.checking) return 'Still checking that username — one moment.';
    }
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
      setUnverified(false);
      if (mode === 'signin') {
        const { user } = await signIn(fields.email, fields.password);
        onAuthSuccess?.(user);
      } else {
        const { emailSendFailed: sendFailed } = await signUp(fields.email, fields.password, fields.name, fields.username);
        setEmailSendFailed(sendFailed);
        // Move straight to the "check your email" screen — keep the email
        // (needed for the resend button) but clear the passwords now that
        // they've done their job.
        setFields((prev) => ({ ...prev, password: '', confirmPassword: '' }));
        setMode('awaiting-verification');
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
        setError(err.message);
      } else {
        setError(
          mode === 'signin'
            ? (err.message || 'Invalid email or password.')
            : (err.message || 'Could not create account. Try a different email.')
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Resend verification email ─────────────────────────────────────────────
  async function handleResendVerification() {
    try {
      setResending(true);
      await resendVerification(fields.email);
      setError('');
      setUnverified(false);
      setSuccess('A new verification link has been sent — check your inbox.');
    } catch (err) {
      setError(err.message || 'Could not resend the verification email.');
    } finally {
      setResending(false);
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

  // ── Verify email (arrived via ?verify= link) ──────────────────────────────
  useEffect(() => {
    if (mode !== 'verify' || !verifyToken) return;
    setLoading(true);
    verifyEmail(verifyToken)
      .then(({ message, email }) => {
        setSuccess(message || 'Email verified! You can now log in.');
        // Browser tabs can't bring each other to the foreground (no web API
        // for that), but same-origin tabs CAN talk to each other. If the tab
        // that originally signed up is still sitting on "Check your email"
        // elsewhere, tell it verification just finished so it can switch
        // itself over automatically instead of staying stuck — the user
        // still has to click back to that tab themselves, but it's ready
        // and waiting when they do.
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel(VERIFY_CHANNEL);
          channel.postMessage({ type: 'email-verified', email });
          channel.close();
        }
      })
      .catch((err) => setError(err.message || 'This verification link is invalid or has expired.'))
      .finally(() => setLoading(false));
    // Only run once, when this instance first mounts in verify mode.
  }, []);

  // ── Listen for verification finishing in another tab ──────────────────────
  // Only relevant while this tab is sitting on the "check your email" screen.
  useEffect(() => {
    if (mode !== 'awaiting-verification' || typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(VERIFY_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type !== 'email-verified') return;
      setMode('signin');
      setFields((prev) => ({ ...prev, email: event.data.email || prev.email, password: '', confirmPassword: '' }));
      setError('');
      setSuccess('Email verified! You can log in now.');
      setUnverified(false);
    };
    return () => channel.close();
  }, [mode]);

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

        {/* Tabs — only shown for the actual login/signup forms */}
        {(mode === 'signin' || mode === 'signup') && (
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

        {/* ── Verify email — just the result message, nothing else. The
              original signup tab (if still open) switches itself to the
              login screen automatically via the cross-tab broadcast below,
              so this tab has nothing left for the user to do here. ── */}
        {mode === 'verify' && (
          <div className="auth-form">
            {loading && <p className="auth-mode-sub">Verifying your email…</p>}
            {error   && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}
          </div>
        )}

        {/* ── Check your email (right after signing up) ── */}
        {mode === 'awaiting-verification' && (
          <div className="auth-form">
            <div className="auth-mode-header">
              <h2 className="auth-mode-title">Check Your Email</h2>
              <p className="auth-mode-sub">
                We sent a verification link to <strong>{fields.email}</strong>.
                Click it to activate your account, then come back and log in.
              </p>
            </div>

            {emailSendFailed && (
              <p className="auth-error">
                We couldn't send that email right away — click below to try again.
              </p>
            )}
            {error   && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <button
              type="button"
              className="btn-primary auth-submit"
              onClick={handleResendVerification}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Resend Verification Email'}
            </button>
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
            {mode === 'signup' && (
              <label className="auth-label">
                Username
                <input className="input-field" type="text" name="username" value={fields.username} onChange={handleChange} placeholder="e.g. ahmed_r22" autoComplete="username" readOnly onFocus={preventAutoFill} />
                {fields.username.trim() && (
                  <span className={`auth-username-hint ${usernameCheck.available === true ? 'auth-username-ok' : usernameCheck.available === false ? 'auth-username-bad' : ''}`}>
                    {usernameCheck.checking ? 'Checking availability…' : usernameCheck.available === true ? '✓ Available' : usernameCheck.available === false ? (usernameCheck.error || 'Not available') : ''}
                  </span>
                )}
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

            {/* Shown only when login failed because the account isn't verified yet */}
            {unverified && (
              <button
                type="button"
                className="auth-forgot-link"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}

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

        {/* Bottom nav — back to sign in for forgot/awaiting-verification modes */}
        {(mode === 'forgot' || mode === 'awaiting-verification') && (
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
