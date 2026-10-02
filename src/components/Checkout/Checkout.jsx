import React, { useState, useEffect } from 'react';
import './Checkout.css';
import { placeOrder, fetchBuyerOrders, initiatePayment, deleteMyOrder } from './OrdersAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';

const SHIPPING_FEE   = 65;
const SHIPPING_LABEL = 'Standard Delivery';

// paymentReturn: { status: 'success'|'fail'|'cancel', orderId } | null — set
// by App.jsx after parsing ?payment=&order= off the URL when SSLCommerz
// redirects the buyer's browser back here (see payments.routes.js).
export default function Checkout({ cart, user, removeFromCart, updateQty, clearCart, onGoToMarket, paymentReturn, onClearPaymentReturn }) {

  const { confirm, dialog } = useConfirm();

  const [form, setForm] = useState({
    fullName: '', address: '', district: '', phone: '', email: '', note: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'online'
  const [redirecting,   setRedirecting]   = useState(false); // true while sending the browser to SSLCommerz

  const [placed,        setPlaced]        = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [orders,        setOrders]        = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Show order history when the cart is empty — only makes sense if someone is signed in
  useEffect(() => {
    if (cart.length > 0 || !user || placed) return;
    setOrdersLoading(true);
    fetchBuyerOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [cart.length, user, placed, paymentReturn]);

  // Clear the cart *after* the success screen has rendered, not before.
  // If we cleared it first the component would jump straight to the empty-cart view.
  useEffect(() => {
    if (placed) clearCart();
  }, [placed]);

  const subtotal = cart.reduce((s, item) => s + Number(item.price) * item.quantity, 0);

  // Free delivery only when every seller in the cart is in the same district
  // as the buyer's delivery address — this is a preview; the server
  // recomputes it from the DB when the order is actually placed.
  const buyerDistrict = form.district.trim().toLowerCase();
  const sameCityOrder = buyerDistrict.length > 0 && cart.every(
    (item) => (item.seller_district || '').trim().toLowerCase() === buyerDistrict
  );
  const shippingFee = sameCityOrder ? 0 : SHIPPING_FEE;

  function handleChange(e) {
    const { name } = e.target;
    setForm((prev) => ({ ...prev, [name]: capitalizedValue(e) }));
  }

  function validate() {
    if (!form.fullName.trim())  return 'Full name is required.';
    if (!form.address.trim())   return 'Address is required.';
    if (!form.district.trim())  return 'District is required.';
    // Strip non-digits then check length — handles spaces, dashes, country codes
    if (form.phone.replace(/\D/g, '').length < 10) return 'Please enter a valid phone number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    return '';
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const order = await placeOrder(form, { method: 'standard', fee: shippingFee, paymentMethod }, cart);

      if (paymentMethod === 'online') {
        // Order already exists (pending/unpaid) — now send the browser to
        // SSLCommerz's hosted page. Cart gets cleared regardless, since the
        // order itself has already been created either way.
        setRedirecting(true);
        const { gatewayUrl } = await initiatePayment(order.id);
        clearCart();
        window.location.href = gatewayUrl; // full navigation away from the SPA
        return;
      }

      setPlaced(true);
    } catch (apiErr) {
      setError(apiErr?.message || 'Failed to place order. Please try again.');
      console.error(apiErr);
      setRedirecting(false);
    } finally {
      setSaving(false);
    }
  }

  // Lets the buyer retry payment on an order that's still unpaid (payment
  // failed, or they cancelled out of the gateway page) without re-entering
  // their billing details or creating a duplicate order.
  async function handleRetryPayment(order) {
    try {
      const { gatewayUrl } = await initiatePayment(order.id);
      window.location.href = gatewayUrl;
    } catch (apiErr) {
      setError(apiErr?.message || 'Could not start payment. Please try again.');
    }
  }

  // Backs out of checkout entirely — empties the cart rather than leaving it
  // around, since the items were only there to be bought right now.
  async function handleCancel() {
    if (!await confirm('Cancel checkout and empty your cart?')) return;
    clearCart();
    onGoToMarket();
  }

  // Lets the buyer clear a delivered/cancelled order out of their own order
  // history — the backend rejects this for anything still active, so there's
  // no risk of a seller's in-progress order disappearing on them.
  async function handleRemoveOrder(order) {
    if (!await confirm('Remove this order from your history?')) return;
    try {
      await deleteMyOrder(order.id);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (apiErr) {
      setError(apiErr?.message || 'Could not remove this order.');
    }
  }

  // Order confirmed — show a thank-you screen instead of the form
  if (placed) {
    return (
      <div className="checkout-empty">
        <div className="checkout-empty-card card">
          <div className="checkout-empty-icon">✅</div>
          <h2>Order Placed!</h2>
          <p>Thank you, <strong>{form.fullName}</strong>. Your order has been received and will be delivered to <strong>{form.address}</strong>.</p>
          <button className="btn-primary" onClick={onGoToMarket} style={{ marginTop: 16 }}>
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // Cart is empty — show past orders instead of a blank page
  if (cart.length === 0) {
    return (
      <div className="checkout">
        {dialog}
        <h2 className="section-title">My Orders</h2>

        {/* Set by App.jsx after SSLCommerz redirects the browser back here
            with ?payment=success|fail|cancel&order=... */}
        {paymentReturn && (
          <div className={`co-payment-banner co-payment-banner-${paymentReturn.status}`}>
            {paymentReturn.status === 'success' && '✅ Payment received — thank you!'}
            {paymentReturn.status === 'fail'    && '⚠️ Payment failed. You can retry it below.'}
            {paymentReturn.status === 'cancel'  && 'Payment cancelled. You can retry it below whenever you\'re ready.'}
            <button className="co-banner-dismiss" onClick={onClearPaymentReturn} aria-label="Dismiss">✕</button>
          </div>
        )}

        <div className="co-empty-hint">
          {!ordersLoading && orders.length === 0 && (
            <span>Your cart is empty.</span>
          )}
          <button className="btn-primary" onClick={onGoToMarket} style={{ marginLeft: 12 }}>
            Go to Marketplace
          </button>
        </div>

        {ordersLoading && <p className="ap-loading">Loading your orders…</p>}

        {!ordersLoading && orders.length > 0 && (
          <div className="co-order-grid">
            {orders.map((order) => (
              <div key={order.id} className="co-order-card card">

                <div className="co-card-badges">
                  <span className={`mp-order-status mp-status-${order.status} co-card-status`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  {order.payment_method === 'online' && (
                    <span className={`co-payment-badge co-payment-badge-${order.payment_status}`}>
                      {order.payment_status === 'paid' ? '💳 Paid Online' : order.payment_status === 'failed' ? '⚠️ Payment Failed' : '💳 Awaiting Payment'}
                    </span>
                  )}
                </div>

                <h3 className="co-card-id">Order #{order.id.slice(0, 8).toUpperCase()}</h3>
                <p className="co-card-date">
                  {new Date(order.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>

                <ul className="co-card-items">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      <span className="co-card-item-info">
                        <span className="co-card-item-title">{item.title}</span>
                        <span className="co-item-seller">🧑‍🌾 {item.seller_name}</span>
                      </span>
                      <span className="co-card-item-meta">×{item.quantity} — BDT {Number(item.item_subtotal).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="co-card-footer">
                  <span className="co-card-ship">{SHIPPING_LABEL} (BDT {order.shipping_fee})</span>
                  <span className="co-card-total">BDT {Number(order.subtotal).toFixed(2)} + {order.shipping_fee}</span>
                </div>

                {order.payment_method === 'online' && order.payment_status !== 'paid' && (
                  <button className="btn-primary co-retry-btn" onClick={() => handleRetryPayment(order)}>
                    Retry Payment
                  </button>
                )}

                {['delivered', 'cancelled'].includes(order.status) && (
                  <button className="btn-danger co-remove-order-btn" onClick={() => handleRemoveOrder(order)}>
                    Remove
                  </button>
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main checkout layout — billing form on the left, order summary on the right
  return (
    <div className="checkout">
      {dialog}
      <h2 className="section-title">Checkout</h2>

      <div className="checkout-layout">

        <div className="checkout-form-col">
          <div className="card checkout-card">
            <h3 className="checkout-section-heading">Billing &amp; Shipping</h3>

            <form onSubmit={handlePlaceOrder}>

              <label className="co-label">
                Full Name *
                <input className="input-field" type="text" name="fullName"
                  value={form.fullName} onChange={handleChange} placeholder="Your full name" />
              </label>

              <label className="co-label">
                Full Address *
                <input className="input-field" type="text" name="address"
                  value={form.address} onChange={handleChange}
                  placeholder="Your full address with thana and district name" />
              </label>

              <label className="co-label">
                District *
                <input className="input-field" type="text" name="district"
                  value={form.district} onChange={handleChange}
                  placeholder="District name (for Dhaka, area; ex: Banani)" />
              </label>

              <label className="co-label">
                Phone *
                <input className="input-field" type="tel" name="phone"
                  value={form.phone} onChange={handleChange} placeholder="+880 1700 000000" />
              </label>

              <label className="co-label">
                Email Address *
                <input className="input-field" type="email" name="email"
                  value={form.email} onChange={handleChange} placeholder="A valid email address" />
              </label>

              <label className="co-label">
                Order Note (optional)
                <textarea className="input-field" name="note" value={form.note}
                  onChange={handleChange} rows={2}
                  placeholder="Special instructions for your order..." />
              </label>

              {error && <p className="ap-error">{error}</p>}

              <div className="co-form-actions">
                {/* Disabled while the request is in-flight to prevent double orders */}
                <button type="submit" className="btn-primary co-place-btn" disabled={saving || redirecting}>
                  {redirecting ? 'Redirecting to payment…' : saving ? 'Placing Order…' : paymentMethod === 'online' ? 'Proceed to Payment' : 'Place Order'}
                </button>
                <button type="button" className="btn-secondary co-cancel-btn" onClick={handleCancel} disabled={saving || redirecting}>
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>

        <div className="checkout-summary-col">
          <div className="card checkout-card">
            <h3 className="checkout-section-heading">Order Summary</h3>

            <table className="co-items-table">
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Subtotal</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="co-item-title">{item.title}</span>
                      <span className="co-item-seller">🧑‍🌾 {item.seller_name}</span>
                    </td>
                    <td>
                      <div className="co-qty-wrap">
                        {/* Decrementing to 0 removes the item entirely (handled by updateQty in App.jsx) */}
                        <button className="co-qty-btn" onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                        <span className="co-qty-val">{item.quantity}</span>
                        <button className="co-qty-btn" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                      </div>
                    </td>
                    <td className="co-item-price">BDT {(Number(item.price) * item.quantity).toFixed(2)}</td>
                    <td>
                      <button className="co-remove-btn" onClick={() => removeFromCart(item.id)} title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="co-divider" />
            <div className="co-row"><span>Subtotal</span><span>BDT {subtotal.toFixed(2)}</span></div>
            <div className="co-row">
              <span>{SHIPPING_LABEL}</span>
              <span>{sameCityOrder ? 'Free (same city)' : `BDT ${SHIPPING_FEE}`}</span>
            </div>
            <div className="co-divider" />
            <div className="co-total-row">
              <span>Total</span>
              <span className="co-total-amount">BDT {subtotal.toFixed(2)} + {shippingFee}</span>
            </div>

            <div className="co-payment">
              <label className={`co-payment-option ${paymentMethod === 'cod' ? 'co-payment-active' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <span>💵 Cash on Delivery</span>
              </label>
              <label className={`co-payment-option ${paymentMethod === 'online' ? 'co-payment-active' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                />
                <span>💳 Pay Online (bKash / Nagad / Rocket / Card)</span>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
