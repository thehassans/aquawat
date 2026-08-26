/**
 * Shared transfer list / dashboard count query builder.
 * Lists and counters MUST use this so they cannot drift.
 */
import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import { withTenant } from '../../utils/tenantScope.js';
import { toObjectId } from '../../models/inventory/common.js';
import { warehouseFilter } from './warehouseScope.js';

/** Open-work states shown on Overview cards (drafts are separate). */
export const OVERVIEW_OPEN_STATES = ['draft', 'waiting', 'confirmed', 'assigned'];

/**
 * Resolve operation-type ids for a code (+ optional warehouse scope).
 * Returns { otIds, otFilter } — otIds may be empty when none match.
 */
export async function resolveOperationTypeIds(tenantId, {
  code = null,
  operationTypeId = null,
  warehouseScope = null,
  activeOnly = true,
} = {}) {
  const tid = toObjectId(tenantId);
  const otFilter = withTenant(tid, {
    ...warehouseFilter(warehouseScope),
  });
  if (activeOnly) otFilter.active = true;
  if (code) otFilter.code = code;

  const ots = await InvOperationType.find(otFilter).select('_id code warehouseId').lean();
  let otIds = ots.map((o) => o._id);

  if (operationTypeId) {
    const want = String(operationTypeId);
    const allowed = otIds.some((id) => String(id) === want);
    otIds = allowed ? [toObjectId(operationTypeId)] : [];
  }

  return { otIds, otFilter, operationTypes: ots };
}

/**
 * Build InvTransfer find filter + appliedFilters meta for list endpoints.
 */
export async function buildTransferListFilter(tenantId, {
  code = null,
  state = null,
  operationTypeId = null,
  warehouseScope = null,
  includeDone = true,
} = {}) {
  const tid = toObjectId(tenantId);
  const appliedFilters = {
    tenantId: String(tid),
    code: code || null,
    state: state || null,
    operationTypeId: operationTypeId || null,
    warehouseScope: warehouseScope ? warehouseScope.map(String) : null,
  };

  const filter = withTenant(tid);

  if (state) {
    filter.state = state;
  } else if (!includeDone) {
    filter.state = { $ne: 'done' };
  }

  if (code || operationTypeId || (warehouseScope && warehouseScope.length)) {
    const { otIds, otFilter } = await resolveOperationTypeIds(tid, {
      code,
      operationTypeId,
      warehouseScope,
    });
    appliedFilters.operationTypeIdsMatched = otIds.map(String);
    appliedFilters.operationTypeQuery = otFilter;

    // Mongo `$in: []` matches nothing — keep that behaviour but flag it in meta
    filter.operationTypeId = { $in: otIds };
    appliedFilters.emptyOperationTypeMatch = otIds.length === 0;
  }

  return { filter, appliedFilters };
}

/**
 * List transfers with _meta (same builder as counts).
 */
export async function listTransfers(tenantId, query = {}, warehouseScope = null) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.limit) || 40));
  const skip = (page - 1) * pageSize;

  const { filter, appliedFilters } = await buildTransferListFilter(tenantId, {
    code: query.code || null,
    state: query.state || null,
    operationTypeId: query.operationTypeId || null,
    warehouseScope,
  });

  const [rows, total] = await Promise.all([
    InvTransfer.find(filter)
      .sort({ scheduledDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('operationTypeId', 'name nameAr code cardColor warehouseId')
      .select('name origin state scheduledDate operationTypeId partnerId priority createdAt')
      .lean(),
    InvTransfer.countDocuments(filter),
  ]);

  const { attachPartnersToTransfers } = await import('./partnerResolve.js');
  const data = await attachPartnersToTransfers(tenantId, rows);

  return {
    data,
    _meta: {
      total,
      page,
      pageSize,
      appliedFilters,
    },
  };
}

/**
 * Overview counters — same OT resolution as list; includes draft.
 */
export async function countTransfersByCodeAndState(tenantId, warehouseScope = null) {
  const codes = ['incoming', 'outgoing', 'internal', 'pos', 'manufacturing'];
  const states = OVERVIEW_OPEN_STATES;
  const result = {};

  await Promise.all(
    codes.map(async (code) => {
      const { otIds } = await resolveOperationTypeIds(tenantId, {
        code,
        warehouseScope,
      });
      result[code] = {};
      await Promise.all(
        states.map(async (state) => {
          if (!otIds.length) {
            result[code][state] = 0;
            return;
          }
          result[code][state] = await InvTransfer.countDocuments(
            withTenant(toObjectId(tenantId), {
              operationTypeId: { $in: otIds },
              state,
            }),
          );
        }),
      );
    }),
  );

  return result;
}
