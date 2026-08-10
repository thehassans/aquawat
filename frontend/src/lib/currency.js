export const CURRENCY_CODE = 'SAR'
export const SAR_SYMBOL = '﷼'
export const DEFAULT_CURRENCY = CURRENCY_CODE

export const isSarCurrency = (currency = CURRENCY_CODE) => String(currency || CURRENCY_CODE).trim().toUpperCase() === CURRENCY_CODE

// Comprehensive ISO 4217 currency list surfaced in tenant Settings and the
// Super Admin panel. GCC/MENA currencies are listed first since this is a
// Saudi-first ERP, followed by the other major world currencies.
export const CURRENCIES = [
  { code: 'SAR', nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي', symbol: '﷼' },
  { code: 'AED', nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', nameEn: 'Kuwaiti Dinar', nameAr: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', nameEn: 'Qatari Riyal', nameAr: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'BHD', nameEn: 'Bahraini Dinar', nameAr: 'دينار بحريني', symbol: '.د.ب' },
  { code: 'OMR', nameEn: 'Omani Rial', nameAr: 'ريال عماني', symbol: 'ر.ع.' },
  { code: 'EGP', nameEn: 'Egyptian Pound', nameAr: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'JOD', nameEn: 'Jordanian Dinar', nameAr: 'دينار أردني', symbol: 'د.ا' },
  { code: 'LBP', nameEn: 'Lebanese Pound', nameAr: 'ليرة لبنانية', symbol: 'ل.ل' },
  { code: 'IQD', nameEn: 'Iraqi Dinar', nameAr: 'دينار عراقي', symbol: 'ع.د' },
  { code: 'YER', nameEn: 'Yemeni Rial', nameAr: 'ريال يمني', symbol: 'ر.ي' },
  { code: 'SYP', nameEn: 'Syrian Pound', nameAr: 'ليرة سورية', symbol: 'ل.س' },
  { code: 'SDG', nameEn: 'Sudanese Pound', nameAr: 'جنيه سوداني', symbol: 'ج.س' },
  { code: 'LYD', nameEn: 'Libyan Dinar', nameAr: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'TND', nameEn: 'Tunisian Dinar', nameAr: 'دينار تونسي', symbol: 'د.ت' },
  { code: 'DZD', nameEn: 'Algerian Dinar', nameAr: 'دينار جزائري', symbol: 'د.ج' },
  { code: 'MAD', nameEn: 'Moroccan Dirham', nameAr: 'درهم مغربي', symbol: 'د.م.' },
  { code: 'TRY', nameEn: 'Turkish Lira', nameAr: 'ليرة تركية', symbol: '₺' },
  { code: 'USD', nameEn: 'US Dollar', nameAr: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', nameEn: 'Euro', nameAr: 'يورو', symbol: '€' },
  { code: 'GBP', nameEn: 'British Pound', nameAr: 'جنيه إسترليني', symbol: '£' },
  { code: 'CHF', nameEn: 'Swiss Franc', nameAr: 'فرنك سويسري', symbol: 'CHF' },
  { code: 'SEK', nameEn: 'Swedish Krona', nameAr: 'كرونة سويدية', symbol: 'kr' },
  { code: 'NOK', nameEn: 'Norwegian Krone', nameAr: 'كرونة نرويجية', symbol: 'kr' },
  { code: 'DKK', nameEn: 'Danish Krone', nameAr: 'كرونة دنماركية', symbol: 'kr' },
  { code: 'PLN', nameEn: 'Polish Zloty', nameAr: 'زلوتي بولندي', symbol: 'zł' },
  { code: 'RUB', nameEn: 'Russian Ruble', nameAr: 'روبل روسي', symbol: '₽' },
  { code: 'PKR', nameEn: 'Pakistani Rupee', nameAr: 'روبية باكستانية', symbol: '₨' },
  { code: 'INR', nameEn: 'Indian Rupee', nameAr: 'روبية هندية', symbol: '₹' },
  { code: 'BDT', nameEn: 'Bangladeshi Taka', nameAr: 'تاكا بنغلاديشي', symbol: '৳' },
  { code: 'AFN', nameEn: 'Afghan Afghani', nameAr: 'أفغاني أفغانستاني', symbol: '؋' },
  { code: 'IRR', nameEn: 'Iranian Rial', nameAr: 'ريال إيراني', symbol: '﷼' },
  { code: 'PHP', nameEn: 'Philippine Peso', nameAr: 'بيزو فلبيني', symbol: '₱' },
  { code: 'IDR', nameEn: 'Indonesian Rupiah', nameAr: 'روبية إندونيسية', symbol: 'Rp' },
  { code: 'MYR', nameEn: 'Malaysian Ringgit', nameAr: 'رينغيت ماليزي', symbol: 'RM' },
  { code: 'SGD', nameEn: 'Singapore Dollar', nameAr: 'دولار سنغافوري', symbol: 'S$' },
  { code: 'CNY', nameEn: 'Chinese Yuan', nameAr: 'يوان صيني', symbol: '¥' },
  { code: 'JPY', nameEn: 'Japanese Yen', nameAr: 'ين ياباني', symbol: '¥' },
  { code: 'KRW', nameEn: 'South Korean Won', nameAr: 'وون كوري جنوبي', symbol: '₩' },
  { code: 'THB', nameEn: 'Thai Baht', nameAr: 'باهت تايلاندي', symbol: '฿' },
  { code: 'VND', nameEn: 'Vietnamese Dong', nameAr: 'دونغ فيتنامي', symbol: '₫' },
  { code: 'AUD', nameEn: 'Australian Dollar', nameAr: 'دولار أسترالي', symbol: 'A$' },
  { code: 'NZD', nameEn: 'New Zealand Dollar', nameAr: 'دولار نيوزيلندي', symbol: 'NZ$' },
  { code: 'CAD', nameEn: 'Canadian Dollar', nameAr: 'دولار كندي', symbol: 'C$' },
  { code: 'ZAR', nameEn: 'South African Rand', nameAr: 'راند جنوب أفريقي', symbol: 'R' },
  { code: 'NGN', nameEn: 'Nigerian Naira', nameAr: 'نايرا نيجيرية', symbol: '₦' },
  { code: 'KES', nameEn: 'Kenyan Shilling', nameAr: 'شلن كيني', symbol: 'KSh' },
  { code: 'ETB', nameEn: 'Ethiopian Birr', nameAr: 'بير إثيوبي', symbol: 'Br' },
  { code: 'BRL', nameEn: 'Brazilian Real', nameAr: 'ريال برازيلي', symbol: 'R$' },
  { code: 'MXN', nameEn: 'Mexican Peso', nameAr: 'بيزو مكسيكي', symbol: '$' },
  { code: 'HKD', nameEn: 'Hong Kong Dollar', nameAr: 'دولار هونغ كونغي', symbol: 'HK$' },
]

const CURRENCIES_BY_CODE = CURRENCIES.reduce((acc, item) => {
  acc[item.code] = item
  return acc
}, {})

export const getCurrencyMeta = (currency = CURRENCY_CODE) => {
  const code = String(currency || CURRENCY_CODE).trim().toUpperCase()
  return CURRENCIES_BY_CODE[code] || { code, nameEn: code, nameAr: code, symbol: code }
}

export const getCurrencyLabel = (currency = CURRENCY_CODE, language = 'en') => {
  const meta = getCurrencyMeta(currency)
  return language === 'ar' ? `${meta.nameAr} (${meta.code})` : `${meta.nameEn} (${meta.code})`
}

const getFormatter = ({
  language = 'en',
  currency = CURRENCY_CODE,
  currencyDisplay = 'code',
  minimumFractionDigits,
  maximumFractionDigits,
}) => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-SA'
  const options = {
    style: 'currency',
    currency,
    currencyDisplay,
  }

  if (typeof minimumFractionDigits === 'number') {
    options.minimumFractionDigits = minimumFractionDigits
  }

  if (typeof maximumFractionDigits === 'number') {
    options.maximumFractionDigits = maximumFractionDigits
  }

  return new Intl.NumberFormat(locale, options)
}

const getSafeValue = (value) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export const formatCurrencyAmount = (
  value,
  {
    language = 'en',
    currency = CURRENCY_CODE,
    currencyDisplay = 'code',
    minimumFractionDigits,
    maximumFractionDigits,
  } = {}
) => {
  const safeValue = getSafeValue(value)
  const formatter = getFormatter({
    language,
    currency,
    currencyDisplay,
    minimumFractionDigits,
    maximumFractionDigits,
  })

  return formatter
    .formatToParts(safeValue)
    .filter((part) => part.type !== 'currency')
    .map((part) => part.value)
    .join('')
    .replace(/[\u200e\u200f\u061c]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const formatCurrency = (
  value,
  {
    language = 'en',
    currency = CURRENCY_CODE,
    currencyDisplay = 'code',
    minimumFractionDigits,
    maximumFractionDigits,
  } = {}
) => {
  const safeValue = getSafeValue(value)
  const formatter = getFormatter({
    language,
    currency,
    currencyDisplay,
    minimumFractionDigits,
    maximumFractionDigits,
  })

  if (currencyDisplay === 'code' && isSarCurrency(currency)) {
    return `${SAR_SYMBOL} ${formatCurrencyAmount(safeValue, {
      language,
      currency,
      currencyDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
    })}`.trim()
  }

  return formatter.format(safeValue)
}
