import React, { useState, useEffect, useMemo, useRef } from 'react';
import './Marketplace.css';
import { fetchListings, createListing, updateListing, deleteListing, uploadListingImage, fetchListingPerformance, VALID_CATEGORIES } from './MarketplaceAPI';
import { fetchSellerOrders, updateOrderStatus, deleteOrder } from '../Checkout/OrdersAPI';
import { useConfirm } from '../shared/useConfirm';
import { capitalizedValue } from '../shared/textCase';

export default function Marketplace({ user, addToCart, onGoToCheckout }) {

  const { confirm, dialog } = useConfirm();

  // 'browse' shows listings; 'orders' shows incoming orders for sellers
  const [view,     setView]     = useState('browse');
  const [listings, setListings] = useState([]);

  // Detail view opened by clicking one of "Your Listings" — holds the full
  // record (including the sales totals the backend joins in) for whichever
  // listing was clicked, or null when the modal is closed.
  const [detailListing, setDetailListing] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState(null);

  async function openPerformance(id) {
    setDetailListing({}); // opens the modal immediately with a loading state
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchListingPerformance(id);
      setDetailListing(data);
    } catch (err) {
      setDetailError('Could not load this listing\'s performance.');
    } finally {
      setDetailLoading(false);
    }
  }

  // Search is the only way to discover other people's listings —
  // no search = no results, so the page isn't a firehose on first load
  const [searchQuery, setSearchQuery] = useState('');

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title:       '',
    category:    'Livestock',
    price:       '',
    unit:        '',
    description: '',
  });

  // Product photo for the listing being created/edited — held as a local
  // file/preview until submit, when it's uploaded and its URL is attached.
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const formRef = useRef(null);

  // Set to a listing's id while editing it (instead of creating a new one).
  // The photo it already had, kept separately so saving an edit without
  // picking a new file doesn't wipe out the existing one.
  const [editingId,        setEditingId]        = useState(null);
  const [existingImageUrl, setExistingImageUrl]  = useState(null);

  // Bumped on every "Edit" click (see startEdit) so the scroll effect below
  // always re-fires — even re-selecting the *same* listing that's already
  // open, where neither showForm nor editingId actually change value, so a
  // dependency on those alone wouldn't re-trigger it.
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // Whenever the form opens (adding or editing), scroll it into view — it
  // renders at the top of the page, so without this, opening it while
  // scrolled down (e.g. after clicking "Edit" from a card further down the
  // grid) looks like nothing happened.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editingId, scrollTrigger]);

  const [sellerOrders,  setSellerOrders]  = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError,   setOrdersError]   = useState(null);

  // Only fetch seller orders when the orders tab is actually open
  useEffect(() => {
    if (view !== 'orders' || !user) return;
    setOrdersLoading(true);
    setOrdersError(null);
    fetchSellerOrders()
      .then(setSellerOrders)
      .catch(() => setOrdersError('Could not load orders.'))
      .finally(() => setOrdersLoading(false));
  }, [view, user]);

  async function handleOrderStatusChange(orderId, newStatus) {
    try {
      if (newStatus === 'removed') {
        // Only ever sent for an order already in a terminal state
        // (delivered/cancelled, enforced by the button's own visibility
        // below) — the transaction is fully resolved by then, so deleting
        // the row outright (cascading to order_items) has nothing left to protect.
        await deleteOrder(orderId);
        setSellerOrders((prev) => prev.filter((entry) => entry.order.id !== orderId));
      } else {
        // 'confirmed', 'delivered', and 'cancelled' all persist a real status
        // value instead of deleting the row. This is what lets a paid order
        // still be marked delivered (deleting it would discard its payment
        // record), and lets a cancelled order actually show up — and later
        // be removed — in the buyer's own order history instead of just
        // vanishing. Cancelling a paid order is still blocked server-side
        // (409) since that would need a refund first.
        await updateOrderStatus(orderId, newStatus);
        setSellerOrders((prev) =>
          prev.map((entry) =>
            entry.order.id === orderId
              ? { ...entry, order: { ...entry.order, status: newStatus } }
              : entry
          )
        );
      }
    } catch (err) {
      // A paid-online order returns 409 with a specific message (see
      // orders.routes.js) rather than the generic fallback — show it as-is
      // since it tells the seller exactly why the action was blocked.
      setOrdersError(err.message || 'Could not update order. Please try again.');
      console.error(err);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchListings();
      setListings(data);
    } catch (err) {
      setError('Could not load marketplace listings.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // The signed-in user's own listings — shown by default when there's no active search
  const myListings = useMemo(() => {
    if (!user) return [];
    return listings.filter((item) => item.user_id === user.id);
  }, [listings, user]);

  // Search results — only populated when the user has typed something
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return listings.filter((item) =>
      item.title.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  function handleInputChange(e) {
    const { name } = e.target;
    setFormData((prev) => ({ ...prev, [name]: capitalizedValue(e) }));
  }

  function resetForm() {
    setFormData({ title: '', category: 'Livestock', price: '', unit: '', description: '' });
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    setExistingImageUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  // Opens the form pre-filled with an existing listing's data instead of blank.
  function startEdit(listing) {
    setEditingId(listing.id);
    setFormData({
      title:       listing.title || '',
      category:    listing.category || 'Livestock',
      price:       listing.price || '',
      unit:        listing.unit || '',
      description: listing.description || '',
    });
    setImageFile(null);
    setImagePreview(listing.image_url || null);
    setExistingImageUrl(listing.image_url || null);
    setShowForm(true);
    setScrollTrigger((n) => n + 1); // always re-scroll, even re-selecting the same listing
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmitListing(e) {
    e.preventDefault();

    if (!formData.title.trim() || !formData.price) {
      alert('Title and price are required.');
      return;
    }

    try {
      // Keep the existing photo unless a new one was picked — otherwise
      // saving an edit without touching the photo field would wipe it out.
      let image_url = existingImageUrl;
      if (imageFile) {
        setImageUploading(true);
        image_url = await uploadListingImage(imageFile);
      }

      if (editingId) {
        const updated = await updateListing(editingId, { ...formData, image_url });
        setListings((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const newListing = await createListing({ ...formData, image_url });
        // Prepend so the new listing appears at the top without a full re-fetch
        setListings((prev) => [newListing, ...prev]);
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(editingId ? 'Failed to save changes.' : 'Failed to post listing.');
      console.error(err);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!await confirm('Remove this listing?')) return;
    try {
      await deleteListing(id);
      setListings((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError('Failed to remove listing.');
    }
  }

  return (
    <div className="marketplace">
      {dialog}

      <div className="mp-header">
        <div className="mp-header-left">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Farm Marketplace</h2>
          {user && (
            <div className="mp-view-toggle">
              <button
                className={`mp-toggle-btn ${view === 'browse' ? 'active' : ''}`}
                onClick={() => setView('browse')}
              >
                Browse
              </button>
              <button
                className={`mp-toggle-btn ${view === 'orders' ? 'active' : ''}`}
                onClick={() => {
                  if (showForm) { resetForm(); setShowForm(false); }
                  setView('orders');
                }}
              >
                Incoming Orders
              </button>
            </div>
          )}
        </div>
        {view !== 'orders' && (
          user ? (
            <button className="btn-primary" onClick={() => {
              if (showForm) resetForm();
              setShowForm((p) => !p);
            }}>
              {showForm ? 'Cancel' : '+ Post Listing'}
            </button>
          ) : (
            <span className="mp-signin-hint">Login to post a listing</span>
          )
        )}
      </div>

      {/* Seller orders panel — only rendered when that tab is selected */}
      {view === 'orders' && user && (
        <SellerOrdersPanel
          orders={sellerOrders}
          loading={ordersLoading}
          error={ordersError}
          onStatusChange={handleOrderStatusChange}
        />
      )}

      {view === 'browse' && (
      <>

      {showForm && user && (
        <form ref={formRef} className="mp-form card" onSubmit={handleSubmitListing}>
          <h3 className="mp-form-title">{editingId ? 'Edit Listing' : 'New Listing'}</h3>

          <label className="ap-label">
            Product Photo
            <div className="mp-image-upload" onClick={() => imageInputRef.current?.click()}>
              {imagePreview ? (
                <img src={imagePreview} alt="Listing preview" className="mp-image-preview" />
              ) : (
                <span className="mp-image-upload-hint">📷 Click to add a photo</span>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </label>

          <label className="ap-label">
            Title *
            <input
              className="input-field"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g. Holstein Cows for Sale"
            />
          </label>

          <label className="ap-label">
            Category *
            <select
              className="input-field"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
            >
              {VALID_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <div className="mp-row">
            <label className="ap-label">
              Price (BDT) *
              <input
                className="input-field"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                min="0"
                placeholder="0.00"
              />
            </label>

            <label className="ap-label">
              Unit
              <input
                className="input-field"
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="e.g. per head, per kg"
              />
            </label>
          </div>

          <label className="ap-label">
            Description
            <textarea
              className="input-field"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Details about the listing..."
            />
          </label>

          <button type="submit" className="btn-primary" disabled={imageUploading}>
            {imageUploading ? 'Uploading photo…' : editingId ? 'Save Changes' : 'Post Listing'}
          </button>
        </form>
      )}

      <input
        className="input-field mp-search"
        type="text"
        placeholder="Search by listing name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {loading && <p className="ap-loading">Loading listings...</p>}
      {error   && <p className="ap-error">{error}</p>}

      {!loading && !error && (
        <>
          {!isSearching && (
            <>
              {user ? (
                <>
                  <p className="mp-section-label">Your Listings</p>
                  {myListings.length === 0 ? (
                    <p className="ap-empty">
                      You haven't posted any listings yet. Click <strong>+ Post Listing</strong> to add one.
                    </p>
                  ) : (
                    <ListingsGrid items={myListings} user={user} onDelete={handleDelete} onEdit={startEdit} onAddToCart={addToCart} onGoToCheckout={onGoToCheckout} onCardClick={openPerformance} />
                  )}
                  <p className="mp-search-hint">
                    Search above to browse listings from other farmers.
                  </p>
                </>
              ) : (
                <p className="ap-empty">Search by listing name to browse the marketplace.</p>
              )}
            </>
          )}

          {isSearching && (
            <>
              {searchResults.length === 0 ? (
                <p className="ap-empty">No listings found for "{searchQuery}".</p>
              ) : (
                <>
                  <p className="mp-section-label">
                    Search results for "{searchQuery}" ({searchResults.length})
                  </p>
                  <ListingsGrid items={searchResults} user={user} onDelete={handleDelete} onEdit={startEdit} onAddToCart={addToCart} onGoToCheckout={onGoToCheckout} onCardClick={openPerformance} />
                </>
              )}
            </>
          )}
        </>
      )}

      </>
      )}

      {detailListing && (
        <ListingPerformanceModal
          listing={detailListing}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailListing(null)}
        />
      )}

    </div>
  );
}

// Shows incoming orders for a seller. Each card displays full customer info
// plus action buttons to confirm, cancel, or mark as delivered.
function SellerOrdersPanel({ orders, loading, error, onStatusChange }) {
  const SHIP_LABELS = { inside: 'Inside Dhaka', suburbs: 'Dhaka Suburbs', outside: 'Outside Dhaka', standard: 'Standard Delivery' };

  if (loading) return <p className="ap-loading">Loading orders…</p>;
  if (error)   return <p className="ap-error">{error}</p>;
  if (orders.length === 0) return (
    <p className="ap-empty">No incoming orders yet. Orders will appear here when customers buy your listings.</p>
  );

  return (
    <div className="mp-orders-list">
      {orders.map(({ order, items }) => {
        if (!order) return null; // RLS blocked the join — skip the row
        const isPending   = order.status === 'pending';
        const isConfirmed = order.status === 'confirmed';
        const isTerminal   = order.status === 'delivered' || order.status === 'cancelled';
        return (
        <div key={order.id} className="mp-order-card card">

          <div className="mp-order-header">
            <div>
              <span className="mp-order-id">Order #{order.id.slice(0, 8).toUpperCase()}</span>
              <span className="mp-order-date">
                {new Date(order.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
            <div className="mp-order-header-right">
              <span className={`mp-order-status mp-status-${order.status}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              {order.payment_method === 'online' && (
                <span className={`co-payment-badge co-payment-badge-${order.payment_status}`}>
                  {order.payment_status === 'paid' ? '💳 Paid Online' : order.payment_status === 'failed' ? '⚠️ Payment Failed' : '💳 Awaiting Payment'}
                </span>
              )}
              {isPending && (
                <div className="mp-order-actions">
                  <button
                    className="btn-primary mp-action-btn"
                    onClick={() => onStatusChange(order.id, 'confirmed')}
                  >
                    ✓ Confirm
                  </button>
                  <button
                    className="btn-danger mp-action-btn"
                    onClick={() => onStatusChange(order.id, 'cancelled')}
                    disabled={order.payment_status === 'paid'}
                    title={order.payment_status === 'paid' ? 'Paid online — refund before cancelling.' : undefined}
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
              {isConfirmed && (
                <div className="mp-order-actions">
                  <button
                    className="btn-primary mp-action-btn"
                    onClick={() => onStatusChange(order.id, 'delivered')}
                  >
                    📦 Mark Delivered
                  </button>
                </div>
              )}
              {isTerminal && (
                <div className="mp-order-actions">
                  <button
                    className="btn-danger mp-action-btn"
                    onClick={() => onStatusChange(order.id, 'removed')}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mp-order-body">
            <div className="mp-customer-details">
              <p className="mp-order-section-label">Customer Details</p>
              <table className="mp-customer-table">
                <tbody>
                  <tr><td>Name</td><td><strong>{order.customer_name}</strong></td></tr>
                  <tr><td>Address</td><td>{order.customer_address}</td></tr>
                  <tr><td>District</td><td>{order.customer_district}</td></tr>
                  <tr><td>Phone</td><td><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></td></tr>
                  <tr><td>Email</td><td><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></td></tr>
                  {order.customer_note && <tr><td>Note</td><td><em>{order.customer_note}</em></td></tr>}
                  <tr><td>Shipping</td><td>{SHIP_LABELS[order.shipping_method] || order.shipping_method} (BDT {order.shipping_fee})</td></tr>
                </tbody>
              </table>
            </div>

            <div className="mp-ordered-items">
              <p className="mp-order-section-label">Your Items in This Order</p>
              <table className="mp-items-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.quantity}</td>
                      <td>BDT {Number(item.price).toFixed(2)}</td>
                      <td><strong>BDT {Number(item.item_subtotal).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mp-order-your-total">
                Your items total: <strong>BDT {items.reduce((s, i) => s + Number(i.item_subtotal), 0).toFixed(2)}</strong>
              </p>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// Shown when one of "Your Listings" is clicked. Displays that listing's
// details plus its lifetime sales, pulled in via the backend's RIGHT JOIN
// across order_items/orders/marketplace_items/users (so a listing that's
// never sold still shows 0s instead of an error).
function ListingPerformanceModal({ listing, loading, error, onClose }) {
  return (
    <div className="mp-detail-overlay" onClick={onClose}>
      <div className="mp-detail-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="mp-detail-close" onClick={onClose} type="button" aria-label="Close">✕</button>

        {loading && <p className="ap-loading">Loading…</p>}
        {error   && <p className="ap-error">{error}</p>}

        {!loading && !error && (
          <>
            <h3 className="mp-card-title">{listing.title}</h3>
            <span className="mp-category-badge">{listing.category}</span>
            <div className="mp-price">BDT {Number(listing.price).toFixed(2)}</div>
            <p className="mp-detail-status">Status: <strong>{listing.available ? 'Available' : 'Hidden'}</strong></p>

            <div className="mp-detail-divider" />

            <p className="mp-detail-section-label">Sales Performance</p>
            <ul className="mp-detail-stats">
              <li><span>Times ordered</span><strong>{listing.times_ordered}</strong></li>
              <li><span>Units sold</span><strong>{listing.total_quantity_sold}</strong></li>
              <li><span>Revenue</span><strong>BDT {Number(listing.total_revenue).toFixed(2)}</strong></li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Renders a grid of listing cards. "Add to Cart" is hidden for the owner's own
// listings; those instead open the seller's sales-performance modal on click
// (their action buttons stop that click from bubbling up to the card).
function ListingsGrid({ items, user, onDelete, onEdit, onAddToCart, onGoToCheckout, onCardClick }) {
  return (
    <div className="mp-grid">
      {items.map((item) => {
        const isOwner = user && user.id === item.user_id;
        return (
        <div
          key={item.id}
          className={`mp-card card ${isOwner ? 'mp-card-clickable' : ''}`}
          onClick={isOwner ? () => onCardClick(item.id) : undefined}
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="mp-card-image" />
          ) : (
            <div className="mp-card-image mp-card-image-placeholder">🌾</div>
          )}
          <h3 className="mp-card-title">{item.title}</h3>
          <span className="mp-category-badge">{item.category}</span>
          <div className="mp-price">
            BDT {Number(item.price).toFixed(2)}
            {item.unit && <span className="mp-unit"> {item.unit}</span>}
          </div>
          <p className="mp-description">{item.description}</p>
          <div className="mp-footer">
            <span className="mp-seller">🧑‍🌾 {item.seller_name}</span>
          </div>
          <div className="mp-card-actions">
            {/* Only show "Add to Cart" for other people's listings, not your own */}
            {user && !isOwner && (
              <button
                className="btn-primary mp-cart-btn"
                onClick={() => {
                  onAddToCart(item);
                  onGoToCheckout();
                }}
              >
                🛒 Add to Cart
              </button>
            )}
            {isOwner && (
              <span className="mp-own-badge">Your Listing</span>
            )}
            {isOwner && (
              <button className="btn-primary" onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                Edit
              </button>
            )}
            {isOwner && (
              <button className="btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                Remove
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
