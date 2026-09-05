/**
 * Accounting module top navigation — Odoo-style six hubs.
 * Items with `group` render as section headings inside dropdowns.
 * Missing domains point at coming-soon `:section` routes under /accounting/*.
 */

const A = '/app/dashboard/accounting'

export const ACCOUNTING_PATH = {
  root: A,
  invoices: `${A}/invoices`,
  invoiceSettings: `${A}/invoices/settings`,
  bills: `${A}/bills`,
  billsNew: `${A}/bills/new`,
  vendorRefunds: `${A}/vendor-refunds`,
  vendorRefundsNew: `${A}/vendor-refunds/new`,
}

/**
 * Only leave items here when there is truly no panel yet.
 * Prefer wiring a real panel (or SimpleStatusPanel) in Accounting.jsx.
 */
export const ACCOUNTING_COMING_SOON_SECTIONS = []

/**
 * Top bar hubs. Dashboard is a direct link (no children).
 * Dropdown hubs use `children` with optional `group` headings.
 */
export const ACCOUNTING_MENU = [
  {
    id: 'dashboard',
    labelEn: 'Dashboard',
    labelAr: 'لوحة التحكم',
    href: A,
    end: true,
  },
  {
    id: 'customers',
    labelEn: 'Customers',
    labelAr: 'العملاء',
    children: [
      { href: `${A}/invoices`, labelEn: 'Invoices', labelAr: 'الفواتير', end: true },
      { href: `${A}/credit-notes`, labelEn: 'Credit Notes', labelAr: 'إشعارات الدائن' },
      { href: `${A}/customer-payments`, labelEn: 'Payments', labelAr: 'المدفوعات' },
      { href: `${A}/follow-up-reports`, labelEn: 'Follow-up Reports', labelAr: 'تقارير المتابعة' },
      { href: `${A}/aged-ar`, labelEn: 'Aged Receivable', labelAr: 'أعمار المدينين' },
      { href: `${A}/products`, labelEn: 'Products', labelAr: 'المنتجات' },
      { href: `${A}/customers`, labelEn: 'Customers', labelAr: 'العملاء' },
    ],
  },
  {
    id: 'vendors',
    labelEn: 'Vendors',
    labelAr: 'الموردون',
    children: [
      { href: `${A}/bills`, labelEn: 'Bills', labelAr: 'فواتير المشتريات', end: true },
      { href: `${A}/vendor-refunds`, labelEn: 'Refunds', labelAr: 'المرتجعات' },
      { href: `${A}/vendor-payments`, labelEn: 'Payments', labelAr: 'المدفوعات' },
      { href: `${A}/payment-batches`, labelEn: 'Payment batches', labelAr: 'دفعات البنك' },
      { href: `${A}/aged-ap`, labelEn: 'Aged Payable', labelAr: 'أعمار الدائنين' },
      { href: `${A}/products`, labelEn: 'Products', labelAr: 'المنتجات' },
      { href: `${A}/vendors`, labelEn: 'Vendors', labelAr: 'الموردون' },
    ],
  },
  {
    id: 'accounting',
    labelEn: 'Accounting',
    labelAr: 'المحاسبة',
    children: [
      { group: true, labelEn: 'Journals', labelAr: 'القيود' },
      { href: `${A}/journals-board`, labelEn: 'Journal Entries', labelAr: 'قيود اليومية' },
      { href: `${A}/journal-items`, labelEn: 'Journal Items', labelAr: 'بنود القيود' },
      { href: `${A}/journal-books`, labelEn: 'Journal Books', labelAr: 'دفاتر القيود' },
      { href: `${A}/daily-restriction`, labelEn: 'Daily Restriction', labelAr: 'القيود اليومية' },
      { href: `${A}/general-voucher`, labelEn: 'General Voucher', labelAr: 'سند قيد عام' },
      { href: `${A}/receipt-voucher`, labelEn: 'Receipt Voucher', labelAr: 'سند قبض' },
      { href: `${A}/payment-voucher`, labelEn: 'Payment Voucher', labelAr: 'سند صرف' },
      { href: `${A}/ledger-search`, labelEn: 'Search', labelAr: 'بحث' },

      { group: true, labelEn: 'Management', labelAr: 'الإدارة' },
      { href: `${A}/automatic-transfers`, labelEn: 'Automatic Transfers', labelAr: 'تحويلات تلقائية' },
      { href: `${A}/analytic-items`, labelEn: 'Analytic Items', labelAr: 'البنود التحليلية' },
      { href: `${A}/analytic-accounts`, labelEn: 'Analytic Accounts', labelAr: 'الحسابات التحليلية' },
      { href: `${A}/assets`, labelEn: 'Assets', labelAr: 'الأصول' },
      { href: `${A}/deferred-revenues`, labelEn: 'Deferred Revenues', labelAr: 'إيرادات مؤجلة' },
      { href: `${A}/deferred-expenses`, labelEn: 'Deferred Expenses', labelAr: 'مصروفات مؤجلة' },
      { href: `${A}/opening-balances`, labelEn: 'Opening Balances', labelAr: 'أرصدة افتتاحية' },
      { href: `${A}/firm-clients`, labelEn: 'Firm Clients', labelAr: 'عملاء المكتب' },

      { group: true, labelEn: 'Actions', labelAr: 'إجراءات' },
      { href: `${A}/bank-recon`, labelEn: 'Reconciliation', labelAr: 'التسوية' },
      { href: `${A}/lock-dates`, labelEn: 'Lock Dates', labelAr: 'تواريخ الإقفال' },
      { href: `${A}/period-close`, labelEn: 'Period Close', labelAr: 'إقفال الفترة' },
    ],
  },
  {
    id: 'reporting',
    labelEn: 'Reporting',
    labelAr: 'التقارير',
    children: [
      { href: `${A}/executive-summary`, labelEn: 'Executive Summary', labelAr: 'الملخص التنفيذي' },
      { href: `${A}/balance-sheet`, labelEn: 'Balance Sheet', labelAr: 'الميزانية العمومية' },
      { href: `${A}/pnl`, labelEn: 'Profit and Loss', labelAr: 'الأرباح والخسائر' },
      { href: `${A}/cash-flow`, labelEn: 'Cash Flow Statement', labelAr: 'قائمة التدفقات النقدية' },
      { href: `${A}/tax-report`, labelEn: 'Tax Report', labelAr: 'تقرير الضريبة' },
      { href: `${A}/general-ledger`, labelEn: 'General Ledger', labelAr: 'دفتر الأستاذ العام' },
      { href: `${A}/trial`, labelEn: 'Trial Balance', labelAr: 'ميزان المراجعة' },
      { href: `${A}/journal-report`, labelEn: 'Journal Report', labelAr: 'تقرير القيود' },
      { href: `${A}/sequence-integrity`, labelEn: 'Sequence Integrity', labelAr: 'سلامة التسلسل' },
      { href: `${A}/journal-book-mapping`, labelEn: 'Journal Book Mapping', labelAr: 'مطابقة دفاتر القيود' },
      { href: `${A}/partner-ledger`, labelEn: 'Partner Ledger', labelAr: 'دفتر الشريك' },
      { href: `${A}/aged-ar`, labelEn: 'Aged Receivable', labelAr: 'أعمار المدينين' },
      { href: `${A}/aged-ap`, labelEn: 'Aged Payable', labelAr: 'أعمار الدائنين' },
      { href: `${A}/invoice-analysis`, labelEn: 'Invoice Analysis', labelAr: 'تحليل الفواتير' },
      { href: `${A}/analytic-report`, labelEn: 'Analytic Report', labelAr: 'تقرير تحليلي' },
      { href: `${A}/depreciation-schedule`, labelEn: 'Depreciation Schedule', labelAr: 'جدول الإهلاك' },
    ],
  },
  {
    id: 'configuration',
    labelEn: 'Configuration',
    labelAr: 'الإعدادات',
    children: [
      { group: true, labelEn: 'Settings', labelAr: 'الإعدادات' },
      { href: `${A}/defaults`, labelEn: 'Default Accounts', labelAr: 'الحسابات الافتراضية' },
      { href: `${A}/chart-of-accounts`, labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات' },
      { href: `${A}/taxes`, labelEn: 'Taxes', labelAr: 'الضريبة' },
      { href: `${A}/journals-board`, labelEn: 'Journals', labelAr: 'دفاتر القيود' },
      { href: `${A}/payment-terms`, labelEn: 'Payment Terms', labelAr: 'شروط الدفع' },
      { href: ACCOUNTING_PATH.invoiceSettings, labelEn: 'Invoice Settings', labelAr: 'إعدادات الفاتورة', end: true },
      { href: `${A}/follow-up-levels`, labelEn: 'Follow-up Levels', labelAr: 'مستويات المتابعة' },
      { href: `${A}/incoterms`, labelEn: 'Incoterms', labelAr: 'شروط التجارة الدولية' },

      { group: true, labelEn: 'Accounting', labelAr: 'المحاسبة' },
      { href: `${A}/bank-accounts`, labelEn: 'Bank Accounts', labelAr: 'الحسابات البنكية' },
      { href: `${A}/reconciliation-models`, labelEn: 'Reconciliation Models', labelAr: 'نماذج التسوية' },
      { href: `${A}/online-sync`, labelEn: 'Online Synchronization', labelAr: 'مزامنة عبر الإنترنت' },
      { href: `${A}/currencies`, labelEn: 'Currencies', labelAr: 'العملات' },
      { href: `${A}/fiscal-positions`, labelEn: 'Fiscal Positions', labelAr: 'المراكز الضريبية' },
      { href: `${A}/journal-groups`, labelEn: 'Journal Groups', labelAr: 'مجموعات الدفاتر' },

      { group: true, labelEn: 'Taxes', labelAr: 'الضرائب' },
      { href: `${A}/tax-groups`, labelEn: 'Tax Groups', labelAr: 'مجموعات الضريبة' },
      { href: `${A}/tax-units`, labelEn: 'Tax Units', labelAr: 'وحدات الضريبة' },

      { group: true, labelEn: 'Accounts', labelAr: 'الحسابات' },
      { href: `${A}/account-tags`, labelEn: 'Account Tags', labelAr: 'وسوم الحسابات' },
      { href: `${A}/account-groups`, labelEn: 'Account Groups', labelAr: 'مجموعات الحسابات' },
      { href: `${A}/horizontal-groups`, labelEn: 'Horizontal Groups', labelAr: 'مجموعات أفقية' },

      { group: true, labelEn: 'Payments', labelAr: 'المدفوعات' },
      { href: `${A}/payment-providers`, labelEn: 'Payment Providers', labelAr: 'بوابات الدفع' },

      { group: true, labelEn: 'Assets', labelAr: 'الأصول' },
      { href: `${A}/asset-models`, labelEn: 'Asset Models', labelAr: 'نماذج الأصول' },
      { href: `${A}/deferred-revenue-models`, labelEn: 'Deferred Revenue Models', labelAr: 'نماذج الإيرادات المؤجلة' },
      { href: `${A}/deferred-expense-models`, labelEn: 'Deferred Expense Models', labelAr: 'نماذج المصروفات المؤجلة' },

      { group: true, labelEn: 'Products', labelAr: 'المنتجات' },
      { href: `${A}/product-categories`, labelEn: 'Product Categories', labelAr: 'فئات المنتجات' },

      { group: true, labelEn: 'Reporting', labelAr: 'التقارير' },
      { href: `${A}/accounting-reports-config`, labelEn: 'Accounting Reports', labelAr: 'تقارير المحاسبة' },

      { group: true, labelEn: 'Analytic', labelAr: 'تحليلي' },
      { href: `${A}/analytic-accounts`, labelEn: 'Analytic Accounts', labelAr: 'الحسابات التحليلية' },
      { href: `${A}/analytic-plans`, labelEn: 'Analytic Plans', labelAr: 'الخطط التحليلية' },
      { href: `${A}/analytic-distribution-models`, labelEn: 'Analytic Distribution Models', labelAr: 'نماذج التوزيع التحليلي' },
    ],
  },
]

export function flattenAccountingMenuHrefs(menu = ACCOUNTING_MENU) {
  const hrefs = []
  for (const hub of menu) {
    if (hub.href) hrefs.push(hub.href)
    for (const child of hub.children || []) {
      if (child.href) hrefs.push(child.href)
    }
  }
  return hrefs
}

export function hubIsActive(hub, pathname, search = '') {
  // Bills / refunds / purchase composers belong to Vendors — never Customers
  const vendorPaths = [
    '/accounting/bills',
    '/accounting/vendor-bills',
    '/accounting/vendor-refunds',
    '/accounting/vendor-payments',
    '/accounting/payment-batches',
    '/accounting/aged-ap',
    '/accounting/vendors',
    '/accounting/invoices/new/purchase',
  ]
  const onVendorSurface = vendorPaths.some((p) => pathname.includes(p))
    || (pathname.includes('/accounting/invoices') && /[?&](tab|flow)=(purchase|purchases|vendor|bills|ap)/i.test(search))

  if (hub.id === 'vendors' && onVendorSurface) return true
  if (hub.id === 'customers' && onVendorSurface) return false

  if (hub.href) {
    if (hub.end) return pathname === hub.href || pathname === `${hub.href}/`
    return pathname === hub.href || pathname.startsWith(`${hub.href}/`)
  }
  return (hub.children || []).some((item) => {
    if (!item.href) return false
    const path = item.href.split('?')[0]
    if (item.end) return pathname === path || pathname === `${path}/`
    return pathname === path || pathname.startsWith(`${path}/`)
  })
}
