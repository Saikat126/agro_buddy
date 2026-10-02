import React, { useState, useEffect, useRef } from 'react';
import './AnimalProfiles.css';
import { fetchAnimals, fetchAnimalDetail, createAnimal, updateAnimal, deleteAnimal, uploadAnimalImage } from './AnimalProfilesAPI';
import { fetchDosageRecordsByAnimal } from '../DosageCalculator/DosageCalculatorAPI';
import { fetchTasksByAnimal } from '../TaskList/TaskListAPI';
import { fetchEventsByAnimal } from '../Calendar/CalendarAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';

// Flips 'yyyy-mm-dd' to 'dd-mm-yyyy', matching how dates are shown everywhere
// else in the app (TaskList, DosageCalculator's own history view).
function fmtDate(iso) {
  if (!iso) return '';
  return iso.split('-').reverse().join('-');
}

// Mirrors the label map in CalendarView.jsx so an event's type reads as
// "Vet Visit" instead of the raw DB value "vet".
const EVENT_TYPE_LABELS = {
  vet: 'Vet Visit', harvest: 'Harvest', market: 'Market Day',
  medication: 'Medication', other: 'Other',
};

// Combines the form's separate Years/Months inputs into the single decimal
// age_years the backend stores (e.g. 2 yr 3 mo -> 2.25). Returns '' when
// both are blank so age stays optional, matching the old single-field behavior.
function combineAge(years, months) {
  if (years === '' && months === '') return '';
  const total = (Number(years) || 0) + (Number(months) || 0) / 12;
  return total.toFixed(2);
}

// Reverse of combineAge, used when opening the edit form on an existing
// animal — splits the stored decimal back into whole years + months.
function splitAge(ageYears) {
  if (ageYears == null || ageYears === '') return { years: '', months: '' };
  const total = Number(ageYears);
  let years = Math.floor(total);
  let months = Math.round((total - years) * 12);
  if (months === 12) { months = 0; years += 1; } // rounding carry (e.g. 2.999 -> 3yr 0mo, not 2yr 12mo)
  return { years: String(years), months: String(months) };
}

// Renders the stored decimal as "2 yr 3 mo" instead of a raw number like
// "2.25 yr" — drops whichever half is zero (a pure-months animal just shows "3 mo").
function formatAge(ageYears) {
  const { years, months } = splitAge(ageYears);
  if (years === '') return '';
  const parts = [];
  if (Number(years) > 0) parts.push(`${years} yr`);
  if (Number(months) > 0) parts.push(`${months} mo`);
  return parts.length > 0 ? parts.join(' ') : '0 yr';
}

export default function AnimalProfiles({ user, autoAdd, onClearAutoAdd }) {

  const { confirm, dialog } = useConfirm();

  const [animals,  setAnimals]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Detail view opened by clicking a card — holds the full record (including
  // the dosage/event/task counts the backend joins in) for whichever animal
  // was clicked, or null when the modal is closed.
  const [detailAnimal,  setDetailAnimal]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState(null);

  async function openDetail(id) {
    setDetailAnimal({}); // opens the modal immediately with a loading state
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchAnimalDetail(id);
      setDetailAnimal(data);
    } catch (err) {
      setDetailError('Could not load this animal\'s details.');
    } finally {
      setDetailLoading(false);
    }
  }

  // When the Home dashboard "+" button sends us here, open the form automatically
  useEffect(() => {
    if (autoAdd) {
      setShowForm(true);
      onClearAutoAdd?.();
    }
  }, [autoAdd]);

  // All form fields in one object , easier to reset everything at once.
  // ageYears/ageMonths are separate inputs for easier entry of young
  // animals — combined into the single decimal age_years the backend
  // actually stores (e.g. 2 yr 3 mo -> 2.25) right before saving.
  const [formData, setFormData] = useState({
    name:      '',
    species:   '',
    ageYears:  '',
    ageMonths: '',
    weight_kg: '',
    notes:     '',
  });

  // Animal photo for the profile being created/edited — held as a local
  // file/preview until submit, when it's uploaded and its URL is attached.
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const formRef = useRef(null);

  // Set to an animal's id while editing it (instead of creating a new one).
  // The photo it already had, kept separately so submitting without picking
  // a new file doesn't wipe out the existing one.
  const [editingId,        setEditingId]        = useState(null);
  const [existingImageUrl, setExistingImageUrl]  = useState(null);

  // Bumped on every "Edit Profile" click (see startEdit) so the scroll
  // effect below always re-fires — even re-selecting the *same* animal
  // that's already open, where neither showForm nor editingId actually
  // change value, so a dependency on those alone wouldn't re-trigger it.
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // Whenever the form opens (adding or editing), scroll it into view — it
  // renders at the top of the page, so without this, opening it while
  // scrolled down (e.g. after clicking "Edit Profile" from a card further
  // down the grid) looks like nothing happened.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editingId, scrollTrigger]);

  // Load the animal list once when the component first mounts
  useEffect(() => {
    loadAnimals();
  }, []);

  async function loadAnimals() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAnimals();
      setAnimals(data);
    } catch (err) {
      setError('Failed to load animals. Please check your connection.');
      console.error('fetchAnimals error:', err);
    } finally {
      setLoading(false);
    }
  }

  // One handler for all form inputs — e.target.name tells us which field changed
  function handleInputChange(e) {
    const { name } = e.target;
    setFormData((prev) => ({ ...prev, [name]: capitalizedValue(e) }));
  }

  function resetForm() {
    setFormData({ name: '', species: '', ageYears: '', ageMonths: '', weight_kg: '', notes: '' });
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    setExistingImageUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  // Opens the form pre-filled with an existing animal's data instead of blank.
  function startEdit(animal) {
    setEditingId(animal.id);
    const { years, months } = splitAge(animal.age_years);
    setFormData({
      name:      animal.name || '',
      species:   animal.species || '',
      ageYears:  years,
      ageMonths: months,
      weight_kg: animal.weight_kg || '',
      notes:     animal.notes || '',
    });
    setImageFile(null);
    setImagePreview(animal.image_url || null);
    setExistingImageUrl(animal.image_url || null);
    setDetailAnimal(null); // close the detail modal in favor of the form
    setShowForm(true);
    setScrollTrigger((n) => n + 1); // always re-scroll, even re-selecting the same animal
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmitAnimal(e) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.species.trim()) {
      alert('Please enter at least a name and species.');
      return;
    }

    try {
      // Keep the existing photo unless a new one was picked — otherwise
      // saving an edit without touching the photo field would wipe it out.
      let image_url = existingImageUrl;
      if (imageFile) {
        setImageUploading(true);
        image_url = await uploadAnimalImage(imageFile);
      }

      // Collapse the two age inputs into the single decimal field the
      // backend actually stores — ageYears/ageMonths never get sent as-is.
      const { ageYears, ageMonths, ...rest } = formData;
      const payload = { ...rest, age_years: combineAge(ageYears, ageMonths), image_url };

      if (editingId) {
        await updateAnimal(editingId, payload);
      } else {
        await createAnimal(payload);
      }
      await loadAnimals(); // re-fetch so the list reflects exactly what's in the database
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(editingId ? 'Failed to save changes. Please try again.' : 'Failed to add animal. Please try again.');
      console.error('saveAnimal error:', err);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!await confirm('Delete this animal profile?')) return;

    try {
      await deleteAnimal(id);
      // Remove from local state directly — no need to hit the server again
      setAnimals((prev) => prev.filter((animal) => animal.id !== id));
    } catch (err) {
      setError('Failed to delete animal.');
      console.error('deleteAnimal error:', err);
    }
  }

  return (
    <div className="animal-profiles">
      {dialog}

      <div className="ap-header">
        <h2 className="section-title">Animal Profiles</h2>
        <button
          className="btn-primary"
          onClick={() => {
            // Reset the form before hiding it so old values don't reappear next time
            if (showForm) resetForm();
            setShowForm((prev) => !prev);
          }}
        >
          {showForm ? 'Cancel' : '+ Add Animal'}
        </button>
      </div>

      {showForm && (
        <form ref={formRef} className="ap-form card" onSubmit={handleSubmitAnimal}>
          <h3 className="ap-form-title">{editingId ? 'Edit Animal Profile' : 'New Animal Profile'}</h3>

          <label className="ap-label">
            Photo
            <div className="ap-image-upload" onClick={() => imageInputRef.current?.click()}>
              {imagePreview ? (
                <img src={imagePreview} alt="Animal preview" className="ap-image-preview" />
              ) : (
                <span className="ap-image-upload-hint">📷 Click to add a photo</span>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </label>

          <label className="ap-label">
            Name *
            <input
              className="input-field"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g. Bessie"
            />
          </label>

          <label className="ap-label">
            Species *
            <input
              className="input-field"
              type="text"
              name="species"
              value={formData.species}
              onChange={handleInputChange}
              placeholder="e.g. Cow, Sheep, Goat"
            />
          </label>

          {/* Side by side with CSS grid */}
          <div className="ap-row">
            <label className="ap-label">
              Age
              <div className="ap-age-inputs">
                <input
                  className="input-field"
                  type="number"
                  name="ageYears"
                  value={formData.ageYears}
                  onChange={handleInputChange}
                  min="0"
                  placeholder="Years"
                />
                <input
                  className="input-field"
                  type="number"
                  name="ageMonths"
                  value={formData.ageMonths}
                  onChange={handleInputChange}
                  min="0"
                  max="11"
                  placeholder="Months"
                />
              </div>
            </label>

            <label className="ap-label">
              Weight (kg)
              <input
                className="input-field"
                type="number"
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleInputChange}
                min="0"
                placeholder="e.g. 450"
              />
            </label>
          </div>

          <label className="ap-label">
            Notes
            <textarea
              className="input-field"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Health notes, vaccinations, etc."
            />
          </label>

          <button type="submit" className="btn-primary" disabled={imageUploading}>
            {imageUploading ? 'Uploading photo…' : (editingId ? 'Save Changes' : 'Save Animal')}
          </button>
        </form>
      )}

      {loading && <p className="ap-loading">Loading animals...</p>}
      {error   && <p className="ap-error">{error}</p>}

      {!loading && !error && animals.length === 0 && (
        <p className="ap-empty">No animals yet. Add your first one above!</p>
      )}

      <div className="ap-grid">
        {animals.map((animal) => (
          // key is required so React can tell which card changed when the list updates
          // Clicking anywhere on the card opens its detail view; the Delete
          // button stops that click from bubbling up so it doesn't also open it.
          <div key={animal.id} className="ap-card card ap-card-clickable" onClick={() => openDetail(animal.id)}>
            {animal.image_url ? (
              <img src={animal.image_url} alt={animal.name} className="ap-card-image" />
            ) : (
              <div className="ap-card-image ap-card-image-placeholder">🐾</div>
            )}
            <h3 className="ap-card-name">{animal.name}</h3>
            <span className="ap-badge">{animal.species}</span>

            <ul className="ap-details">
              {/* Only show these lines if the user actually provided a value */}
              {animal.age_years && <li>Age: <strong>{formatAge(animal.age_years)}</strong></li>}
              {animal.weight_kg && <li>Weight: <strong>{animal.weight_kg} kg</strong></li>}
              {animal.notes     && <li>Notes: <em>{animal.notes}</em></li>}
            </ul>

            <button
              className="btn-danger"
              onClick={(e) => { e.stopPropagation(); handleDelete(animal.id); }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {detailAnimal && (
        <AnimalDetailModal
          animal={detailAnimal}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailAnimal(null)}
          onEdit={startEdit}
        />
      )}
    </div>
  );
}

// Shown when an animal card is clicked. Displays the animal's full profile
// plus counts pulled in via the backend's LEFT JOIN across dosage_records,
// calendar_events, and tasks (so a brand-new animal with none of those yet
// still shows 0s instead of an error) — and, below that, the actual list of
// dosage records instead of just the count.
function AnimalDetailModal({ animal, loading, error, onClose, onEdit }) {
  const [records,        setRecords]        = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [tasks,        setTasks]        = useState([]);
  const [tasksLoading,  setTasksLoading] = useState(false);

  const [events,        setEvents]        = useState([]);
  const [eventsLoading,  setEventsLoading] = useState(false);

  useEffect(() => {
    if (loading || error || !animal.id) return;
    setRecordsLoading(true);
    fetchDosageRecordsByAnimal(animal.id)
      .then(setRecords)
      .catch(() => {}) // the Health Overview count above still shows either way
      .finally(() => setRecordsLoading(false));

    setTasksLoading(true);
    fetchTasksByAnimal(animal.id)
      .then(setTasks)
      .catch(() => {}) // the Open tasks count above still shows either way
      .finally(() => setTasksLoading(false));

    setEventsLoading(true);
    fetchEventsByAnimal(animal.id)
      .then(setEvents)
      .catch(() => {}) // the Upcoming events count above still shows either way
      .finally(() => setEventsLoading(false));
  }, [animal.id, loading, error]);

  return (
    <div className="ap-detail-overlay" onClick={onClose}>
      <div className="ap-detail-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="ap-detail-close" onClick={onClose} type="button" aria-label="Close">✕</button>

        {loading && <p className="ap-loading">Loading…</p>}
        {error   && <p className="ap-error">{error}</p>}

        {!loading && !error && (
          <>
            {animal.image_url ? (
              <img src={animal.image_url} alt={animal.name} className="ap-detail-image" />
            ) : (
              <div className="ap-detail-image ap-card-image-placeholder">🐾</div>
            )}

            <h3 className="ap-card-name">{animal.name}</h3>
            <span className="ap-badge">{animal.species}</span>

            <ul className="ap-details">
              {animal.age_years && <li>Age: <strong>{formatAge(animal.age_years)}</strong></li>}
              {animal.weight_kg && <li>Weight: <strong>{animal.weight_kg} kg</strong></li>}
              {animal.notes     && <li>Notes: <em>{animal.notes}</em></li>}
            </ul>

            <button type="button" className="btn-primary ap-detail-edit-btn" onClick={() => onEdit(animal)}>
              Edit Profile
            </button>

            <div className="ap-detail-divider" />

            <p className="ap-detail-section-label">Health Overview</p>
            <ul className="ap-detail-stats">
              <li><span>Dosage records</span><strong>{animal.dosage_record_count}</strong></li>
              <li><span>Latest treatment ends</span><strong>{animal.latest_treatment_end || '—'}</strong></li>
              <li><span>Upcoming events</span><strong>{animal.upcoming_event_count}</strong></li>
              <li><span>Open tasks</span><strong>{animal.open_task_count}</strong></li>
            </ul>

            {Number(animal.dosage_record_count) > 0 && (
              <>
                <div className="ap-detail-divider" />
                <p className="ap-detail-section-label">Dosage Records</p>
                {recordsLoading ? (
                  <p className="ap-loading">Loading…</p>
                ) : (
                  <ul className="ap-dosage-list">
                    {records.map((rec) => (
                      <li key={rec.id} className="ap-dosage-row">
                        <span className="ap-dosage-med">{rec.medication}</span>
                        <span className="ap-dosage-dates">
                          {fmtDate(rec.start_date)} → {fmtDate(rec.end_date)}
                        </span>
                        <span className="ap-dosage-vol">{Number(rec.total_ml).toFixed(2)} ml/dose</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tasks.length > 0 && (
              <>
                <div className="ap-detail-divider" />
                <p className="ap-detail-section-label">Tasks</p>
                {tasksLoading ? (
                  <p className="ap-loading">Loading…</p>
                ) : (
                  <ul className="ap-task-list">
                    {tasks.map((task) => (
                      <li key={task.id} className={`ap-task-row ${task.completed ? 'ap-task-done' : ''}`}>
                        <span className="ap-task-title">
                          {task.dosageRecordId && '💊 '}{task.title}
                        </span>
                        <span className="ap-task-due">
                          {task.dueDate ? `Due: ${fmtDate(task.dueDate)}` : 'No due date'}
                        </span>
                        <span className="ap-task-status">
                          {task.completed ? 'Done' : task.isRepeating ? 'Active' : 'Pending'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {events.length > 0 && (
              <>
                <div className="ap-detail-divider" />
                <p className="ap-detail-section-label">Upcoming Events</p>
                {eventsLoading ? (
                  <p className="ap-loading">Loading…</p>
                ) : (
                  <ul className="ap-event-list">
                    {events.map((ev) => (
                      <li key={ev.id} className={`ap-event-row ${ev.completed ? 'ap-event-done' : ''}`}>
                        <span className="ap-event-type">{EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}</span>
                        <span className="ap-event-title">{ev.title}</span>
                        <span className="ap-event-date">{fmtDate(ev.event_date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
