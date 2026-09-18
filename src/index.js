import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

// Grab the <div id="root"> from index.html and hand it over to React.
// Everything the app renders will live inside that div.
const root = ReactDOM.createRoot(document.getElementById('root'));

// StrictMode doesn't affect the production build — it just makes React
// intentionally run some things twice in dev so bugs surface early.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
