const { verifyToken } = require('../utils/jwt');

// Requires a valid Bearer token. Sets req.userId on success.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

// Doesn't reject when there's no token — just attaches req.userId if a valid
// one is present. Used by routes like GET /marketplace that are public but
// behave differently for a signed-in caller (e.g. vets' is_public visibility).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.userId = verifyToken(token).sub;
    } catch {
      // Ignore a bad token on an optional route — just treat the caller as a guest.
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
