import React from 'react';
import './Navbar.css';

const logo = process.env.PUBLIC_URL + '/logo.png';

export default function Navbar({ tabs, activeTab, onTabChange, user, onSignInClick, cartCount = 0 }) {

  return (
    <nav className="navbar">

      <button className="navbar-brand" onClick={() => onTabChange('home')} type="button" aria-label="Go to home page">
        <img src={logo} alt="Agro Buddy" className="navbar-logo-img" />
        <span className="navbar-title">Agro Buddy</span>
      </button>

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

      <button
        className={`navbar-cart-btn ${activeTab === 'checkout' ? 'active' : ''}`}
        onClick={() => onTabChange('checkout')}
        title="View cart"
      >
        🛒
        {cartCount > 0 && <span className="navbar-cart-badge">{cartCount}</span>}
      </button>

      {/* ── Logged in: avatar button opens the full Profile page ── */}
      {user ? (
        <div className="navbar-auth-wrap">
          <button
            className={`navbar-avatar-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => onTabChange('profile')}
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
