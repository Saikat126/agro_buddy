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

export async function deleteOrder(orderId) {
  await client.delete(`/orders/${orderId}`);
}


// Lets a seller move an order through the lifecycle: pending → confirmed → delivered.
export async function updateOrderStatus(orderId, status) {
  const { data } = await client.patch(`/orders/${orderId}/status`, { status });
  return data;
}
