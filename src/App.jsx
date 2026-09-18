import React, { useState, useEffect } from 'react';
import './App.css';
import Navbar           from './components/Layout/Navbar';
import Auth             from './components/Auth/Auth';
import Home             from './components/Home/Home';
import AnimalProfiles   from './components/AnimalProfiles/AnimalProfiles';
import TaskList         from './components/TaskList/TaskList';
import Marketplace      from './components/Marketplace/Marketplace';
import DosageCalculator from './components/DosageCalculator/DosageCalculator';
import CalendarView     from './components/Calendar/CalendarView';
import VetFinder        from './components/VetFinder/VetFinder';
import Checkout         from './components/Checkout/Checkout';
import { getCurrentUser, signOut } from './components/Auth/AuthAPI';

// protected: true means the tab redirects to a sign-in prompt when no user is logged in
const TABS = [
  { id: 'home',     label: 'Home',             protected: false },
  { id: 'animals',  label: 'Animal Profiles',  protected: true  },
  { id: 'tasks',    label: 'Task List',         protected: true  },
  { id: 'market',   label: 'Marketplace',       protected: true  },
  { id: 'dosage',   label: 'Dosage Calculator', protected: true  },
  { id: 'calendar', label: 'Calendar',          protected: false },
  { id: 'vets',     label: 'Vet Finder',        protected: false },
];

// Maps tab id → component so we can render dynamically instead of a huge if/else chain
const TAB_COMPONENTS = {
  home:     Home,
  animals:  AnimalProfiles,
  tasks:    TaskList,
  market:   Marketplace,
  dosage:   DosageCalculator,
  calendar: CalendarView,
  vets:     VetFinder,
  checkout: Checkout,
};

export default function App() {
  const [user,         setUser]         = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [activeTab,    setActiveTab]    = useState('home');
  const [showAuth,     setShowAuth]     = useState(false);

  // Set when the URL carries a password-reset token (?token=... — the link the
  // backend emails out). Read once on load, same as the old PASSWORD_RECOVERY
  // event used to trigger the "set new password" screen.
  const [resetToken, setResetToken] = useState(null);

  // autoAdd — when the Home dashboard "+" button is clicked, we navigate to that
  // tab AND want its add-form to open automatically. This flag carries that intent.
  const [autoAdd,   setAutoAdd]   = useState(false);

  function handleTabChange(tabId, openAdd = false) {
    setActiveTab(tabId);
    setAutoAdd(openAdd);
  }

  // Cart lives here in App so it survives tab switches.
  // Each item looks like: { id, title, price, unit, seller_name, quantity }
  const [cart, setCart] = useState([]);

  function addToCart(listing) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === listing.id);
      if (existing) {
        // Already in cart — just bump the quantity instead of adding a duplicate
        return prev.map((item) =>
          item.id === listing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...listing, quantity: 1 }];
    });
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  function updateQty(id, qty) {
    // If qty drops to zero, remove the item entirely instead of showing "0"
    if (qty < 1) { removeFromCart(id); return; }
    setCart((prev) =>
      prev.map((item) => item.id === id ? { ...item, quantity: qty } : item)
    );
  }

  function clearCart() {
    setCart([]);
  }

  // The number shown on the cart badge — counts individual units, not distinct products
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // On mount: check if a reset-password link brought us here, and otherwise
  // check if there's already a session (e.g., the page was refreshed) by
  // asking the backend to validate the stored JWT.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      setResetToken(token);
      setAuthReady(true);
      return;
    }

    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);

  async function handleLogout() {
    try { await signOut(); } catch (err) { console.error(err); }
    setUser(null);
  }

  // Don't render anything until we know whether someone is logged in.
  // Without this, protected tabs would flash visible for a split second.
  if (!authReady) {
    return <div className="app-container"><div className="app-auth-loading">Loading…</div></div>;
  }

  // Checkout is special — it's always accessible regardless of auth state
  // because you need to be able to view it after placing an order.
  const isCheckout  = activeTab === 'checkout';
  const currentTab  = TABS.find((t) => t.id === activeTab);
  const Component   = TAB_COMPONENTS[activeTab] ?? Marketplace;

  // Everything a child component might ever need — passed down as a bundle
  const sharedProps = {
    user,
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    onTabChange:    handleTabChange,
    autoAdd,
    onClearAutoAdd: () => setAutoAdd(false),
    onGoToCheckout: () => setActiveTab('checkout'),
    onGoToMarket:   () => setActiveTab('market'),
  };

  // A password-reset link brought us here — show the "set new password" form
  // over everything else, using the token straight from the URL.
  if (resetToken) {
    return (
      <Auth
        forceMode="reset"
        resetToken={resetToken}
        onResetDone={() => {
          setResetToken(null);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  // The full-page sign in / sign up screen, opened from the navbar or a protected tab.
  if (showAuth && !user) {
    return (
      <Auth
        onAuthSuccess={(u) => { setUser(u); setActiveTab('home'); setShowAuth(false); }}
        onCancel={() => setShowAuth(false)}
      />
    );
  }

  return (
    <div className="app-container">
      <Navbar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        onSignInClick={() => setShowAuth(true)}
        onLogout={handleLogout}
        onUserUpdate={setUser}
        cartCount={cartCount}
      />

      <main className={`app-content${activeTab === 'home' ? ' app-content--home' : ''}`}>
        {isCheckout ? (
          <Component key="checkout" {...sharedProps} />
        ) : currentTab?.protected && !user ? (
          // User hit a protected tab while signed out — show a prompt instead of the feature
          <div className="app-signin-prompt">
            <div className="app-signin-card">
              <h2 className="app-signin-title">Login to continue</h2>
              <p className="app-signin-desc">
                {currentTab.label} is only visible to you after logging in.
              </p>
              <button className="btn-primary app-signin-btn" onClick={() => setShowAuth(true)}>
                Login
              </button>
            </div>
          </div>
        ) : (
          // key=user.id forces a full remount when the user changes so stale data doesn't linger
          <Component key={user?.id ?? 'guest'} {...sharedProps} />
        )}
      </main>
    </div>
  );
}
