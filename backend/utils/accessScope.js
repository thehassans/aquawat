/**
 * User data-access scopes (products / invoices) beyond module×action permissions.
 * Admins and super_admins always see everything.
 */

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export const DEFAULT_ACCESS_SCOPE = Object.freeze({
  productVisibility: 'all',
  canAddProducts: false,
  invoiceVisibility: 'own',
  canManageOwnInvoiceSettings: false,
});

export const isElevatedRole = (user) => ADMIN_ROLES.has(String(user?.role || ''));

export const getAccessScope = (user) => {
  const raw = user?.accessScope && typeof user.accessScope === 'object' ? user.accessScope : null;
  const hasConfiguredScope = Boolean(
    raw && (
      raw.productVisibility != null
      || raw.invoiceVisibility != null
      || typeof raw.canAddProducts === 'boolean'
      || typeof raw.canManageOwnInvoiceSettings === 'boolean'
    ),
  );
  return {
    productVisibility: raw?.productVisibility === 'own' ? 'own' : 'all',
    canAddProducts: Boolean(raw?.canAddProducts),
    // Legacy users (no accessScope in DB) keep tenant-wide invoice visibility.
    // Newly created users get invoiceVisibility: 'own' from User.create.
    invoiceVisibility: !hasConfiguredScope
      ? 'all'
      : (raw.invoiceVisibility === 'all' ? 'all' : 'own'),
    canManageOwnInvoiceSettings: Boolean(raw?.canManageOwnInvoiceSettings),
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
