// A custom hook that replaces window.confirm() with our own styled dialog.
// The trick: we store the Promise's resolve function in state so the dialog buttons
// can settle the promise later, after the user has actually clicked something.
//
// Usage:
//   const { confirm, dialog } = useConfirm();
//   // put {dialog} somewhere in JSX
//   if (!await confirm('Delete this?')) return; // suspends until user responds

import { useState } from 'react';
import React from 'react';
import ConfirmDialog from './ConfirmDialog';

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', resolve: null });

  // Opens the dialog and returns a promise that won't settle until the user clicks
  function confirm(message) {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve });
    });
  }

  // User clicked "Delete" — resolve the promise with true so the caller proceeds
  function handleConfirm() {
    state.resolve(true);
    setState({ open: false, message: '', resolve: null });
  }

  // User clicked "Cancel" or the overlay — resolve with false so the caller bails out
  function handleCancel() {
    state.resolve(false);
    setState({ open: false, message: '', resolve: null });
  }

  // null when the dialog is closed so nothing extra renders in the DOM
  const dialog = state.open
    ? React.createElement(ConfirmDialog, {
        message:   state.message,
        onConfirm: handleConfirm,
        onCancel:  handleCancel,
      })
    : null;

  return { confirm, dialog };
}
