import { Link } from 'react-router-dom'
import { StatusChip } from '../inventoryUi'

/**
 * PoS recovery screen — single primary Save & Validate action.
 */
export function PosActionBar({
  ar,
  transferState,
  busy,
  onSaveAndValidate,
  onCancel,
  onPrint,
}) {
  if (transferState === 'cancelled') return null
  if (transferState === 'done') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {onPrint}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onPrint}
      <button
        type="button"
        className="btn btn-primary text-sm"
        disabled={busy}
        onClick={onSaveAndValidate}
      >
        {ar ? 'حفظ واعتماد' : 'Save & Validate'}
      </button>
      {transferState && transferState !== 'done' && (
        <button type="button" className="btn btn-danger text-sm" disabled={busy} onClick={onCancel}>
          {ar ? 'إلغاء' : 'Cancel'}
        </button>
      )}
    </div>
  )
}

export function PosHeader({
  ar,
  language,
  isNew,
  title,
  transferState,
  listPath,
  actionBar,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-slate-500">
            <Link to={listPath} className="hover:text-slate-800 dark:hover:text-slate-200">
              {ar ? 'المخزون' : 'Inventory'}
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            <Link to={listPath} className="hover:text-slate-800 dark:hover:text-slate-200">
              {ar ? 'طلبات نقطة البيع' : 'PoS Orders'}
            </Link>
            {!isNew && title ? (
              <>
                <span className="mx-1.5 text-slate-300">/</span>
                <span>{title}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={listPath}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-300"
            >
              ← {ar ? 'رجوع' : 'Back'}
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isNew
                ? (ar ? 'طلب نقطة بيع جديد' : 'New PoS Order')
                : (title || (ar ? 'طلب نقطة بيع' : 'PoS Order'))}
            </h1>
            {!isNew && transferState ? <StatusChip status={transferState} language={language} /> : null}
          </div>
          <p className="text-xs text-slate-400">
            {ar
              ? 'شاشة استثناء/استرداد — حفظ واعتماد في خطوة واحدة'
              : 'Exception / recovery screen — save & validate in one step'}
          </p>
        </div>
        {!isNew && actionBar}
      </div>
    </div>
  )
}
