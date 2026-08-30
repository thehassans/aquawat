import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

/**
 * Completely wipe a tenant's operational data so the panel starts at zero.
 * Preserves: Tenant record, Users, Employees, and branding/subscription settings
 * (counters on the tenant document are zeroed by resetTenantCounters).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Models that must never be deleted by a panel reset */
const PRESERVE_MODELS = new Set([
  'Tenant',
  'User',
  'Employee',
  'DemoUser',
  'SystemSettings',
  'Reseller',
  'LeadQuery',
  'AppCatalogItem',
  'AppCatalog',
]);

/** Ensure inventory + partner models are registered before the wipe scan */
async function ensureCriticalModelsRegistered() {
  await Promise.all([
    import('../models/inventory/index.js'),
    import('../models/Partner.js'),
    import('../models/ZatcaLog.js').catch(() => null),
    import('../models/ZatcaQueue.js').catch(() => null),
    import('../models/ZatcaAuditLog.js').catch(() => null),
    import('../models/PosSession.js').catch(() => null),
    import('../models/PosPayment.js').catch(() => null),
    import('../models/PosTerminalSession.js').catch(() => null),
    import('../models/Manufacturing.js').catch(() => null),
    import('../models/Journal.js').catch(() => null),
    import('../models/JournalEntry.js').catch(() => null),
    import('../models/JournalItem.js').catch(() => null),
    import('../models/Tax.js').catch(() => null),
    import('../models/AnalyticAccount.js').catch(() => null),
    import('../models/BankStatement.js').catch(() => null),
    import('../models/BankStatementLine.js').catch(() => null),
    import('../models/ChartOfAccount.js').catch(() => null),
    import('../models/Message.js').catch(() => null),
    import('../models/SmsMessage.js').catch(() => null),
    import('../models/KhataAccount.js').catch(() => null),
    import('../models/KhataTransaction.js').catch(() => null),
    import('../models/DaftarAccount.js').catch(() => null),
    import('../models/DaftarTransaction.js').catch(() => null),
    import('../models/Branch.js').catch(() => null),
    import('../models/Promotion.js').catch(() => null),
    import('../models/FuelLog.js').catch(() => null),
    import('../models/FleetAsset.js').catch(() => null),
    import('../models/PharmacyDispense.js').catch(() => null),
    import('../models/FurnitureProduct.js').catch(() => null),
    import('../models/FurnitureOrder.js').catch(() => null),
    import('../models/BookStoreProduct.js').catch(() => null),
    import('../models/BookRental.js').catch(() => null),
    import('../models/MarqueePackage.js').catch(() => null),
    import('../models/MarqueeAppointment.js').catch(() => null),
    import('../models/RestaurantMenuItem.js').catch(() => null),
    import('../models/UserActivityLog.js').catch(() => null),
    import('../models/LeadSetup.js').catch(() => null),
    import('../models/sales/DocumentMessage.js').catch(() => null),
    import('../models/sales/Pricelist.js').catch(() => null),
    import('../models/sales/SalesTeam.js').catch(() => null),
    import('../models/sales/SalesSettings.js').catch(() => null),
    import('../models/sales/SalesTag.js').catch(() => null),
    import('../models/sales/SalesPromotion.js').catch(() => null),
    import('../models/sales/SalesActivityType.js').catch(() => null),
    import('../models/sales/SalesActivityPlan.js').catch(() => null),
    import('../models/sales/SalesPaymentMethod.js').catch(() => null),
    import('../models/sales/SalesPaymentProvider.js').catch(() => null),
    import('../models/sales/SalesPaymentTransaction.js').catch(() => null),
    import('../models/sales/SalesPaymentToken.js').catch(() => null),
    import('../models/sales/QuotationTemplate.js').catch(() => null),
    import('../models/sales/PortalUser.js').catch(() => null),
    import('../models/sales/CarrierConnector.js').catch(() => null),
    import('../models/GymMember.js').catch(() => null),
    import('../models/GymSubscription.js').catch(() => null),
    import('../models/GymPlan.js').catch(() => null),
    import('../models/GymAttendance.js').catch(() => null),
    import('../models/GymClass.js').catch(() => null),
    import('../models/GymClassBooking.js').catch(() => null),
    import('../models/GymTrainer.js').catch(() => null),
    import('../models/GymPTPackage.js').catch(() => null),
    import('../models/GymMeasurement.js').catch(() => null),
    import('../models/GymLocker.js').catch(() => null),
    import('../models/khayyat/KhayyatStitching.js').catch(() => null),
    import('../models/khayyat/KhayyatWorker.js').catch(() => null),
    import('../models/khayyat/KhayyatFabric.js').catch(() => null),
    import('../models/khayyat/KhayyatPayment.js').catch(() => null),
    import('../models/khayyat/KhayyatLaundry.js').catch(() => null),
    import('../models/khayyat/KhayyatLaundryPayment.js').catch(() => null),
    import('../models/khayyat/KhayyatEmbroideryDesign.js').catch(() => null),
    import('../models/khayyat/KhayyatMeasurementProfile.js').catch(() => null),
    import('../models/khayyat/KhayyatCustomization.js').catch(() => null),
    import('../models/khayyat/KhayyatDelivery.js').catch(() => null),
    import('../models/AppAddon.js').catch(() => null),
    import('../models/AppReview.js').catch(() => null),
  ]);
}

function modelHasTenantId(Model) {
  try {
    return Boolean(Model?.schema?.path?.('tenantId'));
  } catch {
    return false;
  }
}

async function clearInvoicePdfStorage(tenantId) {
  const candidates = [
    path.join(process.cwd(), 'storage', 'invoice-pdfs', String(tenantId)),
    path.join(process.cwd(), 'backend', 'storage', 'invoice-pdfs', String(tenantId)),
    path.join(__dirname, '..', 'storage', 'invoice-pdfs', String(tenantId)),
  ];
  let cleared = 0;
  for (const dir of candidates) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      cleared += 1;
    } catch {
      // ignore missing dirs
    }
  }
  return cleared;
}

/**
 * Delete every tenant-scoped document across registered mongoose models.
 * Returns { ModelName: deletedCount }.
 */
export async function wipeTenantOperationalData(tenantId) {
  if (!tenantId) throw new Error('tenantId is required');

  await ensureCriticalModelsRegistered();

  const filter = { tenantId };
  const deleted = {};

  const modelNames = Object.keys(mongoose.models).sort();
  // Sequential batches keep Mongo under control for large tenants
  const BATCH = 8;
  for (let i = 0; i < modelNames.length; i += BATCH) {
    const slice = modelNames.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (name) => {
        if (PRESERVE_MODELS.has(name)) return [name, null];
        const Model = mongoose.models[name];
        if (!modelHasTenantId(Model)) return [name, null];
        try {
          const result = await Model.deleteMany(filter);
          return [name, result?.deletedCount || 0];
        } catch (err) {
          return [name, { error: err.message }];
        }
      })
    );
    for (const [name, count] of results) {
      if (count === null) continue;
      deleted[name] = count;
    }
  }

  deleted.invoicePdfStorageDirs = await clearInvoicePdfStorage(tenantId);
  return deleted;
}

/**
 * Zero document counters on the tenant so numbering starts at 1 again.
 */
export function resetTenantCounters(tenant) {
  if (!tenant) return tenant;

  const zatcaPrev = tenant.zatca?.toObject?.() || tenant.zatca || {};
  tenant.zatca = {
    ...zatcaPrev,
    invoiceCounter: 0,
    lastInvoiceHash: '',
  };
  tenant.markModified?.('zatca');

  if (!tenant.settings) tenant.settings = {};
  tenant.settings.invoiceSequenceCounter = 0;
  tenant.markModified?.('settings');

  // Clear installed app modules so workspace starts clean (matches new-tenant behaviour)
  tenant.settings.installedApps = {};
  tenant.installedApps = [];
  tenant.apps = [];
  tenant.markModified?.('settings.installedApps');
  tenant.markModified?.('installedApps');
  tenant.markModified?.('apps');

  return tenant;
}

export default wipeTenantOperationalData;
