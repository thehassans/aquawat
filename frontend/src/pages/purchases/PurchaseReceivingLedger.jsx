import { Clock3, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PURCHASES_PATH, shell, STATUS_PILL, formatDay, warehouseName } from './purchasesUi'

function productLabel(row, language) {
  if (language === 'ar') return row.productNameAr || row.productName || '—'
  return row.productName || row.productNameAr || '—'
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ring-1 ring-inset ${
            delayed ? STATUS_PILL.delayed : STATUS_PILL.received
          }`}
        >
          {delayed
            ? (language === 'ar' ? 'متأخر' : 'Delayed')
            : (language === 'ar' ? 'مستلم' : 'Received')}
        </span>
        <p className="text-[12px] tabular-nums text-slate-500">
          {delayed
            ? `${language === 'ar' ? 'حتى' : 'Until'} ${formatDay(event.delayedUntil, language)}`
            : formatDay(event.date, language)}
        </p>
      </div>
      <p className="mt-2 text-[13px] font-medium text-slate-900 dark:text-white">
        {language === 'ar' ? 'الكمية' : 'Qty'} {event.quantity}
        {event.productName ? ` · ${event.productName}` : ''}
      </p>
      {delayed && event.delayReason ? (
        <p className="mt-1.5 text-[13px] text-slate-700 dark:text-slate-200">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'السبب' : 'Reason'}
          </span>
          <span className="ms-2">{event.delayReason}</span>
        </p>
      ) : null}
      {event.notes ? (
        <p className="mt-1 text-[13px] leading-6 text-slate-600 dark:text-slate-300">{event.notes}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {event.grnId ? (
          <Link
            to={`${PURCHASES_PATH.grn}/${event.grnId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-teal-700 hover:underline dark:text-teal-300"
          >
            {event.grnNumber || 'GRN'}
          </Link>
        ) : null}
        {event.warehouse ? <span>{warehouseName(event.warehouse, language)}</span> : null}
      </div>
    </div>
  )
}

export default function PurchaseReceivingLedger({ order, language }) {
  const ledger = order?.receivingLedger
  const lines = Array.isArray(ledger?.lines) ? ledger.lines : []
  const unmatched = Array.isArray(ledger?.unmatched) ? ledger.unmatched : []
  const ordered = lines.reduce((sum, row) => sum + Number(row.quantityOrdered || 0), 0)
  const received = lines.reduce((sum, row) => sum + Number(row.quantityReceived || 0), 0)
  const returned = lines.reduce((sum, row) => sum + Number(row.quantityReturned || 0), 0)
  const delayed = Number(ledger?.delayedCount || 0)

  return (
    <section className={`${shell} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {language === 'ar' ? 'الاستلام' : 'Receiving'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'ما وصل، ومتى، وما تأخر مع السبب والملاحظة.'
              : 'What arrived, when, and what is delayed — with reason and notes.'}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <Stat label={language === 'ar' ? 'مطلوب' : 'Ordered'} value={ordered} />
          <Stat label={language === 'ar' ? 'مستلم' : 'Received'} value={received} tone="text-teal-800 dark:text-teal-300" />
          <Stat label={language === 'ar' ? 'مرتجع' : 'Returned'} value={returned} tone={returned > 0 ? "text-rose-800 dark:text-rose-300" : undefined} />
          <Stat label={language === 'ar' ? 'متأخر' : 'Delayed'} value={delayed} tone={delayed ? 'text-amber-800 dark:text-amber-300' : undefined} />
        </div>
      </div>

      {!ledger?.hasActivity ? (
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
            {order?._id ? (
              <Link
                to={`${PURCHASES_PATH.grn}/new?poId=${order._id}`}
                className="mt-3 inline-flex text-[13px] font-medium text-teal-700 hover:underline dark:text-teal-300"
              >
                {language === 'ar' ? 'إنشاء إشعار استلام' : 'Create GRN'}
              </Link>
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
                      <span className="text-rose-600 dark:text-rose-400">
                        {language === 'ar' ? 'مرتجع' : 'Returned'} {row.quantityReturned}
                      </span>
                    </>
                  )}
                  <span className="mx-2 text-slate-300">·</span>
                  {language === 'ar' ? 'متبقي' : 'Remaining'} {row.remaining}
                </p>
              </div>
              {(row.receivedEvents.length || row.delayedEvents.length) ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {row.receivedEvents.map((event, i) => (
                    <EventCard key={`r-${event.grnId}-${i}`} event={event} language={language} />
                  ))}
                  {row.delayedEvents.map((event, i) => (
                    <EventCard key={`d-${event.grnId}-${i}`} event={event} language={language} delayed />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-slate-400">
                  {language === 'ar' ? 'لم يُستلم هذا البند بعد.' : 'This line has not been received yet.'}
                </p>
              )}
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
