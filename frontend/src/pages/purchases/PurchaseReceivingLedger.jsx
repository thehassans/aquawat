import { Clock3, PackageCheck, Warehouse as WarehouseIcon, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { shell, STATUS_PILL, formatDay, warehouseName } from './purchasesUi'
import { autoTranslateText } from '../../lib/builtInTranslator'

function productLabel(row, language) {
  if (language === 'ar') {
    return row.productNameAr || (row.productName ? autoTranslateText(row.productName, 'en', 'ar') : '') || row.productName || '—'
  }
  return row.productName || (row.productNameAr ? autoTranslateText(row.productNameAr, 'ar', 'en') : '') || row.productNameAr || '—'
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-1 text-[18px] font-semibold tabular-nums tracking-tight ${tone || 'text-slate-950 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function EventCard({ event, language, delayed }) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        delayed
          ? 'border-amber-200/80 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/[0.06]'
          : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {event.grnNumber || (language === 'ar' ? 'استلام' : 'Receive')}
        </span>
        <span>{formatDay(event.dateReceived || event.createdAt, language)}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[14px] font-semibold tabular-nums text-slate-950 dark:text-white">
          +{event.quantity} {event.uom || ''}
        </span>
        <span className="text-[11px] text-slate-400">
          {warehouseName(event.warehouseId, language)}
        </span>
      </div>
      {delayed ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-100/60 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock3 className="h-3 w-3" />
            <span>{event.delayReason || (language === 'ar' ? 'تأخير مورد' : 'Supplier delay')}</span>
          </div>
          {event.delayNote ? <p className="mt-0.5 opacity-90">{event.delayNote}</p> : null}
        </div>
      ) : null}
      {event.notes ? (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{event.notes}</p>
      ) : null}
    </div>
  )
}

export default function PurchaseReceivingLedger({ order, language, onOpenReceive, onApprove, isApproving }) {
  const ledger = order?.receivingLedger
  const lines = ledger?.lines || []
  const unmatched = ledger?.unmatchedEvents || []

  const ordered = lines.reduce((sum, row) => sum + Number(row.quantityOrdered || 0), 0)
  const received = lines.reduce((sum, row) => sum + Number(row.quantityReceived || 0), 0)
  const returned = lines.reduce((sum, row) => sum + Number(row.quantityReturned || 0), 0)
  const delayed = Number(ledger?.delayedCount || 0)

  return (
    <section className={`${shell} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {language === 'ar' ? 'سجل الاستلام (GRN)' : 'Receiving Ledger (GRN)'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'ما تم استلامه وترحيله للمخزون مع التواريخ والملاحظات.'
              : 'What arrived, inventory postings, and delay records.'}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <Stat label={language === 'ar' ? 'مطلوب' : 'Ordered'} value={ordered} />
          <Stat label={language === 'ar' ? 'مستلم' : 'Received'} value={received} tone="text-teal-800 dark:text-teal-300" />
          <Stat label={language === 'ar' ? 'مسترد / مرتجع' : 'Refunded'} value={returned} tone={returned > 0 ? "text-rose-800 dark:text-rose-300" : undefined} />
          <Stat label={language === 'ar' ? 'متأخر' : 'Delayed'} value={delayed} tone={delayed ? 'text-amber-800 dark:text-amber-300' : undefined} />
        </div>
      </div>

      {!ledger?.hasActivity && returned === 0 ? (
        <div className="flex items-start gap-3 pt-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-white/[0.04]">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-slate-900 dark:text-white">
              {language === 'ar' ? 'لا يوجد استلام بعد' : 'No receipts yet'}
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              {language === 'ar'
                ? 'عند استلام البنود أو تأخيرها ستظهر التواريخ والأسباب هنا.'
                : 'Received quantities and delay reasons will appear here.'}
            </p>
            {['draft', 'sent'].includes(order?.status) ? (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  {language === 'ar' ? 'يجب اعتماد طلب الشراء أولاً لتتمكن من استلام البضاعة (GRN)' : 'Approve purchase order first to receive goods (GRN)'}
                </span>
                {onApprove && (
                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={isApproving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {language === 'ar' ? 'اعتماد الطلب الآن' : 'Approve PO now'}
                  </button>
                )}
              </div>
            ) : onOpenReceive && ['approved', 'partially_received'].includes(order?.status) ? (
              <button
                type="button"
                onClick={onOpenReceive}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
              >
                <WarehouseIcon className="h-4 w-4" />
                {language === 'ar' ? 'استلام البضاعة الآن (GRN)' : 'Receive goods now (GRN)'}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {lines.map((row) => (
            <div key={`${row.productId || row.productName}-${row.index}`} className="border-b border-slate-50 pb-5 last:border-0 last:pb-0 dark:border-white/[0.04]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {productLabel(row, language)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {[row.sku, row.uom].filter(Boolean).join(' · ') || (language === 'ar' ? 'بند' : 'Line')}
                  </p>
                </div>
                <p className="text-[12px] tabular-nums text-slate-500">
                  {language === 'ar' ? 'مطلوب' : 'Ordered'} {row.quantityOrdered}
                  <span className="mx-2 text-slate-300">·</span>
                  {language === 'ar' ? 'مستلم' : 'Received'} {row.quantityReceived}
                  {row.quantityReturned > 0 && (
                    <>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {language === 'ar' ? 'مسترد' : 'Refunded'} {row.quantityReturned}
                      </span>
                    </>
                  )}
                  <span className="mx-2 text-slate-300">·</span>
                  {language === 'ar' ? 'متبقي' : 'Remaining'} {row.remaining}
                </p>
              </div>
              {row.quantityReturned > 0 && (
                <div className="mt-2.5 rounded-xl border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-500/20 dark:bg-rose-500/[0.05] text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <RotateCcw className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{language === 'ar' ? `تمت تسوية واسترداد ${row.quantityReturned} ${row.uom || 'وحدة'} وإلغاء المتبقي من الطلب.` : `${row.quantityReturned} ${row.uom || 'units'} refunded & settled.`}</span>
                </div>
              )}
              {(row.receivedEvents.length || row.delayedEvents.length) ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {row.receivedEvents.map((event, i) => (
                    <EventCard key={`r-${event.grnId}-${i}`} event={event} language={language} />
                  ))}
                  {row.delayedEvents.map((event, i) => (
                    <EventCard key={`d-${event.grnId}-${i}`} event={event} language={language} delayed />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {unmatched.length > 0 && (
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                <Clock3 className="h-3.5 w-3.5" />
                {language === 'ar' ? 'بنود غير مطابقة' : 'Unmatched lines'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {unmatched.map((event, i) => (
                  <EventCard key={`u-${event.grnId}-${i}`} event={event} language={language} delayed={event.isDelayed} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
