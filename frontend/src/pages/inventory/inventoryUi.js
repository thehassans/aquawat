export const INVENTORY_PATH = {
  root: '/app/dashboard/inventory',
  overview: '/app/dashboard/inventory/overview',
  operations: '/app/dashboard/inventory/operations/receipts',
  receipts: '/app/dashboard/inventory/operations/receipts',
  deliveries: '/app/dashboard/inventory/operations/deliveries',
  internal: '/app/dashboard/inventory/operations/internal',
  physicalInventory: '/app/dashboard/inventory/operations/physical-inventory',
  scrap: '/app/dashboard/inventory/operations/scrap',
  replenishment: '/app/dashboard/inventory/operations/replenishment',
  procurementGroups: '/app/dashboard/inventory/operations/procurement-groups',
  products: '/app/dashboard/inventory/products',
  productNew: '/app/dashboard/inventory/products/new',
  product: (id) => `/app/dashboard/inventory/products/${id}`,
  lots: '/app/dashboard/inventory/products/lots',
  lot: (id) => `/app/dashboard/inventory/products/lots/${id}`,
  packages: '/app/dashboard/inventory/products/packages',
  picking: (id) => `/app/dashboard/inventory/pickings/${id}`,
  receiptNew: '/app/dashboard/inventory/operations/receipts/new',
  deliveryNew: '/app/dashboard/inventory/operations/deliveries/new',
  internalNew: '/app/dashboard/inventory/operations/internal/new',
  stockReport: '/app/dashboard/inventory/reporting/stock',
  movesHistory: '/app/dashboard/inventory/reporting/moves-history',
  movesAnalysis: '/app/dashboard/inventory/reporting/moves-analysis',
  performance: '/app/dashboard/inventory/reporting/performance',
  landedCosts: '/app/dashboard/inventory/operations/landed-costs',
  landedCost: (id) => `/app/dashboard/inventory/operations/landed-costs/${id}`,
  config: '/app/dashboard/inventory/configuration',
  warehouses: '/app/dashboard/inventory/configuration/warehouses',
  routes: '/app/dashboard/inventory/configuration/routes',
  rules: '/app/dashboard/inventory/configuration/rules',
  putaway: '/app/dashboard/inventory/configuration/putaway',
  barcodes: '/app/dashboard/inventory/configuration/barcodes',
}

export const fieldControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white'

export const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,118,110,0.85)] transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950'

export const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200'

export const PICKING_STATUS_PILL = {
  assigned: 'badge-success',
  waiting: 'badge-warning',
  confirmed: 'badge-info',
  draft: 'badge-neutral',
  done: 'badge-neutral',
  cancel: 'badge-danger',
}

export function pickingStatusLabel(state, language) {
  const ar = {
    draft: 'مسودة',
    waiting: 'انتظار',
    confirmed: 'مؤكد',
    assigned: 'جاهز',
    done: 'منجز',
    cancel: 'ملغى',
  }
  const en = {
    draft: 'Draft',
    waiting: 'Waiting',
    confirmed: 'Confirmed',
    assigned: 'Ready',
    done: 'Done',
    cancel: 'Cancelled',
  }
  return (language === 'ar' ? ar : en)[state] || state
}

export function opTypeLabel(code, language) {
  const ar = { incoming: 'استلام', outgoing: 'تسليم', internal: 'تحويل داخلي' }
  const en = { incoming: 'Receipts', outgoing: 'Deliveries', internal: 'Internal' }
  return (language === 'ar' ? ar : en)[code] || code
}
