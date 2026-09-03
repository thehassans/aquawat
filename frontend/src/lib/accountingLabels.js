/** Human-readable EN/AR labels for accounting enums shown in the UI. */

function pick(map, key, language, fallback) {
  const entry = map[String(key || '').toLowerCase()]
  if (!entry) {
    const raw = fallback ?? key
    return raw ? String(raw) : '—'
  }
  return language === 'ar' ? entry.ar : entry.en
}

export function journalStatusLabel(status, language = 'en') {
  return pick({
    draft: { en: 'Draft', ar: 'مسودة' },
    posted: { en: 'Posted', ar: 'مرحّل' },
    reversed: { en: 'Reversed', ar: 'معكوس' },
    void: { en: 'Void', ar: 'ملغى' },
    cancelled: { en: 'Cancelled', ar: 'ملغى' },
  }, status, language, status)
}

export function journalTypeLabel(type, language = 'en') {
  return pick({
    manual: { en: 'Manual', ar: 'يدوي' },
    sale: { en: 'Sale', ar: 'بيع' },
    purchase: { en: 'Purchase', ar: 'شراء' },
    bank: { en: 'Bank', ar: 'بنك' },
    cash: { en: 'Cash', ar: 'نقد' },
    general: { en: 'General', ar: 'عام' },
    opening: { en: 'Opening', ar: 'افتتاحي' },
    closing: { en: 'Closing', ar: 'إقفال' },
    payment: { en: 'Payment', ar: 'دفعة' },
    receipt: { en: 'Receipt', ar: 'قبض' },
    credit_note: { en: 'Credit note', ar: 'إشعار دائن' },
    depreciation: { en: 'Depreciation', ar: 'إهلاك' },
    miscellaneous: { en: 'Miscellaneous', ar: 'متنوع' },
  }, type, language, type)
}

export function followUpChannelLabel(channel, language = 'en') {
  return pick({
    whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
    email: { en: 'Email', ar: 'بريد' },
    sms: { en: 'SMS', ar: 'رسالة' },
    call: { en: 'Call', ar: 'اتصال' },
    copy: { en: 'Copied', ar: 'منسوخ' },
  }, channel, language, channel)
}

export function accountTypeLabel(type, language = 'en') {
  return pick({
    asset: { en: 'Asset', ar: 'أصل' },
    liability: { en: 'Liability', ar: 'التزام' },
    equity: { en: 'Equity', ar: 'حقوق ملكية' },
    income: { en: 'Income', ar: 'إيراد' },
    expense: { en: 'Expense', ar: 'مصروف' },
    off_balance: { en: 'Off-balance', ar: 'خارج الميزانية' },
  }, type, language, type)
}

export function accountSubtypeLabel(subtype, language = 'en') {
  return pick({
    receivable: { en: 'Receivable', ar: 'مدينون' },
    payable: { en: 'Payable', ar: 'دائنون' },
    bank: { en: 'Bank', ar: 'بنك' },
    cash: { en: 'Cash', ar: 'نقد' },
    current: { en: 'Current', ar: 'متداول' },
    non_current: { en: 'Non-current', ar: 'غير متداول' },
    fixed: { en: 'Fixed', ar: 'ثابت' },
    inventory: { en: 'Inventory', ar: 'مخزون' },
    tax: { en: 'Tax', ar: 'ضريبة' },
    cogs: { en: 'COGS', ar: 'تكلفة البضاعة' },
    other: { en: 'Other', ar: 'أخرى' },
  }, subtype, language, subtype)
}

export function taxTypeLabel(type, language = 'en') {
  return pick({
    sales: { en: 'Sales', ar: 'مبيعات' },
    purchase: { en: 'Purchase', ar: 'مشتريات' },
    both: { en: 'Both', ar: 'كلاهما' },
    vat: { en: 'VAT', ar: 'ضريبة قيمة مضافة' },
    none: { en: 'None', ar: 'بدون' },
  }, type, language, type)
}

export function taxScopeLabel(scope, language = 'en') {
  return pick({
    all: { en: 'All', ar: 'الكل' },
    service: { en: 'Service', ar: 'خدمة' },
    product: { en: 'Product', ar: 'منتج' },
    invoice: { en: 'Invoice', ar: 'فاتورة' },
  }, scope, language, scope)
}

export function analyticTypeLabel(type, language = 'en') {
  return pick({
    view: { en: 'View', ar: 'عرض' },
    normal: { en: 'Normal', ar: 'عادي' },
    cost: { en: 'Cost', ar: 'تكلفة' },
    revenue: { en: 'Revenue', ar: 'إيراد' },
  }, type, language, type)
}

export function deferredStatusLabel(status, language = 'en') {
  return pick({
    draft: { en: 'Draft', ar: 'مسودة' },
    running: { en: 'Running', ar: 'جارٍ' },
    done: { en: 'Done', ar: 'مكتمل' },
    cancelled: { en: 'Cancelled', ar: 'ملغى' },
    posted: { en: 'Posted', ar: 'مرحّل' },
  }, status, language, status)
}
