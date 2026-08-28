import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../../lib/api'
import {
  fieldControlClass,
  fieldLabelClass,
  listShellClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
} from '../salesUi'

const DIMS = [
  { value: 'salesperson', label: 'Salesperson', labelAr: 'مندوب' },
  { value: 'customer', label: 'Customer', labelAr: 'عميل' },
  { value: 'product', label: 'Product', labelAr: 'منتج' },
  { value: 'category', label: 'Category', labelAr: 'فئة' },
  { value: 'month', label: 'Month', labelAr: 'شهر' },
  { value: 'week', label: 'Week', labelAr: 'أسبوع' },
  { value: 'day', label: 'Day', labelAr: 'يوم' },
]

const MEASURES = [
  { value: 'untaxedTotal', label: 'Untaxed total' },
  { value: 'totalSales', label: 'Total sales' },
  { value: 'margin', label: 'Margin' },
  { value: 'qtyInvoiced', label: 'Qty invoiced' },
]

export default function SalesMatrixReportPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [preset, setPreset] = useState('365d')
  const [row, setRow] = useState('salesperson')
  const [col, setCol] = useState('month')
  const [measure, setMeasure] = useState('untaxedTotal')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-matrix', preset, row, col, measure],
    queryFn: async () => (await api.get('/sales/reporting/matrix', { params: { preset, row, col, measure } })).data,
  })

  const cols = data?.cols || []
  const matrix = data?.matrix || []
  const colTotals = data?.colTotals || {}

  const grandTotal = useMemo(
    () => matrix.reduce((s, r) => s + Number(r.total || 0), 0),
    [matrix],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الفترة' : 'Period'}</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="mtd">Month to date</option>
            <option value="ytd">Year to date</option>
            <option value="365d">Last 365 days</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'صفوف' : 'Rows'}</label>
          <select className={fieldControlClass} value={row} onChange={(e) => setRow(e.target.value)}>
            {DIMS.map((d) => (
              <option key={d.value} value={d.value}>{isAr ? d.labelAr : d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'أعمدة' : 'Columns'}</label>
          <select className={fieldControlClass} value={col} onChange={(e) => setCol(e.target.value)}>
            {DIMS.map((d) => (
              <option key={d.value} value={d.value}>{isAr ? d.labelAr : d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'المقياس' : 'Measure'}</label>
          <select className={fieldControlClass} value={measure} onChange={(e) => setMeasure(e.target.value)}>
            {MEASURES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={sectionCardClass}>
        <h2 className="mb-3 text-lg font-semibold">{isAr ? 'تقرير مصفوفة' : 'Matrix report'}</h2>
        <div className={`${listShellClass} overflow-x-auto`}>
          <table className={`${salesTableClass} min-w-max table-fixed`}>
            <thead>
              <tr>
                <th className={salesThClass}>{isAr ? 'صف' : 'Row'}</th>
                {cols.map((c) => (
                  <th key={c} className={`${salesThClass} text-end`}>{c}</th>
                ))}
                <th className={`${salesThClass} text-end`}>{isAr ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={cols.length + 2} className={salesTdClass}>Loading…</td></tr>
              ) : !matrix.length ? (
                <tr><td colSpan={cols.length + 2} className={salesTdClass}>{isAr ? 'لا توجد بيانات' : 'No data for this range'}</td></tr>
              ) : (
                <>
                  {matrix.map((r) => (
                    <tr key={r.row} className={salesTrClass}>
                      <td className={salesTdClass}>{r.row}</td>
                      {cols.map((c) => (
                        <td key={c} className={`${salesTdClass} text-end tabular-nums`}>
                          {Number(r.values?.[c] || 0).toFixed(2)}
                        </td>
                      ))}
                      <td className={`${salesTdClass} text-end font-semibold tabular-nums`}>{Number(r.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className={salesTrClass}>
                    <td className={`${salesTdClass} font-semibold`}>{isAr ? 'الإجمالي' : 'Total'}</td>
                    {cols.map((c) => (
                      <td key={c} className={`${salesTdClass} text-end font-semibold tabular-nums`}>
                        {Number(colTotals[c] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className={`${salesTdClass} text-end font-semibold tabular-nums`}>{grandTotal.toFixed(2)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
