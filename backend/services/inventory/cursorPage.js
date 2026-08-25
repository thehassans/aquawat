/**
 * Cursor pagination helpers for large inventory lists (moves, lines, layers).
 * Cursor opaque: base64url(`${iso}|${id}`).
 */

export function encodeCursor(doc, dateField = 'updatedAt') {
  if (!doc?._id) return null;
  const d = doc[dateField] || doc.createdAt || new Date();
  const iso = d instanceof Date ? d.toISOString() : new Date(d).toISOString();
  return Buffer.from(`${iso}|${doc._id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const [iso, id] = raw.split('|');
    const date = new Date(iso);
    if (!id || Number.isNaN(date.getTime())) return null;
    return { date, id };
  } catch {
    return null;
  }
}

/** Mongo filter clause for (dateField, _id) descending keyset. */
export function cursorFilter(cursor, dateField = 'updatedAt') {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    $or: [
      { [dateField]: { $lt: decoded.date } },
      { [dateField]: decoded.date, _id: { $lt: decoded.id } },
    ],
  };
}

export function pageMeta({ items, limit, cursorField = 'updatedAt', total }) {
  const pageSize = Number(limit) || 80;
  const nextCursor = items.length >= pageSize
    ? encodeCursor(items[items.length - 1], cursorField)
    : null;
  return {
    pageSize,
    nextCursor,
    ...(total != null ? { total } : {}),
  };
}
