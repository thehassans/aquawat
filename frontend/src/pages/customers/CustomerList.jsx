import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Filter,
  Download
} from 'lucide-react'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { getTenantBusinessTypes } from '../../lib/businessTypes'

export default function CustomerList() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const hasKhayyat = tenantBusinessTypes.includes('khayyat')
  
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, type: typeFilter, page }],
    queryFn: () => api.get('/customers', { 
      params: { search, type: typeFilter, page, limit: 20 } 
    }).then(res => res.data)
  })

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => api.get('/customers/stats').then(res => res.data)
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customer-stats'])
    }
  })

  const handleDelete = (id, name) => {
    if (window.confirm(language === 'ar' ? `هل أنت متأكد من حذف ${name}؟` : `Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id)
    }
  }

  const exportColumns = [
    {
      key: 'customerCode',
      label: language === 'ar' ? 'رقم العميل' : 'Customer ID',
      value: (r) => r?.customerCode || ''
    },
    {
      key: 'name',
      label: language === 'ar' ? 'العميل' : 'Customer',
      value: (r) => (language === 'ar' ? r?.nameAr || r?.name : r?.name || r?.nameAr) || ''
    },
    {
      key: 'type',
      label: language === 'ar' ? 'النوع' : 'Type',
      value: (r) => r?.type || ''
    },
    {
      key: 'email',
      label: language === 'ar' ? 'البريد' : 'Email',
      value: (r) => r?.email || ''
    },
    {
      key: 'phone',
      label: language === 'ar' ? 'الهاتف' : 'Phone',
      value: (r) => r?.phone || ''
    },
    {
      key: 'vatNumber',
      label: language === 'ar' ? 'الرقم الضريبي' : 'VAT Number',
      value: (r) => r?.vatNumber || r?.taxNumber || ''
    },
    {
      key: 'totalInvoices',
      label: language === 'ar' ? 'الفواتير' : 'Invoices',
      value: (r) => r?.totalInvoices ?? ''
    },
    {
      key: 'totalRevenue',
      label: language === 'ar' ? 'الإيرادات' : 'Revenue',
      value: (r) => r?.totalRevenue ?? ''
    },
    {
      key: 'status',
      label: language === 'ar' ? 'الحالة' : 'Status',
      value: (r) => (r?.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive'))
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/customers', {
        params: { search, type: typeFilter, page: currentPage, limit }
      })
      const batch = res.data?.customers || []
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'العملاء' : 'Customers'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة عملائك وبياناتهم' : 'Manage your customers and their data'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={data?.customers || []}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'العملاء' : 'Customers'}
            title={language === 'ar' ? 'العملاء' : 'Customers'}
            disabled={isLoading || (data?.customers || []).length === 0}
          />
          <Link
            to="/customers/new"
            className="btn btn-action-dark"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'عميل جديد' : 'New Customer'}
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.total || 0}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar' ? 'شركات' : 'Businesses'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.byType?.find(t => t._id === 'business')?.count || 0}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar' ? 'أفراد' : 'Individuals'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.byType?.find(t => t._id === 'individual')?.count || 0}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar' ? 'نشط' : 'Active'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.active || 0}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ar' ? 'بحث بالاسم أو البريد أو الرقم الضريبي...' : 'Search by name, email, or VAT number...'}
              className="w-full ps-10 pe-4 py-2.5 bg-gray-100 dark:bg-dark-700 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-100 dark:bg-dark-700 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{language === 'ar' ? 'جميع الأنواع' : 'All Types'}</option>
            <option value="business">{language === 'ar' ? 'شركة' : 'Business'}</option>
            <option value="individual">{language === 'ar' ? 'فرد' : 'Individual'}</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : data?.customers?.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {language === 'ar' ? 'لا يوجد عملاء' : 'No customers found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {language === 'ar' ? 'ابدأ بإضافة أول عميل' : 'Start by adding your first customer'}
            </p>
            <Link to="/customers/new" className="btn btn-primary">
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة عميل' : 'Add Customer'}
            </Link>
          </div>
        ) : (
          <>
            <ResponsiveDataList
              items={data?.customers || []}
              className="p-4 md:p-0"
              renderCard={(customer) => (
                <div key={customer._id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                        customer.type === 'business'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        {customer.type === 'business'
                          ? <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          : <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {language === 'ar' && customer.nameAr ? customer.nameAr : customer.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {customer.customerCode ? `#${customer.customerCode}` : ''}
                          {customer.phone ? `${customer.customerCode ? ' · ' : ''}${customer.phone}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${customer.type === 'business' ? 'badge-primary' : 'badge-success'}`}>
                      {customer.type === 'business'
                        ? (language === 'ar' ? 'شركة' : 'Business')
                        : (language === 'ar' ? 'فرد' : 'Individual')
                      }
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span className="truncate">
                      {hasKhayyat
                        ? `${language === 'ar' ? 'متبقي' : 'Pending'}: `
                        : `${language === 'ar' ? 'فواتير' : 'Invoices'}: ${customer.totalInvoices || 0}`}
                      {hasKhayyat && (
                        <Money value={customer.khayyatPendingAmount || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                      )}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/customers/${customer._id}`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </Link>
                      <Link to={`/customers/${customer._id}/edit`} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(customer._id, customer.name)}
                        className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-700">
                    <tr>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {language === 'ar' ? 'العميل' : 'Customer'}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {language === 'ar' ? 'النوع' : 'Type'}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {language === 'ar' ? 'الاتصال' : 'Contact'}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}
                      </th>
                      {hasKhayyat ? (
                        <>
                          <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {language === 'ar' ? 'الثياب' : 'Thawbs'}
                          </th>
                          <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {language === 'ar' ? 'المدفوع' : 'Paid'}
                          </th>
                          <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {language === 'ar' ? 'المتبقي' : 'Pending'}
                          </th>
                        </>
                      ) : (
                        <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {language === 'ar' ? 'الفواتير' : 'Invoices'}
                        </th>
                      )}
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {language === 'ar' ? 'الإجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                    {data?.customers?.map((customer) => (
                      <tr key={customer._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              customer.type === 'business' 
                                ? 'bg-blue-100 dark:bg-blue-900/30' 
                                : 'bg-green-100 dark:bg-green-900/30'
                            }`}>
                              {customer.type === 'business' 
                                ? <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                : <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                              }
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {language === 'ar' && customer.nameAr ? customer.nameAr : customer.name}
                                </p>
                                {customer.customerCode && (
                                  <span className="text-xs font-mono bg-gray-100 dark:bg-dark-600 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">
                                    #{customer.customerCode}
                                  </span>
                                )}
                              </div>
                              {customer.address?.city && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {customer.address.city}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${customer.type === 'business' ? 'badge-primary' : 'badge-success'}`}>
                            {customer.type === 'business' 
                              ? (language === 'ar' ? 'شركة' : 'Business') 
                              : (language === 'ar' ? 'فرد' : 'Individual')
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Mail className="w-4 h-4" />
                                {customer.email}
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {customer.vatNumber || customer.taxNumber || '-'}
                          </span>
                        </td>
                        {hasKhayyat ? (
                          <>
                            <td className="px-6 py-4">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {customer.totalThawb || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                <Money value={customer.khayyatPaidAmount || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                <Money value={customer.khayyatPendingAmount || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {customer.totalInvoices || 0}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                <Money value={customer.totalRevenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                              </p>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Menu as="div" className="relative">
                            <Menu.Button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors">
                              <MoreVertical className="w-4 h-4 text-gray-500" />
                            </Menu.Button>
                            <Transition
                              as={Fragment}
                              enter="transition ease-out duration-100"
                              enterFrom="transform opacity-0 scale-95"
                              enterTo="transform opacity-100 scale-100"
                              leave="transition ease-in duration-75"
                              leaveFrom="transform opacity-100 scale-100"
                              leaveTo="transform opacity-0 scale-95"
                            >
                              <Menu.Items className="absolute end-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-10">
                                <div className="p-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        to={`/customers/${customer._id}`}
                                        className={`${active ? 'bg-gray-100 dark:bg-dark-700' : ''} flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg`}
                                      >
                                        <Eye className="w-4 h-4" />
                                        {language === 'ar' ? 'عرض' : 'View'}
                                      </Link>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        to={`/customers/${customer._id}/edit`}
                                        className={`${active ? 'bg-gray-100 dark:bg-dark-700' : ''} flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg`}
                                      >
                                        <Edit className="w-4 h-4" />
                                        {language === 'ar' ? 'تعديل' : 'Edit'}
                                      </Link>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDelete(customer._id, customer.name)}
                                        className={`${active ? 'bg-red-50 dark:bg-red-900/20' : ''} flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg w-full`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        {language === 'ar' ? 'حذف' : 'Delete'}
                                      </button>
                                    )}
                                  </Menu.Item>
                                </div>
                              </Menu.Items>
                            </Transition>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ResponsiveDataList>

            {/* Pagination */}
            {data?.pagination?.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'ar' 
                    ? `عرض ${(page - 1) * 20 + 1} - ${Math.min(page * 20, data.pagination.total)} من ${data.pagination.total}` 
                    : `Showing ${(page - 1) * 20 + 1} - ${Math.min(page * 20, data.pagination.total)} of ${data.pagination.total}`
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    {language === 'ar' ? 'السابق' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={page === data.pagination.pages}
                    className="btn btn-secondary btn-sm"
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
