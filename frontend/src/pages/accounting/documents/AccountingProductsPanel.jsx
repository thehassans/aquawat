import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ExternalLink } from 'lucide-react'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
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

/**
 * Accounting-context product catalog — stays inside Accounting nav with income/tax columns.
 */
export default function AccountingProductsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-products-catalog', search],
    queryFn: () => api.get('/products', {
      params: {
        limit: 100,
        search: search.trim() || undefined,
        status: 'active',
      },
    }).then((r) => r.data),
  })

  const rows = data?.products || data?.items || (Array.isArray(data) ? data : [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'العملاء' : 'Customers'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'المنتجات (محاسبة)' : 'Products (accounting)'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr
              ? 'سعر البيع وحساب الدخل والضرائب الافتراضية — داخل مساحة المحاسبة'
              : 'Sale price, default income account, and customer taxes — inside Accounting'}
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

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد منتجات' : 'No products yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <p className="font-semibold text-slate-900 dark:text-white">{isAr ? (row.nameAr || row.name) : row.name}</p>
                <p className="text-xs text-slate-400">{row.sku || row.productId || '—'}</p>
                <Money value={row.sellingPrice ?? row.salePrice ?? row.unitPrice} />
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className={`${salesTableClass} min-w-[960px]`}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{isAr ? 'المنتج' : 'Product'}</th>
                    <th className={salesThClass}>SKU</th>
                    <th className={salesThClass}>{isAr ? 'سعر البيع' : 'Sale price'}</th>
                    <th className={salesThClass}>{isAr ? 'حساب الدخل' : 'Income account'}</th>
                    <th className={salesThClass}>{isAr ? 'ضريبة العميل' : 'Customer tax'}</th>
                    <th className={salesThClass}>{isAr ? 'النوع' : 'Type'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id} className={salesTrClass}>
                      <td className={salesTdClass}>
                        <Link
                          to={`/app/dashboard/inventory/products/${row._id}`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {isAr ? (row.nameAr || row.name) : row.name}
                        </Link>
                        {row.nameAr && !isAr ? (
                          <p className="text-xs text-slate-400">{row.nameAr}</p>
                        ) : null}
                      </td>
                      <td className={salesTdClass}>{row.sku || row.productId || '—'}</td>
                      <td className={salesTdClass}>
                        <Money value={row.sellingPrice ?? row.salePrice ?? row.unitPrice} />
                      </td>
                      <td className={salesTdClass}>
                        {row.incomeAccountCode || row.incomeAccount?.code
                          ? `${row.incomeAccountCode || row.incomeAccount?.code}${row.incomeAccount?.name ? ` — ${row.incomeAccount.name}` : ''}`
                          : '—'}
                      </td>
                      <td className={salesTdClass}>
                        {row.saleTaxName || row.customerTax?.name || row.taxRate != null
                          ? (row.saleTaxName || row.customerTax?.name || `${row.taxRate}%`)
                          : '—'}
                      </td>
                      <td className={salesTdClass}>
                        <span className={softChipClass}>{row.productType || 'goods'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        )}
      </div>
    </div>
  )
}
