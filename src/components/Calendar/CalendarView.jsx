import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarView.css';
import { fetchEvents, createEvent, deleteEvent, deletePastEvents } from './CalendarAPI';
import { fetchAnimals } from '../AnimalProfiles/AnimalProfilesAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';
import { buildAnimalOptions } from '../shared/animalOptions';
import { toLocalDateString } from '../shared/localDate';

// value must match the DB CHECK constraint exactly (lowercase);
// label is what appears in the dropdown
const EVENT_TYPES = [
  { value: 'vet',        label: 'Vet Visit'  },
  { value: 'harvest',    label: 'Harvest'    },
  { value: 'market',     label: 'Market Day' },
  { value: 'medication', label: 'Medication' },
  { value: 'other',      label: 'Other'      },
];

export default function CalendarView({ user, autoAdd, onClearAutoAdd }) {

  const { confirm, dialog } = useConfirm();

  // Start with today selected so the right panel already shows something on first load
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [showForm,     setShowForm]     = useState(false);

  // Auto-open the add form when the Home dashboard "+" sends the user here
  useEffect(() => {
    if (autoAdd) {
      setShowForm(true);
      onClearAutoAdd?.();
    }
  }, [autoAdd]);

  const [formData, setFormData] = useState({
    title:      '',
    event_type: 'vet',
    notes:      '',
    animal_id:  '',
  });

  // Animals list for the optional "Link to animal" dropdown — this is what
  // lets an animal profile's "Upcoming events" count actually find anything,
  // since that count is driven entirely by calendar_events.animal_id.
  const [animals, setAnimals] = useState([]);

  const animalOptions = useMemo(() => buildAnimalOptions(animals), [animals]);

  // Load events when the component mounts and also after sign-in.
  // The component remounts via key={user.id} in App.jsx on user change,
  // so this effect runs fresh for each new session.
  useEffect(() => {
    if (user) {
      loadEvents();
      fetchAnimals().then(setAnimals).catch(() => {});
    }
  }, [user]);

  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);
      // Clean up stale events automatically so the calendar stays tidy
      await deletePastEvents();
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      setError('Could not load calendar events.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const selectedDateStr = toLocalDateString(selectedDate);

  // Events for the currently selected date — re-computed on every render,
  // which is fine since the events array is small
  const eventsForSelectedDate = events.filter((ev) => ev.event_date === selectedDateStr);

  // useCallback so this function reference stays stable between renders —
  // react-calendar uses it as a prop and would re-render all tiles if it changed every time
  const tileContent = useCallback(
    ({ date }) => {
      const hasEvent = events.some((ev) => ev.event_date === toLocalDateString(date));
      // A small green dot on any date that has at least one event
      return hasEvent ? <span className="cv-dot" /> : null;
    },
    [events]
  );

  function handleInputChange(e) {
    const { name } = e.target;
    setFormData((prev) => ({ ...prev, [name]: capitalizedValue(e) }));
  }

  async function handleAddEvent(e) {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Event title is required.');
      return;
    }

    try {
      const newEvent = await createEvent({
        title:      formData.title,
        event_type: formData.event_type,
        notes:      formData.notes,
        animal_id:  formData.animal_id || null,
        event_date: selectedDateStr, // use the currently selected date
      });

      // Append to local state so the dot and event list update immediately
      setEvents((prev) => [...prev, newEvent]);
      setFormData({ title: '', event_type: 'vet', notes: '', animal_id: '' });
      setShowForm(false);
    } catch (err) {
      setError('Failed to add event.');
      console.error(err);
    }
  }

  async function handleDeleteEvent(id) {
    if (!await confirm('Delete this event?')) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err) {
      setError('Failed to delete event.');
    }
  }

  return (
    <div className="calendar-view">
      {dialog}
      <h2 className="section-title">Farm Calendar</h2>

      {loading && <p className="ap-loading">Loading events...</p>}
      {error   && <p className="ap-error">{error}</p>}

      {/* Two-column layout: calendar widget on the left, event detail on the right */}
      <div className="cv-layout">

        <div className="cv-calendar-wrap">
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            tileContent={tileContent} // adds the green dot to days with events
            calendarType="iso8601"    // forces weeks to start on Monday everywhere
          />
        </div>

        <div className="cv-detail">

          <div className="cv-detail-header">
            <h3 className="cv-detail-date">
              {selectedDate.toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </h3>
            {/* Only signed-in users can add events */}
            {user && (
              <button
                className="btn-primary"
                onClick={() => {
                  if (showForm) setFormData({ title: '', event_type: 'vet', notes: '', animal_id: '' });
                  setShowForm((p) => !p);
                }}
              >
                {showForm ? 'Cancel' : '+ Add Event'}
              </button>
            )}
          </div>

          {!user ? (
            // Guests can see the calendar but not the events
            <div className="cv-signin-prompt">
              <p className="cv-signin-text">
                Login to view and add events for your farm.
              </p>
            </div>
          ) : (
            <>
              {showForm && (
                <form className="cv-form card" onSubmit={handleAddEvent}>
                  <label className="ap-label">
                    Event Title *
                    <input
                      className="input-field"
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g. Vet visit for Bessie"
                    />
                  </label>

                  <label className="ap-label">
                    Event Type
                    <select
                      className="input-field"
                      name="event_type"
                      value={formData.event_type}
                      onChange={handleInputChange}
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="ap-label">
                    Link to Animal (optional)
                    <select
                      className="input-field"
                      name="animal_id"
                      value={formData.animal_id}
                      onChange={handleInputChange}
                    >
                      <option value="">— None —</option>
                      {animalOptions.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="ap-label">
                    Notes
                    <textarea
                      className="input-field"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={2}
                      placeholder="Optional details..."
                    />
                  </label>

                  <button type="submit" className="btn-primary">Save Event</button>
                </form>
              )}

              {eventsForSelectedDate.length === 0 && !showForm ? (
                <p className="ap-empty">No events for this day. Add one above!</p>
              ) : (
                <ul className="cv-event-list">
                  {eventsForSelectedDate.map((ev) => (
                    <li key={ev.id} className="cv-event-item card">
                      {/* Look up the human-readable label from the value stored in the DB */}
                      <span className="cv-event-type">
                        {EVENT_TYPES.find((t) => t.value === ev.event_type)?.label || ev.event_type}
                      </span>
                      <strong className="cv-event-title">{ev.title}</strong>
                      {ev.animal_id && (
                        <span className="cv-event-animal">
                          🐾 {animals.find((a) => a.id === ev.animal_id)?.name || 'Linked animal'}
                        </span>
                      )}
                      {ev.notes && <p className="cv-event-notes">{ev.notes}</p>}
                      <button
                        className="btn-danger"
                        onClick={() => handleDeleteEvent(ev.id)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
