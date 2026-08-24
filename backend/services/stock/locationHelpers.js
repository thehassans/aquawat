import StockLocation from '../../models/stock/StockLocation.js';

/**
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {import('mongoose').Types.ObjectId|string} locationId
 * @returns {Promise<string[]>} location ids including self and descendants
 */
export async function getLocationSubtreeIds(tenantId, locationId) {
  const root = await StockLocation.findOne({ _id: locationId, tenantId }).lean();
  if (!root) return [];
  const prefix = root.completeName;
  const descendants = await StockLocation.find({
    tenantId,
    completeName: new RegExp(`^${escapeRegex(prefix)}/`),
    active: true,
  }).select('_id').lean();
  return [String(root._id), ...descendants.map((d) => String(d._id))];
}

/**
 * Internal locations under a warehouse stock location.
 */
export async function getInternalLocationIds(tenantId, rootLocationId) {
  const ids = await getLocationSubtreeIds(tenantId, rootLocationId);
  const locs = await StockLocation.find({
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

/**
 * Resolve removal strategy: product category > location > default fifo
 */
export function resolveRemovalStrategy({ categoryStrategy, locationStrategy }) {
  return categoryStrategy || locationStrategy || 'fifo';
}

/**
 * Sort quants by removal strategy
 * @param {Array} quants
 * @param {string} strategy
 */
export function sortQuantsForRemoval(quants, strategy) {
  const copy = [...quants];
  switch (strategy) {
    case 'lifo':
      copy.sort((a, b) => new Date(b.inDate) - new Date(a.inDate) || String(a._id).localeCompare(String(b._id)));
      break;
    case 'closest':
      copy.sort((a, b) => (a.locationCompleteName || '').localeCompare(b.locationCompleteName || ''));
      break;
    case 'fefo':
      copy.sort((a, b) => {
        const ar = a.lotRemovalDate ? new Date(a.lotRemovalDate).getTime() : Infinity;
        const br = b.lotRemovalDate ? new Date(b.lotRemovalDate).getTime() : Infinity;
        if (ar !== br) return ar - br;
        return new Date(a.inDate) - new Date(b.inDate);
      });
      break;
    case 'fifo':
    default:
      copy.sort((a, b) => new Date(a.inDate) - new Date(b.inDate) || String(a._id).localeCompare(String(b._id)));
  }
  return copy;
}
