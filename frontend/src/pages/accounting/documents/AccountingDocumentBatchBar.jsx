import { Banknote, Printer, Send } from 'lucide-react'

export default function AccountingDocumentBatchBar({
  count = 0,
  language = 'en',
  onRegisterPayment,
  onSendPrint,
  registerDisabled = false,
}) {
  if (count < 1) return null
  const isAr = language === 'ar'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
        {isAr ? `${count} محدد` : `${count} selected`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={registerDisabled}
          onClick={onRegisterPayment}
        >
          <Banknote className="h-4 w-4" />
          {isAr ? 'تسجيل دفعة' : 'Register payment'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSendPrint}>
          <Send className="h-4 w-4" />
          {isAr ? 'إرسال وطباعة' : 'Send & print'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSendPrint}>
          <Printer className="h-4 w-4" />
          {isAr ? 'طباعة' : 'Print'}
        </button>
      </div>
    </div>
  )
}
