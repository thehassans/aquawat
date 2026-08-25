/**
 * Every InvSettings toggle must map to at least one observable backend effect.
 * Used by tests and GET /stock/settings?include=effects.
 */
export const SETTINGS_EFFECTS = {
  engineEnabled: 'legacy_adjust_blocked_when_on',
  groupUom: 'uom_menu_and_conversion',
  groupStockMultiLocations: 'hide_internal_locations_putaway_api',
  groupStockTrackingLot: 'lots_packages_columns_enforced',
  moduleProductExpiry: 'fefo_and_expiry_validate',
  annualInventoryMonth: 'scheduler_stamps_nextCountDate',
  annualInventoryDay: 'scheduler_stamps_nextCountDate',
  securityLeadTimeSales: 'outgoing_scheduledDate_shifted',
  securityLeadTimePurchase: 'procurement_deadline_lead',
  daysToPurchase: 'procurement_lead_days',
  enforceWarehouseRestriction: 'warehouse_scope_on_queries',
  schedulerEnabled: 'cron_and_manual_scheduler',
  stockAccountingEnabled: 'valuation_journals_and_menu',
  propertyStockValuationAccountId: 'stock_journal_account_ref',
  propertyStockInputAccountId: 'stock_journal_account_ref',
  propertyStockOutputAccountId: 'stock_journal_account_ref',
  propertyLandedCostAccountId: 'landed_cost_account_ref',
  stockJournalId: 'stock_journal_ref',
  showLotsOnDeliverySlips: 'print_lot_column_on_delivery',
  showLotsOnInvoices: 'invoice_lot_lines_from_linked_transfers',
  receptionReportEnabled: 'reception_report_api_and_menu',
  emailConfirmationOnDelivery: 'outgoing_validate_sends_partner_email',
  signatureOnDelivery: 'outgoing_validate_requires_signature',
  groupAdvLocation: 'multi_step_routes_force_multi_loc',
  groupStockStorageCategories: 'storage_categories_menu',
  groupPutawayRules: 'putaway_menu_and_resolve',
  groupProductVariant: 'attributes_variants_crud_and_move_variantId',
  groupStockPackaging: 'product_packaging_crud_and_packages_enforced_on_moves',
  groupProductionLot: 'lots_enforced_on_moves',
  groupLandedCosts: 'landed_costs_menu_and_post',
  groupDeliveryMethods: 'delivery_methods_menu_and_fixed_rate',
  groupStockBarcode: 'picking_barcode_scan',
  menuPos: 'pos_menu_card',
  menuManufacturing: 'manufacturing_menu_card',
  groupBatchTransfer: 'batch_transfers_api_menu_and_bulk_validate',
  groupStockWarning: 'partner_stockWarn_block',
  defaultPickingPolicy: 'check_availability_one_vs_direct',
  moduleQuality: 'quality_points_checks_block_validate_until_pass',
  groupReceptionReport: 'alias_receptionReportEnabled',
  barcodeNomenclatureId: 'barcode_match_rules',
  stockSmsConfirmation: 'outgoing_validate_sends_partner_sms_requires_provider',
  groupStockSignDelivery: 'alias_signatureOnDelivery',
  groupGs1Nomenclature: 'gs1_rules_seeded_on_default_nomenclature',
  groupStockTrackingOwner: 'ownerId_on_transfer_and_picker_ui',
  groupLotOnDeliverySlip: 'alias_showLotsOnDeliverySlips',
  groupLotOnInvoice: 'alias_showLotsOnInvoices',
  moduleCarrierUps: 'carrier_stub_ups',
  moduleCarrierDhl: 'carrier_stub_dhl',
  moduleCarrierFedex: 'carrier_stub_fedex',
  moduleCarrierUsps: 'carrier_stub_usps',
  moduleCarrierSmsa: 'carrier_stub_smsa',
  moduleCarrierAramex: 'carrier_stub_aramex',
  moduleCarrierNaqel: 'carrier_stub_naqel',
  moduleCarrierEasypost: 'carrier_stub_easypost',
  moduleCarrierSendcloud: 'carrier_stub_sendcloud',
};

const CARRIER_FLAG_TO_PROVIDER = {
  moduleCarrierUps: 'ups',
  moduleCarrierDhl: 'dhl',
  moduleCarrierFedex: 'fedex',
  moduleCarrierUsps: 'usps',
  moduleCarrierSmsa: 'smsa',
  moduleCarrierAramex: 'aramex',
  moduleCarrierNaqel: 'naqel',
  moduleCarrierEasypost: 'easypost',
  moduleCarrierSendcloud: 'sendcloud',
};

/**
 * When a carrier module flag turns on, upsert a non-installed carrier stub row.
 */
export async function syncCarrierStubs(tenantId, settingsDoc, prior = {}) {
  const { default: InvDeliveryCarrier } = await import('../../models/inventory/InvDeliveryCarrier.js');
  const { toObjectId } = await import('../../models/inventory/common.js');
  const tid = toObjectId(tenantId);
  const synced = [];

  for (const [flag, provider] of Object.entries(CARRIER_FLAG_TO_PROVIDER)) {
    const nowOn = !!settingsDoc?.[flag];
    const wasOn = !!prior?.[flag];
    if (!nowOn || wasOn) continue;

    const name = provider.toUpperCase();
    await InvDeliveryCarrier.findOneAndUpdate(
      { tenantId: tid, providerCode: provider },
      {
        $setOnInsert: {
          tenantId: tid,
          name,
          nameAr: name,
          carrierType: 'provider',
          providerCode: provider,
          installed: false,
          active: true,
        },
        $set: { active: true, installed: false },
      },
      { upsert: true },
    );
    synced.push(provider);
  }
  return synced;
}

const GS1_RULES = [
  { name: 'GTIN-13', pattern: '^[0-9]{13}$', type: 'product', encoding: 'gtin', sequence: 10 },
  { name: 'GTIN-14', pattern: '^[0-9]{14}$', type: 'product', encoding: 'gtin', sequence: 20 },
  { name: 'GS1 AI (01) GTIN', pattern: '\\(01\\)[0-9]{14}', type: 'product', encoding: 'gs1', sequence: 30 },
  { name: 'GS1 AI (10) Lot', pattern: '\\(10\\)([^\\(]+)', type: 'lot', encoding: 'gs1', sequence: 40 },
  { name: 'GS1 AI (21) Serial', pattern: '\\(21\\)([^\\(]+)', type: 'lot', encoding: 'gs1', sequence: 50 },
  { name: 'GS1 AI (17) Expiry YYMMDD', pattern: '\\(17\\)[0-9]{6}', type: 'any', encoding: 'gs1', sequence: 60 },
];

/**
 * When GS1 nomenclature flag turns on, ensure a GS1 rule set exists on the default nomenclature.
 */
export async function syncGs1Nomenclature(tenantId, settingsDoc, prior = {}) {
  const nowOn = !!settingsDoc?.groupGs1Nomenclature;
  const wasOn = !!prior?.groupGs1Nomenclature;
  if (!nowOn || wasOn) return { synced: false };

  const { default: InvBarcodeNomenclature } = await import('../../models/inventory/InvBarcodeNomenclature.js');
  const { toObjectId } = await import('../../models/inventory/common.js');
  const tid = toObjectId(tenantId);

  let nom = await InvBarcodeNomenclature.findOne({ tenantId: tid, isDefault: true });
  if (!nom) {
    nom = await InvBarcodeNomenclature.create({
      tenantId: tid,
      name: 'GS1 Default',
      nameAr: 'GS1 افتراضي',
      isDefault: true,
      rules: GS1_RULES.map((r) => ({ ...r, active: true })),
    });
    return { synced: true, created: true, nomenclatureId: nom._id };
  }

  const existingNames = new Set((nom.rules || []).map((r) => r.name));
  let added = 0;
  for (const rule of GS1_RULES) {
    if (existingNames.has(rule.name)) continue;
    nom.rules.push({ ...rule, active: true });
    added += 1;
  }
  if (added) {
    nom.version = (nom.version || 0) + 1;
    await nom.save();
  }
  // Keep settings barcodeNomenclatureId pointed at default when empty
  if (!settingsDoc.barcodeNomenclatureId) {
    const InvSettings = (await import('../../models/inventory/InvSettings.js')).default;
    await InvSettings.updateOne(
      { tenantId: tid },
      { $set: { barcodeNomenclatureId: nom._id } },
    );
  }
  return { synced: true, created: false, added, nomenclatureId: nom._id };
}

export function listSettingsEffects() {
  return Object.entries(SETTINGS_EFFECTS).map(([flag, effect]) => ({ flag, effect }));
}
