import React from 'react'
import { motion } from 'framer-motion'
import {
  Printer,
  Download,
  Edit2,
  CheckCircle2,
  Calendar,
  Warehouse as WarehouseIcon,
  FileText,
  Building2,
  PackageCheck
} from 'lucide-react'
import { useSelector } from 'react-redux'
import Money from '../ui/Money'

const STATUS_PILL = {
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  delayed: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  sent: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

const statusLabel = (status, lang) => {
  if (!status) return ''
  const ar = {
    draft: 'مسودة', approved: 'معتمد', partially_received: 'مستلم جزئياً',
    received: 'مستلم بالكامل', billed: 'مفوتر', cancelled: 'ملغي', sent: 'مُرسل', delayed: 'متأخر'
  }
  return lang === 'ar' ? (ar[status] || status) : (status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '))
}

const formatDate = (val, lang) => {
  if (!val) return ''
  return new Date(val).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PurchaseOrderPreview({ 
  order, 
  onEdit, 
  onApprove, 
  onPrint, 
  onCreateGrn,
  isApproving,
  supplier,
  warehouse,
}) {
  const { language } = useSelector(state => state.ui)
  const isRtl = language === 'ar'

  if (!order) return null

  const lines = Array.isArray(order.lineItems) ? order.lineItems : []
  const subtotal = Number(order.subtotal || 0)
  const taxTotal = Number(order.taxTotal || 0)
  const grandTotal = Number(order.grandTotal || 0)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-5xl rounded-3xl bg-white/70 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-slate-900/60 dark:ring-white/10 overflow-hidden"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/50 bg-slate-50/50 p-6 px-8 dark:border-white/5 dark:bg-slate-800/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {order.poNumber || 'New PO'}
            </h1>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${STATUS_PILL[order.status || 'draft']}`}>
              {statusLabel(order.status || 'draft', language)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {language === 'ar' ? 'معاينة أمر الشراء' : 'Purchase Order Preview'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'draft' && (
            <>
              <button type="button" onClick={onEdit} className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-700">
                <Edit2 className="me-2 h-4 w-4" />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </button>
              <button type="button" onClick={onApprove} disabled={isApproving} className="inline-flex h-9 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50">
                <CheckCircle2 className="me-2 h-4 w-4" />
                {language === 'ar' ? 'اعتماد' : 'Approve'}
              </button>
            </>
          )}
          {order.status !== 'draft' && (
            <>
              <button type="button" onClick={onPrint} className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-700">
                <Printer className="me-2 h-4 w-4" />
                {language === 'ar' ? 'طباعة' : 'Print'}
              </button>
              {['approved', 'partially_received'].includes(order.status) && (
                <button type="button" onClick={onCreateGrn} className="inline-flex h-9 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">
                  <PackageCheck className="me-2 h-4 w-4" />
                  {language === 'ar' ? 'استلام بضاعة' : 'Create GRN'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-8">
        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-1">
            <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Building2 className="me-1.5 h-3.5 w-3.5" />
              {language === 'ar' ? 'المورد' : 'Supplier'}
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {supplier?.nameEn || supplier?.nameAr || supplier?.name || order.supplierId?.nameEn || '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <WarehouseIcon className="me-1.5 h-3.5 w-3.5" />
              {language === 'ar' ? 'المستودع' : 'Warehouse'}
            </p>
            <p className="text-base font-medium text-slate-800 dark:text-slate-200">
              {warehouse?.nameEn || warehouse?.nameAr || warehouse?.name || order.warehouseId?.nameEn || '—'}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Calendar className="me-1.5 h-3.5 w-3.5" />
                {language === 'ar' ? 'تاريخ الطلب' : 'Order Date'}
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                {formatDate(order.orderDate, language)}
              </p>
            </div>
            {order.expectedDate && (
              <div>
                <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Calendar className="me-1.5 h-3.5 w-3.5 text-amber-500" />
                  {language === 'ar' ? 'التاريخ المتوقع' : 'Expected Date'}
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                  {formatDate(order.expectedDate, language)}
                </p>
              </div>
            )}
          </div>
        </div>

        {order.notes && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.02]">
            <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              <FileText className="me-1.5 h-3.5 w-3.5" />
              {language === 'ar' ? 'ملاحظات' : 'Notes'}
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {order.notes}
            </p>
          </div>
        )}

        {/* Line Items List */}
        <div className="mt-10">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              <tr>
                <th className={`pb-3 font-medium ${isRtl ? 'pl-4 text-right' : 'pr-4 text-left'}`}>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="pb-3 px-4 font-medium text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th className="pb-3 px-4 font-medium text-right">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                <th className="pb-3 pl-4 font-medium text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {lines.map((line, idx) => (
                <tr key={idx} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                  <td className={`py-4 ${isRtl ? 'pl-4 text-right' : 'pr-4 text-left'}`}>
                    <p className="font-semibold text-slate-900 dark:text-white whitespace-normal">
                      {line.productName || line.productId?.nameEn || line.productId?.nameAr || line.manualName || '—'}
                    </p>
                    {line.description && (
                      <p className="mt-1 text-xs text-slate-500 max-w-[300px] truncate">{line.description}</p>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center font-medium tabular-nums text-slate-700 dark:text-slate-300">
                    {line.quantityOrdered} <span className="text-slate-400 text-xs ml-1">{line.uom}</span>
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    <Money value={line.unitCost} />
                  </td>
                  <td className="py-4 pl-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                    <Money value={Number(line.quantityOrdered) * Number(line.unitCost)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box */}
        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-sm rounded-2xl bg-slate-50 p-6 dark:bg-white/[0.02]">
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
                <span>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                <span className="tabular-nums"><Money value={subtotal} /></span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
                <span>{language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                <span className="tabular-nums"><Money value={taxTotal} /></span>
              </div>
              {order.landedCostTotal > 0 && (
                <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
                  <span>{language === 'ar' ? 'تكاليف الشحن/الجمارك' : 'Landed Costs'}</span>
                  <span className="tabular-nums"><Money value={order.landedCostTotal} /></span>
                </div>
              )}
              <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900 dark:border-white/10 dark:text-white">
                <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="tabular-nums"><Money value={grandTotal} /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
