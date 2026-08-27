import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, ReportTableFrame, REPORT_THEAD, useReportFilters, exportCsv } from './ReportShell'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { formatInvError } from '../../lib/invError'
import {
  formatReportMoney,
  formatReportMoneyCsv,
  formatReportProduct,
  formatReportQty,
} from '../../lib/reportFormat'

export default function ValuationReport() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { queryParams } = useReportFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['valuation-report', queryParams],
    queryFn: () => api.get('/stock/valuation-report', { params: queryParams }).then((r) => r.data),
  })

  const items = data?.items || []
  const total = items.reduce((s, r) => s + Number(r.value || 0), 0)

  return (
    <ReportShell
      activeId="valuation"
      title={ar ? 'تقرير التقييم' : 'Inventory Valuation'}
      subtitle={ar
        ? 'قيمة المخزون حسب طريقة التكلفة — يجب أن تطابق تقرير المخزون'
        : 'On-hand value by costing method — must match Stock report'}
      toolbar={(
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons model="valuation" importable={false} ar={ar} filters={queryParams} />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!items.length}
            onClick={() => exportCsv('valuation.csv', items, [
              { label: 'SKU', get: (r) => r.sku },
              { label: 'Name', get: (r) => formatReportProduct({ ...r, productName: r.name || r.productName }, { ar }) },
              { label: 'Method', get: (r) => r.costMethod },
              { label: 'Qty', get: (r) => formatReportQty(r.qty) },
              { label: 'UnitCost', get: (r) => formatReportMoneyCsv(r.unitCost) },
              { label: 'Value', get: (r) => formatReportMoneyCsv(r.value) },
            ])}
          >
            CSV
          </button>
        </div>
      )}
    >
      <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <Link to="/app/dashboard/inventory/report/reconcile" className="text-xs font-medium text-primary-600 hover:underline">
          {language === 'ar' ? 'تشغيل المطابقة' : 'Run reconcile'}
        </Link>
        <div className="rounded-xl border border-slate-200/80 px-4 py-2 dark:border-dark-600">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {language === 'ar' ? 'الإجمالي' : 'Total'}
          </div>
          <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatReportMoney(total)}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState
          title={language === 'ar' ? 'لا قيمة' : 'No valued stock'}
          description={language === 'ar'
            ? 'تحقق من الحركات بعد تفعيل المحرك'
            : 'Validate receipts/deliveries after enabling the engine'}
        />
      ) : (
        <ReportTableFrame>
          <table className="w-full min-w-[720px] text-sm">
            <thead className={REPORT_THEAD}>
              <tr>
                <th className="min-w-[150px] px-3 py-2 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="min-w-[150px] px-3 py-2 text-start">{language === 'ar' ? 'الطريقة' : 'Method'}</th>
                <th className="min-w-[150px] px-3 py-2 text-end">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th className="min-w-[150px] px-3 py-2 text-end">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit cost'}</th>
                <th className="min-w-[150px] px-3 py-2 text-end">{language === 'ar' ? 'القيمة' : 'Value'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => (
                <tr key={`${row.productId}|${row.variantId || ''}`}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {formatReportProduct({ ...row, productName: row.name || row.productName }, { ar })}
                    </div>
                    <div className="text-xs text-slate-400">{row.sku}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.costMethod}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{formatReportQty(row.qty)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{formatReportMoney(row.unitCost)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums font-medium">{formatReportMoney(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportTableFrame>
      )}

      <p className="mt-2 shrink-0 text-xs text-slate-500">
        <Link to="/app/dashboard/inventory/landed-costs" className="text-primary-600 hover:underline">
          {language === 'ar' ? 'التكاليف المرسية' : 'Landed costs'}
        </Link>
        {' · '}
        <Link to="/app/dashboard/landed-costs" className="text-primary-600 hover:underline">
          {language === 'ar' ? 'تكلفة مرسية (مشتريات)' : 'Purchase landed costs'}
        </Link>
      </p>
    </ReportShell>
  )
}

export function InvLandedCostsPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [transferId, setTransferId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-landed-costs'],
    queryFn: () => api.get('/stock/landed-costs').then((r) => r.data),
  })

  const { data: receipts } = useQuery({
    queryKey: ['inv-receipts-done'],
    queryFn: () =>
      api.get('/stock/transfers', { params: { code: 'incoming', state: 'done', limit: 40 } })
        .then((r) => r.data?.items || r.data || []),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/stock/landed-costs', {
        name: name || undefined,
        transferIds: transferId ? [transferId] : [],
        costLines: price
          ? [{ name: 'Additional cost', price, splitMethod: 'byQuantity' }]
          : [],
      }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الإنشاء' : 'Created')
      setName('')
      setPrice('')
      qc.invalidateQueries({ queryKey: ['inv-landed-costs'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const computeMut = useMutation({
    mutationFn: (id) => api.post(`/stock/landed-costs/${id}/compute`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحساب' : 'Computed')
      qc.invalidateQueries({ queryKey: ['inv-landed-costs'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const validateMut = useMutation({
    mutationFn: (id) => api.post(`/stock/landed-costs/${id}/validate`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الترحيل' : 'Validated')
      qc.invalidateQueries({ queryKey: ['inv-landed-costs'] })
      qc.invalidateQueries({ queryKey: ['valuation-report'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const items = data?.items || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'تكاليف مرسية (محرك المخزون)' : 'Landed Costs (Inventory Engine)'}
        </h2>
        <p className="text-sm text-slate-500">
          {language === 'ar'
            ? 'توزيع تكاليف إضافية على طبقات التقييم لاستلامات منجزة'
            : 'Allocate extra costs onto valuation layers for done receipts'}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200/80 p-4 dark:border-dark-600 md:grid-cols-4">
        <input
          className="input"
          placeholder={language === 'ar' ? 'الاسم (اختياري)' : 'Name (optional)'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="select" value={transferId} onChange={(e) => setTransferId(e.target.value)}>
          <option value="">{language === 'ar' ? 'استلام منجز…' : 'Done receipt…'}</option>
          {(Array.isArray(receipts) ? receipts : []).map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={createMut.isPending || !transferId || !price}
          onClick={() => createMut.mutate()}
        >
          {language === 'ar' ? 'إنشاء' : 'Create'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={language === 'ar' ? 'لا تكاليف' : 'No engine landed costs'} />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-dark-700 dark:border-dark-600">
          {items.map((lc) => (
            <li key={lc._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">{lc.name}</div>
                <div className="text-xs text-slate-500">
                  {lc.state}
                  {lc.valuationAdjustmentLines?.length
                    ? ` · ${lc.valuationAdjustmentLines.length} adj`
                    : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {lc.state === 'draft' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => computeMut.mutate(lc._id)}
                  >
                    {language === 'ar' ? 'احسب' : 'Compute'}
                  </button>
                )}
                {lc.state !== 'done' && lc.state !== 'cancelled' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => validateMut.mutate(lc._id)}
                  >
                    {language === 'ar' ? 'ترحيل' : 'Validate'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
