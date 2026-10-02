const axios = require('axios');

// Sandbox vs live base URL — see SSLCZ_IS_LIVE in .env. Stay on sandbox until
// real (live) store credentials are in hand; sandbox payments never move real money.
const IS_LIVE = process.env.SSLCZ_IS_LIVE === 'true';
const BASE = IS_LIVE ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';

const INIT_URL     = `${BASE}/gwprocess/v4/api.php`;
const VALIDATE_URL = `${BASE}/validator/api/validationserverAPI.php`;

// Starts a gateway session for one payment attempt and returns the URL to
// redirect the buyer's browser to. total_amount always comes from the order
// row already stored in our own database (order.total) — never from the
// client — so a tampered request can't pay a different amount than what's owed.
async function initiateSession({ tranId, order }) {
  const base = process.env.SERVER_BASE_URL;

  const { data } = await axios.post(
    INIT_URL,
    new URLSearchParams({
      store_id:       process.env.SSLCZ_STORE_ID,
      store_passwd:   process.env.SSLCZ_STORE_PASSWORD,
      total_amount:   Number(order.total).toFixed(2),
      currency:       'BDT',
      tran_id:        tranId,
      success_url:    `${base}/api/payments/success`,
      fail_url:       `${base}/api/payments/fail`,
      cancel_url:     `${base}/api/payments/cancel`,
      ipn_url:        `${base}/api/payments/ipn`,
      // Passthrough field SSLCommerz echoes back on IPN/validation — a
      // belt-and-suspenders way to recover the order id alongside tran_id.
      value_a:        order.id,
      cus_name:       order.customer_name,
      cus_email:      order.customer_email,
      cus_add1:       order.customer_address,
      cus_city:       order.customer_district,
      cus_postcode:   '1000', // not collected by the checkout form — placeholder accepted by the sandbox
      cus_country:    'Bangladesh',
      cus_phone:      order.customer_phone,
      shipping_method: 'Courier',
      // No separate shipping address is collected by the checkout form —
      // ship_* mirrors cus_* (shipping = billing), which SSLCommerz requires
      // even when there's nothing to actually differ.
      ship_name:      order.customer_name,
      ship_add1:      order.customer_address,
      ship_city:      order.customer_district,
      ship_postcode:  '1000',
      ship_country:   'Bangladesh',
      num_product:    1,
      product_name:   'Agro Buddy Marketplace Order',
      product_category: 'General',
      product_profile: 'general',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return data; // { status, GatewayPageURL, ... } or { status: 'FAILED', failedreason }
}

// Authoritative server-to-server check — the only source of truth for whether
// a transaction actually went through. Never trust a gateway callback's own
// `status` field without this.
async function validateTransaction(valId) {
  const { data } = await axios.get(VALIDATE_URL, {
    params: {
      val_id:       valId,
      store_id:     process.env.SSLCZ_STORE_ID,
      store_passwd: process.env.SSLCZ_STORE_PASSWORD,
      format:       'json',
    },
  });
  return data; // { status: 'VALID' | 'VALIDATED' | ..., tran_id, amount, currency_type, ... }
}

module.exports = { initiateSession, validateTransaction };
