import React, { useState, useEffect, useRef } from 'react';
import './AnimalProfiles.css';
import { fetchAnimals, createAnimal, deleteAnimal, uploadAnimalImage } from './AnimalProfilesAPI';
import { useConfirm } from '../shared/useConfirm';

export default function AnimalProfiles({ user, autoAdd, onClearAutoAdd }) {

  const { confirm, dialog } = useConfirm();
  const [animals,  setAnimals]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);

  // When the Home dashboard "+" button sends us here, open the form automatically
  useEffect(() => {
    if (autoAdd) {
      setShowForm(true);
      onClearAutoAdd?.();
    }
  }, [autoAdd]);

  // All form fields in one object , easier to reset everything at once
  const [formData, setFormData] = useState({
    name:      '',
    species:   '',
    age_years: '',
    weight_kg: '',
    notes:     '',
  });

  // Animal photo for the profile being created — held as a local file/preview
  // until submit, when it's uploaded and its URL is attached to the animal.
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);

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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setFormData({ name: '', species: '', age_years: '', weight_kg: '', notes: '' });
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
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

  async function handleAddAnimal(e) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.species.trim()) {
      alert('Please enter at least a name and species.');
      return;
    }

    try {
      let image_url = null;
      if (imageFile) {
        setImageUploading(true);
        image_url = await uploadAnimalImage(imageFile);
      }
      await createAnimal({ ...formData, image_url });
      await loadAnimals(); // re-fetch so the list reflects exactly what's in the database
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError('Failed to add animal. Please try again.');
      console.error('createAnimal error:', err);
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
        <form className="ap-form card" onSubmit={handleAddAnimal}>
          <h3 className="ap-form-title">New Animal Profile</h3>

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
              Age (years)
              <input
                className="input-field"
                type="number"
                name="age_years"
                value={formData.age_years}
                onChange={handleInputChange}
                min="0"
                placeholder="e.g. 3"
              />
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
            {imageUploading ? 'Uploading photo…' : 'Save Animal'}
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
          <div key={animal.id} className="ap-card card">
            {animal.image_url ? (
              <img src={animal.image_url} alt={animal.name} className="ap-card-image" />
            ) : (
              <div className="ap-card-image ap-card-image-placeholder">🐾</div>
            )}
            <h3 className="ap-card-name">{animal.name}</h3>
            <span className="ap-badge">{animal.species}</span>

            <ul className="ap-details">
              {/* Only show these lines if the user actually provided a value */}
              {animal.age_years && <li>Age: <strong>{animal.age_years} yr</strong></li>}
              {animal.weight_kg && <li>Weight: <strong>{animal.weight_kg} kg</strong></li>}
              {animal.notes     && <li>Notes: <em>{animal.notes}</em></li>}
            </ul>

            <button
              className="btn-danger"
              onClick={() => handleDelete(animal.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
