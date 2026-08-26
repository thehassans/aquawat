import InvSettings from '../../models/inventory/InvSettings.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import Tenant from '../../models/Tenant.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

import {
  flagsForInventoryAccountingMode,
  resolveInventoryAccountingMode,
  INVENTORY_ACCOUNTING_MODES,
} from './accountingMode.js';

export const SETTINGS_ALLOWED = [
  'engineEnabled',
  'groupUom',
  'groupStockMultiLocations',
  'groupStockTrackingLot',
  'moduleProductExpiry',
  'annualInventoryMonth',
  'annualInventoryDay',
  'securityLeadTimeSales',
  'securityLeadTimePurchase',
  'daysToPurchase',
  'enforceWarehouseRestriction',
  'schedulerEnabled',
  'inventoryAccountingMode',
  'stockAccountingEnabled',
  'inventoryEvaluationEnabled',
  'allowNegativeStock',
  'propertyStockValuationAccountId',
  'propertyStockInputAccountId',
  'propertyStockOutputAccountId',
  'propertyLandedCostAccountId',
  'stockJournalId',
  'showLotsOnDeliverySlips',
  'showLotsOnInvoices',
  'receptionReportEnabled',
  'emailConfirmationOnDelivery',
  'signatureOnDelivery',
  'groupAdvLocation',
  'groupStockStorageCategories',
  'groupPutawayRules',
  'groupProductVariant',
  'groupStockPackaging',
  'groupProductionLot',
  'groupLandedCosts',
  'groupDeliveryMethods',
  'groupStockBarcode',
  'menuPos',
  'menuManufacturing',
  'groupBatchTransfer',
  'groupStockWarning',
  'defaultPickingPolicy',
  'moduleQuality',
  'groupReceptionReport',
  'barcodeNomenclatureId',
  'stockSmsConfirmation',
  'groupStockSignDelivery',
  'groupGs1Nomenclature',
  'groupStockTrackingOwner',
  'groupLotOnDeliverySlip',
  'groupLotOnInvoice',
  'moduleCarrierUps',
  'moduleCarrierDhl',
  'moduleCarrierFedex',
  'moduleCarrierUsps',
  'moduleCarrierSmsa',
  'moduleCarrierAramex',
  'moduleCarrierNaqel',
  'moduleCarrierEasypost',
  'moduleCarrierSendcloud',
  // v4.1 physical inventory + print
  'blindCountMode',
  'varianceApprovalThreshold',
  'inventoryPeriodLockDate',
  'printDefaultLang',
  'printShowPricesOnDelivery',
  'printFooterTerms',
  'printWatermarkEnabled',
  'printPaperSize',
];

/** Normalize aliases from v2 brief names onto stored columns */
function normalizeBody(body) {
  const out = { ...body };
  if (body.groupReceptionReport != null && body.receptionReportEnabled == null) {
    out.receptionReportEnabled = body.groupReceptionReport;
  }
  if (body.groupStockSignDelivery != null && body.signatureOnDelivery == null) {
    out.signatureOnDelivery = body.groupStockSignDelivery;
  }
  if (body.groupLotOnDeliverySlip != null && body.showLotsOnDeliverySlips == null) {
    out.showLotsOnDeliverySlips = body.groupLotOnDeliverySlip;
  }
  if (body.groupLotOnInvoice != null && body.showLotsOnInvoices == null) {
    out.showLotsOnInvoices = body.groupLotOnInvoice;
  }
  if (body.securityLeadDaysSale != null) out.securityLeadTimeSales = body.securityLeadDaysSale;
  if (body.securityLeadDaysPurchase != null) out.securityLeadTimePurchase = body.securityLeadDaysPurchase;
  if (body.stockMoveEmailValidation != null) out.emailConfirmationOnDelivery = body.stockMoveEmailValidation;
  return out;
}

export async function getInvSettings(tenantId) {
  const tid = toObjectId(tenantId);
  let settings = await InvSettings.findOne({ tenantId: tid });
  if (!settings) {
    settings = await InvSettings.create({
      tenantId: tid,
      inventoryAccountingMode: 'ops_only',
      inventoryEvaluationEnabled: false,
      stockAccountingEnabled: false,
    });
    return settings;
  }

  const mode = resolveInventoryAccountingMode(settings);
  const flags = flagsForInventoryAccountingMode(mode);
  let dirty = false;
  if (settings.inventoryAccountingMode !== mode) {
    settings.inventoryAccountingMode = mode;
    dirty = true;
  }
  if (settings.inventoryEvaluationEnabled !== flags.inventoryEvaluationEnabled) {
    settings.inventoryEvaluationEnabled = flags.inventoryEvaluationEnabled;
    dirty = true;
  }
  if (settings.stockAccountingEnabled !== flags.stockAccountingEnabled) {
    settings.stockAccountingEnabled = flags.stockAccountingEnabled;
    dirty = true;
  }
  if (dirty) await settings.save();
  return settings;
}

export function packagesEnabled(settings) {
  return Boolean(settings?.groupStockTrackingLot || settings?.groupStockPackaging);
}

export function lotsEnabled(settings) {
  return Boolean(settings?.groupProductionLot || settings?.groupStockTrackingLot);
}

export function signatureRequired(settings) {
  return Boolean(settings?.signatureOnDelivery || settings?.groupStockSignDelivery);
}

export async function isSmsProviderConfigured(tenantId) {
  const tenant = await Tenant.findById(tenantId)
    .select('settings.sms settings.communication.sms')
    .lean();
  const comm = tenant?.settings?.communication?.sms;
  const legacy = tenant?.settings?.sms;
  const sms = (comm && (comm.enabled || comm.provider || comm.twilioAccountSid || comm.customUrl))
    ? comm
    : (legacy || comm || {});
  if (!sms?.enabled) return false;
  if (sms.provider === 'twilio' && sms.twilioAccountSid && sms.twilioAuthToken && sms.fromNumber) return true;
  if (sms.provider === 'unifonic' && (sms.unifonicToken || sms.unifonicAppSid)) return true;
  if (sms.provider === 'custom' && sms.customUrl) return true;
  return false;
}

/**
 * Count internal locations (beyond a single Stock) that hold stock — used when turning multi-loc off.
 */
export async function findStockedInternalLocations(tenantId) {
  const tid = toObjectId(tenantId);
  const internals = await InvLocation.find({
    tenantId: tid,
    usage: 'internal',
    active: true,
  }).select('_id name completePath warehouseId').lean();

  const byWh = new Map();
  for (const loc of internals) {
    const key = String(loc.warehouseId || 'none');
    if (!byWh.has(key)) byWh.set(key, []);
    byWh.get(key).push(loc);
  }

  const stocked = [];
  for (const locs of byWh.values()) {
    if (locs.length <= 1) continue;
    for (const loc of locs) {
      const quants = await InvQuant.find({ tenantId: tid, locationId: loc._id })
        .select('quantity')
        .lean();
      const has = quants.some((q) => Number(q.quantity) !== 0);
      if (has) stocked.push({ id: loc._id, path: loc.completePath });
    }
  }
  return stocked;
}

export async function updateInvSettings(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const normalized = normalizeBody(body);
  const current = await getInvSettings(tid);

  const $set = { updatedBy: userId };
  for (const k of SETTINGS_ALLOWED) {
    if (normalized[k] !== undefined) $set[k] = normalized[k];
  }

  for (const k of [
    'propertyStockValuationAccountId',
    'propertyStockInputAccountId',
    'propertyStockOutputAccountId',
    'propertyLandedCostAccountId',
    'stockJournalId',
    'barcodeNomenclatureId',
  ]) {
    if ($set[k] === '' || $set[k] === undefined) {
      if (normalized[k] !== undefined) $set[k] = null;
    }
  }

  // Mode is source of truth when provided; otherwise derive from booleans
  if ($set.inventoryAccountingMode != null) {
    if (!INVENTORY_ACCOUNTING_MODES.includes($set.inventoryAccountingMode)) {
      throw new InventoryValidationError(
        'inventoryAccountingMode must be ops_only, costing, or full_accounting',
        'BAD_ACCOUNTING_MODE',
      );
    }
    const flags = flagsForInventoryAccountingMode($set.inventoryAccountingMode);
    $set.inventoryEvaluationEnabled = flags.inventoryEvaluationEnabled;
    $set.stockAccountingEnabled = flags.stockAccountingEnabled;
  } else if (
    $set.inventoryEvaluationEnabled !== undefined
    || $set.stockAccountingEnabled !== undefined
  ) {
    const merged = {
      inventoryEvaluationEnabled: $set.inventoryEvaluationEnabled !== undefined
        ? $set.inventoryEvaluationEnabled
        : current.inventoryEvaluationEnabled,
      stockAccountingEnabled: $set.stockAccountingEnabled !== undefined
        ? $set.stockAccountingEnabled
        : current.stockAccountingEnabled,
    };
    $set.inventoryAccountingMode = resolveInventoryAccountingMode(merged);
  }

  // Multi-step routes force multi-locations
  if ($set.groupAdvLocation === true) {
    $set.groupStockMultiLocations = true;
  }

  // Turning multi-locations off: block if stock sits in multiple internals
  const multiNext = $set.groupStockMultiLocations !== undefined
    ? $set.groupStockMultiLocations
    : current.groupStockMultiLocations;
  if (multiNext === false && current.groupStockMultiLocations !== false) {
    const stocked = await findStockedInternalLocations(tid);
    if (stocked.length > 1) {
      throw new InventoryValidationError(
        `Cannot disable storage locations while stock exists in multiple locations: ${stocked.map((s) => s.path).join(', ')}`,
        'MULTI_LOC_STOCK',
      );
    }
    $set.groupAdvLocation = false;
  }

  // SMS confirmation requires a configured provider
  if ($set.stockSmsConfirmation === true) {
    const ok = await isSmsProviderConfigured(tid);
    if (!ok) {
      throw new InventoryValidationError(
        'No SMS provider configured — enable SMS under tenant settings first',
        'SMS_PROVIDER',
      );
    }
  }

  if ($set.defaultPickingPolicy != null
    && !['direct', 'one'].includes($set.defaultPickingPolicy)) {
    throw new InventoryValidationError('defaultPickingPolicy must be direct or one', 'PICK_POLICY');
  }

  // Keep alias mirrors in sync
  if ($set.receptionReportEnabled != null) $set.groupReceptionReport = $set.receptionReportEnabled;
  if ($set.groupReceptionReport != null) $set.receptionReportEnabled = $set.groupReceptionReport;
  if ($set.signatureOnDelivery != null) $set.groupStockSignDelivery = $set.signatureOnDelivery;
  if ($set.groupStockSignDelivery != null) $set.signatureOnDelivery = $set.groupStockSignDelivery;
  if ($set.showLotsOnDeliverySlips != null) $set.groupLotOnDeliverySlip = $set.showLotsOnDeliverySlips;
  if ($set.groupLotOnDeliverySlip != null) $set.showLotsOnDeliverySlips = $set.groupLotOnDeliverySlip;
  if ($set.showLotsOnInvoices != null) $set.groupLotOnInvoice = $set.showLotsOnInvoices;
  if ($set.groupLotOnInvoice != null) $set.showLotsOnInvoices = $set.groupLotOnInvoice;

  const prior = current.toObject ? current.toObject() : { ...current };
  const updated = await InvSettings.findOneAndUpdate(
    { tenantId: tid },
    { $set },
    { new: true, upsert: true },
  );

  // Opting into full Anglo-Saxon accounting: seed STJ + interim COA + prefill tenant defaults
  if (
    updated.inventoryAccountingMode === 'full_accounting'
    && prior.inventoryAccountingMode !== 'full_accounting'
  ) {
    try {
      const { linkDefaultPropertyStockAccounts } = await import('./stockAccounting.js');
      const linked = await linkDefaultPropertyStockAccounts(tid, userId);
      if (linked) {
        updated.propertyStockValuationAccountId = linked.propertyStockValuationAccountId;
        updated.propertyStockInputAccountId = linked.propertyStockInputAccountId;
        updated.propertyStockOutputAccountId = linked.propertyStockOutputAccountId;
        updated.propertyLandedCostAccountId = linked.propertyLandedCostAccountId;
        updated.stockJournalId = linked.stockJournalId;
      }
    } catch (err) {
      console.error('[inventory] seed full accounting defaults', err?.message || err);
    }
  }

  try {
    const { syncCarrierStubs, syncGs1Nomenclature } = await import('./settingsEffects.js');
    await syncCarrierStubs(tid, updated, prior);
    await syncGs1Nomenclature(tid, updated, prior);
  } catch {
    /* non-blocking */
  }

  try {
    const { recordConfigAudit, diffFields } = await import('./configAudit.js');
    const after = updated.toObject ? updated.toObject() : updated;
    const changes = diffFields(prior, after, Object.keys($set).filter((k) => k !== 'updatedBy'));
    await recordConfigAudit({
      tenantId: tid,
      userId,
      resourceType: 'settings',
      resourceId: updated._id,
      resourceName: 'InvSettings',
      changes,
    });
  } catch {
    /* non-blocking */
  }

  return updated;
}
