const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Builds a multer instance that saves into uploads/<subfolder>/<userId>-<random>.<ext>,
// mirroring the <userId>/<file> layout the Supabase Storage buckets used to use.
function makeUploader(subfolder) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${req.userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      cb(null, unique);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, matches the frontend's own check
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Please upload an image file.'));
      }
      cb(null, true);
    },
  });
}

// Turns a saved file's disk path into the public URL the frontend stores as image_url.
function fileUrl(req, subfolder, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${filename}`;
}

module.exports = { makeUploader, fileUrl, UPLOAD_ROOT };
