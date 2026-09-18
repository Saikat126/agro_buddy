// Reusable confirmation modal — shown before any destructive action.
// Rendered by the useConfirm() hook, not placed directly in component JSX.

import React from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    // Clicking the dark overlay dismisses the dialog (same as clicking Cancel)
    <div className="confirm-overlay" onClick={onCancel}>

      {/* stopPropagation prevents clicks inside the card from bubbling up to the overlay
          and accidentally closing the dialog when the user is just reading it */}
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">⚠</div>
        <p className="confirm-title">Are you sure?</p>
        <p className="confirm-message">{message} This action cannot be undone.</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-delete" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
