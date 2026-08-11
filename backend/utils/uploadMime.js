/** Allowed image MIME types for multer uploads (logo, QR hero, menu images, etc.). */
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const isAllowedImageMime = (mime) => ALLOWED_IMAGE_MIMES.has(String(mime || '').toLowerCase());

/** Multer fileFilter that accepts only allowlisted image MIME types. */
export const imageFileFilter = (_req, file, cb) => {
  if (isAllowedImageMime(file?.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
};
