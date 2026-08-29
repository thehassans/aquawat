import { Building2, Mail, Phone, MapPin } from 'lucide-react'
import { getLetterheadContact, splitCompanyNameLines, getLetterheadStyle, getInvoiceTypography, getInvoiceCssFontFamily } from '../../lib/invoiceBranding'
import { toEasternArabicNumerals, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { isPakistanTenant, isBangladeshTenant } from '../../lib/saudiTenant'
import { getImageUrl } from '../../lib/api'

/**
 * Official company letterhead chrome (header + footer).
 * Used by the Letterhead generator and the quotation Letterhead template
 * so both documents look the same.
 */
export default function LetterheadChrome({
  tenant,
  invoice,
  bilingual = true,
  outputLang,
  children,
  className = '',
  /** Settings live-preview: no A4 min-height, tighter padding */
  compact = false,
  /** Optional live overrides (settings panel) — wins over tenant.settings */
  sizeOverrides = null,
  /** Hide letterhead footer when the child template renders its own */
  hideFooter = false,
}) {
  const contact = getLetterheadContact(tenant, invoice)
  const invoiceBranding = tenant?.settings?.invoiceBranding || {}
  const logoSrc = getImageUrl(
    String(
      tenant?.branding?.logo
      || invoiceBranding.logo
      || '',
    ).trim(),
  ) || null
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

  const typography = getInvoiceTypography(tenant)
  const headingFontFamily = getInvoiceCssFontFamily(typography.headingFontFamily)
  const bodyFontFamily = getInvoiceCssFontFamily(typography.bodyFontFamily)

  const rawLogo = Number(sizeOverrides?.logoSize ?? invoiceBranding.logoSize) || 112
  const rawHeading = Number(sizeOverrides?.headingSize ?? invoiceBranding.headingSize ?? typography.headingFontSize) || 24
  const rawCrVat = Number(sizeOverrides?.crVatSize ?? invoiceBranding.crVatSize) || Math.max(9, (typography.bodyFontSize || 12) + 2)

  const logoHeight = Math.max(24, Math.min(300, rawLogo))
  const headingFontSize = Math.max(10, Math.min(72, rawHeading))
  const crVatFontSize = Math.max(8, Math.min(48, rawCrVat))
  const isSingleLine = invoiceBranding.singleLineHeading || false
  const bodyFontSize = Number(sizeOverrides?.bodyFontSize ?? typography.bodyFontSize) || 12
  const logoMaxWidth = Math.max(logoHeight * 1.75, compact ? 96 : 120)

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

  const sampleBody = children ?? (compact ? (
    <div className="space-y-3 px-6 py-5" style={{ fontSize: `${bodyFontSize}px`, color: textColor }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-40">Sample</p>
      <div className="space-y-1.5">
        <div className="h-2 w-2/3 rounded bg-slate-200/90" />
        <div className="h-2 w-full rounded bg-slate-100" />
        <div className="h-2 w-5/6 rounded bg-slate-100" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80">
        <div className="grid grid-cols-4 gap-px bg-slate-200/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="bg-slate-50 px-2 py-1.5">Item</span>
          <span className="bg-slate-50 px-2 py-1.5 text-end">Qty</span>
          <span className="bg-slate-50 px-2 py-1.5 text-end">Price</span>
          <span className="bg-slate-50 px-2 py-1.5 text-end">Total</span>
        </div>
        <div className="grid grid-cols-4 gap-px bg-slate-100 text-xs">
          <span className="bg-white px-2 py-2">Product line</span>
          <span className="bg-white px-2 py-2 text-end tabular-nums">2</span>
          <span className="bg-white px-2 py-2 text-end tabular-nums">100.00</span>
          <span className="bg-white px-2 py-2 text-end tabular-nums font-semibold">200.00</span>
        </div>
      </div>
    </div>
  ) : null)

  return (
    <div
      data-letterhead-root
      className={`relative mx-auto flex w-full max-w-4xl flex-col overflow-hidden bg-white text-gray-900 ${compact ? 'min-h-0' : 'min-h-[297mm]'} ${className}`}
      style={{ fontFamily: bodyFontFamily, color: textColor, fontSize: compact ? `${bodyFontSize}px` : undefined }}
    >
      {logoSrc ? (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none">
          <img src={logoSrc} alt="" className={`object-contain opacity-[0.06] ${compact ? 'h-40 w-40' : 'h-72 w-72 sm:h-96 sm:w-96'}`} />
        </div>
      ) : null}

      <header
        className={`relative z-10 bg-gradient-to-r from-white to-gray-50/80 print:bg-none print:p-4 ${compact ? 'p-4' : 'p-8'}`}
        style={headerBorderStyle}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-4">
          <div className="min-w-0 w-full text-left">
            {showEn ? (
              <>
                <h1 className={`font-bold leading-tight ${compact ? 'min-h-0' : 'min-h-16'}`} style={{ fontSize: `${headingFontSize}px`, color: textColor, fontFamily: headingFontFamily }}>
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
              <img
                src={logoSrc}
                alt="Logo"
                className="object-contain"
                style={{
                  height: `${logoHeight}px`,
                  width: 'auto',
                  maxWidth: `${logoMaxWidth}px`,
                }}
              />
            ) : (
              <div className={`flex items-center justify-center rounded-lg ${compact ? 'h-12 w-12' : 'h-16 w-16'}`} style={{ backgroundColor: `${accentColor}22` }}>
                <Building2 className={compact ? 'h-6 w-6' : 'h-8 w-8'} style={{ color: accentColor }} />
              </div>
            )}
          </div>

          <div className={`min-w-0 w-full ${isBangla ? 'text-right' : 'text-right font-[\'Almarai\']'}`} dir={isBangla ? 'ltr' : 'rtl'}>
            {showSec ? (
              <>
                <h1 className={`w-full font-bold leading-tight ${compact ? 'min-h-0' : 'min-h-16'} ${!isBangla ? "font-['Almarai']" : ''}`} style={{ fontSize: `${headingFontSize}px`, color: textColor, fontFamily: isBangla ? headingFontFamily : undefined }}>
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

      <div className="relative z-10 flex-1 bg-transparent">{sampleBody}</div>

      {!hideFooter ? (
      <footer
        className={`relative z-10 mt-auto bg-gradient-to-r from-gray-50/80 to-white print:bg-none print:p-4 ${compact ? 'p-3' : 'p-6'}`}
        style={{ ...footerBorderStyle, color: textColor }}
      >
        <div className={`mx-auto flex max-w-3xl flex-col items-center gap-2 text-center font-bold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: textColor, fontFamily: bodyFontFamily }}>
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
      ) : null}
    </div>
  )
}
