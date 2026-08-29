import DocumentMessage from '../../models/sales/DocumentMessage.js';

export async function appendDocumentMessage({
  tenantId,
  docType,
  docId,
  userId = null,
  body,
  kind = 'note',
}) {
  if (!tenantId || !docType || !docId || !body) return null;
  return DocumentMessage.create({
    tenantId,
    docType,
    docId,
    createdBy: userId || undefined,
    body: String(body).slice(0, 4000),
    kind,
  });
}

export async function listDocumentMessages({ tenantId, docType, docId, limit = 100 }) {
  return DocumentMessage.find({ tenantId, docType, docId })
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Number(limit) || 100))
    .populate('createdBy', 'firstName lastName email')
    .lean();
}
