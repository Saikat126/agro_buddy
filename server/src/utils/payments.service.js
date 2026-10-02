const pool = require('../db');
const { validateTransaction } = require('./sslcommerz');

const VALID_STATUSES = new Set(['VALID', 'VALIDATED']);

// Shared by both the IPN webhook and the success-url redirect, so there's
// exactly one place that ever trusts SSLCommerz's confirmation. Looks the
// order up by our own transaction_id (never by an order id taken from the
// request) and re-validates with SSLCommerz's own Order Validation API
// before marking anything paid — the raw callback body is never trusted alone.
//
// The "AND payment_status != 'paid'" guard on both UPDATEs makes this
// idempotent: SSLCommerz retries the IPN, and the browser's success-url hit
// can arrive before or after it — whichever lands first wins, the other is a
// safe no-op.
async function confirmTransaction({ tranId, valId }) {
  const [[order] = []] = await pool.query(
    'SELECT * FROM orders WHERE transaction_id = ?', [tranId]
  );
  if (!order) return null;
  if (order.payment_status === 'paid') return order; // already settled — nothing to do

  let validation;
  try {
    validation = await validateTransaction(valId);
  } catch (err) {
    // Couldn't even reach SSLCommerz to ask (network blip/timeout) — this is
    // NOT the same as them answering "invalid". Leave the order untouched
    // rather than guessing 'failed': the IPN and success-redirect both call
    // this function independently, so whichever one manages to actually
    // reach the Validation API next will still resolve it correctly. Marking
    // it 'failed' here would be a permanent, wrong, unrecoverable state for
    // a payment that may well have genuinely succeeded.
    console.error('[payments] validation API call failed:', err.message);
    return order;
  }

  const amountMatches = Math.abs(Number(validation.amount) - Number(order.total)) < 0.01;
  const isValid = VALID_STATUSES.has(validation.status) && amountMatches;

  await pool.query(
    `UPDATE orders
     SET payment_status = ?, val_id = ?
     WHERE id = ? AND payment_status != 'paid'`,
    [isValid ? 'paid' : 'failed', valId || null, order.id]
  );

  if (isValid) {
    await pool.query(
      `UPDATE orders SET paid_at = NOW() WHERE id = ? AND paid_at IS NULL`,
      [order.id]
    );
  }

  const [[updated]] = await pool.query('SELECT * FROM orders WHERE id = ?', [order.id]);
  return updated;
}

// SSLCommerz's fail/cancel callbacks carry no val_id, so (unlike success/IPN)
// there's nothing to re-validate against their Validation API — this route
// has to trust the tran_id in the request. To keep that from being abusable
// indefinitely (a leaked/guessed tran_id for someone else's order used to
// grief it into 'failed' long after the fact), reject anything older than a
// real gateway round-trip ever takes. tran_id's own format — `${orderId}_${Date.now()}`,
// minted fresh by /initiate — carries this timestamp already, so no schema change is needed.
const MAX_CALLBACK_AGE_MS = 30 * 60 * 1000; // 30 minutes
function isTranIdFresh(tranId) {
  const ts = Number(String(tranId).split('_').pop());
  return Number.isFinite(ts) && (Date.now() - ts) < MAX_CALLBACK_AGE_MS;
}

// Used by the fail/cancel endpoints, which SSLCommerz calls without a val_id
// to validate (there's nothing to validate — the payment didn't go through).
async function markOrderUnsettled(tranId, status) {
  if (!isTranIdFresh(tranId)) return null;
  await pool.query(
    `UPDATE orders SET payment_status = ? WHERE transaction_id = ? AND payment_status != 'paid'`,
    [status, tranId]
  );
  const [[order] = []] = await pool.query('SELECT * FROM orders WHERE transaction_id = ?', [tranId]);
  return order || null;
}

module.exports = { confirmTransaction, markOrderUnsettled };
