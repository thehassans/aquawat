import { Building2, Mail, Phone, MapPin } from 'lucide-react'
import { getLetterheadContact, splitCompanyNameLines, getLetterheadStyle, getInvoiceTypography, getInvoiceCssFontFamily } from '../../lib/invoiceBranding'
import { toEasternArabicNumerals, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { isPakistanTenant, isBangladeshTenant } from '../../lib/saudiTenant'

/**
 * Official company letterhead chrome (header + footer).
 * Used by the Letterhead generator and the quotation Letterhead template
 * so both documents look the same.
 */
export default function LetterheadChrome({ tenant, invoice, bilingual = true, outputLang, children, className = '' }) {
  const contact = getLetterheadContact(tenant, invoice)
  const logoSrc = String(tenant?.branding?.logo || '').trim() || null
  const letterheadStyle = getLetterheadStyle(tenant)

  const secondaryCode = getInvoiceSecondaryLanguage(tenant) || (isPakistanTenant(tenant) ? 'ur' : isBangladeshTenant(tenant) ? 'bn' : 'ar')
  const isUrdu = secondaryCode === 'ur'
  const isBangla = secondaryCode === 'bn'
  const isArabic = secondaryCode === 'ar'

  const lang = outputLang || (bilingual ? 'both' : 'en')
  const showEn = lang !== 'secondary' && lang !== 'ar' && lang !== 'ur' && lang !== 'bn'
  const showSec = lang !== 'en' && Boolean(contact.companyAr || contact.companyEn)

  const nameEnLines = splitCompanyNameLines(contact.companyEn || '—')
  const nameSecLines = splitCompanyNameLines(contact.companyAr || contact.companyEn || '')

  const crFormatted = isArabic ? toEasternArabicNumerals(contact.crNumber) : contact.crNumber
  const vatFormatted = isArabic ? toEasternArabicNumerals(contact.vatNumber) : contact.vatNumber
  const addressSec = isArabic ? toEasternArabicNumerals(contact.addressAr) : (contact.addressAr || '')

  const invoiceBranding = tenant?.settings?.invoiceBranding || {}
  const typography = getInvoiceTypography(tenant)
  const headingFontFamily = getInvoiceCssFontFamily(typography.headingFontFamily)
  const bodyFontFamily = getInvoiceCssFontFamily(typography.bodyFontFamily)
  const logoHeight = invoiceBranding.logoSize || 112
  const headingFontSize = invoiceBranding.headingSize || typography.headingFontSize || 24
  const crVatFontSize = invoiceBranding.crVatSize || Math.max(9, (typography.bodyFontSize || 12) + 2)
  const isSingleLine = invoiceBranding.singleLineHeading || false

  const { textColor, accentColor, headerTextEn, headerTextAr, footerTextEn, footerTextAr } = letterheadStyle

  const getSecCrLabel = () => {
    if (isUrdu) return 'رجسٹریشن / CR #'
    if (isBangla) return 'ট্রেড লাইসেন্স নং'
    return 'س.ت'
  }

  const getSecVatLabel = () => {
    if (isUrdu) return 'سیلز ٹیکس / NTN #'
    if (isBangla) return 'বিন / মূসক নং'
    return 'الرقم الضريبي'
  }

  const headerBorderStyle = { borderBottomColor: accentColor, borderBottomWidth: 2, borderBottomStyle: 'solid' }
  const footerBorderStyle = { borderTopColor: accentColor, borderTopWidth: 2, borderTopStyle: 'solid' }

  return (
    <div
      data-letterhead-root
      className={`relative mx-auto flex min-h-[297mm] w-full max-w-4xl flex-col overflow-hidden bg-white text-gray-900 ${className}`}
      style={{ fontFamily: bodyFontFamily, color: textColor }}
    >
      {logoSrc ? (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none">
          <img src={logoSrc} alt="" className="h-72 w-72 object-contain opacity-[0.06] sm:h-96 sm:w-96" />
        </div>
      ) : null}

      <header className="relative z-10 bg-gradient-to-r from-white to-gray-50/80 p-8 print:bg-none print:p-4" style={headerBorderStyle}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-4">
          <div className="min-w-0 w-full text-left">
            {showEn ? (
              <>
                <h1 className="min-h-16 font-bold leading-tight print:text-black" style={{ fontSize: `${headingFontSize}px`, color: textColor, fontFamily: headingFontFamily }}>
                  {isSingleLine ? (
                    <span className="block whitespace-nowrap">{contact.companyEn || '—'}</span>
                  ) : (
                    nameEnLines.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))
                  )}
                </h1>
                {headerTextEn ? (
                  <p className="mt-1 text-sm font-medium leading-snug" style={{ color: textColor }}>{headerTextEn}</p>
                ) : null}
                <div className="mt-2 space-y-1 font-bold leading-snug" style={{ fontSize: `${crVatFontSize}px`, color: textColor }}>
                  {contact.crNumber ? <p>{isPakistanTenant(tenant) ? 'Reg #' : 'C.R #'} : {contact.crNumber}</p> : null}
                  {contact.vatNumber ? <p>{isPakistanTenant(tenant) ? 'NTN / STRN #' : isBangladeshTenant(tenant) ? 'BIN #' : 'VAT #'} : {contact.vatNumber}</p> : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-center self-center px-2">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="w-auto max-w-[200px] object-contain" style={{ height: `${logoHeight}px` }} />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg" style={{ backgroundColor: `${accentColor}22` }}>
                <Building2 className="h-8 w-8" style={{ color: accentColor }} />
              </div>
            )}
          </div>

          <div className={`min-w-0 w-full ${isBangla ? 'text-right' : 'text-right font-[\'Almarai\']'}`} dir={isBangla ? 'ltr' : 'rtl'}>
            {showSec ? (
              <>
                <h1 className={`min-h-16 w-full font-bold leading-tight print:text-black ${!isBangla ? "font-['Almarai']" : ''}`} style={{ fontSize: `${headingFontSize}px`, color: textColor, fontFamily: isBangla ? headingFontFamily : undefined }}>
                  {isSingleLine ? (
                    <span className="block whitespace-nowrap">{contact.companyAr || contact.companyEn}</span>
                  ) : (
                    nameSecLines.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))
                  )}
                </h1>
                {headerTextAr ? (
                  <p className={`mt-1 text-sm font-medium leading-snug ${!isBangla ? "font-['Almarai']" : ''}`} style={{ color: textColor }} dir="rtl">{headerTextAr}</p>
                ) : null}
                <div className={`mt-2 w-full space-y-1 font-bold leading-snug ${!isBangla ? "font-['Almarai']" : ''}`} style={{ fontSize: `${crVatFontSize}px`, color: textColor }}>
                  {contact.crNumber ? <p>{getSecCrLabel()} : {crFormatted}</p> : null}
                  {contact.vatNumber ? <p>{getSecVatLabel()} : {vatFormatted}</p> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 bg-transparent">{children}</div>

      <footer className="relative z-10 mt-auto bg-gradient-to-r from-gray-50/80 to-white p-6 print:bg-none print:p-4" style={{ ...footerBorderStyle, color: textColor }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center text-sm font-bold print:text-black" style={{ color: textColor, fontFamily: bodyFontFamily }}>
          {contact.addressLine ? (
            <p className="flex items-start justify-center gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
              <span>{contact.addressLine}</span>
            </p>
          ) : null}
          {showSec && addressSec ? (
            <p className={`flex items-start justify-center gap-1.5 ${!isBangla ? "font-['Almarai']" : ''}`} dir={isBangla ? 'ltr' : 'rtl'}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
              <span>{addressSec}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1">
            {contact.phone ? (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
                <span>{contact.phone}</span>
              </p>
            ) : null}
            {contact.email ? (
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
                <span>{contact.email}</span>
              </p>
            ) : null}
          </div>
          {footerTextEn && showEn ? (
            <p className="mt-1 text-xs font-semibold leading-relaxed opacity-90">{footerTextEn}</p>
          ) : null}
          {footerTextAr && showSec ? (
            <p className={`mt-1 text-xs font-semibold leading-relaxed opacity-90 ${!isBangla ? "font-['Almarai']" : ''}`} dir="rtl">{footerTextAr}</p>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
