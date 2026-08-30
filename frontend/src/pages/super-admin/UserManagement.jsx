import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, User, X, Save, Shield, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import SuperAdminPortal, { SA_BACKDROP_Z, SA_MODAL_Z } from '../../components/super-admin/SuperAdminPortal'

export default function UserManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ role: '' })
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  const { register, handleSubmit, reset } = useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, filters],
    queryFn: () => api.get('/super-admin/users', { params: { page, limit: 20, search, ...filters } }).then(res => res.data)
  })

  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => api.get('/super-admin/tenants', { params: { limit: 100 } }).then(res => res.data.tenants)
  })

  const mutation = useMutation({
    mutationFn: (data) => editingUser ? api.put(`/super-admin/users/${editingUser._id}`, data) : api.post('/super-admin/users', data),
    onSuccess: () => {
      toast.success(editingUser ? (language === 'ar' ? 'تم تحديث المستخدم' : 'User updated') : (language === 'ar' ? 'تم إنشاء المستخدم' : 'User created'))
      queryClient.invalidateQueries(['admin-users'])
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error')
  })

  const openModal = (user = null) => {
    setEditingUser(user)
    if (user) reset(user)
    else reset({})
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    reset({})
  }

  const roles = ['admin', 'manager', 'accountant', 'hr_manager', 'inventory_manager', 'sales', 'kitchen_staff', 'viewer']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users')}</h1>
          <p className="text-gray-500 mt-1">{language === 'ar' ? 'إدارة جميع المستخدمين' : 'Manage all users'}</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder={`${t('search')}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="input ps-10" />
          </div>
          <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className="select w-full sm:w-40">
            <option value="">{language === 'ar' ? 'كل الأدوار' : 'All Roles'}</option>
            {roles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{language === 'ar' ? 'المستخدم' : 'User'}</th>
                    <th>{language === 'ar' ? 'المستأجر' : 'Tenant'}</th>
                    <th>{language === 'ar' ? 'الدور' : 'Role'}</th>
                    <th>{language === 'ar' ? 'آخر دخول' : 'Last Login'}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users?.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            user.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-primary-500 to-primary-600'
                          }`}>
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {user.tenantId ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{user.tenantId.name || user.tenantId.slug}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          user.role === 'super_admin' ? 'bg-amber-100 text-amber-700' :
                          user.role === 'admin' ? 'badge-info' :
                          'badge-neutral'
                        }`}>
                          <Shield className="w-3 h-3 me-1" />
                          {user.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-'}
                      </td>
                      <td>
                        <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {user.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => openModal(user)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                          <User className="w-4 h-4 text-gray-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.pagination && (
              <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {language === 'ar' ? `عرض ${data.users.length} من ${data.pagination.total}` : `Showing ${data.users.length} of ${data.pagination.total}`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary">{language === 'ar' ? 'السابق' : 'Previous'}</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages} className="btn btn-secondary">{language === 'ar' ? 'التالي' : 'Next'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Modal */}
      <SuperAdminPortal>
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className={`fixed inset-0 bg-black/50 ${SA_BACKDROP_Z}`} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white dark:bg-dark-800 rounded-2xl shadow-xl ${SA_MODAL_Z} overflow-hidden`}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
                <h3 className="text-lg font-semibold">{editingUser ? (language === 'ar' ? 'تعديل مستخدم' : 'Edit User') : (language === 'ar' ? 'إضافة مستخدم' : 'Add User')}</h3>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('firstName')} *</label>
                    <input {...register('firstName', { required: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">{t('lastName')} *</label>
                    <input {...register('lastName', { required: true })} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">{t('email')} *</label>
                  <input type="email" {...register('email', { required: true })} className="input" />
                </div>
                {!editingUser && (
                  <div>
                    <label className="label">{t('password')} *</label>
                    <input type="password" {...register('password', { required: !editingUser })} className="input" />
                  </div>
                )}
                <div>
                  <label className="label">{language === 'ar' ? 'المستأجر' : 'Tenant'}</label>
                  <select {...register('tenantId')} className="select">
                    <option value="">{language === 'ar' ? 'بدون مستأجر (Super Admin)' : 'No Tenant (Super Admin)'}</option>
                    {tenants?.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الدور' : 'Role'}</label>
                  <select {...register('role')} className="select">
                    <option value="super_admin">Super Admin</option>
                    {roles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" {...register('isActive')} defaultChecked className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                  <label className="text-sm">{language === 'ar' ? 'مستخدم نشط' : 'Active User'}</label>
                </div>
              </form>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
                <button type="button" onClick={closeModal} className="btn btn-secondary">{t('cancel')}</button>
                <button onClick={handleSubmit((data) => mutation.mutate(data))} disabled={mutation.isPending} className="btn btn-primary">
                  {mutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </SuperAdminPortal>
    </div>
  )
}
