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
  showLotsOnInvoices: 'invoice_lot_display_hint',
  receptionReportEnabled: 'reception_report_flag',
  emailConfirmationOnDelivery: 'validate_stamps_email_note',
  signatureOnDelivery: 'outgoing_validate_requires_signature',
  groupAdvLocation: 'multi_step_routes_force_multi_loc',
  groupStockStorageCategories: 'storage_categories_menu',
  groupPutawayRules: 'putaway_menu_and_resolve',
  groupProductVariant: 'attributes_variants_crud_and_move_variantId',
  groupStockPackaging: 'packages_enforced_on_moves',
  groupProductionLot: 'lots_enforced_on_moves',
  groupLandedCosts: 'landed_costs_menu_and_post',
  groupDeliveryMethods: 'delivery_methods_menu_and_fixed_rate',
  groupStockBarcode: 'picking_barcode_scan',
  menuPos: 'pos_menu_card',
  menuManufacturing: 'manufacturing_menu_card',
  groupBatchTransfer: 'batch_transfer_model',
  groupStockWarning: 'partner_stockWarn_block',
  defaultPickingPolicy: 'check_availability_one_vs_direct',
  moduleQuality: 'quality_blocks_validate',
  groupReceptionReport: 'alias_receptionReportEnabled',
  barcodeNomenclatureId: 'barcode_match_rules',
  stockSmsConfirmation: 'validate_stamps_sms_note_requires_provider',
  groupStockSignDelivery: 'alias_signatureOnDelivery',
  groupGs1Nomenclature: 'gs1_barcode_rules',
  groupStockTrackingOwner: 'ownerId_on_transfer',
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

export function listSettingsEffects() {
  return Object.entries(SETTINGS_EFFECTS).map(([flag, effect]) => ({ flag, effect }));
}
