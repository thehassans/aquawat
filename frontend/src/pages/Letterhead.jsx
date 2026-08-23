import { useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Printer } from 'lucide-react';
import debounce from 'lodash.debounce';
import { autoTranslateText } from '../lib/builtInTranslator';
import { getInvoiceSecondaryLanguage } from '../lib/invoiceLanguage';
import { isPakistanTenant, isBangladeshTenant } from '../lib/saudiTenant';
import LetterheadChrome from '../components/invoices/LetterheadChrome';

const REGION_LOCALES = {
  ur: {
    code: 'ur',
    name: 'Urdu',
    dir: 'rtl',
    labelOnly: 'اردو فقط',
    labelOnlyEn: 'Urdu Only',
    labelBoth: 'انگریزی + اردو (مشترکہ)',
    labelBothEn: 'Bilingual (English + Urdu)',
    dateLabel: 'تاریخ',
    recipientName: 'موصول کنندہ کا نام',
    recipientTitle: 'عہدہ / ادارہ / کمپنی',
    subject: 'موضوع',
    content: 'یہاں خط کا متن درج کریں...',
    senderName: 'آپ کا نام',
    senderTitle: 'آپ کا عہدہ',
    closing: 'نیک تمناؤں کے ساتھ / مخلص،',
  },
  bn: {
    code: 'bn',
    name: 'Bangla',
    dir: 'ltr',
    labelOnly: 'বাংলা শুধুমাত্র',
    labelOnlyEn: 'Bangla Only',
    labelBoth: 'ইংরেজি + বাংলা (দ্বিভাষিক)',
    labelBothEn: 'Bilingual (English + Bangla)',
    dateLabel: 'তারিখ',
    recipientName: 'প্রাপকের নাম',
    recipientTitle: 'পদবী / প্রতিষ্ঠান',
    subject: 'বিষয়',
    content: 'এখানে চিঠির বিবরণ লিখুন...',
    senderName: 'আপনার নাম',
    senderTitle: 'আপনার পদবী',
    closing: 'বিনীত / শুভেচ্ছান্তে,',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    dir: 'rtl',
    labelOnly: 'عربي فقط',
    labelOnlyEn: 'Arabic Only',
    labelBoth: 'عربي وإنجليزي (مزدوج)',
    labelBothEn: 'Bilingual (Both)',
    dateLabel: 'التاريخ',
    recipientName: 'اسم المستلم',
    recipientTitle: 'المنصب / الجهة',
    subject: 'الموضوع',
    content: 'اكتب محتوى الخطاب هنا...',
    senderName: 'الاسم',
    senderTitle: 'المنصب',
    closing: 'وتفضلوا بقبول فائق الاحترام،',
  },
};

export default function Letterhead() {
  const { tenant } = useSelector((state) => state.auth);
  const uiLanguage = useSelector((state) => state.ui.language);

  // Determine secondary locale for letterhead
  const secondaryCode = useMemo(() => {
    const sec = getInvoiceSecondaryLanguage(tenant);
    if (sec === 'ur' || isPakistanTenant(tenant)) return 'ur';
    if (sec === 'bn' || isBangladeshTenant(tenant)) return 'bn';
    if (sec === 'ar') return 'ar';
    // Default fallback
    if (isPakistanTenant(tenant)) return 'ur';
    if (isBangladeshTenant(tenant)) return 'bn';
    return 'ar';
  }, [tenant]);

  const locale = REGION_LOCALES[secondaryCode] || REGION_LOCALES.ar;

  const [outputLang, setOutputLang] = useState(() => 'both'); // 'en', 'sec', 'both'
  const [contentEn, setContentEn] = useState('');
  const [contentSec, setContentSec] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [recipientEn, setRecipientEn] = useState('');
  const [recipientSec, setRecipientSec] = useState('');
  const [recipientTitleEn, setRecipientTitleEn] = useState('');
  const [recipientTitleSec, setRecipientTitleSec] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [subjectSec, setSubjectSec] = useState('');
  const [senderNameEn, setSenderNameEn] = useState('');
  const [senderNameSec, setSenderNameSec] = useState('');
  const [senderTitleEn, setSenderTitleEn] = useState('');
  const [senderTitleSec, setSenderTitleSec] = useState('');

  const translateText = (text, targetLang) => {
    if (!text?.trim()) return '';
    return autoTranslateText(text, targetLang === secondaryCode ? 'en' : secondaryCode, targetLang);
  };

  const translateEnToSec = useCallback(
    debounce((text, setter) => {
      if (!text?.trim()) return;
      const translated = translateText(text, secondaryCode);
      if (translated) setter(translated);
    }, 150),
    [secondaryCode]
  );

  const translateSecToEn = useCallback(
    debounce((text, setter) => {
      if (!text?.trim()) return;
      const translated = translateText(text, 'en');
      if (translated) setter(translated);
    }, 1000),
    [secondaryCode]
  );

  const handlePrint = () => {
    window.print();
  };

  const isSecVisible = outputLang === 'sec' || outputLang === 'both';
  const isEnVisible = outputLang === 'en' || outputLang === 'both';

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
            <option value="sec">{uiLanguage === 'ar' ? locale.labelOnly : locale.labelOnlyEn}</option>
            <option value="both">{uiLanguage === 'ar' ? locale.labelBoth : locale.labelBothEn}</option>
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
        outputLang={outputLang === 'sec' ? 'secondary' : outputLang}
        className="rounded-xl border border-gray-200 shadow-lg print:m-0 print:border-none print:p-0 print:shadow-none dark:bg-white"
      >
        {/* Content Area */}
        <div className="relative z-10 min-h-[650px] flex-1 bg-transparent p-8 text-black print:min-h-0 print:p-4">
          {/* Date */}
          <div className="mb-8 flex justify-between">
            <div className="w-1/3">
              {isEnVisible && (
                <div className="print:hidden mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">Date (EN)</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input bg-transparent" />
                </div>
              )}
              <div className="hidden print:block font-medium border border-gray-200 rounded-lg p-3">Date: {date}</div>
            </div>

            <div className={`w-1/3 ${locale.dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={locale.dir}>
              {isSecVisible && (
                <div className="print:hidden mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">{locale.dateLabel}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input bg-transparent" />
                </div>
              )}
              <div className="hidden print:block font-medium border border-gray-200 rounded-lg p-3">{locale.dateLabel}: {date}</div>
            </div>
          </div>

          {/* Grid Layout for Body (Row Based for Alignment) */}
          <div className="space-y-6">

            {/* Recipient Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isEnVisible && (
                <div className="space-y-3" dir="ltr">
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={recipientEn}
                      onChange={e => {
                        setRecipientEn(e.target.value);
                        translateEnToSec(e.target.value, setRecipientSec);
                      }}
                      placeholder="Recipient Name"
                      className="input bg-transparent font-bold text-lg"
                    />
                    <input
                      type="text"
                      value={recipientTitleEn}
                      onChange={e => {
                        setRecipientTitleEn(e.target.value);
                        translateEnToSec(e.target.value, setRecipientTitleSec);
                      }}
                      placeholder="Recipient Title / Company"
                      className="input bg-transparent"
                    />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold text-lg min-h-[48px] flex items-center">{recipientEn}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{recipientTitleEn}</div>
                  </div>
                </div>
              )}
              {isSecVisible && (
                <div className="space-y-3" dir={locale.dir}>
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={recipientSec}
                      onChange={e => {
                        setRecipientSec(e.target.value);
                        translateSecToEn(e.target.value, setRecipientEn);
                      }}
                      placeholder={locale.recipientName}
                      className="input bg-transparent font-bold text-lg"
                    />
                    <input
                      type="text"
                      value={recipientTitleSec}
                      onChange={e => {
                        setRecipientTitleSec(e.target.value);
                        translateSecToEn(e.target.value, setRecipientTitleEn);
                      }}
                      placeholder={locale.recipientTitle}
                      className="input bg-transparent"
                    />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold text-lg min-h-[48px] flex items-center">{recipientSec}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{recipientTitleSec}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Subject Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isEnVisible && (
                <div dir="ltr">
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={subjectEn}
                      onChange={e => {
                        setSubjectEn(e.target.value);
                        translateEnToSec(e.target.value, setSubjectSec);
                      }}
                      placeholder="Subject Line"
                      className="input bg-transparent font-bold underline"
                    />
                  </div>
                  <div className="hidden print:block font-bold underline border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">
                    {subjectEn ? `Subject: ${subjectEn}` : ''}
                  </div>
                </div>
              )}
              {isSecVisible && (
                <div dir={locale.dir}>
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={subjectSec}
                      onChange={e => {
                        setSubjectSec(e.target.value);
                        translateSecToEn(e.target.value, setSubjectEn);
                      }}
                      placeholder={locale.subject}
                      className="input bg-transparent font-bold underline"
                    />
                  </div>
                  <div className="hidden print:block font-bold underline border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">
                    {subjectSec ? `${locale.subject}: ${subjectSec}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Content Row */}
            <div className={`grid gap-8 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isEnVisible && (
                <div dir="ltr">
                  <div className="print:hidden">
                    <textarea
                      value={contentEn}
                      onChange={e => {
                        setContentEn(e.target.value);
                        translateEnToSec(e.target.value, setContentSec);
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
              {isSecVisible && (
                <div dir={locale.dir}>
                  <div className="print:hidden">
                    <textarea
                      value={contentSec}
                      onChange={e => {
                        setContentSec(e.target.value);
                        translateSecToEn(e.target.value, setContentEn);
                      }}
                      placeholder={locale.content}
                      className="w-full min-h-[200px] p-4 rounded-lg border border-gray-200 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="hidden print:block whitespace-pre-wrap border border-gray-200 rounded-lg p-4 min-h-[200px]">
                    {contentSec}
                  </div>
                </div>
              )}
            </div>

            {/* Sender Row */}
            <div className={`grid gap-8 pt-4 ${outputLang === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isEnVisible && (
                <div className="space-y-3" dir="ltr">
                  <p className="print:block hidden mb-4">Sincerely,</p>
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={senderNameEn}
                      onChange={e => {
                        setSenderNameEn(e.target.value);
                        translateEnToSec(e.target.value, setSenderNameSec);
                      }}
                      placeholder="Your Name"
                      className="input bg-transparent font-bold"
                    />
                    <input
                      type="text"
                      value={senderTitleEn}
                      onChange={e => {
                        setSenderTitleEn(e.target.value);
                        translateEnToSec(e.target.value, setSenderTitleSec);
                      }}
                      placeholder="Your Title"
                      className="input bg-transparent"
                    />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold min-h-[48px] flex items-center">{senderNameEn}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{senderTitleEn}</div>
                  </div>
                </div>
              )}
              {isSecVisible && (
                <div className="space-y-3" dir={locale.dir}>
                  <p className="print:block hidden mb-4">{locale.closing}</p>
                  <div className="print:hidden">
                    <input
                      type="text"
                      value={senderNameSec}
                      onChange={e => {
                        setSenderNameSec(e.target.value);
                        translateSecToEn(e.target.value, setSenderNameEn);
                      }}
                      placeholder={locale.senderName}
                      className="input bg-transparent font-bold"
                    />
                    <input
                      type="text"
                      value={senderTitleSec}
                      onChange={e => {
                        setSenderTitleSec(e.target.value);
                        translateSecToEn(e.target.value, setSenderTitleEn);
                      }}
                      placeholder={locale.senderTitle}
                      className="input bg-transparent"
                    />
                  </div>
                  <div className="hidden print:block space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3 font-bold min-h-[48px] flex items-center">{senderNameSec}</div>
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[48px] flex items-center">{senderTitleSec}</div>
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
