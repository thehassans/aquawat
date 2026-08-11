import multer from 'multer';

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

const DEFAULT_IMAGE_LIMIT = 10 * 1024 * 1024;

/**
 * Ready-made multer instance for image uploads (memory + MIME allowlist).
 * @param {{ fileSize?: number }} [opts]
 */
export function createImageUpload(opts = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: opts.fileSize ?? DEFAULT_IMAGE_LIMIT },
    fileFilter: imageFileFilter,
  });
}

/** Default image upload middleware (10MB). */
export const imageUpload = createImageUpload();

export default {
  ALLOWED_IMAGE_MIMES,
  isAllowedImageMime,
  imageFileFilter,
  createImageUpload,
  imageUpload,
};
