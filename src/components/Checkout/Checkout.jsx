import React, { useState, useEffect } from 'react';
import './Checkout.css';
import { placeOrder, fetchBuyerOrders } from './OrdersAPI';

const SHIPPING_FEE   = 65;
const SHIPPING_LABEL = 'Standard Delivery';

export default function Checkout({ cart, user, removeFromCart, updateQty, clearCart, onGoToMarket }) {

  const [form, setForm] = useState({
    fullName: '', address: '', district: '', phone: '', email: '', note: '',
  });

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
  }, [cart.length, user, placed]);

  // Clear the cart *after* the success screen has rendered, not before.
  // If we cleared it first the component would jump straight to the empty-cart view.
  useEffect(() => {
    if (placed) clearCart();
  }, [placed]);

  const subtotal    = cart.reduce((s, item) => s + Number(item.price) * item.quantity, 0);
  const shippingFee = SHIPPING_FEE;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      await placeOrder(form, { method: 'standard', fee: SHIPPING_FEE }, cart);
      setPlaced(true);
    } catch (apiErr) {
      setError(apiErr?.message || 'Failed to place order. Please try again.');
      console.error(apiErr);
    } finally {
      setSaving(false);
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
        <h2 className="section-title">My Orders</h2>

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

                <span className={`mp-order-status mp-status-${order.status} co-card-status`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>

                <h3 className="co-card-id">Order #{order.id.slice(0, 8).toUpperCase()}</h3>
                <p className="co-card-date">
                  {new Date(order.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>

                <ul className="co-card-items">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      <span className="co-card-item-title">{item.title}</span>
                      <span className="co-card-item-meta">×{item.quantity} — ${Number(item.item_subtotal).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="co-card-footer">
                  <span className="co-card-ship">{SHIPPING_LABEL} (${order.shipping_fee})</span>
                  <span className="co-card-total">${Number(order.subtotal).toFixed(2)} + ${order.shipping_fee}</span>
                </div>

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

              {/* Disabled while the request is in-flight to prevent double orders */}
              <button type="submit" className="btn-primary co-place-btn" disabled={saving}>
                {saving ? 'Placing Order…' : 'Place Order'}
              </button>

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
                    <td className="co-item-price">${(Number(item.price) * item.quantity).toFixed(2)}</td>
                    <td>
                      <button className="co-remove-btn" onClick={() => removeFromCart(item.id)} title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="co-divider" />
            <div className="co-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="co-row">
              <span>{SHIPPING_LABEL}</span>
              <span>${SHIPPING_FEE}</span>
            </div>
            <div className="co-divider" />
            <div className="co-total-row">
              <span>Total</span>
              <span className="co-total-amount">${subtotal.toFixed(2)} + ${shippingFee}</span>
            </div>

            <div className="co-payment">
              <label className="co-payment-option co-payment-active">
                <input type="radio" defaultChecked readOnly />
                <span>💵 Cash on Delivery</span>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
