import { Building2, Mail, Phone, MapPin } from 'lucide-react'
import { getLetterheadContact } from '../../lib/invoiceBranding'

/**
 * Official company letterhead chrome (header + footer).
 * Used by the Letterhead generator and the quotation Letterhead template
 * so both documents look the same.
 */
export default function LetterheadChrome({ tenant, invoice, bilingual = true, outputLang, children, className = '' }) {
  const contact = getLetterheadContact(tenant, invoice)
  const logoSrc = String(tenant?.branding?.logo || '').trim() || null
  const lang = outputLang || (bilingual ? 'both' : 'en')
  const showEn = lang !== 'ar'
  const showAr = lang !== 'en' && Boolean(contact.companyAr)

  return (
    <div className={`relative mx-auto flex min-h-[1050px] w-full max-w-4xl flex-col overflow-hidden bg-white text-gray-900 ${className}`}>
      {logoSrc ? (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none">
          <img src={logoSrc} alt="" className="h-72 w-72 object-contain opacity-[0.06] sm:h-96 sm:w-96" />
        </div>
      ) : null}

      <header className="relative z-10 border-b-2 border-primary-500/20 bg-gradient-to-r from-white to-gray-50/80 p-8 print:bg-none print:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
          {showEn ? (
            <h1 className="text-2xl font-bold leading-8 text-start print:text-black">{contact.companyEn || '—'}</h1>
          ) : (
            <div />
          )}
          <div className="row-span-3 flex items-center justify-center px-2">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-28 w-auto max-w-[200px] object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-100">
                <Building2 className="h-8 w-8 text-primary-600" />
              </div>
            )}
          </div>
          {showAr ? (
            <h1 className="text-2xl font-bold leading-8 text-end print:text-black" dir="rtl">{contact.companyAr}</h1>
          ) : (
            <div />
          )}

          {showEn && contact.crNumber ? (
            <p className="text-sm font-bold leading-5 text-start">C.R # : {contact.crNumber}</p>
          ) : (
            <div />
          )}
          {showAr && contact.crNumber ? (
            <p className="text-sm font-bold leading-5 text-end" dir="rtl">س.ت : {contact.crNumber}</p>
          ) : (
            <div />
          )}

          {showEn && contact.vatNumber ? (
            <p className="text-sm font-bold leading-5 text-start">VAT # : {contact.vatNumber}</p>
          ) : (
            <div />
          )}
          {showAr && contact.vatNumber ? (
            <p className="text-sm font-bold leading-5 text-end" dir="rtl">الرقم الضريبي : {contact.vatNumber}</p>
          ) : (
            <div />
          )}
        </div>
      </header>

      <div className="relative z-10 flex-1 bg-transparent">{children}</div>

      <footer className="relative z-10 mt-auto border-t-2 border-primary-500/20 bg-gradient-to-r from-gray-50/80 to-white p-6 print:bg-none print:p-4">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-2 text-sm font-bold text-gray-900 print:text-black">
          <p className="flex items-start gap-1.5 text-start">
            {contact.addressLine ? (
              <>
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{contact.addressLine}</span>
              </>
            ) : null}
          </p>
          <p className="flex items-start justify-end gap-1.5 text-end" dir="rtl">
            {contact.addressAr ? (
              <>
                <span>{contact.addressAr}</span>
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              </>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5">
            {contact.phone ? (
              <>
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.phone}</span>
              </>
            ) : null}
          </p>
          <p className="flex items-center justify-end gap-1.5">
            {contact.email ? (
              <>
                <span>{contact.email}</span>
                <Mail className="h-3.5 w-3.5 shrink-0" />
              </>
            ) : null}
          </p>
        </div>
      </footer>
    </div>
  )
}
