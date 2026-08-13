// ─── Invoice Language Logic ──────────────────────────────────────────────────
// English is always the primary document language. A secondary language is
// paired alongside it when Settings → Invoice Language says so.
//
// Arabic is reserved for GCC markets only (Saudi, UAE, Qatar, Kuwait, Bahrain,
// Oman). Pakistan → Urdu, Bangladesh → Bangla. Everything else defaults to
// English-only unless the tenant picks an explicit bilingual mode.

export const INVOICE_LANGUAGE_OPTIONS = [
  { value: 'auto', labelEn: 'Auto (based on currency)', labelAr: 'تلقائي (حسب العملة)' },
  { value: 'en', labelEn: 'English Only', labelAr: 'الإنجليزية فقط' },
  { value: 'en_ar', labelEn: 'English + Arabic (GCC)', labelAr: 'الإنجليزية + العربية' },
  { value: 'en_ur', labelEn: 'English + Urdu', labelAr: 'الإنجليزية + الأردية' },
  { value: 'en_bn', labelEn: 'English + Bangla', labelAr: 'الإنجليزية + البنغالية' },
]

/** GCC currencies — Arabic secondary language is allowed only here. */
const ARABIC_CURRENCIES = new Set(['SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR'])
const ARABIC_COUNTRIES = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM'])

const URDU_CURRENCIES = new Set(['PKR'])
const URDU_COUNTRIES = new Set(['PK'])

const BANGLA_CURRENCIES = new Set(['BDT'])
const BANGLA_COUNTRIES = new Set(['BD'])

const VALID_MODES = ['en', 'en_ar', 'en_ur', 'en_bn']

const normalizeMode = (tenant) => {
  const raw = String(tenant?.settings?.invoiceLanguage || 'auto').trim().toLowerCase()
  return VALID_MODES.includes(raw) ? raw : 'auto'
}

const getCountryCode = (tenant) => String(tenant?.business?.address?.country || '').trim().toUpperCase()
const getCurrencyCode = (tenant) => String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()

/** The secondary language 'auto' mode would pick — currency first, then country. */
export const getAutoSecondaryLanguage = (tenant) => {
  const currency = getCurrencyCode(tenant)
  if (BANGLA_CURRENCIES.has(currency)) return 'bn'
  if (URDU_CURRENCIES.has(currency)) return 'ur'
  if (ARABIC_CURRENCIES.has(currency)) return 'ar'

  const country = getCountryCode(tenant)
  if (BANGLA_COUNTRIES.has(country)) return 'bn'
  if (URDU_COUNTRIES.has(country)) return 'ur'
  if (ARABIC_COUNTRIES.has(country)) return 'ar'
  return null
}

/**
 * Resolves the tenant's invoice secondary language: 'ar' | 'ur' | 'bn' | null.
 * null means English-only.
 */
export const getInvoiceSecondaryLanguage = (tenant) => {
  const mode = normalizeMode(tenant)
  if (mode === 'en') return null
  if (mode === 'en_ar') return 'ar'
  if (mode === 'en_ur') return 'ur'
  if (mode === 'en_bn') return 'bn'
  return getAutoSecondaryLanguage(tenant)
}

/**
 * Whether a document should render bilingually (English + secondary).
 *   - 'en'                 → never
 *   - 'en_ar'/'en_ur'/'en_bn' → always
 *   - 'auto'               → bilingual when a secondary language resolves
 *                            (invoices/quotations/letterheads always pair it)
 */
export const resolveInvoiceBilingual = (tenant, contextBilingual = true) => {
  const mode = normalizeMode(tenant)
  if (mode === 'en') return false
  if (mode === 'en_ar' || mode === 'en_ur' || mode === 'en_bn') return true
  const secondary = getAutoSecondaryLanguage(tenant)
  if (!secondary) return false
  return contextBilingual !== false
}

export const isGccArabicMarket = (tenant) => getAutoSecondaryLanguage(tenant) === 'ar'
  || ARABIC_CURRENCIES.has(getCurrencyCode(tenant))
  || ARABIC_COUNTRIES.has(getCountryCode(tenant))

// ─── Static-label localisation ───────────────────────────────────────────────
// Templates hardcode Arabic as the secondary phrase. We swap those exact
// Arabic strings into Urdu / Bangla when that secondary language is active.
export const AR_TO_UR_LABELS = {
  'الإجمالي الفرعي': 'ذیلی مجموعہ',
  'الخصم': 'رعایت',
  'الضريبة': 'ٹیکس',
  'إجمالي الضريبة': 'کل ٹیکس',
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
  'تاريخ الاستحقاق': 'موعد ادائیگی',
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
  'فاتورة بيع مفروشات': 'فرنیچر سیل انوائس',
  'فاتورة بيع بوتيك': 'بوٹیک سیل انوائس',
  'فاتورة إيجار بوتيك': 'بوٹیک کرایہ انوائس',
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
  'الفاتورة إلى': 'بل وصول',
  'التفاصيل': 'تفصیلات',
  'وسيلة الدفع': 'ادائیگی کا طریقہ',
  'المبلغ كتابة': 'رقم الفاظ میں',
  'المفوض بالتوقيع': 'مجاز دستخط کنندہ',
  'الأيام': 'دن',
  'تأمين': 'ڈپازٹ',
  'المبلغ المدفوع': 'ادا شدہ رقم',
  'المبلغ المتبقي': 'باقی رقم',
  'بداية الإيجار': 'کرایہ آغاز',
  'نهاية الإيجار': 'کرایہ اختتام',
  'عدد أيام الإيجار': 'کرایہ کے دن',
  'المجموع الفرعي': 'ذیلی مجموعہ',
  'المبلغ كتابةً': 'رقم الفاظ میں',
  'بيانات البنك': 'بینک کی تفصیلات',
  'شروط الإيجار': 'کرایہ کی شرائط',
  'طريقة الدفع': 'ادائیگی کا طریقہ',
}

export const AR_TO_BN_LABELS = {
  'الإجمالي الفرعي': 'উপমোট',
  'الخصم': 'ছাড়',
  'الضريبة': 'কর',
  'إجمالي الضريبة': 'মোট কর',
  'الإجمالي': 'মোট',
  'الإجمالي النهائي': 'সর্বমোট',
  'الوصف': 'বিবরণ',
  'الكمية': 'পরিমাণ',
  'سعر الوحدة': 'একক মূল্য',
  'السعر': 'মূল্য',
  'العميل': 'গ্রাহক',
  'المشتري': 'ক্রেতা',
  'البائع': 'বিক্রেতা',
  'الرقم الضريبي للشركة': 'কোম্পানি ভ্যাট নম্বর',
  'الرقم الضريبي': 'ভ্যাট নম্বর',
  'السجل التجاري': 'বাণিজ্যিক নিবন্ধন',
  'الهاتف': 'ফোন',
  'العنوان': 'ঠিকানা',
  'البريد الإلكتروني': 'ইমেইল',
  'التاريخ': 'তারিখ',
  'تاريخ الاستحقاق': 'পরিশোধের তারিখ',
  'رقم': 'নম্বর',
  'اسم المسافر الرئيسي': 'প্রধান যাত্রীর নাম',
  'رقم الجواز': 'পাসপোর্ট নম্বর',
  'مرجع التذكرة': 'টিকেট রেফারেন্স',
  'رمز الحجز': 'বুকিং কোড',
  'مسار الرحلة': 'ভ্রমণপথ',
  'الناقل / مزود الخدمة': 'পরিষেবা প্রদানকারী',
  'تاريخ المغادرة': 'প্রস্থানের তারিখ',
  'تاريخ العودة': 'ফেরার তারিখ',
  'التوقف / الإقامة': 'থাকা / স্টপওভার',
  'مسافرون إضافيون': 'অতিরিক্ত যাত্রী',
  'فاتورة ضريبية': 'ট্যাক্স ইনভয়েস',
  'فاتورة ضريبية للتجارة': 'ট্রেডিং ট্যাক্স ইনভয়েস',
  'فاتورة ضريبية للمقاولات': 'নির্মাণ ট্যাক্স ইনভয়েস',
  'فاتورة ضريبية لخدمات السفر': 'ভ্রমণ সেবা ট্যাক্স ইনভয়েস',
  'فاتورة بيع مفروشات': 'ফার্নিচার বিক্রয় ইনভয়েস',
  'فاتورة بيع بوتيك': 'বুটিক বিক্রয় ইনভয়েস',
  'فاتورة إيجار بوتيك': 'বুটিক ভাড়া ইনভয়েস',
  'عرض سعر': 'কোটেশন',
  'عرض سعر للمقاولات': 'নির্মাণ কোটেশন',
  'عرض سعر لخدمات السفر': 'ভ্রমণ সেবা কোটেশন',
  'عرض سعر للمطعم': 'রেস্তোরাঁ কোটেশন',
  'ملاحظات': 'নোট',
  'الشروط والأحكام': 'শর্তাবলী',
  'الموضوع': 'বিষয়',
  'التوقيع': 'স্বাক্ষর',
  'الختم': 'সিল',
  'المجموع': 'মোট',
  'صافي المبلغ': 'নেট পরিমাণ',
  'الفاتورة إلى': 'বিল প্রাপক',
  'التفاصيل': 'বিস্তারিত',
  'وسيلة الدفع': 'পরিশোধের মাধ্যম',
  'المبلغ كتابة': 'কথায় পরিমাণ',
  'المفوض بالتوقيع': 'অনুমোদিত স্বাক্ষরকারী',
  'الأيام': 'দিন',
  'تأمين': 'জামানত',
  'المبلغ المدفوع': 'পরিশোধিত',
  'المبلغ المتبقي': 'বকেয়া',
  'بداية الإيجار': 'ভাড়া শুরু',
  'نهاية الإيجار': 'ভাড়া শেষ',
  'عدد أيام الإيجار': 'ভাড়ার দিন',
  'المجموع الفرعي': 'উপমোট',
  'المبلغ كتابةً': 'কথায় পরিমাণ',
  'بيانات البنك': 'ব্যাংকের বিবরণ',
  'شروط الإيجار': 'ভাড়ার শর্তাবলী',
  'طريقة الدفع': 'পরিশোধের মাধ্যম',
}

let activeSecondaryLanguage = null

/** Call once per render before using `localizeSecondaryText` / bilingual helpers. */
export const setActiveInvoiceSecondaryLanguage = (lang) => {
  activeSecondaryLanguage = (lang === 'ur' || lang === 'bn' || lang === 'ar') ? lang : null
}

export const getActiveInvoiceSecondaryLanguage = () => activeSecondaryLanguage

/** True when secondary text should render RTL (Arabic / Urdu). Bangla is LTR. */
export const getSecondaryTextDir = (lang = activeSecondaryLanguage) => (lang === 'bn' ? 'ltr' : 'rtl')

/** Swaps a hardcoded Arabic phrase for Urdu / Bangla when that secondary is active. */
export const localizeSecondaryText = (arabicText) => {
  const text = String(arabicText || '')
  if (!activeSecondaryLanguage) return ''
  if (activeSecondaryLanguage === 'ur') return AR_TO_UR_LABELS[text] || text
  if (activeSecondaryLanguage === 'bn') return AR_TO_BN_LABELS[text] || text
  return text
}

/**
 * Build a document label: English only, or `English / Secondary`.
 * Pass the Arabic canonical phrase as `arabic` — it is auto-localized to
 * Urdu/Bangla when that secondary language is active.
 */
export const bilingualLabel = (english, arabic, bilingual = true) => {
  if (!bilingual) return english
  const secondary = localizeSecondaryText(arabic)
  if (!secondary || secondary === english) return english
  return `${english} / ${secondary}`
}

export const toEasternArabicNumerals = (value) => (
  String(value || '').replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[digit])
)
