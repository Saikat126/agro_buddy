require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes        = require('./routes/auth.routes');
const animalsRoutes     = require('./routes/animals.routes');
const tasksRoutes       = require('./routes/tasks.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const calendarRoutes    = require('./routes/calendar.routes');
const vetsRoutes        = require('./routes/vets.routes');
const dosageRoutes      = require('./routes/dosage.routes');
const ordersRoutes      = require('./routes/orders.routes');
const paymentsRoutes    = require('./routes/payments.routes');
const uploadsRoutes     = require('./routes/uploads.routes');
const { UPLOAD_ROOT }   = require('./middleware/upload');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());
// SSLCommerz posts its ipn/success/fail/cancel callbacks as
// application/x-www-form-urlencoded, not JSON — without this, req.body is
// empty for every one of them.
app.use(express.urlencoded({ extended: true }));

// Serves everything under server/uploads/ at http://localhost:PORT/uploads/...
// — the local stand-in for what Supabase Storage's public buckets used to do.
app.use('/uploads', express.static(UPLOAD_ROOT));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/animals', animalsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/vets', vetsRoutes);
app.use('/api/dosage', dosageRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/uploads', uploadsRoutes);

// Catches multer errors (bad file type, too large) and anything else that
// slipped past a route's own try/catch, so the client always gets JSON back.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Agro Buddy API listening on http://localhost:${PORT}`);
});
