/**
 * User data-access scopes (products / invoices / customers / sales docs)
 * beyond module×action permissions.
 * Admins and super_admins always see everything.
 *
 * Non-admins default to own-only for invoices, customers, and related docs
 * unless accessScope.invoiceVisibility is explicitly set to 'all'.
 */

import Invoice from '../models/Invoice.js';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export const DEFAULT_ACCESS_SCOPE = Object.freeze({
  productVisibility: 'all',
  canAddProducts: false,
  invoiceVisibility: 'own',
  canManageOwnInvoiceSettings: false,
});

export const isElevatedRole = (user) => ADMIN_ROLES.has(String(user?.role || ''));

export const getAccessScope = (user) => {
  const raw = user?.accessScope && typeof user.accessScope === 'object' ? user.accessScope : {};
  return {
    productVisibility: raw.productVisibility === 'own' ? 'own' : 'all',
    canAddProducts: Boolean(raw.canAddProducts),
    // Explicit 'all' only — everything else (missing / own) is own-only for non-admins.
    invoiceVisibility: raw.invoiceVisibility === 'all' ? 'all' : 'own',
    canManageOwnInvoiceSettings: Boolean(raw.canManageOwnInvoiceSettings),
  };
};

export const sanitizeAccessScopeInput = (input) => {
  if (!input || typeof input !== 'object') return null;
  const next = {};
  if (input.productVisibility === 'all' || input.productVisibility === 'own') {
    next.productVisibility = input.productVisibility;
  }
  if (typeof input.canAddProducts === 'boolean') {
    next.canAddProducts = input.canAddProducts;
  }
  if (input.invoiceVisibility === 'all' || input.invoiceVisibility === 'own') {
    next.invoiceVisibility = input.invoiceVisibility;
  }
  if (typeof input.canManageOwnInvoiceSettings === 'boolean') {
    next.canManageOwnInvoiceSettings = input.canManageOwnInvoiceSettings;
  }
  return Object.keys(next).length ? next : null;
};

/** Non-admins with invoiceVisibility=own only see invoices they created. */
export const shouldScopeInvoicesToSelf = (user) => {
  if (!user || isElevatedRole(user)) return false;
  return getAccessScope(user).invoiceVisibility !== 'all';
};

/** Same visibility rule drives customer / sales / purchase / accounting filters. */
export const shouldScopeCustomersToSelf = (user) => shouldScopeInvoicesToSelf(user);

export const shouldScopeSalesDocsToSelf = (user) => shouldScopeInvoicesToSelf(user);

/** Non-admins with productVisibility=own only see products they created. */
export const shouldScopeProductsToSelf = (user) => {
  if (!user || isElevatedRole(user)) return false;
  return getAccessScope(user).productVisibility === 'own';
};

export const canUserAddProducts = (user) => {
  if (!user) return false;
  if (isElevatedRole(user)) return true;
  if (getAccessScope(user).canAddProducts) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const inv = permissions.find((p) => p.module === 'inventory');
  return Boolean(inv && Array.isArray(inv.actions) && inv.actions.includes('create'));
};

export const canManageOwnInvoiceSettings = (user) => {
  if (!user) return false;
  if (isElevatedRole(user)) return true;
  return getAccessScope(user).canManageOwnInvoiceSettings;
};

/**
 * Ensure inventory.create is present when canAddProducts is enabled
 * so product routes and UI stay consistent.
 */
export const ensureInventoryCreatePermission = (permissions = [], canAdd) => {
  const list = Array.isArray(permissions)
    ? permissions.map((p) => ({
        module: p.module,
        actions: Array.isArray(p.actions) ? [...p.actions] : [],
      }))
    : [];
  if (!canAdd) return list;
  const idx = list.findIndex((p) => p.module === 'inventory');
  if (idx === -1) {
    list.push({ module: 'inventory', actions: ['create', 'read'] });
    return list;
  }
  const actions = new Set(list[idx].actions);
  actions.add('create');
  actions.add('read');
  list[idx] = { ...list[idx], actions: Array.from(actions) };
  return list;
};

export const applyCreatedByScope = (query, userId) => {
  if (!userId) return query;
  query.createdBy = userId;
  return query;
};

/** Apply createdBy when the user must only see their own records. */
export const applyOwnerScopeToQuery = (query, user) => {
  if (!shouldScopeInvoicesToSelf(user)) return query;
  return applyCreatedByScope(query, user._id);
};

/**
 * Customers visible to a scoped user:
 * - created by them, OR
 * - linked on invoices they created (covers legacy partners without createdBy)
 */
export const getScopedCustomerIds = async (user, tenantId) => {
  if (!shouldScopeCustomersToSelf(user) || !tenantId || !user?._id) return null;
  const ids = await Invoice.distinct('customerId', {
    tenantId,
    createdBy: user._id,
    customerId: { $ne: null },
  });
  return ids.filter(Boolean);
};

export const getScopedSupplierIds = async (user, tenantId) => {
  if (!shouldScopeCustomersToSelf(user) || !tenantId || !user?._id) return null;
  const ids = await Invoice.distinct('supplierId', {
    tenantId,
    createdBy: user._id,
    supplierId: { $ne: null },
  });
  return ids.filter(Boolean);
};

export const applyCustomerOwnerScope = async (query, user, tenantId) => {
  if (!shouldScopeCustomersToSelf(user)) return query;
  const linkedIds = await getScopedCustomerIds(user, tenantId);
  const or = [{ createdBy: user._id }];
  if (linkedIds?.length) or.push({ _id: { $in: linkedIds } });
  query.$and = (query.$and || []).concat([{ $or: or }]);
  return query;
};

export const applySupplierOwnerScope = async (query, user, tenantId) => {
  if (!shouldScopeCustomersToSelf(user)) return query;
  const linkedIds = await getScopedSupplierIds(user, tenantId);
  const or = [{ createdBy: user._id }];
  if (linkedIds?.length) or.push({ _id: { $in: linkedIds } });
  query.$and = (query.$and || []).concat([{ $or: or }]);
  return query;
};

/**
 * Build a find filter for a single invoice by id, enforcing owner scope.
 */
export const scopedInvoiceFilter = (req) => {
  const filter = { _id: req.params.id, ...req.tenantFilter };
  if (shouldScopeInvoicesToSelf(req.user)) {
    applyCreatedByScope(filter, req.user._id);
  }
  return filter;
};
