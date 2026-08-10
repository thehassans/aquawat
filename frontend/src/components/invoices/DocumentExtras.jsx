import React from 'react'
import NaturalStamp from './NaturalStamp'
import { localizeSecondaryText } from '../../lib/invoiceLanguage'

export default function DocumentExtras({ invoice, invoiceBranding = {}, language = 'en', bilingual = false }) {
  const isAr = language === 'ar'
  const sectionTitle = (english, arabic) => (bilingual ? `${english} / ${localizeSecondaryText(arabic)}` : (isAr ? arabic : english))
  const signatoryLabel = (arabic) => localizeSecondaryText(arabic)
  
  const hasSubject = Boolean(invoice?.subject || invoice?.subjectAr)
  const hasNotes = Boolean(invoice?.notes || invoice?.notesAr)
  const hasTerms = Boolean(invoice?.termsAndConditions || invoice?.termsAndConditionsAr)
  
  const stampImage = invoiceBranding?.stampImage || invoice?.stampImage
  const signatureImage = invoice?.authorizedPersonSignature || invoiceBranding?.signatureImage
  const authorizedName = invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr
  const authorizedTitle = invoice?.authorizedPersonDesignation || invoice?.authorizedPersonDesignationAr
  
  const hasSignatory = Boolean(stampImage || signatureImage || authorizedName || authorizedTitle)
  const hasTextExtras = Boolean(hasSubject || hasNotes || hasTerms)

  if (!hasTextExtras && !hasSignatory) {
    return null
  }

  return (
    <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start gap-8 text-black break-inside-avoid">
      {/* Left Column: Subject, Notes, Terms */}
      <div className="space-y-4 flex-1 min-w-0">
        {hasSubject && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {sectionTitle('Subject', 'الموضوع')}
            </h4>
            {bilingual ? (
              <>
                {invoice?.subject && <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">{invoice.subject}</p>}
                {invoice?.subjectAr && <p dir="rtl" className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed mt-1">{invoice.subjectAr}</p>}
              </>
            ) : (
              <p dir={isAr ? 'rtl' : 'ltr'} className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">
                {isAr ? (invoice?.subjectAr || invoice?.subject) : (invoice?.subject || invoice?.subjectAr)}
              </p>
            )}
          </div>
        )}

        {hasNotes && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {sectionTitle('Notes', 'ملاحظات')}
            </h4>
            {bilingual ? (
              <>
                {invoice?.notes && <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>}
                {invoice?.notesAr && <p dir="rtl" className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed mt-1">{invoice.notesAr}</p>}
              </>
            ) : (
              <p dir={isAr ? 'rtl' : 'ltr'} className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {isAr ? (invoice?.notesAr || invoice?.notes) : (invoice?.notes || invoice?.notesAr)}
              </p>
            )}
          </div>
        )}

        {hasTerms && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {sectionTitle('Terms & Conditions', 'الشروط والأحكام')}
            </h4>
            {bilingual ? (
              <>
                {invoice?.termsAndConditions && <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{invoice.termsAndConditions}</p>}
                {invoice?.termsAndConditionsAr && <p dir="rtl" className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed mt-1">{invoice.termsAndConditionsAr}</p>}
              </>
            ) : (
              <p dir={isAr ? 'rtl' : 'ltr'} className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {isAr ? (invoice?.termsAndConditionsAr || invoice?.termsAndConditions) : (invoice?.termsAndConditions || invoice?.termsAndConditionsAr)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Unified Natural Rough Stamp & Signature */}
      {hasSignatory && (
        <div className="flex items-end justify-end shrink-0 gap-6 self-end md:self-auto">
          {stampImage && (
            <NaturalStamp
              stampImage={stampImage}
              companyName={invoice?.business?.legalNameEn || invoiceBranding?.legalNameEn || ''}
              companyNameAr={invoice?.business?.legalNameAr || invoiceBranding?.legalNameAr || ''}
              crNumber={invoice?.business?.crNumber || invoiceBranding?.crNumber || ''}
              vatNumber={invoice?.business?.vatNumber || invoiceBranding?.vatNumber || ''}
              language={language}
              size="md"
            />
          )}

          {(signatureImage || authorizedName) && (
            <div className="flex flex-col items-center justify-end text-center min-w-[160px] max-w-[220px]">
              {signatureImage ? (
                <img
                  src={signatureImage}
                  alt="Signature"
                  className="h-16 max-w-[160px] object-contain mb-1 mix-blend-multiply"
                />
              ) : (
                <div className="h-14 mb-1" />
              )}
              
              <div className="border-t border-gray-400 pt-1.5 w-full">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {authorizedName ? (
                    bilingual
                      ? `${invoice?.authorizedPersonName || ''} ${invoice?.authorizedPersonNameAr ? ` / ${invoice.authorizedPersonNameAr}` : ''}`
                      : (isAr ? (invoice?.authorizedPersonNameAr || invoice?.authorizedPersonName) : (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr))
                  ) : (
                    isAr ? 'المفوض بالتوقيع' : (bilingual ? `Authorized Signature / ${signatoryLabel('المفوض بالتوقيع')}` : 'Authorized Signature')
                  )}
                </p>
                {authorizedTitle && (
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                    {bilingual
                      ? `${invoice?.authorizedPersonDesignation || ''} ${invoice?.authorizedPersonDesignationAr ? ` / ${invoice.authorizedPersonDesignationAr}` : ''}`
                      : (isAr ? (invoice?.authorizedPersonDesignationAr || invoice?.authorizedPersonDesignation) : (invoice?.authorizedPersonDesignation || invoice?.authorizedPersonDesignationAr))}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
