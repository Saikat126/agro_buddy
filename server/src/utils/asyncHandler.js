// Express 4 doesn't catch a rejected promise thrown inside an async route
// handler — without this, a DB error would just hang the request instead of
// reaching the error-handling middleware in index.js. Wrap every handler with
// this so `next(err)` always gets called.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
