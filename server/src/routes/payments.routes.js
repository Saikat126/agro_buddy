const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { initiateSession } = require('../utils/sslcommerz');
const { confirmTransaction, markOrderUnsettled } = require('../utils/payments.service');

const router = express.Router();

// This router is mounted separately from orders.routes.js (which applies
// requireAuth to every route) because SSLCommerz's own servers call
// /ipn directly and carry no JWT — only /initiate needs auth.

// POST /api/payments/initiate — starts (or retries) an online-payment attempt
// for an order the caller owns.
router.post('/initiate', requireAuth, asyncHandler(async (req, res) => {
  // Checked before even touching the DB/gateway — without real credentials
  // SSLCommerz itself only replies with a vague "Store Credential Error",
  // which isn't actionable for whoever's testing this locally.
  if (!process.env.SSLCZ_STORE_ID || process.env.SSLCZ_STORE_ID === 'your-sandbox-store-id') {
    return res.status(503).json({
      error: 'Online payment isn\'t set up yet — register for sandbox credentials at ' +
             'https://developer.sslcommerz.com/registration/ and add them to server/.env. ' +
             'Cash on Delivery still works normally.',
    });
  }

  const { orderId } = req.body;
  const [[order] = []] = await pool.query(
    'SELECT * FROM orders WHERE id = ? AND buyer_id = ?', [orderId, req.userId]
  );
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_method !== 'online') {
    return res.status(400).json({ error: 'This order was not placed for online payment.' });
  }
  if (order.payment_status === 'paid') {
    return res.status(409).json({ error: 'This order has already been paid.' });
  }

  // Fresh tran_id per attempt — a buyer retrying after a failed/cancelled
  // payment needs a new one; SSLCommerz requires tran_id to be unique per session.
  const tranId = `${order.id}_${Date.now()}`;
  await pool.query('UPDATE orders SET transaction_id = ? WHERE id = ?', [tranId, order.id]);

  const session = await initiateSession({ tranId, order });
  if (session.status !== 'SUCCESS' || !session.GatewayPageURL) {
    console.error('[payments] initiate failed:', session.failedreason || session);
    return res.status(502).json({ error: 'Could not start the payment session. Please try again.' });
  }

  res.json({ gatewayUrl: session.GatewayPageURL });
}));

// POST /api/payments/ipn — SSLCommerz's authoritative server-to-server
// confirmation. No auth (can't carry a JWT); always acks 200 so it stops retrying.
router.post('/ipn', asyncHandler(async (req, res) => {
  await confirmTransaction({ tranId: req.body.tran_id, valId: req.body.val_id });
  res.status(200).json({ received: true });
}));

// POST/GET /api/payments/success|fail|cancel — the buyer's own browser lands
// here after the gateway page. success/fail re-validate the same way the IPN
// does (idempotent — whichever of the two arrives first wins); cancel just
// means the buyer backed out, nothing to validate.
function redirectTo(res, result, orderId) {
  const base = process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(`${base}/?payment=${result}&order=${orderId || ''}`);
}

const handleSuccess = asyncHandler(async (req, res) => {
  const order = await confirmTransaction({ tranId: req.body.tran_id || req.query.tran_id, valId: req.body.val_id || req.query.val_id });
  redirectTo(res, order?.payment_status === 'paid' ? 'success' : 'fail', order?.id);
});

const handleFail = asyncHandler(async (req, res) => {
  const tranId = req.body.tran_id || req.query.tran_id;
  const order = await markOrderUnsettled(tranId, 'failed');
  redirectTo(res, 'fail', order?.id);
});

const handleCancel = asyncHandler(async (req, res) => {
  const tranId = req.body.tran_id || req.query.tran_id;
  // Nothing failed — the buyer just backed out — so payment_status stays
  // 'unpaid' (not 'failed') and they can retry the same order.
  const [[order] = []] = await pool.query('SELECT * FROM orders WHERE transaction_id = ?', [tranId]);
  redirectTo(res, 'cancel', order?.id);
});

router.post('/success', handleSuccess);
router.get('/success', handleSuccess);
router.post('/fail', handleFail);
router.get('/fail', handleFail);
router.post('/cancel', handleCancel);
router.get('/cancel', handleCancel);

module.exports = router;
