import React, { useState, useRef, useEffect } from 'react';
import './Profile.css';
import { requestPasswordReset, updatePassword, uploadAvatar, updateProfile, deleteAccount, checkUsernameAvailable } from '../Auth/AuthAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';

export default function Profile({ user, onUserUpdate, onLogout, onTabChange }) {

  const { confirm, dialog } = useConfirm();

  const [profileView,     setProfileView]     = useState('main'); // 'main' | 'password' | 'edit' | 'delete'
  const [pwFields,        setPwFields]        = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileError,    setProfileError]    = useState('');
  const [profileSuccess,  setProfileSuccess]  = useState('');
  const [profileLoading,  setProfileLoading]  = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editName,     setEditName]     = useState(user?.name || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editPhone,    setEditPhone]    = useState(user?.phone || '');
  const [editDistrict, setEditDistrict] = useState(user?.district || '');
  const [deletePassword, setDeletePassword] = useState('');

  // Live username availability while editing — null when it still matches
  // the account's current username (nothing to check), not an error state.
  const [usernameCheck, setUsernameCheck] = useState({ checking: false, available: null, error: '' });

  const avatarInputRef = useRef(null);

  // App.jsx only ever routes here behind a sign-in prompt, but guard anyway
  // since account deletion clears `user` while this page is still mounted.
  if (!user) return null;

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Image must be smaller than 2 MB.');
      return;
    }
    try {
      setAvatarUploading(true);
      setProfileError('');
      const url = await uploadAvatar(file);
      onUserUpdate?.((prev) => ({ ...prev, avatarUrl: url }));
      setProfileSuccess('Photo updated!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!pwFields.currentPassword) { setProfileError('Please enter your current password.'); return; }
    if (pwFields.newPassword.length < 6) { setProfileError('New password must be at least 6 characters.'); return; }
    if (pwFields.newPassword !== pwFields.confirmPassword) { setProfileError('Passwords do not match.'); return; }
    try {
      setProfileLoading(true);
      setProfileError('');
      // The backend re-verifies currentPassword itself before applying the change.
      await updatePassword(pwFields.currentPassword, pwFields.newPassword);
      setProfileSuccess('Password updated!');
      setPwFields({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setProfileView('main'); setProfileSuccess(''); }, 2000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update password.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleForgotFromProfile() {
    try {
      setProfileLoading(true);
      setProfileError('');
      await requestPasswordReset(user.email);
      setProfileSuccess(`Reset link sent to ${user.email}`);
    } catch (err) {
      setProfileError(err.message || 'Could not send reset email.');
    } finally {
      setProfileLoading(false);
    }
  }

  // Debounced live availability check while editing the Username field —
  // skipped entirely when it's unchanged from the account's current one.
  useEffect(() => {
    if (profileView !== 'edit') return;
    const username = editUsername.trim();
    if (!username || username.toLowerCase() === (user.username || '').toLowerCase()) {
      setUsernameCheck({ checking: false, available: null, error: '' });
      return;
    }
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
  }, [editUsername, profileView, user.username]);

  async function handleEditProfile(e) {
    e.preventDefault();
    if (!editName.trim()) { setProfileError('Please enter your name.'); return; }
    if (!editUsername.trim()) { setProfileError('Please enter a username.'); return; }
    if (usernameCheck.available === false) { setProfileError(usernameCheck.error || 'That username is not available.'); return; }
    if (usernameCheck.checking) { setProfileError('Still checking that username — one moment.'); return; }
    try {
      setProfileLoading(true);
      setProfileError('');
      const updated = await updateProfile(editName, editUsername, editPhone, editDistrict);
      onUserUpdate?.(updated);
      setProfileSuccess('Profile updated!');
      setTimeout(() => { setProfileView('main'); setProfileSuccess(''); }, 1500);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleLogoutClick() {
    if (!await confirm('Are you sure you want to log out?', { undoable: true, confirmLabel: 'Log Out' })) return;
    onLogout?.();
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!deletePassword) { setProfileError('Please enter your password to confirm.'); return; }
    if (!await confirm('This permanently deletes your account and all your data (animals, listings, orders, etc.). This cannot be undone. Continue?')) return;
    try {
      setProfileLoading(true);
      setProfileError('');
      await deleteAccount(deletePassword);
      onUserUpdate?.(null);
      onTabChange?.('home');
    } catch (err) {
      setProfileError(err.message || 'Failed to delete account.');
      setProfileLoading(false);
    }
  }

  return (
    <div className="profile-page">
      {dialog}

      <div className="card profile-card">

        {/* Gradient header — avatar overlaps the bottom edge */}
        <div className="profile-hero">
          <div className="npp-avatar-section">
            <button
              className="npp-avatar-wrap"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              title="Change photo"
              type="button"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="npp-avatar-img" />
              ) : (
                <div className="npp-avatar-letter">
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="npp-avatar-overlay">
                {avatarUploading ? (
                  <span className="npp-spinner" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        <div className="profile-body">
          <p className="npp-name">{user.name}</p>
          {user.username && <p className="npp-username">@{user.username}</p>}
          <p className="npp-email">{user.email}</p>

          {/* Main view */}
          {profileView === 'main' && (
            <>
              {(user.phone || user.district) && (
                <div className="profile-chips">
                  {user.phone    && <span className="profile-chip">📞 {user.phone}</span>}
                  {user.district && <span className="profile-chip">📍 {user.district}</span>}
                </div>
              )}

              {profileError   && <p className="npp-error">{profileError}</p>}
              {profileSuccess && <p className="npp-success">{profileSuccess}</p>}

              <div className="profile-actions">
                <button
                  className="profile-action-card"
                  onClick={() => { setProfileView('edit'); setEditName(user.name || ''); setEditUsername(user.username || ''); setEditPhone(user.phone || ''); setEditDistrict(user.district || ''); setProfileError(''); setProfileSuccess(''); }}
                >
                  <span className="profile-action-icon">✏️</span>
                  Edit Profile
                </button>
                <button
                  className="profile-action-card"
                  onClick={() => { setProfileView('password'); setProfileError(''); setProfileSuccess(''); }}
                >
                  <span className="profile-action-icon">🔒</span>
                  Change Password
                </button>
              </div>

              <button className="profile-action-card profile-action-full npp-signout" onClick={handleLogoutClick}>
                <span className="profile-action-icon">🚪</span>
                Log Out
              </button>

              <div className="npp-divider" />

              <button
                className="profile-action-card profile-action-full npp-danger"
                onClick={() => { setProfileView('delete'); setDeletePassword(''); setProfileError(''); setProfileSuccess(''); }}
              >
                <span className="profile-action-icon">🗑️</span>
                Delete Account
              </button>
            </>
          )}

          {/* Edit profile view */}
        {profileView === 'edit' && (
          <form className="npp-pw-form" onSubmit={handleEditProfile}>
            <div className="npp-pw-header">
              <button
                type="button"
                className="npp-back-btn"
                onClick={() => { setProfileView('main'); setProfileError(''); setProfileSuccess(''); }}
              >
                ← Back
              </button>
              <span className="npp-pw-title">Edit Profile</span>
            </div>
            <input
              className="input-field npp-input"
              type="text"
              placeholder="Full name"
              value={editName}
              onChange={(e) => { setProfileError(''); setEditName(capitalizedValue(e)); }}
              autoComplete="name"
            />
            <div className="profile-field-group">
              <input
                className="input-field npp-input"
                type="text"
                placeholder="Username"
                value={editUsername}
                onChange={(e) => { setProfileError(''); setEditUsername(e.target.value); }}
                autoComplete="username"
              />
              {editUsername.trim() && editUsername.trim().toLowerCase() !== (user.username || '').toLowerCase() && (
                <span className={`auth-username-hint ${usernameCheck.available === true ? 'auth-username-ok' : usernameCheck.available === false ? 'auth-username-bad' : ''}`}>
                  {usernameCheck.checking ? 'Checking availability…' : usernameCheck.available === true ? '✓ Available' : usernameCheck.available === false ? (usernameCheck.error || 'Not available') : ''}
                </span>
              )}
            </div>
            <input
              className="input-field npp-input"
              type="tel"
              placeholder="Phone number"
              value={editPhone}
              onChange={(e) => { setProfileError(''); setEditPhone(e.target.value); }}
              autoComplete="tel"
            />
            <input
              className="input-field npp-input"
              type="text"
              placeholder="Farm location (district)"
              value={editDistrict}
              onChange={(e) => { setProfileError(''); setEditDistrict(capitalizedValue(e)); }}
              autoComplete="address-level2"
            />
            {profileError   && <p className="npp-error">{profileError}</p>}
            {profileSuccess && <p className="npp-success">{profileSuccess}</p>}
            {!profileSuccess && (
              <button type="submit" className="btn-primary npp-submit" disabled={profileLoading}>
                {profileLoading ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </form>
        )}

        {/* Delete account view */}
        {profileView === 'delete' && (
          <form className="npp-pw-form" onSubmit={handleDeleteAccount}>
            <div className="npp-pw-header">
              <button
                type="button"
                className="npp-back-btn"
                onClick={() => { setProfileView('main'); setDeletePassword(''); setProfileError(''); setProfileSuccess(''); }}
              >
                ← Back
              </button>
              <span className="npp-pw-title">Delete Account</span>
            </div>
            <p className="npp-danger-warning">
              This permanently deletes your account and all of your data — animal profiles, listings, orders, everything. This cannot be undone.
            </p>
            <input
              className="input-field npp-input"
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => { setProfileError(''); setDeletePassword(e.target.value); }}
              autoComplete="current-password"
            />
            {profileError && <p className="npp-error">{profileError}</p>}
            <button type="submit" className="btn-danger npp-submit" disabled={profileLoading}>
              {profileLoading ? 'Deleting…' : 'Permanently Delete Account'}
            </button>
          </form>
        )}

        {/* Change password view */}
        {profileView === 'password' && (
          <form className="npp-pw-form" onSubmit={handlePasswordChange}>
            <div className="npp-pw-header">
              <button
                type="button"
                className="npp-back-btn"
                onClick={() => { setProfileView('main'); setProfileError(''); setProfileSuccess(''); setPwFields({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
              >
                ← Back
              </button>
              <span className="npp-pw-title">Change Password</span>
            </div>
            <input
              className="input-field npp-input"
              type="password"
              placeholder="Current password"
              value={pwFields.currentPassword}
              onChange={(e) => { setProfileError(''); setPwFields((p) => ({ ...p, currentPassword: e.target.value })); }}
              autoComplete="current-password"
            />
            <input
              className="input-field npp-input"
              type="password"
              placeholder="New password"
              value={pwFields.newPassword}
              onChange={(e) => { setProfileError(''); setPwFields((p) => ({ ...p, newPassword: e.target.value })); }}
              autoComplete="new-password"
            />
            <input
              className="input-field npp-input"
              type="password"
              placeholder="Confirm new password"
              value={pwFields.confirmPassword}
              onChange={(e) => { setProfileError(''); setPwFields((p) => ({ ...p, confirmPassword: e.target.value })); }}
              autoComplete="new-password"
            />
            {profileError   && <p className="npp-error">{profileError}</p>}
            {profileSuccess && <p className="npp-success">{profileSuccess}</p>}
            {!profileSuccess && (
              <>
                <button type="submit" className="btn-primary npp-submit" disabled={profileLoading}>
                  {profileLoading ? 'Updating…' : 'Update Password'}
                </button>
                <button type="button" className="npp-forgot-pw-link" onClick={handleForgotFromProfile} disabled={profileLoading}>
                  Forgot your password?
                </button>
              </>
            )}
          </form>
          )}

        </div>
      </div>
    </div>
  );
}
