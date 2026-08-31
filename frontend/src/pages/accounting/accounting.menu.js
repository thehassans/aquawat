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
}

/** Flat list of coming-soon section ids (for Accounting.jsx TABS registration). */
export const ACCOUNTING_COMING_SOON_SECTIONS = [
  { id: 'follow-up-reports', labelEn: 'Follow-up Reports', labelAr: 'تقارير المتابعة' },
  { id: 'journal-items', labelEn: 'Journal Items', labelAr: 'بنود القيود' },
  { id: 'automatic-transfers', labelEn: 'Automatic Transfers', labelAr: 'تحويلات تلقائية' },
  { id: 'analytic-items', labelEn: 'Analytic Items', labelAr: 'البنود التحليلية' },
  { id: 'assets', labelEn: 'Assets', labelAr: 'الأصول' },
  { id: 'deferred-revenues', labelEn: 'Deferred Revenues', labelAr: 'إيرادات مؤجلة' },
  { id: 'deferred-expenses', labelEn: 'Deferred Expenses', labelAr: 'مصروفات مؤجلة' },
  { id: 'executive-summary', labelEn: 'Executive Summary', labelAr: 'الملخص التنفيذي' },
  { id: 'general-ledger', labelEn: 'General Ledger', labelAr: 'دفتر الأستاذ العام' },
  { id: 'journal-report', labelEn: 'Journal Report', labelAr: 'تقرير القيود' },
  { id: 'partner-ledger', labelEn: 'Partner Ledger', labelAr: 'دفتر الشريك' },
  { id: 'invoice-analysis', labelEn: 'Invoice Analysis', labelAr: 'تحليل الفواتير' },
  { id: 'depreciation-schedule', labelEn: 'Depreciation Schedule', labelAr: 'جدول الإهلاك' },
  { id: 'payment-terms', labelEn: 'Payment Terms', labelAr: 'شروط الدفع' },
  { id: 'follow-up-levels', labelEn: 'Follow-up Levels', labelAr: 'مستويات المتابعة' },
  { id: 'incoterms', labelEn: 'Incoterms', labelAr: 'شروط التجارة الدولية' },
  { id: 'bank-accounts', labelEn: 'Bank Accounts', labelAr: 'الحسابات البنكية' },
  { id: 'reconciliation-models', labelEn: 'Reconciliation Models', labelAr: 'نماذج التسوية' },
  { id: 'online-sync', labelEn: 'Online Synchronization', labelAr: 'مزامنة عبر الإنترنت' },
  { id: 'currencies', labelEn: 'Currencies', labelAr: 'العملات' },
  { id: 'fiscal-positions', labelEn: 'Fiscal Positions', labelAr: 'المراكز الضريبية' },
  { id: 'journal-groups', labelEn: 'Journal Groups', labelAr: 'مجموعات الدفاتر' },
  { id: 'tax-groups', labelEn: 'Tax Groups', labelAr: 'مجموعات الضريبة' },
  { id: 'tax-units', labelEn: 'Tax Units', labelAr: 'وحدات الضريبة' },
  { id: 'account-tags', labelEn: 'Account Tags', labelAr: 'وسوم الحسابات' },
  { id: 'account-groups', labelEn: 'Account Groups', labelAr: 'مجموعات الحسابات' },
  { id: 'horizontal-groups', labelEn: 'Horizontal Groups', labelAr: 'مجموعات أفقية' },
  { id: 'payment-providers', labelEn: 'Payment Providers', labelAr: 'بوابات الدفع' },
  { id: 'asset-models', labelEn: 'Asset Models', labelAr: 'نماذج الأصول' },
  { id: 'deferred-revenue-models', labelEn: 'Deferred Revenue Models', labelAr: 'نماذج الإيرادات المؤجلة' },
  { id: 'product-categories', labelEn: 'Product Categories', labelAr: 'فئات المنتجات' },
  { id: 'deferred-expense-models', labelEn: 'Deferred Expense Models', labelAr: 'نماذج المصروفات المؤجلة' },
  { id: 'accounting-reports-config', labelEn: 'Accounting Reports', labelAr: 'تقارير المحاسبة' },
  { id: 'analytic-distribution-models', labelEn: 'Analytic Distribution Models', labelAr: 'نماذج التوزيع التحليلي' },
  { id: 'analytic-plans', labelEn: 'Analytic Plans', labelAr: 'الخطط التحليلية' },
]

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
      { href: '/app/dashboard/inventory/products', labelEn: 'Products', labelAr: 'المنتجات' },
      { href: '/app/dashboard/customers', labelEn: 'Customers', labelAr: 'العملاء' },
    ],
  },
  {
    id: 'vendors',
    labelEn: 'Vendors',
    labelAr: 'الموردون',
    children: [
      { href: `${A}/vendor-bills`, labelEn: 'Bills', labelAr: 'فواتير المشتريات' },
      { href: `${A}/vendor-refunds`, labelEn: 'Refunds', labelAr: 'المرتجعات' },
      { href: `${A}/vendor-payments`, labelEn: 'Payments', labelAr: 'المدفوعات' },
      { href: `${A}/aged-ap`, labelEn: 'Aged Payable', labelAr: 'أعمار الدائنين' },
      { href: '/app/dashboard/inventory/products', labelEn: 'Products', labelAr: 'المنتجات' },
      { href: '/app/dashboard/suppliers', labelEn: 'Vendors', labelAr: 'الموردون' },
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
      { id: 'seed-chart', action: 'seed-chart', labelEn: 'Seed Chart of Accounts', labelAr: 'تجهيز دليل الحسابات' },
    ],
  },
  {
    id: 'reporting',
    labelEn: 'Reporting',
    labelAr: 'التقارير',
    children: [
      { group: true, labelEn: 'Statement Reports', labelAr: 'التقارير المالية' },
      { href: `${A}/balance-sheet`, labelEn: 'Balance Sheet', labelAr: 'الميزانية' },
      { href: `${A}/pnl`, labelEn: 'Profit and Loss', labelAr: 'الأرباح والخسائر' },
      { href: `${A}/cash-flow`, labelEn: 'Cash Flow Statement', labelAr: 'قائمة التدفقات النقدية' },
      { href: `${A}/executive-summary`, labelEn: 'Executive Summary', labelAr: 'الملخص التنفيذي' },
      { href: `${A}/tax-report`, labelEn: 'Tax Report', labelAr: 'تقرير الضريبة' },

      { group: true, labelEn: 'Audit Reports', labelAr: 'تقارير التدقيق' },
      { href: `${A}/general-ledger`, labelEn: 'General Ledger', labelAr: 'دفتر الأستاذ العام' },
      { href: `${A}/trial`, labelEn: 'Trial Balance', labelAr: 'ميزان المراجعة' },
      { href: `${A}/journal-report`, labelEn: 'Journal Report', labelAr: 'تقرير القيود' },
      { href: `${A}/account-report`, labelEn: 'Account Report', labelAr: 'تقرير الحساب' },

      { group: true, labelEn: 'Partner Reports', labelAr: 'تقارير الشركاء' },
      { href: `${A}/partner-ledger`, labelEn: 'Partner Ledger', labelAr: 'دفتر الشريك' },
      { href: `${A}/aged-ar`, labelEn: 'Aged Receivable', labelAr: 'أعمار المدينين' },
      { href: `${A}/aged-ap`, labelEn: 'Aged Payable', labelAr: 'أعمار الدائنين' },
      { href: `${A}/customer-account`, labelEn: 'Customer Account', labelAr: 'كشف العميل' },
      { href: `${A}/customer-summary`, labelEn: 'Customer Summary', labelAr: 'ملخص العملاء' },
      { href: `${A}/supplier-account`, labelEn: 'Supplier Account', labelAr: 'كشف المورد' },
      { href: `${A}/supplier-summary`, labelEn: 'Supplier Summary', labelAr: 'ملخص الموردين' },

      { group: true, labelEn: 'Management', labelAr: 'الإدارة' },
      { href: `${A}/invoice-analysis`, labelEn: 'Invoice Analysis', labelAr: 'تحليل الفواتير' },
      { href: `${A}/depreciation-schedule`, labelEn: 'Depreciation Schedule', labelAr: 'جدول الإهلاك' },
      { href: `${A}/analytic-report`, labelEn: 'Analytic Report', labelAr: 'تقرير تحليلي' },
    ],
  },
  {
    id: 'configuration',
    labelEn: 'Configuration',
    labelAr: 'الإعدادات',
    children: [
      { group: true, labelEn: 'Settings', labelAr: 'الإعدادات' },
      { href: `${A}/invoices/settings`, labelEn: 'Settings', labelAr: 'إعدادات الفاتورة' },
      { href: `${A}/defaults`, labelEn: 'Default Accounts', labelAr: 'الحسابات الافتراضية' },

      { group: true, labelEn: 'Invoicing', labelAr: 'الفوترة' },
      { href: `${A}/payment-terms`, labelEn: 'Payment Terms', labelAr: 'شروط الدفع' },
      { href: `${A}/follow-up-levels`, labelEn: 'Follow-up Levels', labelAr: 'مستويات المتابعة' },
      { href: `${A}/incoterms`, labelEn: 'Incoterms', labelAr: 'شروط التجارة الدولية' },

      { group: true, labelEn: 'Banks', labelAr: 'البنوك' },
      { href: `${A}/bank-accounts`, labelEn: 'Add a Bank Account', labelAr: 'إضافة حساب بنكي' },
      { href: `${A}/reconciliation-models`, labelEn: 'Reconciliation Models', labelAr: 'نماذج التسوية' },
      { href: `${A}/online-sync`, labelEn: 'Online Synchronization', labelAr: 'مزامنة عبر الإنترنت' },
      { href: `${A}/bank-recon`, labelEn: 'Bank Reconciliation', labelAr: 'التسوية البنكية' },

      { group: true, labelEn: 'Accounting', labelAr: 'المحاسبة' },
      { href: `${A}/chart-of-accounts`, labelEn: 'Chart of Accounts', labelAr: 'دليل الحسابات' },
      { href: `${A}/taxes`, labelEn: 'Taxes', labelAr: 'الضرائب' },
      { href: `${A}/journal-books`, labelEn: 'Journals', labelAr: 'الدفاتر' },
      { href: `${A}/currencies`, labelEn: 'Currencies', labelAr: 'العملات' },
      { href: `${A}/fiscal-positions`, labelEn: 'Fiscal Positions', labelAr: 'المراكز الضريبية' },
      { href: `${A}/journal-groups`, labelEn: 'Journal Groups', labelAr: 'مجموعات الدفاتر' },
      { href: `${A}/tax-groups`, labelEn: 'Tax Groups', labelAr: 'مجموعات الضريبة' },
      { href: `${A}/tax-units`, labelEn: 'Tax Units', labelAr: 'وحدات الضريبة' },
      { href: `${A}/account-tags`, labelEn: 'Account Tags', labelAr: 'وسوم الحسابات' },
      { href: `${A}/account-groups`, labelEn: 'Account Groups', labelAr: 'مجموعات الحسابات' },
      { href: `${A}/horizontal-groups`, labelEn: 'Horizontal Groups', labelAr: 'مجموعات أفقية' },

      { group: true, labelEn: 'Payments', labelAr: 'المدفوعات' },
      { href: `${A}/payment-providers`, labelEn: 'Payment Providers', labelAr: 'بوابات الدفع' },

      { group: true, labelEn: 'Management', labelAr: 'الإدارة' },
      { href: `${A}/asset-models`, labelEn: 'Asset Models', labelAr: 'نماذج الأصول' },
      { href: `${A}/deferred-revenue-models`, labelEn: 'Deferred Revenue Models', labelAr: 'نماذج الإيرادات المؤجلة' },
      { href: `${A}/product-categories`, labelEn: 'Product Categories', labelAr: 'فئات المنتجات' },
      { href: `${A}/deferred-expense-models`, labelEn: 'Deferred Expense Models', labelAr: 'نماذج المصروفات المؤجلة' },
      { href: `${A}/accounting-reports-config`, labelEn: 'Accounting Reports', labelAr: 'تقارير المحاسبة' },

      { group: true, labelEn: 'Analytic Accounting', labelAr: 'المحاسبة التحليلية' },
      { href: `${A}/analytic-distribution-models`, labelEn: 'Analytic Distribution Models', labelAr: 'نماذج التوزيع التحليلي' },
      { href: `${A}/analytic-accounts`, labelEn: 'Analytic Accounts', labelAr: 'الحسابات التحليلية' },
      { href: `${A}/analytic-plans`, labelEn: 'Analytic Plans', labelAr: 'الخطط التحليلية' },
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

export function hubIsActive(hub, pathname) {
  if (hub.href) {
    if (hub.end) return pathname === hub.href || pathname === `${hub.href}/`
    return pathname === hub.href || pathname.startsWith(`${hub.href}/`)
  }
  return (hub.children || []).some((item) => {
    if (!item.href) return false
    if (item.end) return pathname === item.href || pathname === `${item.href}/`
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  })
}
