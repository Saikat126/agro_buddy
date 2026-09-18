const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { makeUploader, fileUrl } = require('../middleware/upload');

const router = express.Router();

// Avatar uploads go through POST /api/auth/avatar instead (it both saves the
// file and persists avatar_url onto the user row in one call, like the old
// Supabase uploadAvatar() did). These two are two-step: upload here to get a
// URL, then include that URL when creating/updating the animal or listing.
const animalUpload   = makeUploader('animals');
const listingUpload  = makeUploader('marketplace');

router.post('/animal', requireAuth, animalUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ url: fileUrl(req, 'animals', req.file.filename) });
});

router.post('/listing', requireAuth, listingUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ url: fileUrl(req, 'marketplace', req.file.filename) });
});

module.exports = router;
