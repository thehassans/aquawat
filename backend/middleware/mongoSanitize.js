/**
 * Lightweight NoSQL injection guard (express-mongo-sanitize substitute).
 * Strips keys that start with `$` (and optionally contain `.`) from objects
 * in place — covers req.body / req.query / req.params.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Buffer);

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = sanitizeValue(value[i]);
    }
    return value;
  }
  if (!isPlainObject(value)) return value;

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      continue;
    }
    value[key] = sanitizeValue(value[key]);
  }
  return value;
}

export function mongoSanitize(req, _res, next) {
  if (req.body) sanitizeValue(req.body);
  if (req.query) sanitizeValue(req.query);
  if (req.params) sanitizeValue(req.params);
  next();
}

export default mongoSanitize;
