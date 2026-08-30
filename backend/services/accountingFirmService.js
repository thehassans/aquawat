import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { invalidateAuthCache } from '../middleware/auth.js';

const toId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
};

function firmHomeOf(user) {
  return toId(user.firmHomeTenantId) || toId(user.tenantId);
}

function accessibleIdsOf(user) {
  const ids = new Set();
  const home = firmHomeOf(user);
  if (home) ids.add(String(home));
  if (user.tenantId) ids.add(String(user.tenantId));
  for (const id of user.accessibleTenantIds || []) {
    if (id) ids.add(String(id));
  }
  return ids;
}

export function userCanAccessTenant(user, tenantId) {
  if (!user || !tenantId) return false;
  if (user.role === 'super_admin') return true;
  return accessibleIdsOf(user).has(String(tenantId));
}

/** Enable Accounting Firms Mode on the current (home) tenant. */
export async function enableAccountingFirmMode(tenantId, userId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  tenant.accountingFirmMode = true;
  tenant.accountingFirmTenantId = null;
  await tenant.save();

  const user = await User.findById(userId);
  if (user) {
    user.firmHomeTenantId = tenant._id;
    const set = new Set((user.accessibleTenantIds || []).map(String));
    set.add(String(tenant._id));
    user.accessibleTenantIds = [...set].map((id) => toId(id)).filter(Boolean);
    await user.save();
    await invalidateAuthCache(user._id, tenant._id);
  }

  return {
    tenantId: tenant._id,
    accountingFirmMode: true,
    name: tenant.name,
  };
}

export async function listFirmClients(user) {
  const homeId = firmHomeOf(user);
  if (!homeId) return { firmMode: false, home: null, clients: [] };

  const home = await Tenant.findById(homeId)
    .select('_id name slug accountingFirmMode isActive business.legalNameEn')
    .lean();

  const firmMode = Boolean(home?.accountingFirmMode);
  const linked = await Tenant.find({
    accountingFirmTenantId: homeId,
    isActive: { $ne: false },
  })
    .select('_id name slug isActive business.legalNameEn accountingFirmTenantId')
    .sort({ name: 1 })
    .lean();

  const extraIds = (user.accessibleTenantIds || [])
    .map((id) => String(id))
    .filter((id) => id !== String(homeId) && !linked.some((c) => String(c._id) === id));

  let extras = [];
  if (extraIds.length) {
    extras = await Tenant.find({ _id: { $in: extraIds } })
      .select('_id name slug isActive business.legalNameEn accountingFirmTenantId')
      .sort({ name: 1 })
      .lean();
  }

  const clients = [...linked, ...extras];
  return {
    firmMode,
    home: home
      ? {
          _id: home._id,
          name: home.name,
          slug: home.slug,
          accountingFirmMode: home.accountingFirmMode,
        }
      : null,
    clients,
    activeTenantId: user.tenantId || null,
  };
}

/**
 * Link an existing tenant as a client of this firm.
 * Caller must be admin/accountant on the firm home tenant.
 */
export async function linkFirmClient(user, { clientTenantId, grantAccess = true } = {}) {
  const homeId = firmHomeOf(user);
  if (!homeId) throw new Error('Firm home tenant required');

  const home = await Tenant.findById(homeId);
  if (!home) throw new Error('Firm tenant not found');
  if (!home.accountingFirmMode) {
    home.accountingFirmMode = true;
    await home.save();
  }

  const clientId = toId(clientTenantId);
  if (!clientId) throw new Error('clientTenantId is required');
  if (String(clientId) === String(homeId)) throw new Error('Cannot link firm to itself');

  const client = await Tenant.findById(clientId);
  if (!client) throw new Error('Client tenant not found');
  if (client.accountingFirmTenantId && String(client.accountingFirmTenantId) !== String(homeId)) {
    throw new Error('Client is already linked to another accounting firm');
  }

  client.accountingFirmTenantId = homeId;
  client.accountingFirmMode = false;
  await client.save();

  if (grantAccess !== false) {
    const dbUser = await User.findById(user._id || user.id);
    if (dbUser) {
      dbUser.firmHomeTenantId = homeId;
      const set = new Set((dbUser.accessibleTenantIds || []).map(String));
      set.add(String(homeId));
      set.add(String(clientId));
      dbUser.accessibleTenantIds = [...set].map((id) => toId(id)).filter(Boolean);
      await dbUser.save();
      await invalidateAuthCache(dbUser._id, dbUser.tenantId);
    }
  }

  return {
    client: {
      _id: client._id,
      name: client.name,
      slug: client.slug,
      accountingFirmTenantId: client.accountingFirmTenantId,
    },
  };
}

export async function unlinkFirmClient(user, clientTenantId) {
  const homeId = firmHomeOf(user);
  const clientId = toId(clientTenantId);
  if (!homeId || !clientId) throw new Error('clientTenantId is required');

  const client = await Tenant.findOne({ _id: clientId, accountingFirmTenantId: homeId });
  if (!client) throw new Error('Linked client not found');
  client.accountingFirmTenantId = null;
  await client.save();

  const dbUser = await User.findById(user._id || user.id);
  if (dbUser) {
    dbUser.accessibleTenantIds = (dbUser.accessibleTenantIds || [])
      .filter((id) => String(id) !== String(clientId));
    await dbUser.save();
    await invalidateAuthCache(dbUser._id, dbUser.tenantId);
  }

  return { ok: true };
}

/**
 * Search tenants by name or slug so firms can link clients without pasting ObjectIds.
 */
export async function searchTenantsForFirm(user, { q = '' } = {}) {
  const homeId = firmHomeOf(user);
  if (!homeId) throw new Error('Firm home tenant required');
  const query = String(q || '').trim();
  if (query.length < 2) return [];

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escape(query), 'i');
  const rows = await Tenant.find({
    _id: { $ne: homeId },
    isActive: { $ne: false },
    $or: [
      { name: rx },
      { slug: rx },
      { 'business.legalNameEn': rx },
      { 'business.legalNameAr': rx },
    ],
  })
    .select('_id name slug business.legalNameEn business.legalNameAr accountingFirmTenantId accountingFirmMode')
    .sort({ name: 1 })
    .limit(20)
    .lean();

  return rows.map((t) => ({
    _id: t._id,
    name: t.name,
    slug: t.slug,
    legalName: t.business?.legalNameEn || t.business?.legalNameAr || '',
    alreadyLinked: Boolean(t.accountingFirmTenantId),
    linkedToThisFirm: t.accountingFirmTenantId && String(t.accountingFirmTenantId) === String(homeId),
    isFirm: Boolean(t.accountingFirmMode),
  }));
}

/**
 * Switch active books to a client (or back to firm home).
 * Updates user.tenantId and issues a fresh JWT — same pattern as login-as.
 */
export async function switchFirmClient(user, targetTenantId) {
  const targetId = toId(targetTenantId);
  if (!targetId) throw new Error('tenantId is required');

  const dbUser = await User.findById(user._id || user.id);
  if (!dbUser) throw new Error('User not found');

  // Ensure home is remembered before first switch away from firm
  if (!dbUser.firmHomeTenantId) {
    dbUser.firmHomeTenantId = dbUser.tenantId;
  }

  const allowed = accessibleIdsOf(dbUser);
  // Also allow any tenant linked to this firm
  const homeId = firmHomeOf(dbUser);
  if (homeId && String(targetId) !== String(homeId)) {
    const linked = await Tenant.findOne({
      _id: targetId,
      accountingFirmTenantId: homeId,
    }).select('_id').lean();
    if (linked) allowed.add(String(targetId));
  }

  if (!allowed.has(String(targetId)) && dbUser.role !== 'super_admin') {
    throw new Error('Not authorized to open this client');
  }

  const tenant = await Tenant.findById(targetId);
  if (!tenant || tenant.isActive === false) throw new Error('Tenant not found or inactive');

  dbUser.tenantId = targetId;
  const set = new Set((dbUser.accessibleTenantIds || []).map(String));
  set.add(String(dbUser.firmHomeTenantId || homeId));
  set.add(String(targetId));
  dbUser.accessibleTenantIds = [...set].map((id) => toId(id)).filter(Boolean);
  await dbUser.save();
  await invalidateAuthCache(dbUser._id, targetId);
  if (homeId) await invalidateAuthCache(null, homeId);

  if (!process.env.JWT_SECRET) throw new Error('Server misconfigured: JWT_SECRET missing');
  const token = jwt.sign({ id: dbUser._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

  return {
    token,
    user: {
      id: dbUser._id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role: dbUser.role,
      permissions: dbUser.permissions,
      preferences: dbUser.preferences,
      firmHomeTenantId: dbUser.firmHomeTenantId,
      accessibleTenantIds: dbUser.accessibleTenantIds,
      tenantId: dbUser.tenantId,
    },
    tenant: {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      business: tenant.business,
      branding: tenant.branding,
      settings: tenant.settings,
      subscription: tenant.subscription,
      accountingFirmMode: tenant.accountingFirmMode,
      accountingFirmTenantId: tenant.accountingFirmTenantId,
      terminationNotice: tenant.terminationNotice,
    },
  };
}

export default {
  enableAccountingFirmMode,
  listFirmClients,
  linkFirmClient,
  unlinkFirmClient,
  switchFirmClient,
  userCanAccessTenant,
  searchTenantsForFirm,
};
