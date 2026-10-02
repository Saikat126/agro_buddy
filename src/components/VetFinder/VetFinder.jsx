import React, { useState, useEffect } from 'react';
import './VetFinder.css';
import { searchVets, createVet, deleteVet } from './VetFinderAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';

export default function VetFinder({ user }) {

  const { confirm, dialog } = useConfirm();

  // No results shown until the user searches — keeps the directory private on first load
  const [results,     setResults]     = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showForm,    setShowForm]    = useState(false);

  const [formData, setFormData] = useState({
    name:     '',
    clinic:   '',
    phone:    '',
    email:    '',
    location: '',
    map_link: '',
  });

  // Debounced search — fires 400 ms after the user stops typing.
  // Without the debounce we'd hit the database on every single keystroke.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await searchVets(searchQuery.trim());

        // Sort so location matches come first, then name matches.
        // "Dhaka" should show Dhaka-area vets at the top, not vets named "Dhaka Clinic".
        const q = searchQuery.trim().toLowerCase();
        data.sort((a, b) => {
          const aLoc = (a.location || '').toLowerCase();
          const bLoc = (b.location || '').toLowerCase();
          const aExact   = aLoc === q;
          const bExact   = bLoc === q;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          const aPartial = aLoc.includes(q);
          const bPartial = bLoc.includes(q);
          if (aPartial && !bPartial) return -1;
          if (!aPartial && bPartial) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setResults(data);
      } catch (err) {
        setError('Search failed. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 400);

    // If the user keeps typing, cancel the pending timer and start a fresh one
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleInputChange(e) {
    const { name } = e.target;
    setFormData((prev) => ({ ...prev, [name]: capitalizedValue(e) }));
  }

  async function handleAddVet(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Vet name and phone number are required.');
      return;
    }
    try {
      const newVet = await createVet(formData);
      // Prepend to results so the new vet is immediately visible without re-searching
      setResults((prev) => [newVet, ...prev]);
      setFormData({ name: '', clinic: '', phone: '', email: '', location: '', map_link: '' });
      setShowForm(false);
    } catch (err) {
      const detail = err?.message || String(err);
      setError(`Failed to add vet: ${detail}`);
      console.error(err);
    }
  }

  async function handleDelete(id) {
    if (!await confirm('Remove this vet from the directory?')) return;
    try {
      await deleteVet(id);
      setResults((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError('Failed to remove vet.');
    }
  }

  return (
    <div className="vet-finder">
      {dialog}

      <div className="vf-header">
        <h2 className="section-title">Vet Finder</h2>
        {user ? (
          <button className="btn-primary" onClick={() => {
            if (showForm) setFormData({ name: '', clinic: '', phone: '', email: '', location: '', map_link: '' });
            setShowForm((p) => !p);
          }}>
            {showForm ? 'Cancel' : '+ Add Vet'}
          </button>
        ) : (
          <span className="mp-signin-hint">Login to add a vet</span>
        )}
      </div>

      {showForm && user && (
        <form className="vf-form card" onSubmit={handleAddVet}>
          <h3 className="vf-form-title">Register a New Vet</h3>

          <div className="vf-row">
            <label className="ap-label">
              Full Name *
              <input className="input-field" type="text" name="name"
                value={formData.name} onChange={handleInputChange}
                placeholder="Dr. Jane Smith" />
            </label>
            <label className="ap-label">
              Clinic / Hospital
              <input className="input-field" type="text" name="clinic"
                value={formData.clinic} onChange={handleInputChange}
                placeholder="e.g. Green Valley Animal Hospital" />
            </label>
          </div>

          <div className="vf-row">
            <label className="ap-label">
              Phone *
              <input className="input-field" type="tel" name="phone"
                value={formData.phone} onChange={handleInputChange}
                placeholder="+880 1700 000000" />
            </label>
            <label className="ap-label">
              Email
              <input className="input-field" type="email" name="email"
                value={formData.email} onChange={handleInputChange}
                placeholder="vet@clinic.com" />
            </label>
          </div>

          <label className="ap-label">
            Area / Location
            <input className="input-field" type="text" name="location"
              value={formData.location} onChange={handleInputChange}
              placeholder="e.g. Dhaka, Chittagong, Sylhet" />
          </label>

          <label className="ap-label">
            Google Maps Link
            <input className="input-field" type="url" name="map_link"
              value={formData.map_link} onChange={handleInputChange}
              placeholder="https://maps.google.com/..." />
          </label>

          <button type="submit" className="btn-primary">Save Vet</button>
        </form>
      )}

      {/* Search is available to everyone, even guests */}
      <input
        className="input-field vf-search"
        type="text"
        placeholder="Search by name or area..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {loading && <p className="ap-loading">Searching…</p>}
      {error   && <p className="ap-error">{error}</p>}

      {!loading && !error && !searchQuery.trim() && (
        <p className="ap-empty">Type a name or area above to find vets.</p>
      )}

      {!loading && !error && searchQuery.trim() && results.length === 0 && (
        <p className="ap-empty">No vets found for "{searchQuery}". Try a different name or area.</p>
      )}

      <div className="vf-grid">
        {results.map((vet) => (
          <div key={vet.id} className="vf-card card">
            <h3 className="vf-name">{vet.name}</h3>

            <ul className="vf-details">
              {vet.clinic   && <li><span className="vf-icon">🏥</span>{vet.clinic}</li>}
              {vet.location && <li><span className="vf-icon">📍</span>{vet.location}</li>}
              {vet.phone    && (
                <li>
                  <span className="vf-icon">📞</span>
                  <a href={`tel:${vet.phone}`} className="vf-link">{vet.phone}</a>
                </li>
              )}
              {vet.email && (
                <li>
                  <span className="vf-icon">✉️</span>
                  <a href={`mailto:${vet.email}`} className="vf-link">{vet.email}</a>
                </li>
              )}
              {vet.map_link && (
                <li>
                  <span className="vf-icon">🗺️</span>
                  <a href={vet.map_link} className="vf-link" target="_blank" rel="noopener noreferrer">View on Map</a>
                </li>
              )}
            </ul>

            {/* Remove button only shown to the user who originally added this vet */}
            {user && user.id === vet.user_id && (
              <div className="vf-actions">
                <button className="btn-danger" onClick={() => handleDelete(vet.id)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
