import { Link } from 'react-router-dom'
import { StatusChip } from '../inventoryUi'
import { toReceiptUiState } from './opTypeGroups'

const STEPS = [
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'ready', en: 'Ready', ar: 'جاهز' },
  { id: 'done', en: 'Done', ar: 'منجز' },
]

/**
 * State-driven action bar for incoming receipts.
 * No Check Availability / Unreserve / ZATCA (receipts-only).
 * Print is intentionally omitted — ZATCA/print stay on invoicing.
 */
export function ReceiptActionBar({
  ar,
  uiState,
  busy,
  onSaveDraft,
  onConfirm,
  onValidate,
  onFillRemaining,
  onCancel,
  onReturn,
  onDuplicate,
}) {
  if (uiState === 'cancelled') return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {uiState === 'draft' && (
        <>
          {onSaveDraft && (
            <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={onSaveDraft}>
              {ar ? 'حفظ المسودة' : 'Save Draft'}
            </button>
          )}
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={onConfirm}>
            {ar ? 'تأكيد (تعيين كمهمة)' : 'Confirm (Mark as Todo)'}
          </button>
          <button type="button" className="btn btn-danger text-sm" disabled={busy} onClick={onCancel}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
        </>
      )}
      {(uiState === 'ready' || uiState === 'waiting') && (
        <>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={onValidate}>
            {ar ? 'اعتماد الاستلام' : 'Validate'}
          </button>
          <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={onFillRemaining}>
            {ar ? 'تعيين الكميات' : 'Set Quantities'}
          </button>
          <button type="button" className="btn btn-danger text-sm" disabled={busy} onClick={onCancel}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
        </>
      )}
      {uiState === 'done' && (
        <>
          <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={onReturn}>
            {ar ? 'مرتجع' : 'Return'}
          </button>
          <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={onDuplicate}>
            {ar ? 'نسخ' : 'Duplicate'}
          </button>
        </>
      )}
    </div>
  )
}

export function ReceiptHeader({
  ar,
  language,
  isNew,
  title,
  transferState,
  listPath,
  backLabel,
  actionBar,
}) {
  const uiState = toReceiptUiState(transferState)

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
              {ar ? 'الاستلامات' : 'Receipts'}
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
              ← {backLabel || (ar ? 'رجوع' : 'Back')}
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isNew ? (ar ? 'استلام جديد' : 'New Receipt') : (title || (ar ? 'استلام' : 'Receipt'))}
            </h1>
            {!isNew && transferState ? <StatusChip status={transferState} language={language} /> : null}
          </div>
        </div>
        {!isNew && actionBar}
      </div>

      {!isNew && uiState !== 'cancelled' && (
        <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-dark-700">
          {STEPS.map((s) => {
            const active =
              (s.id === 'ready' && (uiState === 'ready' || uiState === 'waiting'))
              || uiState === s.id
            return (
              <div
                key={s.id}
                className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold capitalize ${
                  active
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-slate-100'
                    : 'text-slate-400'
                }`}
              >
                {ar ? s.ar : s.en}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
