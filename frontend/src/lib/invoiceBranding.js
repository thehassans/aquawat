export const DEFAULT_VISION_2030_LOGO = '/saudi-vision-2030-logo.webp'
export const INVOICE_BRANDING_CONTEXTS = ['trading', 'construction', 'travel_agency']
export const INVOICE_FONT_OPTIONS = [
  { value: 'helvetica', labelEn: 'Helvetica', labelAr: 'هيلفيتيكا' },
  { value: 'times', labelEn: 'Times', labelAr: 'تايمز' },
  { value: 'courier', labelEn: 'Courier', labelAr: 'كوريير' },
]

const CONTEXT_TEMPLATE_DEFAULTS = {
  trading: 5,
  construction: 6,
  travel_agency: 4,
}

const DEFAULT_INVOICE_TYPOGRAPHY = {
  bodyFontFamily: 'helvetica',
  headingFontFamily: 'helvetica',
  bodyFontSize: 12,
  headingFontSize: 18,
}

const LEGACY_TRAVEL_HEADER_TEXT_EN = 'Professional travel management and reservation services tailored for corporate and international journeys.'
const LEGACY_TRAVEL_HEADER_TEXT_AR = 'خدمات سفر وحجوزات احترافية مصممة لرحلات الأعمال والرحلات الدولية بثقة عالية.'

const pickLocalizedText = (englishValue, arabicValue, language = 'en') => {
  if (language === 'ar') return arabicValue || englishValue || ''
  return englishValue || arabicValue || ''
}

const pickFirstText = (...values) => values.find((value) => String(value || '').trim()) || ''

const buildDefaultHeaderText = (context, language = 'en') => {
  return ''
}

const buildDefaultContextFooterText = (context, language = 'en') => {
  if (context === 'travel_agency') {
    return language === 'ar'
      ? 'تذاكر طيران • حجوزات فنادق • برامج سفر • دعم احترافي متواصل'
      : 'Air Ticketing • Hotel Reservations • Travel Programs • Professional Support'
  }

  return ''
}

const normalizeInvoiceContext = (businessContext = 'trading') => {
  if (INVOICE_BRANDING_CONTEXTS.includes(businessContext)) return businessContext
  return 'trading'
}

const normalizeFontFamily = (value, fallback = DEFAULT_INVOICE_TYPOGRAPHY.bodyFontFamily) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (INVOICE_FONT_OPTIONS.some((option) => option.value === normalized)) return normalized
  return fallback
}

const normalizeFontSize = (value, fallback) => {
  const size = Number(value)
  if (!Number.isFinite(size)) return fallback
  return Math.min(40, Math.max(9, size))
}

const sanitizeLegacyTravelHeaderText = (value, context) => {
  const raw = String(value || '').trim()
  if (context !== 'travel_agency') return raw
  if (raw === LEGACY_TRAVEL_HEADER_TEXT_EN || raw === LEGACY_TRAVEL_HEADER_TEXT_AR) return ''
  return raw
}

export const getInvoiceCurrencyDisplay = (tenant) => {
  const currency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()
  const rawDisplay = String(tenant?.settings?.invoiceCurrencyDisplay || '').trim().toLowerCase()
  // Saudi Riyal icon only applies to SAR; every other currency always uses
  // the ISO code text so display matches the tenant's default currency.
  const display = currency === 'SAR' && rawDisplay === 'icon' ? 'icon' : 'text'
  const rawPosition = String(tenant?.settings?.invoiceCurrencyPosition || '').trim().toLowerCase()
  const position = rawPosition === 'before' ? 'before' : 'after'
  return { display, position }
}

export const getInvoiceTypography = (tenant) => {
  const typography = tenant?.settings?.invoiceBranding?.typography || {}
  return {
    bodyFontFamily: normalizeFontFamily(typography?.bodyFontFamily, DEFAULT_INVOICE_TYPOGRAPHY.bodyFontFamily),
    headingFontFamily: normalizeFontFamily(typography?.headingFontFamily, DEFAULT_INVOICE_TYPOGRAPHY.headingFontFamily),
    bodyFontSize: normalizeFontSize(typography?.bodyFontSize, DEFAULT_INVOICE_TYPOGRAPHY.bodyFontSize),
    headingFontSize: normalizeFontSize(typography?.headingFontSize, DEFAULT_INVOICE_TYPOGRAPHY.headingFontSize),
  }
}

export const getInvoiceCssFontFamily = (fontFamily = 'helvetica') => {
  if (fontFamily === 'times') return '"Times New Roman", Times, "Almarai", serif'
  if (fontFamily === 'courier') return '"Courier New", Courier, "Almarai", monospace'
  return 'Arial, Helvetica, "Almarai", sans-serif'
}

export const getInvoiceBrandingProfile = (tenant, businessContext = 'trading') => {
  const context = normalizeInvoiceContext(businessContext)
  const contextProfiles = tenant?.settings?.invoiceBranding?.contextProfiles || {}
  const profile = contextProfiles?.[context] || {}

  return {
    templateId: Number(profile?.templateId || tenant?.settings?.invoicePdfTemplate || CONTEXT_TEMPLATE_DEFAULTS[context] || 1),
    logo: profile?.logo || '',
    headerTextEn: profile?.headerTextEn || '',
    headerTextAr: profile?.headerTextAr || '',
    footerTextEn: profile?.footerTextEn || '',
    footerTextAr: profile?.footerTextAr || '',
  }
}

const buildDefaultFooterText = (tenant, language = 'en') => {
  const business = tenant?.business || {}
  const address = [
    business?.address?.street,
    business?.address?.district,
    business?.address?.city,
    business?.address?.postalCode,
    business?.address?.country,
  ].filter(Boolean).join(language === 'ar' ? '، ' : ', ')

  const contactParts = []
  if (business?.contactPhone) contactParts.push(business.contactPhone)
  if (business?.contactEmail) contactParts.push(business.contactEmail)
  if (business?.website) contactParts.push(business.website)
  if (business?.webmail) contactParts.push(business.webmail)

  return [
    address,
    contactParts.join(' • '),
  ].filter(Boolean).join('\n')
}

export const getInvoiceTemplateId = (tenant, businessContext = 'trading', explicitTemplateId) => {
  const context = normalizeInvoiceContext(businessContext)
  // Prioritize global invoicePdfTemplate if set, otherwise fallback to context profile or defaults
  return Number(explicitTemplateId || tenant?.settings?.invoicePdfTemplate || getInvoiceBrandingProfile(tenant, context).templateId || 1)
}

export const getInvoiceBranding = (tenant, language = 'en', businessContext = 'trading') => {
  const invoiceBranding = tenant?.settings?.invoiceBranding || {}
  const business = tenant?.business || {}
  const context = normalizeInvoiceContext(businessContext)
  const contextProfile = getInvoiceBrandingProfile(tenant, context)
  const typography = getInvoiceTypography(tenant)

  return {
    businessContext: context,
    templateId: getInvoiceTemplateId(tenant, context),
    companyName: pickLocalizedText(business?.legalNameEn, business?.legalNameAr, language),
    // Only use this tenant's branding.logo. Do not fall back to
    // invoiceBranding/context logos — those can retain a previous tenant's
    // image after clones/demo handoffs and cause cross-tenant logo leaks.
    logoSrc: String(tenant?.branding?.logo || '').trim() || '/maqdernewlogo.webp',
    stampImage: invoiceBranding?.stampImage || tenant?.branding?.stampImage || contextProfile.stampImage || invoiceBranding?.presetStamp || tenant?.settings?.invoiceBranding?.presetStamp || null,
    signatureImage: invoiceBranding?.signatureImage || tenant?.branding?.signatureImage || contextProfile.signatureImage || invoiceBranding?.presetSignature || tenant?.settings?.invoiceBranding?.presetSignature || null,
    letterheadImage: invoiceBranding?.letterheadImage || tenant?.branding?.letterheadImage || contextProfile.letterheadImage || null,
    headerText: pickLocalizedText(
      sanitizeLegacyTravelHeaderText(pickFirstText(contextProfile.headerTextEn, invoiceBranding?.headerTextEn), context) || buildDefaultHeaderText(context, 'en'),
      sanitizeLegacyTravelHeaderText(pickFirstText(contextProfile.headerTextAr, invoiceBranding?.headerTextAr), context) || buildDefaultHeaderText(context, 'ar'),
      language,
    ),
    footerText: pickLocalizedText(
      pickFirstText(contextProfile.footerTextEn, invoiceBranding?.footerTextEn) || buildDefaultContextFooterText(context, 'en'),
      pickFirstText(contextProfile.footerTextAr, invoiceBranding?.footerTextAr) || buildDefaultContextFooterText(context, 'ar'),
      language,
    ) || buildDefaultFooterText(tenant, language),
    // Vision 2030 is a Saudi government initiative — never show it for
    // tenants configured with a non-SAR default currency.
    showVision2030: invoiceBranding?.showVision2030 !== false && String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR',
    vision2030LogoSrc: invoiceBranding?.vision2030Logo || DEFAULT_VISION_2030_LOGO,
    vatNumber: business?.vatNumber || '',
    crNumber: business?.crNumber || '',
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    typography,
  }
}

export const splitBrandingText = (value) => String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

export const getLetterheadContact = (tenant, invoice) => {
  const business = tenant?.business || {}
  const seller = invoice?.seller || {}
  const address = seller.address || business.address || {}
  const addressLine = [
    address.buildingNumber,
    address.street,
    address.district,
    address.city,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', ')
  const hasArabicAddress = Boolean(address.streetAr || address.districtAr || address.cityAr)
  const addressAr = hasArabicAddress
    ? [
      address.buildingNumber,
      address.streetAr || address.street,
      address.districtAr || address.district,
      address.cityAr || address.city,
    ].filter(Boolean).join('، ')
    : ''

  const website = String(business.website || '').trim().replace(/^https?:\/\//i, '')

  return {
    vatNumber: seller.vatNumber || business.vatNumber || '',
    crNumber: seller.crNumber || business.crNumber || business.commercialRegistration?.crNumber || '',
    phone: seller.contactPhone || business.contactPhone || tenant?.phone || '',
    email: seller.contactEmail || business.contactEmail || '',
    website,
    addressLine,
    addressAr,
    companyEn: business.legalNameEn || seller.name || tenant?.name || '',
    companyAr: business.legalNameAr || seller.nameAr || '',
  }
}

export const splitCompanyNameLines = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return words
  if (words.length === 2) return [words[0], words[1]]
  return [words.slice(0, -1).join(' '), words[words.length - 1]]
}
