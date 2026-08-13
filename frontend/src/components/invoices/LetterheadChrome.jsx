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
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1 text-left">
            {showEn ? <h1 className="text-2xl font-bold print:text-black">{contact.companyEn || '—'}</h1> : null}
            {showEn ? (
              <div className="mt-3 space-y-1 text-sm font-bold text-gray-900">
                {contact.crNumber ? <p>C.R # : {contact.crNumber}</p> : null}
                {contact.vatNumber ? <p>VAT # : {contact.vatNumber}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="mx-4 flex-shrink-0">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-28 w-auto max-w-[200px] object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-100">
                <Building2 className="h-8 w-8 text-primary-600" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-right" dir="rtl">
            {showAr ? <h1 className="text-2xl font-bold print:text-black">{contact.companyAr}</h1> : null}
            {showAr ? (
              <div className="mt-3 space-y-1 text-sm font-bold text-gray-900">
                {contact.crNumber ? <p>س.ت : {contact.crNumber}</p> : null}
                {contact.vatNumber ? <p>الرقم الضريبي : {contact.vatNumber}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 bg-transparent">{children}</div>

      <footer className="relative z-10 mt-auto border-t-2 border-primary-500/20 bg-gradient-to-r from-gray-50/80 to-white p-6 print:bg-none print:p-4">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-bold text-gray-900 print:text-black">
            {contact.addressLine ? (
              <p className="flex max-w-xl items-start gap-1.5 text-center">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{contact.addressLine}</span>
              </p>
            ) : null}
            {contact.phone ? (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.phone}</span>
              </p>
            ) : null}
            {contact.email ? (
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.email}</span>
              </p>
            ) : null}
          </div>
          {contact.addressAr && contact.addressAr !== contact.addressLine ? (
            <p className="max-w-xl text-center text-sm font-bold text-gray-900" dir="rtl">{contact.addressAr}</p>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
