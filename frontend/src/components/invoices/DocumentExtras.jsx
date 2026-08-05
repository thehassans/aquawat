import React from 'react'

export default function DocumentExtras({ invoice, invoiceBranding = {}, language = 'en', bilingual = false }) {
  const isAr = language === 'ar'
  
  const hasSubject = Boolean(invoice?.subject || invoice?.subjectAr)
  const hasNotes = Boolean(invoice?.notes)
  const hasTerms = Boolean(invoice?.termsAndConditions)
  
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
              {isAr ? 'الموضوع' : 'Subject'}
            </h4>
            <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">
              {bilingual
                ? `${invoice?.subject || ''} ${invoice?.subjectAr ? `\n${invoice.subjectAr}` : ''}`
                : (isAr ? (invoice?.subjectAr || invoice?.subject) : (invoice?.subject || invoice?.subjectAr))}
            </p>
          </div>
        )}

        {hasNotes && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {isAr ? 'ملاحظات' : 'Notes'}
            </h4>
            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
              {invoice?.notes}
            </p>
          </div>
        )}

        {hasTerms && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}
            </h4>
            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
              {invoice?.termsAndConditions}
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Unified Stamp & Signature */}
      {hasSignatory && (
        <div className="flex items-end justify-end shrink-0 gap-6 self-end md:self-auto">
          {stampImage && (
            <div className="flex flex-col items-center justify-end text-center">
              <img
                src={stampImage}
                alt="Stamp"
                className="max-h-24 max-w-[130px] object-contain mix-blend-multiply"
              />
              <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
                {isAr ? 'الختم الرسمي' : 'Official Seal'}
              </span>
            </div>
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
                    isAr ? 'المفوض بالتوقيع' : 'Authorized Signature'
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
