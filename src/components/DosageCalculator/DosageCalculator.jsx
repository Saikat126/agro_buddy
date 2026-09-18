import React, { useState, useEffect } from 'react';
import './DosageCalculator.css';
import {
  calculateDosage,
  doseSchedule,
  formatDoseDate,
} from './DosageCalculatorLogic';
import {
  saveDosageRecord,
  fetchDosageRecords,
  deleteDosageRecord,
} from './DosageCalculatorAPI';
import { useConfirm } from '../shared/useConfirm';

// Flips 'yyyy-mm-dd' to 'dd-mm-yyyy' for display in the history table
function fmtDate(iso) {
  if (!iso) return '';
  return iso.split('-').reverse().join('-');
}

export default function DosageCalculator() {

  const { confirm, dialog } = useConfirm();

  const [inputs, setInputs] = useState({
    animalName:    '',
    medication:    '',
    weightKg:      '',
    dosePerKg:     '',
    concentration: '',
    startDate:     '',
    frequencyDays: '1',
    durationDays:  '7',
  });

  const [result,   setResult]   = useState(null);  // { totalMg, totalMl, warning }
  const [schedule, setSchedule] = useState([]);     // array of Date objects for each dose

  // saveStatus drives the button label and disabled state:
  // 'idle' → 'saving' → 'saved' (or 'error' on failure)
  const [saveStatus, setSaveStatus] = useState('idle');

  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError,   setHistError]   = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setHistLoading(true);
      setHistError(null);
      const records = await fetchDosageRecords();
      setHistory(records);
    } catch (err) {
      setHistError('Could not load dosage history.');
      console.error('fetchDosageRecords error:', err);
    } finally {
      setHistLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    // Changing any input invalidates the current result, so reset the save button
    setSaveStatus('idle');
    setInputs((prev) => ({ ...prev, [name]: value }));
  }

  function handleCalculate(e) {
    e.preventDefault();

    const weight        = parseFloat(inputs.weightKg);
    const dose          = parseFloat(inputs.dosePerKg);
    const concentration = parseFloat(inputs.concentration);
    const frequency     = parseInt(inputs.frequencyDays, 10);
    const duration      = parseInt(inputs.durationDays, 10);

    if ([weight, dose, concentration, frequency, duration].some((v) => isNaN(v) || v <= 0)) {
      alert('Please fill in all numeric fields with positive numbers.');
      return;
    }

    const dosageResult = calculateDosage(weight, dose, concentration);
    setResult(dosageResult);
    setSaveStatus('idle');

    // Only generate a schedule if the user actually set a start date
    if (inputs.startDate) {
      const start = new Date(inputs.startDate);
      setSchedule(doseSchedule(start, frequency, duration));
    } else {
      setSchedule([]);
    }
  }

  async function handleSave() {
    // Require the key identifiers before saving — a record without a name is useless in history
    if (!inputs.animalName.trim()) {
      alert('Please enter the animal name before saving.');
      return;
    }
    if (!inputs.medication.trim()) {
      alert('Please enter the medication name before saving.');
      return;
    }
    if (!inputs.startDate) {
      alert('Please set a start date before saving.');
      return;
    }
    if (!result) return;

    try {
      setSaveStatus('saving');

      await saveDosageRecord({
        animal_name:    inputs.animalName.trim(),
        medication:     inputs.medication.trim(),
        weight_kg:      parseFloat(inputs.weightKg),
        dose_per_kg:    parseFloat(inputs.dosePerKg),
        concentration:  parseFloat(inputs.concentration),
        total_mg:       result.totalMg,
        total_ml:       result.totalMl,
        frequency_days: parseInt(inputs.frequencyDays, 10),
        duration_days:  parseInt(inputs.durationDays, 10),
        start_date:     inputs.startDate,
      });

      setSaveStatus('saved');
      await loadHistory(); // refresh so the new record appears at the top
    } catch (err) {
      setSaveStatus('error');
      console.error('saveDosageRecord error:', err);
    }
  }

  async function handleDeleteRecord(id) {
    if (!await confirm('Delete this dosage record?')) return;
    try {
      await deleteDosageRecord(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('deleteDosageRecord error:', err);
    }
  }

  function handleReset() {
    setInputs({
      animalName: '', medication: '', weightKg: '', dosePerKg: '',
      concentration: '', startDate: '', frequencyDays: '1', durationDays: '7',
    });
    setResult(null);
    setSchedule([]);
    setSaveStatus('idle');
  }

  // Derives the correct Save button label from the current save state
  function saveBtnLabel() {
    if (saveStatus === 'saving') return 'Saving…';
    if (saveStatus === 'saved')  return '✓ Saved';
    if (saveStatus === 'error')  return 'Save Failed — Retry';
    return 'Save to History';
  }

  return (
    <div className="dosage-calculator">
      {dialog}
      <h2 className="section-title">Dosage Calculator</h2>

      <form className="dc-form card" onSubmit={handleCalculate}>

        <div className="dc-row">
          <label className="ap-label">
            Animal Name / ID
            <input
              className="input-field"
              type="text"
              name="animalName"
              value={inputs.animalName}
              onChange={handleChange}
              placeholder="e.g. Bessie"
            />
          </label>

          <label className="ap-label">
            Medication Name *
            <input
              className="input-field"
              type="text"
              name="medication"
              value={inputs.medication}
              onChange={handleChange}
              placeholder="e.g. Oxytetracycline"
            />
          </label>
        </div>

        <div className="dc-row">
          <label className="ap-label">
            Animal Weight (kg) *
            <input
              className="input-field"
              type="number"
              name="weightKg"
              value={inputs.weightKg}
              onChange={handleChange}
              min="0.1"
              step="0.1"
              placeholder="e.g. 450"
            />
          </label>

          <label className="ap-label">
            Dose Rate (mg / kg) *
            <input
              className="input-field"
              type="number"
              name="dosePerKg"
              value={inputs.dosePerKg}
              onChange={handleChange}
              min="0.001"
              step="0.001"
              placeholder="e.g. 5"
            />
          </label>
        </div>

        <div className="dc-row">
          <label className="ap-label">
            Concentration (mg / ml) *
            <input
              className="input-field"
              type="number"
              name="concentration"
              value={inputs.concentration}
              onChange={handleChange}
              min="0.001"
              step="0.001"
              placeholder="e.g. 50"
            />
          </label>
        </div>

        <p className="dc-subheading">Treatment Schedule (optional)</p>

        <div className="dc-row">
          <label className="ap-label">
            Start Date
            <input
              className="input-field"
              type="date"
              name="startDate"
              value={inputs.startDate}
              onChange={handleChange}
            />
          </label>

          <label className="ap-label">
            Frequency (days between doses)
            <input
              className="input-field"
              type="number"
              name="frequencyDays"
              value={inputs.frequencyDays}
              onChange={handleChange}
              min="1"
            />
          </label>

          <label className="ap-label">
            Duration (total days)
            <input
              className="input-field"
              type="number"
              name="durationDays"
              value={inputs.durationDays}
              onChange={handleChange}
              min="1"
            />
          </label>
        </div>

        <div className="dc-actions">
          <button type="submit" className="btn-primary">Calculate</button>
          <button type="button" className="btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {/* Results only appear after a successful calculation */}
      {result && (
        <div className="dc-result card">
          <h3 className="dc-result-title">
            Result{inputs.animalName ? ` for ${inputs.animalName}` : ''}
          </h3>

          <div className="dc-result-grid">
            <div className="dc-result-item">
              <span className="dc-result-label">Total Dose</span>
              <span className="dc-result-value">{result.totalMg.toFixed(2)} mg</span>
            </div>
            <div className="dc-result-item">
              <span className="dc-result-label">Volume to Administer</span>
              <span className="dc-result-value dc-volume">{result.totalMl.toFixed(2)} ml</span>
            </div>
          </div>

          {result.warning && (
            <div className="dc-warning">⚠️ {result.warning}</div>
          )}

          {schedule.length > 0 && (
            <div className="dc-schedule">
              <h4 className="dc-schedule-title">Administration Schedule</h4>
              <table className="dc-table">
                <thead>
                  <tr><th>Dose #</th><th>Date</th><th>Volume</th></tr>
                </thead>
                <tbody>
                  {schedule.map((date, index) => (
                    // Alternating row color for readability
                    <tr key={index} className={index % 2 === 1 ? 'dc-row-alt' : ''}>
                      <td>{index + 1}</td>
                      <td>{formatDoseDate(date)}</td>
                      <td>{result.totalMl.toFixed(2)} ml</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Disabled after a successful save to prevent duplicate records */}
          <div className="dc-save-row">
            <button
              type="button"
              className={`btn-primary ${saveStatus === 'saved' ? 'btn-saved' : ''}`}
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            >
              {saveBtnLabel()}
            </button>
            {saveStatus === 'error' && (
              <span className="dc-save-error">Could not save — check console for details.</span>
            )}
          </div>
        </div>
      )}

      {/* History — each saved record is reconstructed into a schedule table
          using the stored start_date, frequency_days, and duration_days */}
      <div className="dc-history">
        <h3 className="dc-history-title">Saved Dosage Records</h3>

        {histLoading && <p className="ap-loading">Loading history…</p>}
        {histError   && <p className="ap-error">{histError}</p>}

        {!histLoading && !histError && history.length === 0 && (
          <p className="ap-empty">
            No records saved yet. Calculate a dosage and click "Save to History".
          </p>
        )}

        {history.map((rec) => {
          const start    = new Date(rec.start_date);
          const doses    = doseSchedule(start, rec.frequency_days, rec.duration_days);
          const volumeMl = Number(rec.total_ml).toFixed(2);

          return (
            <div key={rec.id} className="dc-history-record card">

              <div className="dc-history-header">
                <div className="dc-history-meta">
                  <span className="dc-history-animal">{rec.animal_name}</span>
                  <span className="dc-history-sep">·</span>
                  <span className="dc-history-med">{rec.medication}</span>
                </div>

                <div className="dc-history-chips">
                  <span className="dc-chip">{Number(rec.total_mg).toFixed(2)} mg</span>
                  <span className="dc-chip dc-chip-green">{volumeMl} ml / dose</span>
                  <span className="dc-chip">Every {rec.frequency_days} day{rec.frequency_days > 1 ? 's' : ''}</span>
                  <span className="dc-chip">{fmtDate(rec.start_date)} → {fmtDate(rec.end_date)}</span>
                </div>

                <button
                  className="btn-danger dc-history-delete"
                  onClick={() => handleDeleteRecord(rec.id)}
                  title="Delete this record"
                >
                  ✕
                </button>
              </div>

              <table className="dc-table">
                <thead>
                  <tr>
                    <th>Dose #</th>
                    <th>Date</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {doses.map((date, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'dc-row-alt' : ''}>
                      <td>{i + 1}</td>
                      <td>{formatDoseDate(date)}</td>
                      <td>{volumeMl} ml</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          );
        })}
      </div>

    </div>
  );
}
