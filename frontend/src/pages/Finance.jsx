import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, Percent, CalendarDays } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import Money from '../components/ui/Money'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'
import ResponsiveDataList from '../components/ui/ResponsiveDataList'

const mergeMonthSeries = (revenue = [], expenses = [], language = 'en') => {
  const monthKey = (row) => `${row?._id?.year}-${String(row?._id?.month).padStart(2, '0')}`

  const map = new Map()

  for (const row of revenue || []) {
    const key = monthKey(row)
    if (!key.includes('undefined')) {
      map.set(key, { year: row._id.year, month: row._id.month, revenue: row.revenue || 0, tax: row.tax || 0, invoices: row.count || 0 })
    }
  }

  for (const row of expenses || []) {
    const key = monthKey(row)
    if (!key.includes('undefined')) {
      const existing = map.get(key) || { year: row._id.year, month: row._id.month, revenue: 0, tax: 0, invoices: 0 }
      map.set(key, {
        ...existing,
        salaries: row.salaries || 0,
        gosi: row.gosi || 0,
        other: row.other || 0,
      })
    }
  }

  const locale = language === 'ar' ? 'ar' : 'en'

  return Array.from(map.entries())
    .map(([key, value]) => {
      const date = new Date(value.year, value.month - 1, 1)
      const label = date.toLocaleString(locale, { month: 'short' }) + ' ' + String(value.year).slice(2)
      const salaries = value.salaries || 0
      const gosi = value.gosi || 0
      const other = value.other || 0
      const expensesTotal = salaries + gosi + other
      const revenueTotal = value.revenue || 0
      const profit = revenueTotal - expensesTotal

      return {
        key,
        label,
        year: value.year,
        month: value.month,
        revenue: revenueTotal,
        expenses: expensesTotal,
        salaries,
        gosi,
        other,
        profit,
        tax: value.tax || 0,
        invoices: value.invoices || 0,
      }
    })
    .sort((a, b) => (a.key > b.key ? 1 : -1))
}

export default function Finance() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['finance-revenue', 12],
    queryFn: () => api.get('/dashboard/charts/revenue', { params: { months: 12 } }).then((res) => res.data),
  })

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['finance-expenses', 12],
    queryFn: () => api.get('/dashboard/charts/expenses', { params: { months: 12 } }).then((res) => res.data),
  })

  const { data: vatData, isLoading: vatLoading } = useQuery({
    queryKey: ['finance-vat-return', month, year],
    queryFn: () => api.get('/reports/vat-return', { params: { month, year } }).then((res) => res.data),
  })

  const chartData = useMemo(
    () => mergeMonthSeries(revenueData || [], expensesData || [], language),
    [revenueData, expensesData, language]
  )

  const exportColumns = [
    {
      key: 'label',
      label: language === 'ar' ? 'الشهر' : 'Month',
      value: (r) => r?.label || ''
    },
    {
      key: 'revenue',
      label: language === 'ar' ? 'الإيرادات' : 'Revenue',
      value: (r) => r?.revenue ?? 0
    },
    {
      key: 'expenses',
      label: language === 'ar' ? 'المصروفات' : 'Expenses',
      value: (r) => r?.expenses ?? 0
    },
    {
      key: 'profit',
      label: language === 'ar' ? 'الربح' : 'Profit',
      value: (r) => r?.profit ?? 0
    },
    {
      key: 'invoices',
      label: language === 'ar' ? 'عدد الفواتير' : 'Invoices',
      value: (r) => r?.invoices ?? 0
    },
    {
      key: 'tax',
      label: language === 'ar' ? 'الضريبة' : 'Tax',
      value: (r) => r?.tax ?? 0
    },
  ]

  const totals = useMemo(() => {
    const revenue = chartData.reduce((sum, row) => sum + (row.revenue || 0), 0)
    const expenses = chartData.reduce((sum, row) => sum + (row.expenses || 0), 0)
    const profit = revenue - expenses
    return { revenue, expenses, profit }
  }, [chartData])

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const FinanceTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null

    const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]))

    return (
      <div className="bg-slate-800 text-white rounded-xl px-3 py-2 text-sm">
        <div className="font-semibold mb-1">{label}</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="opacity-80">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</span>
            <Money value={byKey.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="opacity-80">{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
            <Money value={byKey.expenses || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="opacity-80">{language === 'ar' ? 'الربح' : 'Profit'}</span>
            <Money value={byKey.profit || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
        </div>
      </div>
    )
  }

  const vatTotals = vatData?.totals

  const loading = revenueLoading || expensesLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'المالية' : 'Finance'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'لوحة مالية: الإيرادات، المصروفات، وضريبة القيمة المضافة' : 'Finance dashboard: revenue, expenses, and VAT'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <ExportMenu
            language={language}
            t={t}
            rows={[...chartData].reverse()}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'Finance' : 'Finance'}
            title={language === 'ar' ? 'تفاصيل الأشهر' : 'Monthly Breakdown'}
            disabled={chartData.length === 0}
          />
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="select sm:w-44">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2024, m - 1).toLocaleString(language === 'ar' ? 'ar' : 'en', { month: 'long' })}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="select sm:w-32">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إيرادات (12 شهر)' : 'Revenue (12m)'}</p>
            <p className="text-2xl font-bold text-emerald-600">
              <Money value={totals.revenue} minimumFractionDigits={0} maximumFractionDigits={0} />
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'مصروفات (12 شهر)' : 'Expenses (12m)'}</p>
            <p className="text-2xl font-bold text-red-600">
              <Money value={totals.expenses} minimumFractionDigits={0} maximumFractionDigits={0} />
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Wallet className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'صافي الربح (12 شهر)' : 'Net Profit (12m)'}</p>
            <p className="text-2xl font-bold">
              <Money value={totals.profit} minimumFractionDigits={0} maximumFractionDigits={0} />
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Percent className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'خصومات (الشهر)' : 'Discounts (month)'}</p>
            <p className="text-2xl font-bold text-amber-600">
              {vatLoading ? (
                '—'
              ) : (
                <Money value={vatTotals?.totalDiscount || 0} minimumFractionDigits={2} maximumFractionDigits={2} />
              )}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
            <Percent className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'ضريبة القيمة (الشهر)' : 'VAT (month)'}</p>
            <p className="text-2xl font-bold text-amber-600">
              {vatLoading ? (
                '—'
              ) : (
                <Money value={vatTotals?.totalTax || 0} minimumFractionDigits={2} maximumFractionDigits={2} />
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {language === 'ar' ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}
          </h3>

          <div className="h-72">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<FinanceTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'ملخص الشهر' : 'Monthly Snapshot'}</h3>
          </div>

          {vatLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{language === 'ar' ? 'عدد الفواتير' : 'Invoices'}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{(vatTotals?.invoiceCount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{language === 'ar' ? 'خاضع للضريبة' : 'Taxable'}</span>
                <span className="font-semibold"><Money value={vatTotals?.taxableAmount || 0} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{language === 'ar' ? 'الخصومات' : 'Discounts'}</span>
                <span className="font-semibold text-amber-600"><Money value={vatTotals?.totalDiscount || 0} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{language === 'ar' ? 'ضريبة القيمة' : 'VAT'}</span>
                <span className="font-semibold text-primary-600"><Money value={vatTotals?.totalTax || 0} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{language === 'ar' ? 'الإجمالي' : 'Grand Total'}</span>
                <span className="font-semibold"><Money value={vatTotals?.grandTotal || 0} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
                <p className="text-xs text-gray-500">
                  {language === 'ar'
                    ? 'يعتمد هذا الملخص على تقرير إقرار ضريبة القيمة المضافة.'
                    : 'This snapshot is based on the VAT return report.'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {language === 'ar' ? 'تفاصيل الأشهر' : 'Monthly Breakdown'}
        </h3>

        <ResponsiveDataList
          items={[...chartData].reverse()}
          empty={
            <p className="text-center text-gray-500 py-8 text-sm">{t('noData')}</p>
          }
          renderCard={(row) => (
            <div key={row.key} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-white">{row.label}</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</span>
                <Money value={row.revenue} minimumFractionDigits={0} maximumFractionDigits={0} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
                <Money value={row.expenses} minimumFractionDigits={0} maximumFractionDigits={0} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'الربح' : 'Profit'}</span>
                <span className={row.profit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                  <Money value={row.profit} minimumFractionDigits={0} maximumFractionDigits={0} />
                </span>
              </div>
            </div>
          )}
        >
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'الشهر' : 'Month'}</th>
                  <th>{language === 'ar' ? 'الإيرادات' : 'Revenue'}</th>
                  <th>{language === 'ar' ? 'المصروفات' : 'Expenses'}</th>
                  <th>{language === 'ar' ? 'الربح' : 'Profit'}</th>
                </tr>
              </thead>
              <tbody>
                {chartData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-500 py-8">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  [...chartData].reverse().map((row) => (
                    <tr key={row.key}>
                      <td className="font-medium">{row.label}</td>
                      <td><Money value={row.revenue} minimumFractionDigits={0} maximumFractionDigits={0} /></td>
                      <td><Money value={row.expenses} minimumFractionDigits={0} maximumFractionDigits={0} /></td>
                      <td className={row.profit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                        <Money value={row.profit} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ResponsiveDataList>
      </motion.div>
    </div>
  )
}
