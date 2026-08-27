import { Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductChooser from '../../../components/inventory/ProductChooser'
import { StatusChip } from '../inventoryUi'
import { ReceiptQuickAdd } from './ReceiptQuickAdd'

/** Draft (create) lines grid */
export function ReceiptDraftLines({
  ar,
  lines,
  variantsEnabled,
  onChangeLine,
  onRemoveLine,
  onAddLine,
  onPickProduct,
  barcodeEnabled,
  onAddOrIncrementCreate,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'بنود الاستلام' : 'Receipt Lines'}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {ar ? 'منتج · كمية الطلب' : 'Product · demand quantity'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddLine}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-600 hover:text-sky-800 dark:border-dark-500 dark:bg-dark-700 dark:text-slate-100"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          {ar ? 'إضافة' : 'Add'}
        </button>
      </div>

      <ReceiptQuickAdd
        ar={ar}
        enabled={barcodeEnabled}
        mode="create"
        onAddOrIncrementCreate={onAddOrIncrementCreate}
      />

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-10 text-center dark:border-dark-600 dark:bg-dark-900/30">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {ar ? 'لا توجد بنود بعد' : 'No lines yet'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {ar ? 'امسح باركوداً أو أضف سطراً.' : 'Scan a barcode or add a line.'}
          </p>
        </div>
      ) : (
        <div className="overflow-visible rounded-2xl border border-slate-200/80 dark:border-dark-600">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,8rem)_2.25rem] gap-2 border-b border-slate-100 px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:border-dark-600 sm:grid">
            <span>{ar ? 'المنتج' : 'Product'}</span>
            <span>{ar ? 'الكمية' : 'Qty'}</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100/90 dark:divide-dark-600">
            {lines.map((line, idx) => (
              <div
                key={`draft-${idx}`}
                className="grid grid-cols-1 gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,8rem)_2.25rem] sm:items-center"
              >
                <div className="min-w-0">
                  <ProductChooser
                    remote
                    mode="inline"
                    accent="sky"
                    valueLabel={line.productName || ''}
                    valueSub={line.sku || ''}
                    onPick={(p) => onPickProduct(p, idx)}
                    placeholder={ar ? 'اختر منتجاً…' : 'Pick product…'}
                  />
                  {line.sku && !line.productName ? (
                    <div className="mt-1 font-mono text-[11px] text-slate-400">{line.sku}</div>
                  ) : null}
                  {variantsEnabled && line.needsVariant && Array.isArray(line.variants) && line.variants.length > 0 && (
                    <select
                      className="select mt-1 w-full text-xs"
                      value={line.variantId || ''}
                      onChange={(e) => onChangeLine(idx, { ...line, variantId: e.target.value })}
                    >
                      <option value="">{ar ? '— متغير —' : '— Variant —'}</option>
                      {line.variants.map((v) => (
                        <option key={v._id} value={v._id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  className="input input-sm w-full text-end tabular-nums"
                  inputMode="decimal"
                  value={line.demandQty}
                  onChange={(e) => onChangeLine(idx, { ...line, demandQty: e.target.value })}
                />
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => onRemoveLine(idx)}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Existing transfer moves grid (Ready / Done) */
export function ReceiptLineItems({
  ar,
  language,
  moves = [],
  doneEdits = {},
  readOnly,
  canEditDone,
  onDoneChange,
  onFillRemaining,
  barcodeEnabled,
  onIncrementDone,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'بنود الاستلام' : 'Receipt Lines'}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {ar ? 'الطلب مقابل الكمية المستلمة' : 'Demand vs received quantity'}
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
              <th className="px-3 py-2.5 text-start">{ar ? 'المستلم' : 'Done'}</th>
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
              const doneVal = doneEdits[m._id] != null ? doneEdits[m._id] : String(m.doneQty || m.demandQty || '0')
              const done = Number(doneVal || 0)
              const diff = Math.abs(demand - done) > 1e-9
              const uomLabel = (ar && m.uomId?.nameAr)
                ? m.uomId.nameAr
                : (m.uomId?.name || m.productId?.unitOfMeasure || '—')
              return (
                <tr key={m._id} className={diff ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''}>
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
                    {m.variantId?.name ? (
                      <div className="text-[11px] text-slate-500">{m.variantId.name}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{uomLabel}</td>
                  <td className="px-3 py-2.5 tabular-nums">{m.demandQty}</td>
                  <td className="px-3 py-2.5">
                    {canEditDone && !readOnly ? (
                      <input
                        className={`input input-sm w-24 text-end tabular-nums ${diff ? 'border-amber-400' : ''}`}
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
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">
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
