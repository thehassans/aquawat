import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Users, AlertTriangle, Eye, Edit } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import ExportMenu from '../../components/ui/ExportMenu'
import EmployeeContactCards from '../../components/ui/EmployeeContactCards'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'

export default function Employees() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', nationality: '' })
  const [page, setPage] = useState(1)

  const exportColumns = [
    {
      key: 'employeeId',
      label: t('employeeId'),
      value: (r) => r?.employeeId || ''
    },
    {
      key: 'name',
      label: language === 'ar' ? 'الاسم' : 'Name',
      value: (r) => (language === 'ar'
        ? `${r?.firstNameAr || r?.firstNameEn || ''} ${r?.lastNameAr || r?.lastNameEn || ''}`.trim()
        : `${r?.firstNameEn || ''} ${r?.lastNameEn || ''}`.trim())
    },
    {
      key: 'email',
      label: t('email'),
      value: (r) => r?.email || ''
    },
    {
      key: 'department',
      label: t('department'),
      value: (r) => r?.department || ''
    },
    {
      key: 'nationality',
      label: t('nationality'),
      value: (r) => r?.nationality || ''
    },
    {
      key: 'joinDate',
      label: t('joinDate'),
      value: (r) => (r?.joinDate ? new Date(r.joinDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '')
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => r?.status || ''
    },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, filters],
    queryFn: () => api.get('/employees', { params: { page, search, ...filters } }).then(res => res.data)
  })

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/employees', {
        params: { page: currentPage, limit, search, ...filters }
      })
      const batch = res.data?.employees || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data: stats } = useQuery({
    queryKey: ['employees-stats'],
    queryFn: () => api.get('/employees/stats').then(res => res.data)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('employees')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة بيانات الموظفين والوثائق' : 'Manage employee data and documents'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={data?.employees || []}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'الموظفين' : 'Employees'}
            title={language === 'ar' ? 'الموظفين' : 'Employees'}
            disabled={isLoading || (data?.employees || []).length === 0}
          />
          <Link to="/employees/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Users className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('activeEmployees')}</p>
            <p className="text-2xl font-bold">{stats?.totalEmployees?.[0]?.count || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'سعودي' : 'Saudi'}</p>
            <p className="text-2xl font-bold">
              {stats?.byNationality?.find(n => n._id?.toLowerCase() === 'saudi')?.count || 0}
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'غير سعودي' : 'Non-Saudi'}</p>
            <p className="text-2xl font-bold">
              {stats?.byNationality?.filter(n => n._id?.toLowerCase() !== 'saudi').reduce((sum, n) => sum + n.count, 0) || 0}
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'وثائق تنتهي' : 'Expiring Docs'}</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.expiringDocuments?.[0]?.count || 0}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`${t('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input ps-10"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="select w-full sm:w-40"
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="on_leave">{language === 'ar' ? 'في إجازة' : 'On Leave'}</option>
            <option value="terminated">{language === 'ar' ? 'منتهي' : 'Terminated'}</option>
          </select>
          <select
            value={filters.nationality}
            onChange={(e) => setFilters({ ...filters, nationality: e.target.value })}
            className="select w-full sm:w-40"
          >
            <option value="">{language === 'ar' ? 'كل الجنسيات' : 'All Nationalities'}</option>
            <option value="Saudi">{language === 'ar' ? 'سعودي' : 'Saudi'}</option>
            <option value="Non-Saudi">{language === 'ar' ? 'غير سعودي' : 'Non-Saudi'}</option>
          </select>
        </div>
      </div>

      {!isLoading && (data?.employees || []).length > 0 && (
        <EmployeeContactCards employees={data.employees.slice(0, 3)} language={language} />
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveDataList
            items={data?.employees || []}
            empty={<p className="p-6 text-center text-sm text-gray-500">{language === 'ar' ? 'لا يوجد موظفون' : 'No employees'}</p>}
            renderCard={(emp) => (
              <div key={emp._id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {emp.firstNameEn?.[0]}{emp.lastNameEn?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {language === 'ar' ? `${emp.firstNameAr || emp.firstNameEn} ${emp.lastNameAr || emp.lastNameEn}` : `${emp.firstNameEn} ${emp.lastNameEn}`}
                      </p>
                      <p className="text-xs text-gray-500">{emp.employeeId} · {emp.department || '-'}</p>
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${
                    emp.status === 'active' ? 'badge-success' :
                    emp.status === 'on_leave' ? 'badge-warning' :
                    'badge-danger'
                  }`}>
                    {emp.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{emp.nationality || '-'}</span>
                  <div className="flex gap-1">
                    <Link to={`/employees/${emp._id}`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                      <Eye className="w-4 h-4 text-gray-600" />
                    </Link>
                    <Link to={`/employees/${emp._id}`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          >
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('employeeId')}</th>
                    <th>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th>{t('department')}</th>
                    <th>{t('nationality')}</th>
                    <th>{t('joinDate')}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.employees?.map((emp) => (
                    <tr key={emp._id}>
                      <td className="font-medium">{emp.employeeId}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {emp.firstNameEn?.[0]}{emp.lastNameEn?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {language === 'ar' ? `${emp.firstNameAr || emp.firstNameEn} ${emp.lastNameAr || emp.lastNameEn}` : `${emp.firstNameEn} ${emp.lastNameEn}`}
                            </p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{emp.department || '-'}</td>
                      <td>{emp.nationality}</td>
                      <td>{new Date(emp.joinDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${
                          emp.status === 'active' ? 'badge-success' :
                          emp.status === 'on_leave' ? 'badge-warning' :
                          'badge-danger'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link to={`/employees/${emp._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Link>
                          <Link to={`/employees/${emp._id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        )}
      </motion.div>
    </div>
  )
}
