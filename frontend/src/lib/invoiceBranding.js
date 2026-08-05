export const DEFAULT_VISION_2030_LOGO = '/saudi-vision-2030-logo.webp'
export const INVOICE_BRANDING_CONTEXTS = ['trading', 'construction', 'travel_agency']
export const INVOICE_FONT_OPTIONS = [
  { value: 'helvetica', labelEn: 'Helvetica', labelAr: 'Ù‡ÙŠÙ„ÙÙŠØªÙŠÙƒØ§' },
  { value: 'times', labelEn: 'Times', labelAr: 'ØªØ§ÙŠÙ…Ø²' },
  { value: 'courier', labelEn: 'Courier', labelAr: 'ÙƒÙˆØ±ÙŠÙŠØ±' },
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
const LEGACY_TRAVEL_HEADER_TEXT_AR = 'Ø®Ø¯Ù…Ø§Øª Ø³ÙØ± ÙˆØ­Ø¬ÙˆØ²Ø§Øª Ø§Ø­ØªØ±Ø§ÙÙŠØ© Ù…ØµÙ…Ù…Ø© Ù„Ø±Ø­Ù„Ø§Øª Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ ÙˆØ§Ù„Ø±Ø­Ù„Ø§Øª Ø§Ù„Ø¯ÙˆÙ„ÙŠØ© Ø¨Ø«Ù‚Ø© Ø¹Ø§Ù„ÙŠØ©.'

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
      ? 'ØªØ°Ø§ÙƒØ± Ø·ÙŠØ±Ø§Ù† â€¢ Ø­Ø¬ÙˆØ²Ø§Øª ÙÙ†Ø§Ø¯Ù‚ â€¢ Ø¨Ø±Ø§Ù…Ø¬ Ø³ÙØ± â€¢ Ø¯Ø¹Ù… Ø§Ø­ØªØ±Ø§ÙÙŠ Ù…ØªÙˆØ§ØµÙ„'
      : 'Air Ticketing â€¢ Hotel Reservations â€¢ Travel Programs â€¢ Professional Support'
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
  const rawDisplay = String(tenant?.settings?.invoiceCurrencyDisplay || '').trim().toLowerCase()
  const display = rawDisplay === 'icon' ? 'icon' : 'text'
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
  ].filter(Boolean).join(language === 'ar' ? 'ØŒ ' : ', ')

  const contactParts = []
  if (business?.contactPhone) contactParts.push(business.contactPhone)
  if (business?.contactEmail) contactParts.push(business.contactEmail)
  if (business?.website) contactParts.push(business.website)
  if (business?.webmail) contactParts.push(business.webmail)

  return [
    address,
    contactParts.join(' â€¢ '),
  ].filter(Boolean).join('\n')
}

export const getInvoiceTemplateId = (tenant, businessContext = 'trading', explicitTemplateId) => {
  const context = normalizeInvoiceContext(businessContext)
  return Number(explicitTemplateId || getInvoiceBrandingProfile(tenant, context).templateId || tenant?.settings?.invoicePdfTemplate || 1)
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
    logoSrc: contextProfile.logo || invoiceBranding?.logo || tenant?.branding?.logo || '/maqdernewlogo.webp',
    stampImage: contextProfile.stampImage || invoiceBranding?.stampImage || tenant?.branding?.stampImage || invoiceBranding?.presetStamp || tenant?.settings?.invoiceBranding?.presetStamp || null,
    signatureImage: contextProfile.signatureImage || invoiceBranding?.signatureImage || tenant?.branding?.signatureImage || invoiceBranding?.presetSignature || tenant?.settings?.invoiceBranding?.presetSignature || null,
    letterheadImage: contextProfile.letterheadImage || invoiceBranding?.letterheadImage || tenant?.branding?.letterheadImage || null,
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
    showVision2030: invoiceBranding?.showVision2030 !== false,
    vision2030LogoSrc: invoiceBranding?.vision2030Logo || DEFAULT_VISION_2030_LOGO,
    vatNumber: business?.vatNumber || '',
    crNumber: business?.crNumber || '',
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    typography,
  }
}

export const splitBrandingText = (value) => String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
