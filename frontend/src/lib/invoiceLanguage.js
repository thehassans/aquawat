// ─── Invoice Language Logic ──────────────────────────────────────────────────
// Lets each tenant choose which second language (if any) their invoices and
// quotations render in alongside English — e.g. English + Arabic for Saudi
// tenants, English + Urdu for Pakistani tenants, or English only.
//
// 'auto' (default) preserves the app's historical behavior: Arabic is used as
// the secondary language everywhere it was already hardcoded, UNLESS the
// tenant's country resolves to a different natural secondary language (e.g.
// Pakistan → Urdu). Tenants can always override this explicitly in Settings.

export const INVOICE_LANGUAGE_OPTIONS = [
  { value: 'auto', labelEn: 'Auto (based on country)', labelAr: 'تلقائي (حسب الدولة)' },
  { value: 'en', labelEn: 'English Only', labelAr: 'الإنجليزية فقط' },
  { value: 'en_ar', labelEn: 'English + Arabic', labelAr: 'الإنجليزية + العربية' },
  { value: 'en_ur', labelEn: 'English + Urdu', labelAr: 'الإنجليزية + الأردية' },
]

// Countries whose natural invoicing companion language is Arabic.
const ARABIC_COUNTRIES = new Set([
  'SA', 'AE', 'EG', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IQ', 'SY', 'YE',
  'SD', 'MA', 'TN', 'DZ', 'LY', 'PS', 'MR', 'SO', 'DJ', 'KM',
])

// Countries whose natural invoicing companion language is Urdu.
const URDU_COUNTRIES = new Set(['PK'])

const normalizeMode = (tenant) => {
  const raw = String(tenant?.settings?.invoiceLanguage || 'auto').trim().toLowerCase()
  return ['en', 'en_ar', 'en_ur'].includes(raw) ? raw : 'auto'
}

const getCountryCode = (tenant) => String(tenant?.business?.address?.country || 'SA').trim().toUpperCase()

/** The secondary language 'auto' mode would pick for this tenant's country. */
export const getAutoSecondaryLanguage = (tenant) => {
  const country = getCountryCode(tenant)
  if (URDU_COUNTRIES.has(country)) return 'ur'
  if (ARABIC_COUNTRIES.has(country)) return 'ar'
  // Default fallback keeps pre-existing app behavior (Arabic-first) for
  // tenants who haven't set a country / are outside the mapped lists.
  return 'ar'
}

/**
 * Resolves the tenant's invoice secondary language: 'ar' | 'ur' | null.
 * null means English-only (tenant explicitly disabled bilingual invoices).
 */
export const getInvoiceSecondaryLanguage = (tenant) => {
  const mode = normalizeMode(tenant)
  if (mode === 'en') return null
  if (mode === 'en_ar') return 'ar'
  if (mode === 'en_ur') return 'ur'
  return getAutoSecondaryLanguage(tenant)
}

/**
 * Decides whether a specific document should render bilingually, combining
 * the tenant's language preference with the existing per-context defaults
 * (quotations, travel tickets, and a few business contexts have always been
 * bilingual). Explicit tenant choices always win:
 *   - 'en'            → never bilingual, regardless of document context
 *   - 'en_ar'/'en_ur' → always bilingual, for every document
 *   - 'auto' (default) → unchanged legacy per-context behavior
 */
export const resolveInvoiceBilingual = (tenant, contextBilingual = false) => {
  const mode = normalizeMode(tenant)
  if (mode === 'en') return false
  if (mode === 'en_ar' || mode === 'en_ur') return true
  return contextBilingual
}

// ─── Static-label localisation ───────────────────────────────────────────────
// Most templates build bilingual labels as `toBilingualText('Subtotal', 'الإجمالي الفرعي')`
// with the Arabic string hardcoded at the call site. Rather than touching every
// call site, we keep a lookup table from those exact Arabic phrases to their
// Urdu equivalents, and swap them in transparently when the active secondary
// language is Urdu.
export const AR_TO_UR_LABELS = {
  'الإجمالي الفرعي': 'ذیلی مجموعہ',
  'الخصم': 'رعایت',
  'الضريبة': 'ٹیکس',
  'الإجمالي': 'کل رقم',
  'الإجمالي النهائي': 'کل مجموعی رقم',
  'الوصف': 'تفصیل',
  'الكمية': 'مقدار',
  'سعر الوحدة': 'فی یونٹ قیمت',
  'السعر': 'قیمت',
  'العميل': 'گاہک',
  'المشتري': 'خریدار',
  'البائع': 'فروخت کنندہ',
  'الرقم الضريبي للشركة': 'کمپنی ٹیکس نمبر',
  'الرقم الضريبي': 'ٹیکس نمبر',
  'السجل التجاري': 'کمرشل رجسٹریشن نمبر',
  'الهاتف': 'فون نمبر',
  'العنوان': 'پتہ',
  'البريد الإلكتروني': 'ای میل',
  'التاريخ': 'تاریخ',
  'رقم': 'نمبر',
  'اسم المسافر الرئيسي': 'مرکزی مسافر کا نام',
  'رقم الجواز': 'پاسپورٹ نمبر',
  'مرجع التذكرة': 'ٹکٹ حوالہ نمبر',
  'رمز الحجز': 'بکنگ کوڈ',
  'مسار الرحلة': 'سفر کا راستہ',
  'الناقل / مزود الخدمة': 'سروس فراہم کنندہ',
  'تاريخ المغادرة': 'روانگی کی تاریخ',
  'تاريخ العودة': 'واپسی کی تاریخ',
  'التوقف / الإقامة': 'قیام / ٹھہراؤ',
  'مسافرون إضافيون': 'اضافی مسافرین',
  'فاتورة ضريبية': 'ٹیکس انوائس',
  'فاتورة ضريبية للتجارة': 'تجارتی ٹیکس انوائس',
  'فاتورة ضريبية للمقاولات': 'تعمیراتی ٹیکس انوائس',
  'فاتورة ضريبية لخدمات السفر': 'سفری خدمات کا ٹیکس انوائس',
  'عرض سعر': 'کوٹیشن',
  'عرض سعر للمقاولات': 'تعمیراتی کوٹیشن',
  'عرض سعر لخدمات السفر': 'سفری خدمات کوٹیشن',
  'عرض سعر للمطعم': 'ریستوران کوٹیشن',
  'ملاحظات': 'نوٹس',
  'الشروط والأحكام': 'شرائط و ضوابط',
  'الموضوع': 'موضوع',
  'التوقيع': 'دستخط',
  'الختم': 'مہر',
  'المجموع': 'مجموعہ',
  'صافي المبلغ': 'خالص رقم',
}

let activeSecondaryLanguage = 'ar'

/** Call once per render before using `localizeSecondaryText` / `toBilingualText`. */
export const setActiveInvoiceSecondaryLanguage = (lang) => {
  activeSecondaryLanguage = lang === 'ur' ? 'ur' : 'ar'
}

export const getActiveInvoiceSecondaryLanguage = () => activeSecondaryLanguage

/** Swaps a hardcoded Arabic phrase for its Urdu equivalent when applicable. */
export const localizeSecondaryText = (arabicText) => {
  if (activeSecondaryLanguage !== 'ur') return arabicText
  const text = String(arabicText || '')
  return AR_TO_UR_LABELS[text] || text
}
