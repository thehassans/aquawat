import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Printer } from 'lucide-react';
import debounce from 'lodash.debounce';
import { autoTranslateText } from '../lib/builtInTranslator';
import { getInvoiceSecondaryLanguage } from '../lib/invoiceLanguage';
import LetterheadChrome from '../components/invoices/LetterheadChrome';

export default function Letterhead() {
  const { tenant } = useSelector((state) => state.auth);
  const uiLanguage = useSelector((state) => state.ui.language);
  const invoiceSecondary = getInvoiceSecondaryLanguage(tenant);
  
  const [outputLang, setOutputLang] = useState(() => (invoiceSecondary === 'ar' ? 'both' : 'en')); // 'en', 'ar', 'both'
  const [contentEn, setContentEn] = useState('');
  const [contentAr, setContentAr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [recipientEn, setRecipientEn] = useState('');
  const [recipientAr, setRecipientAr] = useState('');
  const [recipientTitleEn, setRecipientTitleEn] = useState('');
  const [recipientTitleAr, setRecipientTitleAr] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [senderNameEn, setSenderNameEn] = useState('');
  const [senderNameAr, setSenderNameAr] = useState('');
  const [senderTitleEn, setSenderTitleEn] = useState('');
  const [senderTitleAr, setSenderTitleAr] = useState('');

  const translateText = (text, targetLanguage) => {
    if (!text.trim()) return '';
    return autoTranslateText(text, targetLanguage === 'Arabic' ? 'en' : 'ar', targetLanguage === 'Arabic' ? 'ar' : 'en');
  };

  const translateEnToAr = useCallback(
    debounce((text, setter) => {
      const translated = translateText(text, 'Arabic');
      if (translated) setter(translated);
    }, 150),
    []
  );

  const translateArToEn = useCallback(
    debounce(async (text, setter) => {
      const translated = await translateText(text, 'English');
      if (translated) setter(translated);
    }, 1000),
    []
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {/* Controls (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {uiLanguage === 'ar' ? 'منشئ الخطابات' : 'Letterhead Generator'}
          </h1>
          <p className="text-gray-500 mt-1">
            {uiLanguage === 'ar' ? 'إنشاء وطباعة خطابات رسمية' : 'Create and print official company letters'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value)}
            className="select"
          >
            <option value="en">{uiLanguage === 'ar' ? 'إنجليزي فقط' : 'English Only'}</option>
            <option value="ar">{uiLanguage === 'ar' ? 'عربي فقط' : 'Arabic Only'}</option>
            <option value="both">{uiLanguage === 'ar' ? 'عربي وإنجليزي (مزدوج)' : 'Bilingual (Both)'}</option>
          </select>
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer className="w-4 h-4" />
            {uiLanguage === 'ar' ? 'طباعة' : 'Print'}
          </button>
        </div>
      </div>

      {/* The Letter Paper */}
      <LetterheadChrome
        tenant={tenant}
        outputLang={outputLang}
        className="rounded-xl border border-gray-200 shadow-lg print:m-0 print:border-none print:p-0 print:shadow-none dark:bg-white"
      >
        {/* Content Area */}
        <div className="relative z-10 min-h-[650px] flex-1 bg-transparent p-8 text-black print:min-h-0 print:p-4">
          {/* Date */}
          <div className="mb-8 flex justify-between">
            <div className="w-1/3">
              {(outputLang === 'en' || outputLang === 'both') && (
                <div className="print:hidden mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">Date (EN)</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input bg-transparent" />
                </div>
              )}
              <div className="hidden print:block font-medium border border-gray-200 rounded-lg p-3">Date: {date}</div>
            </div>
            
            <div className="w-1/3 text-right" dir="rtl">
              {(outputLang === 'ar' || outputLang === 'both') && (
                <div className="print:hidden mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">التاريخ</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input bg-transparent" />
                </div>
              )}
              <div className="hidden print:block font-medium border border-gray-200 rounded-lg p-3">التاريخ: {date}</div>
            </div>
          </div>

          {/* Grid Layout for Body (Row Based for Alignment) */}
          <div className="space-y-6">
            
            {/* Recipient Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(outputLang === 'en' || outputLang === 'both') && (
                <div className="space-y-3" dir="ltr">
                  <div className="print:hidden">
                    <input type="text" value={recipientEn} onChange={e => {
                      setRecipientEn(e.target.value);
                      translateEnToAr(e.target.value, setRecipientAr);
                    }} placeholder="Recipient Name" className="input bg-transparent font-bold text-lg" />
                    <input type="text" value={recipientTitleEn} onChange={e => {
                      setRecipientTitleEn(e.target.value);
                      translateEnToAr(e.target.value, setRecipientTitleAr);
                    }} placeholder="Recipient Title / Company" className="input bg-transparent" />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold text-lg min-h-[48px] flex items-center">{recipientEn}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{recipientTitleEn}</div>
                  </div>
                </div>
              )}
              {(outputLang === 'ar' || outputLang === 'both') && (
                <div className="space-y-3" dir="rtl">
                  <div className="print:hidden">
                    <input type="text" value={recipientAr} onChange={e => {
                      setRecipientAr(e.target.value);
                      translateArToEn(e.target.value, setRecipientEn);
                    }} placeholder="اسم المستلم" className="input bg-transparent font-bold text-lg" />
                    <input type="text" value={recipientTitleAr} onChange={e => {
                      setRecipientTitleAr(e.target.value);
                      translateArToEn(e.target.value, setRecipientTitleEn);
                    }} placeholder="المنصب / الجهة" className="input bg-transparent" />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold text-lg min-h-[48px] flex items-center">{recipientAr}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{recipientTitleAr}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Subject Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(outputLang === 'en' || outputLang === 'both') && (
                <div dir="ltr">
                  <div className="print:hidden">
                    <input type="text" value={subjectEn} onChange={e => {
                      setSubjectEn(e.target.value);
                      translateEnToAr(e.target.value, setSubjectAr);
                    }} placeholder="Subject Line" className="input bg-transparent font-bold underline" />
                  </div>
                  <div className="hidden print:block font-bold underline border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">
                    {subjectEn ? `Subject: ${subjectEn}` : ''}
                  </div>
                </div>
              )}
              {(outputLang === 'ar' || outputLang === 'both') && (
                <div dir="rtl">
                  <div className="print:hidden">
                    <input type="text" value={subjectAr} onChange={e => {
                      setSubjectAr(e.target.value);
                      translateArToEn(e.target.value, setSubjectEn);
                    }} placeholder="الموضوع" className="input bg-transparent font-bold underline" />
                  </div>
                  <div className="hidden print:block font-bold underline border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">
                    {subjectAr ? `الموضوع: ${subjectAr}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Content Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(outputLang === 'en' || outputLang === 'both') && (
                <div dir="ltr">
                  <div className="print:hidden">
                    <textarea
                      value={contentEn}
                      onChange={e => {
                        setContentEn(e.target.value);
                        translateEnToAr(e.target.value, setContentAr);
                      }}
                      placeholder="Type your letter content here..."
                      className="w-full min-h-[200px] p-4 rounded-lg border border-gray-200 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="hidden print:block whitespace-pre-wrap border border-gray-200 rounded-lg p-4 min-h-[200px]">
                    {contentEn}
                  </div>
                </div>
              )}
              {(outputLang === 'ar' || outputLang === 'both') && (
                <div dir="rtl">
                  <div className="print:hidden">
                    <textarea
                      value={contentAr}
                      onChange={e => {
                        setContentAr(e.target.value);
                        translateArToEn(e.target.value, setContentEn);
                      }}
                      placeholder="اكتب محتوى الخطاب هنا..."
                      className="w-full min-h-[200px] p-4 rounded-lg border border-gray-200 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="hidden print:block whitespace-pre-wrap border border-gray-200 rounded-lg p-4 min-h-[200px]">
                    {contentAr}
                  </div>
                </div>
              )}
            </div>

            {/* Sender Row */}
            <div className={`grid gap-8 pt-4 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(outputLang === 'en' || outputLang === 'both') && (
                <div className="space-y-3" dir="ltr">
                  <p className="print:block hidden mb-4">Sincerely,</p>
                  <div className="print:hidden">
                    <input type="text" value={senderNameEn} onChange={e => {
                      setSenderNameEn(e.target.value);
                      translateEnToAr(e.target.value, setSenderNameAr);
                    }} placeholder="Your Name" className="input bg-transparent font-bold" />
                    <input type="text" value={senderTitleEn} onChange={e => {
                      setSenderTitleEn(e.target.value);
                      translateEnToAr(e.target.value, setSenderTitleAr);
                    }} placeholder="Your Title" className="input bg-transparent" />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold min-h-[48px] flex items-center">{senderNameEn}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{senderTitleEn}</div>
                  </div>
                </div>
              )}
              {(outputLang === 'ar' || outputLang === 'both') && (
                <div className="space-y-3" dir="rtl">
                  <p className="print:block hidden mb-4">وتفضلوا بقبول فائق الاحترام،</p>
                  <div className="print:hidden">
                    <input type="text" value={senderNameAr} onChange={e => {
                      setSenderNameAr(e.target.value);
                      translateArToEn(e.target.value, setSenderNameEn);
                    }} placeholder="الاسم" className="input bg-transparent font-bold" />
                    <input type="text" value={senderTitleAr} onChange={e => {
                      setSenderTitleAr(e.target.value);
                      translateArToEn(e.target.value, setSenderTitleEn);
                    }} placeholder="المنصب" className="input bg-transparent" />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold min-h-[48px] flex items-center">{senderNameAr}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{senderTitleAr}</div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </LetterheadChrome>
    </div>
  );
}
