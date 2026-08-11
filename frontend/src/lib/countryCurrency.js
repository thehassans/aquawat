// Country → default currency (and whether Arabic bilingual fields apply).
// Keep aligned with invoiceLanguage.js GCC set.

export const COUNTRY_OPTIONS = [
  { code: 'SA', nameEn: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية', currency: 'SAR', arabic: true },
  { code: 'AE', nameEn: 'United Arab Emirates', nameAr: 'الإمارات', currency: 'AED', arabic: true },
  { code: 'QA', nameEn: 'Qatar', nameAr: 'قطر', currency: 'QAR', arabic: true },
  { code: 'KW', nameEn: 'Kuwait', nameAr: 'الكويت', currency: 'KWD', arabic: true },
  { code: 'BH', nameEn: 'Bahrain', nameAr: 'البحرين', currency: 'BHD', arabic: true },
  { code: 'OM', nameEn: 'Oman', nameAr: 'عُمان', currency: 'OMR', arabic: true },
  { code: 'BD', nameEn: 'Bangladesh', nameAr: 'بنغلاديش', currency: 'BDT', arabic: false },
  { code: 'PK', nameEn: 'Pakistan', nameAr: 'باكستان', currency: 'PKR', arabic: false },
  { code: 'IN', nameEn: 'India', nameAr: 'الهند', currency: 'INR', arabic: false },
  { code: 'EG', nameEn: 'Egypt', nameAr: 'مصر', currency: 'EGP', arabic: false },
  { code: 'JO', nameEn: 'Jordan', nameAr: 'الأردن', currency: 'JOD', arabic: false },
  { code: 'US', nameEn: 'United States', nameAr: 'الولايات المتحدة', currency: 'USD', arabic: false },
  { code: 'GB', nameEn: 'United Kingdom', nameAr: 'المملكة المتحدة', currency: 'GBP', arabic: false },
  { code: 'TR', nameEn: 'Turkey', nameAr: 'تركيا', currency: 'TRY', arabic: false },
  { code: 'MY', nameEn: 'Malaysia', nameAr: 'ماليزيا', currency: 'MYR', arabic: false },
  { code: 'SG', nameEn: 'Singapore', nameAr: 'سنغافورة', currency: 'SGD', arabic: false },
  { code: 'OTHER', nameEn: 'Other', nameAr: 'أخرى', currency: 'USD', arabic: false },
]

export const getCountryOption = (code) =>
  COUNTRY_OPTIONS.find((c) => c.code === String(code || '').toUpperCase()) || null

export const currencyForCountry = (code) => getCountryOption(code)?.currency || 'USD'

export const isArabicCountry = (code) => Boolean(getCountryOption(code)?.arabic)
