import React, { useState, useEffect } from 'react';
import './Home.css';
import { fetchTasks }   from '../TaskList/TaskListAPI';
import { fetchAnimals } from '../AnimalProfiles/AnimalProfilesAPI';
import { fetchEvents }  from '../Calendar/CalendarAPI';

// One entry per feature — clicking any card navigates to that tab.
// id must match the tab id in App.jsx so onTabChange(f.id) works.
const FEATURES = [
  { id: 'animals',  emoji: '🐄', photo: 'animals.jpeg', color: '#16a34a', grad: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', label: 'Animal Profiles',   desc: 'Track health, weight, and history for every animal on your farm.' },
  { id: 'tasks',    emoji: '✅', photo: 'tasks.jpeg',    color: '#2563eb', grad: 'linear-gradient(135deg,#eff6ff,#dbeafe)', label: 'Task List',          desc: 'Organise daily farm work with priorities, due dates, and repeating tasks.' },
  { id: 'market',   emoji: '🛒', photo: 'market.jpeg',   color: '#d97706', grad: 'linear-gradient(135deg,#fffbeb,#fef3c7)', label: 'Marketplace',        desc: 'Buy and sell livestock, crops, and equipment within your farming community.' },
  { id: 'dosage',   emoji: '💊', photo: 'dosage.jpeg',   color: '#7c3aed', grad: 'linear-gradient(135deg,#faf5ff,#ede9fe)', label: 'Dosage Calculator',  desc: 'Calculate precise medication doses and generate treatment schedules.' },
  { id: 'calendar', emoji: '📅', photo: 'calendar.jpeg', color: '#0891b2', grad: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', label: 'Farm Calendar',      desc: 'Schedule vet visits, harvests, and every important farm event.' },
  { id: 'vets',     emoji: '🩺', photo: 'vets.jpeg',     color: '#be185d', grad: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', label: 'Vet Finder',         desc: 'Find and connect with nearby veterinarians for your animals.' },
];

const PRIORITY_COLORS = { high: '#be123c', medium: '#b45309', low: '#15803d' };

export default function Home({ user, onTabChange }) {
  const [tasks,       setTasks]       = useState([]);
  const [animals,     setAnimals]     = useState([]);
  const [events,      setEvents]      = useState([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Fetch all three data sources in parallel when the user is signed in.
  // We re-run when `user` changes so the dashboard loads fresh after sign-in.
  useEffect(() => {
    if (!user) return;
    setDashLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // Promise.all fires all three requests at the same time instead of one after the other
    Promise.all([fetchTasks(), fetchAnimals(), fetchEvents()])
      .then(([t, a, ev]) => {
        setTasks(t.filter((task) => !task.completed));
        setAnimals(a);
        setEvents(ev.filter((e) => !e.completed && e.event_date >= today));
      })
      .catch(console.error)
      .finally(() => setDashLoading(false));
  }, [user]);

  // Cap each dashboard panel at a few items — it's a preview, not a full list
  const activeTasks    = tasks.slice(0, 4);
  const animalPreview  = animals.slice(0, 6);
  const upcomingEvents = events.slice(0, 4);

  return (
    <div className="home">

      {/* Hero section — background photo with a dark gradient overlay so the text stays readable */}
      <section
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.52) 100%), url(${process.env.PUBLIC_URL}/hero.jpeg)`,
          backgroundSize: '100% 100%, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, no-repeat',
        }}
      >
        <div className="home-hero-pattern" />
        <div className="home-hero-content">
          <span className="home-hero-eyebrow">Welcome to Agro Buddy</span>
          <h1 className="home-hero-title">Your Smart Farm,<br />Simplified.</h1>
          <p className="home-hero-sub">
            Manage animals, tasks, health records, marketplace and more —
            all in one place built for modern farmers.
          </p>
          {user ? (
            <div className="home-hero-cta">
              <button className="home-btn-primary" onClick={() => onTabChange('animals')}>
                View Animals
              </button>
              <button className="home-btn-primary" onClick={() => onTabChange('tasks')}>
                View Tasks
              </button>
            </div>
          ) : (
            <div className="home-hero-cta">
              <p className="home-hero-signin-note">
                Login using the button in the top-right to access your farm dashboard.
              </p>
            </div>
          )}
        </div>

        {/* Live counts shown as floating stat chips — only visible when logged in */}
        {user && (
          <div className="home-hero-stats">
            <div className="home-stat-card">
              <span className="home-stat-num">{animals.length}</span>
              <span className="home-stat-label">Animals</span>
            </div>
            <div className="home-stat-card">
              {/* Separate counts for one-off tasks and repeating ones */}
              <span className="home-stat-num">{tasks.filter(t => !t.isRepeating).length}</span>
              <span className="home-stat-label">Active Tasks</span>
            </div>
            <div className="home-stat-card">
              <span className="home-stat-num">{tasks.filter(t => t.isRepeating).length}</span>
              <span className="home-stat-label">Repeating</span>
            </div>
            <div className="home-stat-card">
              <span className="home-stat-num">{events.length}</span>
              <span className="home-stat-label">Events</span>
            </div>
          </div>
        )}

        {/* Decorative wave that blends the hero into the section below */}
        <div className="home-hero-wave">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none">
            <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="var(--color-bg)" />
          </svg>
        </div>
      </section>

      {/* Personal dashboard — only shown when the user is signed in */}
      {user && (
        <section className="home-dashboard">
          <span className="home-section-eyebrow">Live Overview</span>
          <h2 className="home-section-title">Your Farm Dashboard</h2>

          {dashLoading ? (
            <p className="ap-loading">Loading your dashboard…</p>
          ) : (
            <div className="home-dash-grid">

              {/* Tasks panel */}
              <div className="home-panel card home-panel--tasks">
                <div className="home-panel-header">
                  <span className="home-panel-icon">✅</span>
                  <div className="home-panel-info">
                    <h3 className="home-panel-title">Active Tasks</h3>
                    <p className="home-panel-meta">{tasks.length} remaining</p>
                  </div>
                  <div className="home-panel-actions">
                    {/* Passing true as the second arg tells the target tab to open its add-form */}
                    <button className="home-panel-add-btn" onClick={() => onTabChange('tasks', true)} title="Add task">+</button>
                    <button className="home-panel-link" onClick={() => onTabChange('tasks')}>All →</button>
                  </div>
                </div>

                {activeTasks.length === 0
                  ? <p className="home-panel-empty">All clear! 🎉</p>
                  : (
                    <ul className="home-task-list">
                      {activeTasks.map((task) => (
                        <li key={task.id} className="home-task-row">
                          {/* Dot color is driven by priority level */}
                          <span className="home-task-dot" style={{ background: PRIORITY_COLORS[task.priority] || '#16a34a' }} />
                          <span className="home-task-title">{task.title}</span>
                          {task.isRepeating && <span className="home-task-repeat">↻</span>}
                        </li>
                      ))}
                    </ul>
                  )
                }
              </div>

              {/* Animals panel */}
              <div className="home-panel card home-panel--animals">
                <div className="home-panel-header">
                  <span className="home-panel-icon">🐄</span>
                  <div className="home-panel-info">
                    <h3 className="home-panel-title">Animals</h3>
                    <p className="home-panel-meta">{animals.length} registered</p>
                  </div>
                  <div className="home-panel-actions">
                    <button className="home-panel-add-btn" onClick={() => onTabChange('animals', true)} title="Add animal">+</button>
                    <button className="home-panel-link" onClick={() => onTabChange('animals')}>All →</button>
                  </div>
                </div>

                {animalPreview.length === 0
                  ? <p className="home-panel-empty">No animals yet!</p>
                  : (
                    <div className="home-animal-grid">
                      {animalPreview.map((animal) => (
                        <div key={animal.id} className="home-animal-card">
                          {/* Avatar color is derived from the animal's name so it's always consistent */}
                          <div className="home-animal-avatar" style={{ background: stringToColor(animal.name) }}>
                            {animal.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="home-animal-name">{animal.name}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>

              {/* Events panel */}
              <div className="home-panel card home-panel--events">
                <div className="home-panel-header">
                  <span className="home-panel-icon">📅</span>
                  <div className="home-panel-info">
                    <h3 className="home-panel-title">Upcoming Events</h3>
                    <p className="home-panel-meta">{events.length} upcoming</p>
                  </div>
                  <div className="home-panel-actions">
                    <button className="home-panel-add-btn" onClick={() => onTabChange('calendar', true)} title="Add event">+</button>
                    <button className="home-panel-link" onClick={() => onTabChange('calendar')}>All →</button>
                  </div>
                </div>

                {upcomingEvents.length === 0
                  ? <p className="home-panel-empty">No events scheduled!</p>
                  : (
                    <ul className="home-event-list">
                      {upcomingEvents.map((event) => (
                        <li key={event.id} className="home-event-row">
                          <span className="home-task-title">{event.title}</span>
                          <span className={`home-badge home-badge-event-${event.event_type}`}>
                            {event.event_type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </div>

            </div>
          )}
        </section>
      )}

      {/* Feature cards — each card navigates to that feature when clicked.
          CSS custom properties (--card-color, --card-grad) let each card have
          its own color without needing separate CSS classes for each one. */}
      <section className="home-features">
        <div className="home-features-inner">
          <span className="home-section-eyebrow">Everything You Need</span>
          <h2 className="home-section-title home-features-title">Features at Your Fingertips</h2>
          <p className="home-section-sub">
            AgroBuddy brings together the tools every farmer needs to run a healthy,
            productive farm — from animal care to business.
          </p>
          <div className="home-feature-grid">
            {FEATURES.map((f) => (
              <div
                key={f.id}
                className="home-feature-card"
                style={{ '--card-color': f.color, '--card-grad': f.grad }}
                onClick={() => onTabChange(f.id)}
              >
                <div className={`home-feature-top${f.photo ? ' home-feature-top--img' : ''}`}>
                  {f.photo
                    ? <img src={`${process.env.PUBLIC_URL}/${f.photo}`} alt={f.label} className="home-feature-img" />
                    : <span className="home-feature-emoji">{f.emoji}</span>
                  }
                </div>
                <div className="home-feature-body">
                  <h3 className="home-feature-label">{f.label}</h3>
                  <p className="home-feature-desc">{f.desc}</p>
                  <span className="home-feature-cta">Explore →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team credits */}
      <section className="home-credits">
        <span className="home-section-eyebrow">Created By</span>
        <h2 className="home-credits-team-name">Team Edge Runners</h2>
        <p className="home-section-title" style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 0 }}>Meet the Team</p>
        <div className="home-credits-grid">
          {[
            { name: 'Soykot Sikder',        initials: 'SS', color: '#16a34a', photo: 'soykot.jpeg'  },
            { name: 'Zubayer Ahmed',         initials: 'ZA', color: '#2563eb', photo: 'zubayer.jpeg' },
            { name: 'Md. Faiad Ahmed Sajid', initials: 'FS', color: '#d97706', photo: 'faiad.jpeg'   },
          ].map((member) => (
            <div key={member.name} className="home-credit-card card">
              <div className="home-credit-avatar-wrap" style={{ borderColor: member.color }}>
                <img
                  src={`${process.env.PUBLIC_URL}/${member.photo}`}
                  alt={member.name}
                  className="home-credit-photo"
                  onError={(e) => {
                    // If the photo fails to load, hide the broken img and show initials instead
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="home-credit-fallback" style={{ background: member.color, display: 'none' }}>
                  {member.initials}
                </div>
              </div>
              <span className="home-credit-name">{member.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sign-up CTA — only shown to guests */}
      {!user && (
        <section
          className="home-cta-banner"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.48), rgba(0,0,0,0.48)), url(${process.env.PUBLIC_URL}/cta-bg.jpeg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <h2 className="home-cta-title">Ready to manage your farm smarter?</h2>
          <p className="home-cta-sub">Login or create a free account to get started.</p>
          <p className="home-cta-hint">Use the Login button in the top-right corner.</p>
        </section>
      )}

    </div>
  );
}

// Picks a consistent color from a small palette based on the animal's name.
// Same name always → same color, so "Bessie" is always green, not random each render.
// Uses a simple hash: XOR each character code into an accumulator, then mod by palette length.
function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#b45309'];
  return colors[Math.abs(hash) % colors.length];
}
