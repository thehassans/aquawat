import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Receipt, Edit, FileText } from 'lucide-react'
import api from '../lib/api'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import ExportMenu from '../components/ui/ExportMenu'

const statusMeta = {
  draft: { badge: 'badge-neutral', en: 'Draft', ar: 'مسودة' },
  pending_approval: { badge: 'badge-warning', en: 'Pending Approval', ar: 'بانتظار الموافقة' },
  approved: { badge: 'badge-info', en: 'Approved', ar: 'معتمد' },
  paid: { badge: 'badge-success', en: 'Paid', ar: 'مدفوع' },
  cancelled: { badge: 'badge-danger', en: 'Cancelled', ar: 'ملغي' },
}

const formatDate = (value, language) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
}

const getPayeeLabel = (expense, language) => {
  if (expense?.supplierId) return language === 'ar' ? expense.supplierId.nameAr || expense.supplierId.nameEn : expense.supplierId.nameEn
  if (expense?.employeeId) {
    const en = `${expense.employeeId.firstNameEn || ''} ${expense.employeeId.lastNameEn || ''}`.trim()
    const ar = `${expense.employeeId.firstNameAr || ''} ${expense.employeeId.lastNameAr || ''}`.trim()
    return language === 'ar' ? ar || en : en || ar
  }
  if (expense?.customerId) return language === 'ar' ? expense.customerId.nameAr || expense.customerId.name : expense.customerId.name
  return expense?.payeeName || '-'
}

export default function Expenses() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const location = useLocation()
  const projectIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return String(params.get('projectId') || '').trim()
  }, [location.search])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, projectIdFromQuery])

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', { search: debouncedSearch, status, page, projectId: projectIdFromQuery }],
    queryFn: () =>
      api
        .get('/expenses', {
          params: {
            search: debouncedSearch || undefined,
            status,
            ...(projectIdFromQuery ? { projectId: projectIdFromQuery } : {}),
            page,
            limit: 25,
          },
        })
        .then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['expenses-stats', { projectId: projectIdFromQuery }],
    queryFn: () => api.get('/expenses/stats', { params: projectIdFromQuery ? { projectId: projectIdFromQuery } : {} }).then((res) => res.data),
  })

  const expenses = data?.expenses || []
  const pagination = data?.pagination

  const totals = stats?.totals || { total: 0, paidTotal: 0, approvedTotal: 0 }

  const pendingCount = useMemo(
    () => (stats?.byStatus || []).find((s) => s._id === 'pending_approval')?.count || 0,
    [stats]
  )

  const exportColumns = [
    {
      key: 'expenseNumber',
      label: language === 'ar' ? 'الرقم' : 'Number',
      value: (r) => r?.expenseNumber || ''
    },
    {
      key: 'expenseDate',
      label: t('date'),
      value: (r) => formatDate(r?.expenseDate, language)
    },
    {
      key: 'payee',
      label: language === 'ar' ? 'الجهة' : 'Payee',
      value: (r) => getPayeeLabel(r, language)
    },
    {
      key: 'category',
      label: language === 'ar' ? 'الفئة' : 'Category',
      value: (r) => (language === 'ar' ? r?.categoryAr || r?.category : r?.category) || ''
    },
    {
      key: 'amount',
      label: t('amount'),
      value: (r) => r?.totalAmount ?? (Number(r?.amount || 0) + Number(r?.taxAmount || 0))
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => {
        const meta = statusMeta[r?.status] || statusMeta.draft
        return language === 'ar' ? meta.ar : meta.en
      }
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/expenses', {
        params: { search, status, ...(projectIdFromQuery ? { projectId: projectIdFromQuery } : {}), page: currentPage, limit }
      })
      const batch = res.data?.expenses || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'المصروفات' : 'Expenses'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة مصروفات الشركة والموافقات والدفع' : 'Manage company expenses, approvals, and payments'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={expenses}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'المصروفات' : 'Expenses'}
            title={language === 'ar' ? 'المصروفات' : 'Expenses'}
            disabled={isLoading || expenses.length === 0}
          />
          <Link to="/app/dashboard/expenses/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة مصروف' : 'Add Expense'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Receipt className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
            <p className="text-2xl font-bold">{(totals.total || 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'مدفوع (إجمالي)' : 'Paid (Total)'} </p>
            <p className="text-2xl font-bold text-emerald-600">
              <Money value={totals.paidTotal || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Receipt className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval'}</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم المصروف أو الوصف أو المرجع...' : 'Search by number, description, or reference...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input ps-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="select w-full sm:w-56"
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
            {Object.entries(statusMeta).map(([key, meta]) => (
              <option key={key} value={key}>
                {language === 'ar' ? meta.ar : meta.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{language === 'ar' ? 'لا توجد مصروفات' : 'No expenses found'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'الرقم' : 'Number'}</th>
                  <th>{t('date')}</th>
                  <th>{language === 'ar' ? 'الجهة' : 'Payee'}</th>
                  <th>{language === 'ar' ? 'الفئة' : 'Category'}</th>
                  <th>{t('amount')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const meta = statusMeta[e.status] || statusMeta.draft
                  const category = language === 'ar' ? e.categoryAr || e.category : e.category

                  return (
                    <tr key={e._id}>
                      <td className="font-mono text-sm">{e.expenseNumber}</td>
                      <td>{formatDate(e.expenseDate, language)}</td>
                      <td className="font-medium text-gray-900 dark:text-white">{getPayeeLabel(e, language)}</td>
                      <td>{category || '-'}</td>
                      <td>
                        <Money value={e.totalAmount ?? (Number(e.amount || 0) + Number(e.taxAmount || 0))} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </td>
                      <td>
                        <span className={`badge ${meta.badge}`}>{language === 'ar' ? meta.ar : meta.en}</span>
                      </td>
                      <td>
                        <Link to={`/app/dashboard/expenses/${e._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg inline-flex">
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
