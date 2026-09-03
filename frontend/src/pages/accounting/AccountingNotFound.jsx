import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

/** Shown when /accounting/:section is not a known tab. */
export default function AccountingNotFound({ language = 'en', section = '' }) {
  const isAr = language === 'ar'
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-dark-700">
        <FileQuestion className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {isAr ? 'الصفحة غير موجودة' : 'Page not found'}
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          {isAr
            ? `لا توجد صفحة محاسبة باسم «${section || '—'}».`
            : `No accounting page named “${section || '—'}”.`}
        </p>
      </div>
      <Link
        to="/app/dashboard/accounting"
        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        {isAr ? 'العودة إلى المحاسبة' : 'Back to Accounting'}
      </Link>
    </div>
  )
}
