import React from 'react'

export default function DocumentExtras({ invoice, language = 'en', bilingual = false }) {
  const hasSubject = Boolean(invoice?.subject || invoice?.subjectAr)
  const hasNotes = Boolean(invoice?.notes)
  const hasTerms = Boolean(invoice?.termsAndConditions)
  const hasAuthorizedPerson = Boolean(invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr)
  
  if (!hasSubject && !hasNotes && !hasTerms && !hasAuthorizedPerson && !invoice?.stampImage) {
    return null
  }

  return (
    <div className="mt-8 flex justify-between items-start gap-8 text-black break-inside-avoid">
      <div className="space-y-4 flex-1">
         {hasSubject && (
           <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{language === 'ar' ? 'الموضوع' : 'Subject'}</h4>
              <p className="text-sm font-medium whitespace-pre-wrap">
                {bilingual
                  ? `${invoice?.subject || ''} ${invoice?.subjectAr ? `\n${invoice.subjectAr}` : ''}`
                  : (language === 'ar' ? (invoice?.subjectAr || invoice?.subject) : (invoice?.subject || invoice?.subjectAr))}
              </p>
           </div>
         )}
         {hasNotes && (
           <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{language === 'ar' ? 'ملاحظات' : 'Notes'}</h4>
              <p className="text-sm whitespace-pre-wrap">{invoice?.notes}</p>
           </div>
         )}
         {hasTerms && (
           <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</h4>
              <p className="text-sm whitespace-pre-wrap">{invoice?.termsAndConditions}</p>
           </div>
         )}
      </div>
      
      {(hasAuthorizedPerson || invoice?.stampImage) && (
        <div className="flex items-end justify-end gap-8 shrink-0 mt-4">
           {invoice?.stampImage && (
             <div className="flex flex-col items-center justify-end text-center w-32">
               <img src={invoice.stampImage} alt="Stamp" className="h-24 object-contain mb-2 mix-blend-multiply" />
             </div>
           )}
           {hasAuthorizedPerson && (
             <div className="flex flex-col items-center justify-end text-center w-64">
                {invoice?.authorizedPersonSignature ? (
                  <img src={invoice.authorizedPersonSignature} alt="Signature" className="h-16 object-contain mb-2 mix-blend-multiply" />
                ) : (
                  <div className="h-16 mb-2"></div>
                )}
                <p className="text-sm font-bold border-t border-gray-400 pt-2 w-full">
                   {bilingual
                     ? `${invoice?.authorizedPersonName || ''} ${invoice?.authorizedPersonNameAr ? ` / ${invoice.authorizedPersonNameAr}` : ''}`
                     : (language === 'ar' ? (invoice?.authorizedPersonNameAr || invoice?.authorizedPersonName) : (invoice?.authorizedPersonName || invoice?.authorizedPersonNameAr))}
                </p>
                {(invoice?.authorizedPersonDesignation || invoice?.authorizedPersonDesignationAr) && (
                  <p className="text-xs text-gray-500 mt-1">
                     {bilingual
                       ? `${invoice?.authorizedPersonDesignation || ''} ${invoice?.authorizedPersonDesignationAr ? ` / ${invoice.authorizedPersonDesignationAr}` : ''}`
                       : (language === 'ar' ? (invoice?.authorizedPersonDesignationAr || invoice?.authorizedPersonDesignation) : (invoice?.authorizedPersonDesignation || invoice?.authorizedPersonDesignationAr))}
                  </p>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  )
}
