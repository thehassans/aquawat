import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ExternalLink, AlertTriangle, CheckSquare, Square } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { useAccountingQuery } from '../../../hooks/useAccountingQuery'
import AccountingQueryState from '../AccountingQueryState'
import {
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  softChipClass,
} from '../../sales/salesUi'

const typeLabel = (type, isAr) => {
  const t = String(type || 'goods').toLowerCase()
  if (t === 'service') return isAr ? 'خدمة' : 'Service'
  return isAr ? 'بضاعة' : 'Goods'
}

const acctLabel = (row, kind) => {
  const populated = kind === 'income'
    ? (row.incomeAccount || row.incomeAccountId)
    : kind === 'cogs'
      ? (row.expenseAccount || row.expenseAccountId || row.cogsAccount)
      : null
  if (populated && typeof populated === 'object') {
    const code = populated.code || ''
    const name = populated.name || populated.nameAr || ''
    if (code || name) return code ? `${code}${name ? ` — ${name}` : ''}` : name
  }
  if (kind === 'income' && row.incomeAccountCode) return row.incomeAccountCode
  return null
}

const taxLabel = (row) => {
  if (row.saleTaxId && typeof row.saleTaxId === 'object') {
    const t = row.saleTaxId
    return `${t.code || t.name || ''}${t.rate != null ? ` (${t.rate}%)` : ''}`.trim() || null
  }
  if (row.taxCategory && row.taxCategory !== 'S') {
    return `${row.taxCategory}${row.saleTaxRate != null ? ` · ${row.saleTaxRate}%` : ''}`
  }
  if (row.saleTaxRate != null) return `${row.saleTaxRate}%`
  if (row.taxRate != null) return `${row.taxRate}%`
  return null
}

/**
 * Accounting-context product catalog — income/COGS/tax columns + bulk fix.
 */
export default function AccountingProductsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkIncome, setBulkIncome] = useState('')
  const [bulkCogs, setBulkCogs] = useState('')

  const { data, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-products-catalog', search],
    queryFn: () => api.get('/products', {
      params: {
        limit: 100,
        search: search.trim() || undefined,
        status: 'active',
      },
    }).then((r) => r.data),
  })

  const { data: gaps } = useQuery({
    queryKey: ['accounting-products-gaps'],
    queryFn: () => api.get('/products/accounting-gaps').then((r) => r.data),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts-for-products'],
    queryFn: () => api.get('/accounting/accounts').then((r) => (Array.isArray(r.data) ? r.data : r.data?.accounts || [])),
  })

  const rows = data?.products || data?.items || (Array.isArray(data) ? data : [])

  const missingCount = useMemo(() => {
    if (gaps?.wouldUpdate != null) return Number(gaps.wouldUpdate) || 0
    return rows.filter((r) => !acctLabel(r, 'income') || !acctLabel(r, 'cogs')).length
  }, [gaps, rows])

  const fixAll = useMutation({
    mutationFn: () => api.post('/products/bulk-accounts', {
      productIds: rows.map((r) => r._id),
      rewriteTimestampSkus: true,
    }).then((r) => r.data),
    onSuccess: (report) => {
      toast.success(isAr
        ? `تم تحديث ${report.updated ?? report.modified ?? 0} منتج`
        : `Updated ${report.updated ?? report.modified ?? 0} products`)
      queryClient.invalidateQueries({ queryKey: ['accounting-products-catalog'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-products-gaps'] })
      setSelected(new Set())
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || e.message),
  })

  const bulkApply = useMutation({
    mutationFn: () => api.post('/products/bulk-accounts', {
      productIds: [...selected],
      incomeAccountId: bulkIncome || undefined,
      expenseAccountId: bulkCogs || undefined,
    }).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم التعيين الجماعي' : 'Bulk accounts applied')
      queryClient.invalidateQueries({ queryKey: ['accounting-products-catalog'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-products-gaps'] })
      setSelected(new Set())
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || e.message),
  })

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => String(r._id))))
  }

  const marginPct = (row) => {
    const sale = Number(row.sellingPrice ?? row.salePrice ?? row.unitPrice)
    const cost = Number(row.costPrice)
    if (!Number.isFinite(sale) || sale <= 0 || !Number.isFinite(cost)) return null
    return ((sale - cost) / sale) * 100
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'المنتجات' : 'Products'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'المنتجات (محاسبة)' : 'Products (accounting)'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr
              ? 'سعر التكلفة والبيع، حساب الدخل وتكلفة البضاعة، والضريبة'
              : 'Cost & sale price, income / COGS accounts, and customer tax'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/app/dashboard/inventory/products')}
          >
            <ExternalLink className="h-4 w-4" />
            {isAr ? 'فتح المخزون' : 'Open inventory'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/app/dashboard/inventory/products/new')}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'منتج جديد' : 'New product'}
          </button>
        </div>
      </div>

      {missingCount > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isAr
                ? `${missingCount} منتج بلا حساب دخل أو تكلفة بضاعة — المبيعات قد تُرحَّل لحساب افتراضي خاطئ.`
                : `${missingCount} products missing income/COGS accounts — sales may post to the wrong default.`}
            </span>
          </p>
          <button
            type="button"
            className="rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
            disabled={fixAll.isPending || !rows.length}
            onClick={() => fixAll.mutate()}
          >
            {fixAll.isPending ? '…' : (isAr ? 'إصلاح الكل' : 'Fix all')}
          </button>
        </div>
      ) : null}

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم / SKU…' : 'Search name / SKU…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-dark-600 dark:bg-dark-800">
          <p className="w-full text-xs font-semibold text-slate-500">
            {isAr ? `تعيين جماعي (${selected.size})` : `Bulk assign (${selected.size})`}
          </p>
          <label className="min-w-[180px] flex-1 text-[11px] text-slate-500">
            {isAr ? 'حساب الدخل' : 'Income'}
            <select value={bulkIncome} onChange={(e) => setBulkIncome(e.target.value)} className={`${fieldControlClass} mt-1`}>
              <option value="">{isAr ? '— لا تغيير —' : '— No change —'}</option>
              {accounts.filter((a) => /income|revenue|sales/i.test(`${a.type || ''} ${a.code || ''} ${a.name || ''}`) || String(a.code || '').startsWith('4')).map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[180px] flex-1 text-[11px] text-slate-500">
            {isAr ? 'تكلفة البضاعة' : 'COGS'}
            <select value={bulkCogs} onChange={(e) => setBulkCogs(e.target.value)} className={`${fieldControlClass} mt-1`}>
              <option value="">{isAr ? '— لا تغيير —' : '— No change —'}</option>
              {accounts.filter((a) => /expense|cogs|cost/i.test(`${a.type || ''} ${a.subtype || ''} ${a.code || ''} ${a.name || ''}`) || String(a.code || '').startsWith('5')).map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={bulkApply.isPending || (!bulkIncome && !bulkCogs)}
            onClick={() => bulkApply.mutate()}
          >
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        </div>
      ) : null}

      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={6}
      >
        <div className={listShellClass}>
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد منتجات' : 'No products yet'}</p>}
            renderCard={(row) => {
              const income = acctLabel(row, 'income')
              const cogs = acctLabel(row, 'cogs')
              const missing = !income || (!cogs && String(row.productType || 'goods') !== 'service')
              return (
                <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/app/dashboard/inventory/products/${row._id}`} className="font-semibold text-emerald-700">
                      {isAr ? (row.nameAr || row.nameEn || row.name) : (row.nameEn || row.name)}
                    </Link>
                    {missing ? (
                      <span className={`${softChipClass} !border-rose-200 !text-rose-700`}>
                        <AlertTriangle className="h-3 w-3" /> {isAr ? 'ناقص' : 'Missing'}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">{row.sku || '—'}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={softChipClass}>{typeLabel(row.productType, isAr)}</span>
                    <span className={softChipClass}><Money value={row.sellingPrice ?? row.salePrice} /></span>
                  </div>
                </div>
              )
            }}
          >
            <div className="overflow-x-auto">
              <table className={`${salesTableClass} min-w-[1100px]`}>
                <thead>
                  <tr>
                    <th className={salesThClass}>
                      <button type="button" onClick={toggleAll} className="inline-flex items-center gap-1">
                        {selected.size && selected.size === rows.length
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className={salesThClass}>{isAr ? 'المنتج' : 'Product'}</th>
                    <th className={salesThClass}>SKU</th>
                    <th className={salesThClass}>{isAr ? 'النوع' : 'Type'}</th>
                    <th className={salesThClass}>{isAr ? 'التكلفة' : 'Cost'}</th>
                    <th className={salesThClass}>{isAr ? 'سعر البيع' : 'Sale price'}</th>
                    <th className={salesThClass}>{isAr ? 'هامش %' : 'Margin %'}</th>
                    <th className={salesThClass}>{isAr ? 'حساب الدخل' : 'Income'}</th>
                    <th className={salesThClass}>{isAr ? 'تكلفة البضاعة' : 'COGS'}</th>
                    <th className={salesThClass}>{isAr ? 'الضريبة' : 'Tax'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = String(row._id)
                    const income = acctLabel(row, 'income')
                    const cogs = acctLabel(row, 'cogs')
                    const missing = !income || (String(row.productType || 'goods') !== 'service' && !cogs)
                    const m = marginPct(row)
                    return (
                      <tr key={row._id} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <button type="button" onClick={() => toggle(id)}>
                            {selected.has(id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className={salesTdClass}>
                          <Link
                            to={`/app/dashboard/inventory/products/${row._id}`}
                            className="font-semibold text-emerald-700 hover:underline"
                          >
                            {row.nameEn || row.name || '—'}
                          </Link>
                          {row.nameAr ? <p className="text-xs text-slate-400">{row.nameAr}</p> : null}
                          {missing ? (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                              <AlertTriangle className="h-3 w-3" />
                              {isAr ? 'حساب ناقص' : 'Accounts missing'}
                            </span>
                          ) : null}
                        </td>
                        <td className={salesTdClass}>{row.sku || '—'}</td>
                        <td className={salesTdClass}>
                          <span className={softChipClass}>{typeLabel(row.productType, isAr)}</span>
                        </td>
                        <td className={salesTdClass}><Money value={row.costPrice} /></td>
                        <td className={salesTdClass}>
                          <Money value={row.sellingPrice ?? row.salePrice ?? row.unitPrice} />
                        </td>
                        <td className={salesTdClass}>
                          {m == null ? '—' : `${m.toFixed(1)}%`}
                        </td>
                        <td className={salesTdClass}>{income || '—'}</td>
                        <td className={salesTdClass}>{cogs || '—'}</td>
                        <td className={salesTdClass}>{taxLabel(row) || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        </div>
      </AccountingQueryState>
    </div>
  )
}
