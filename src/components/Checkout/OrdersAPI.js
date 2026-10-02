import client from '../../api/client';


// Creates the order (and its items) in one request — the backend wraps both
// inserts in a single database transaction.

export async function placeOrder(billing, shipping, cart) {
  const { data } = await client.post('/orders', { billing, shipping, cart });
  return data;
}


// Fetches all orders that contain at least one item belonging to the current seller.

export async function fetchSellerOrders() {
  const { data } = await client.get('/orders/seller');
  return data;
}


// Fetches all orders placed by the current user (buyer view), newest first.

export async function fetchBuyerOrders() {
  const { data } = await client.get('/orders/buyer');
  return data;
}


// Deletes an order and all its items (the backend cascades to order_items).
// Seller-only — this is the "Cancel" action from the seller's order panel.

export async function deleteOrder(orderId) {
  await client.delete(`/orders/${orderId}`);
}


// Lets a buyer remove one of their own orders from "My Orders" — only
// allowed once it's delivered or cancelled (the backend rejects otherwise).

export async function deleteMyOrder(orderId) {
  await client.delete(`/orders/${orderId}/mine`);
}


// Lets a seller move an order through the lifecycle: pending → confirmed → delivered.
export async function updateOrderStatus(orderId, status) {
  const { data } = await client.patch(`/orders/${orderId}/status`, { status });
  return data;
}


// Starts (or retries) an SSLCommerz payment session for an order already
// created with paymentMethod: 'online'. Returns a gatewayUrl to redirect the
// browser to — the actual payment happens on SSLCommerz's hosted page.
export async function initiatePayment(orderId) {
  const { data } = await client.post('/payments/initiate', { orderId });
  return data;
}
