import { Link } from 'react-router-dom'
import { StatusChip } from '../inventoryUi'
import { ReceiptDraftLines } from '../receipts/ReceiptLineItems'
import { ReceiptQuickAdd } from '../receipts/ReceiptQuickAdd'

export { ReceiptDraftLines as DeliveryDraftLines }

/**
 * Delivery moves grid: Product · Demand · Reserved · Done
 * Warning highlight when Ready and Reserved < Demand.
 */
export function DeliveryLineItems({
  ar,
  language,
  moves = [],
  doneEdits = {},
  readOnly,
  canEditDone,
  uiState,
  onDoneChange,
  onFillRemaining,
  barcodeEnabled,
  onIncrementDone,
}) {
  const warnMissing = uiState === 'ready'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'بنود التسليم' : 'Delivery Lines'}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {ar ? 'الطلب · المحجوز · المنجز' : 'Demand · Reserved · Done'}
          </p>
        </div>
        {canEditDone && moves.length > 0 && (
          <button type="button" className="btn btn-secondary btn-xs" onClick={onFillRemaining}>
            {ar ? 'ملء كل المتبقي' : 'Fill all remaining'}
          </button>
        )}
      </div>

      {canEditDone && (
        <ReceiptQuickAdd
          ar={ar}
          enabled={barcodeEnabled}
          mode="edit"
          moves={moves}
          onIncrementDone={onIncrementDone}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-dark-600">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/90 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900/50">
            <tr>
              <th className="px-3 py-2.5 text-start">{ar ? 'المنتج' : 'Product'}</th>
              <th className="px-3 py-2.5 text-start">{ar ? 'الوحدة' : 'UoM'}</th>
              <th className="px-3 py-2.5 text-start">{ar ? 'الطلب' : 'Demand'}</th>
              <th className="px-3 py-2.5 text-start">{ar ? 'المحجوز' : 'Reserved'}</th>
              <th className="px-3 py-2.5 text-start">{ar ? 'المنجز' : 'Done'}</th>
              <th className="px-3 py-2.5 text-start">{ar ? 'الحالة' : 'State'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
            {moves.map((m) => {
              const pid = m.productId?._id || m.productId
              const label = ar && m.productId?.nameAr
                ? m.productId.nameAr
                : m.productId?.nameEn || m.productId?.sku || '—'
              const demand = Number(m.demandQty || 0)
              const reserved = Number(m.reservedQty || 0)
              const doneVal = doneEdits[m._id] != null ? doneEdits[m._id] : String(m.doneQty || m.demandQty || '0')
              const done = Number(doneVal || 0)
              const underReserved = warnMissing && reserved + 1e-9 < demand
              const uomLabel = (ar && m.uomId?.nameAr)
                ? m.uomId.nameAr
                : (m.uomId?.name || m.productId?.unitOfMeasure || '—')

              return (
                <tr
                  key={m._id}
                  className={
                    underReserved
                      ? 'bg-orange-50/80 dark:bg-orange-950/25'
                      : Math.abs(demand - done) > 1e-9 && canEditDone
                        ? 'bg-amber-50/40 dark:bg-amber-950/15'
                        : ''
                  }
                >
                  <td className="px-3 py-2.5">
                    {pid ? (
                      <Link
                        className="font-medium text-sky-800 hover:underline dark:text-sky-300"
                        to={`/app/dashboard/inventory/products/${pid}`}
                      >
                        {label}
                      </Link>
                    ) : label}
                    {m.productId?.sku ? (
                      <div className="font-mono text-[11px] text-slate-400">{m.productId.sku}</div>
                    ) : null}
                    {underReserved ? (
                      <div className="mt-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
                        {ar ? 'مخزون ناقص للحجز' : 'Insufficient reserved stock'}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{uomLabel}</td>
                  <td className="px-3 py-2.5 tabular-nums">{m.demandQty}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${underReserved ? 'font-semibold text-orange-700' : ''}`}>
                    {reserved}
                  </td>
                  <td className="px-3 py-2.5">
                    {canEditDone && !readOnly ? (
                      <input
                        className="input input-sm w-24 text-end tabular-nums"
                        inputMode="decimal"
                        value={doneVal}
                        onChange={(e) => onDoneChange(m._id, e.target.value)}
                      />
                    ) : (
                      <span className="tabular-nums">{m.doneQty ?? doneVal}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip status={m.state} language={language} />
                  </td>
                </tr>
              )
            })}
            {moves.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  {ar ? 'لا توجد حركات' : 'No moves'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
