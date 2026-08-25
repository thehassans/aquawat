import InvLocation from '../../models/inventory/InvLocation.js';

export async function getLocationSubtreeIds(tenantId, locationId) {
  const root = await InvLocation.findOne({ _id: locationId, tenantId }).lean();
  if (!root) return [];
  const prefix = root.completePath;
  const descendants = await InvLocation.find({
    tenantId,
    completePath: new RegExp(`^${escapeRegex(prefix)}/`),
    active: true,
  }).select('_id').lean();
  return [String(root._id), ...descendants.map((d) => String(d._id))];
}

export async function getInternalLocationIds(tenantId, rootLocationId) {
  const ids = await getLocationSubtreeIds(tenantId, rootLocationId);
  const locs = await InvLocation.find({
    _id: { $in: ids },
    tenantId,
    usage: 'internal',
    active: true,
  }).select('_id').lean();
  return locs.map((l) => l._id);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveRemovalStrategy({ categoryStrategy, locationStrategy }) {
  return categoryStrategy || locationStrategy || 'fifo';
}

export function sortQuantsForRemoval(quants, strategy) {
  const copy = [...quants];
  switch (strategy) {
    case 'lifo':
      copy.sort((a, b) => new Date(b.inDate) - new Date(a.inDate) || String(a._id).localeCompare(String(b._id)));
      break;
    case 'closest':
      copy.sort((a, b) => (a.completePath || '').localeCompare(b.completePath || ''));
      break;
    case 'fefo':
      copy.sort((a, b) => {
        const ar = a.lotRemovalDate ? new Date(a.lotRemovalDate).getTime() : Infinity;
        const br = b.lotRemovalDate ? new Date(b.lotRemovalDate).getTime() : Infinity;
        if (ar !== br) return ar - br;
        return new Date(a.inDate) - new Date(b.inDate) || String(a._id).localeCompare(String(b._id));
      });
      break;
    case 'fifo':
    default:
      copy.sort((a, b) => new Date(a.inDate) - new Date(b.inDate) || String(a._id).localeCompare(String(b._id)));
  }
  return copy;
}
