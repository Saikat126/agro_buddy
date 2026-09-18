import React, { useState, useEffect, useRef } from 'react';
import './Navbar.css';
import { requestPasswordReset, updatePassword, uploadAvatar, updateProfileName, deleteAccount } from '../Auth/AuthAPI';
import { useConfirm } from '../shared/useConfirm';

const logo = process.env.PUBLIC_URL + '/logo.png';

export default function Navbar({ tabs, activeTab, onTabChange, user, onSignInClick, onLogout, onUserUpdate, cartCount = 0 }) {

  const { confirm, dialog } = useConfirm();

  // ── Profile panel ──────────────────────────────────────────────────────────
  const [showProfile,     setShowProfile]     = useState(false);
  const [profileView,     setProfileView]     = useState('main'); // 'main' | 'password' | 'edit' | 'delete'
  const [pwFields,        setPwFields]        = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileError,    setProfileError]    = useState('');
  const [profileSuccess,  setProfileSuccess]  = useState('');
  const [profileLoading,  setProfileLoading]  = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editName,       setEditName]       = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const profileRef    = useRef(null);
  const avatarInputRef = useRef(null);

  function resetProfilePanelState() {
    setProfileView('main');
    setPwFields({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setEditName(user?.name || '');
    setDeletePassword('');
    setProfileError('');
    setProfileSuccess('');
  }

  // Reset profile panel when user signs out so it doesn't reappear on next login
  useEffect(() => {
    if (!user) {
      setShowProfile(false);
      resetProfilePanelState();
    }
  }, [user]);

  // Reset profile view to 'main' whenever the panel closes (any close method)
  useEffect(() => {
    if (!showProfile) {
      resetProfilePanelState();
    } else {
      setEditName(user?.name || '');
    }
  }, [showProfile]);

  // Close profile panel on outside click
  useEffect(() => {
    function onOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    }
    if (showProfile) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showProfile]);

  // ── Profile panel helpers ──────────────────────────────────────────────────
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

  async function handleEditProfile(e) {
    e.preventDefault();
    if (!editName.trim()) { setProfileError('Please enter your name.'); return; }
    try {
      setProfileLoading(true);
      setProfileError('');
      const updated = await updateProfileName(editName);
      onUserUpdate?.(updated);
      setProfileSuccess('Profile updated!');
      setTimeout(() => { setProfileView('main'); setProfileSuccess(''); }, 1500);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
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
    } catch (err) {
      setProfileError(err.message || 'Failed to delete account.');
      setProfileLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <nav className="navbar">
      {dialog}

      <div className="navbar-brand">
        <img src={logo} alt="Agro Buddy" className="navbar-logo-img" />
        <span className="navbar-title">Agro Buddy</span>
      </div>

      <ul className="navbar-tabs">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`navbar-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <button className="navbar-cart-btn" onClick={() => onTabChange('checkout')} title="View cart">
        🛒
        {cartCount > 0 && <span className="navbar-cart-badge">{cartCount}</span>}
      </button>

      {/* ── Logged in: avatar button + profile dropdown ── */}
      {user ? (
        <div className="navbar-auth-wrap" ref={profileRef}>
          <button
            className="navbar-avatar-btn"
            onClick={() => setShowProfile((p) => !p)}
            aria-label="Open profile"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="navbar-avatar-img" />
            ) : (
              <div className="navbar-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </button>

          {showProfile && (
            <div className="nav-profile-panel">

              {/* Avatar upload */}
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

              {/* Main view */}
              {profileView === 'main' && (
                <>
                  <p className="npp-name">{user.name}</p>
                  <p className="npp-email">{user.email}</p>

                  {profileError   && <p className="npp-error">{profileError}</p>}
                  {profileSuccess && <p className="npp-success">{profileSuccess}</p>}

                  <div className="npp-divider" />

                  <button
                    className="npp-action-btn"
                    onClick={() => { setProfileView('edit'); setEditName(user.name || ''); setProfileError(''); setProfileSuccess(''); }}
                  >
                    Edit Profile
                  </button>
                  <button
                    className="npp-action-btn"
                    onClick={() => { setProfileView('password'); setProfileError(''); setProfileSuccess(''); }}
                  >
                    Change Password
                  </button>
                  <button className="npp-action-btn npp-signout" onClick={onLogout}>
                    Log Out
                  </button>

                  <div className="npp-divider" />

                  <button
                    className="npp-action-btn npp-danger"
                    onClick={() => { setProfileView('delete'); setDeletePassword(''); setProfileError(''); setProfileSuccess(''); }}
                  >
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
                    onChange={(e) => { setProfileError(''); setEditName(e.target.value); }}
                    autoComplete="name"
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
          )}
        </div>
      ) : (
        /* ── Logged out: Sign In button — opens the full-page Auth screen ── */
        <div className="navbar-auth-wrap">
          <button className="navbar-signin-btn" onClick={onSignInClick}>
            Login
          </button>
        </div>
      )}
    </nav>
  );
}
