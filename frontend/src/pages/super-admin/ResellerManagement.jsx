import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Search, Edit, Trash2, Building2, Mail, Phone, Users, X, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import SuperAdminPortal, { SA_MODAL_Z } from '../../components/super-admin/SuperAdminPortal'
import { formatSubscriptionDate } from '../../lib/subscriptionState'
import { useTranslation } from '../../lib/translations'

export default function ResellerManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingReseller, setEditingReseller] = useState(null)
  const [viewTenants, setViewTenants] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', commissionRate: 0, notes: '', password: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['resellers', search],
    queryFn: () => api.get('/super-admin/resellers', { params: { search } }).then(res => res.data),
    staleTime: 60 * 1000,
  })

  const resellers = data?.resellers || []

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/super-admin/resellers', data).then(res => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إنشاء الموزع' : 'Reseller created')
      queryClient.invalidateQueries(['resellers'])
      setShowForm(false)
      resetForm()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/super-admin/resellers/${id}`, data).then(res => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الموزع' : 'Reseller updated')
      queryClient.invalidateQueries(['resellers'])
      setShowForm(false)
      resetForm()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/resellers/${id}`).then(res => res.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حذف الموزع' : 'Reseller deleted')
      queryClient.invalidateQueries(['resellers'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const tenantsQuery = useQuery({
    queryKey: ['reseller-tenants', viewTenants?._id],
    queryFn: () => api.get(`/super-admin/resellers/${viewTenants._id}`).then(res => res.data),
    enabled: !!viewTenants,
  })

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', company: '', commissionRate: 0, notes: '', password: '' })
    setEditingReseller(null)
  }

  const handleEdit = (reseller) => {
    setEditingReseller(reseller)
    setForm({
      name: reseller.name || '',
      email: reseller.email || '',
      phone: reseller.phone || '',
      company: reseller.company || '',
      commissionRate: reseller.commissionRate || 0,
      notes: reseller.notes || '',
      password: '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.email) {
      toast.error(language === 'ar' ? 'الاسم والبريد مطلوبان' : 'Name and email are required')
      return
    }
    if (editingReseller) {
      updateMutation.mutate({ id: editingReseller._id, data: { ...form, password: undefined } })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleDelete = (reseller) => {
    if (!window.confirm(language === 'ar'
      ? `هل أنت متأكد من حذف الموزع "${reseller.name}"؟ سيتم إلغاء ربط المستأجرين.`
      : `Are you sure you want to delete reseller "${reseller.name}"? Tenants will be unlinked.`))
      return
    deleteMutation.mutate(reseller._id)
  }

  const planColors = {
    trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    starter: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    professional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }

  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    expired: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    terminated: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'الموزعون' : 'Resellers'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'ar' ? 'إدارة الموزعين والمستأجرين التابعين لهم' : 'Manage resellers and their tenants'}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-white"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة موزع' : 'Add Reseller'}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={language === 'ar' ? 'بحث عن موزع...' : 'Search resellers...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : resellers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{language === 'ar' ? 'لا يوجد موزعون' : 'No resellers found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resellers.map((reseller) => (
            <div
              key={reseller._id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reseller.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <Building2 className={`w-5 h-5 ${reseller.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{reseller.name}</h3>
                    {reseller.company && <p className="text-xs text-gray-500">{reseller.company}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${reseller.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'}`}>
                  {reseller.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'متوقف' : 'Inactive')}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {reseller.email}</div>
                {reseller.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {reseller.phone}</div>}
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-medium text-gray-900 dark:text-white">{reseller.tenantCount}</span>
                  {language === 'ar' ? 'مستأجر' : 'tenants'}
                </div>
                {reseller.commissionRate > 0 && (
                  <div className="text-xs text-gray-500">
                    {language === 'ar' ? 'عمولة' : 'Commission'}: {reseller.commissionRate}%
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setViewTenants(reseller)}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {language === 'ar' ? 'عرض المستأجرين' : 'View Tenants'}
                </button>
                <button
                  onClick={() => handleEdit(reseller)}
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(reseller)}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <SuperAdminPortal>
        <div className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center bg-black/50 p-4`} onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingReseller ? (language === 'ar' ? 'تعديل موزع' : 'Edit Reseller') : (language === 'ar' ? 'إضافة موزع جديد' : 'Add New Reseller')}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'الاسم' : 'Name'} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'الهاتف' : 'Phone'}
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'الشركة' : 'Company'}
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'نسبة العمولة (%)' : 'Commission Rate (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!editingReseller && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      placeholder={language === 'ar' ? 'كلمة المرور للموزع' : 'Reseller login password'}
                      required={!editingReseller}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive !== false}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  {language === 'ar' ? 'نشط' : 'Active'}
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
                >
                  {editingReseller ? (language === 'ar' ? 'حفظ' : 'Save') : (language === 'ar' ? 'إنشاء' : 'Create')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </SuperAdminPortal>
      )}

      {/* View Tenants Modal */}
      {viewTenants && (
        <SuperAdminPortal>
        <div className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center bg-black/50 p-4`} onClick={() => setViewTenants(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {viewTenants.name} — {language === 'ar' ? 'المستأجرون' : 'Tenants'}
                </h2>
                <p className="text-sm text-gray-500">{viewTenants.email}</p>
              </div>
              <button onClick={() => setViewTenants(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tenantsQuery.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : tenantsQuery.data?.tenants?.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>{language === 'ar' ? 'لا يوجد مستأجرون لهذا الموزع' : 'No tenants assigned to this reseller'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tenantsQuery.data?.tenants?.map((tenant) => (
                  <div
                    key={tenant._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{tenant.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[tenant.subscription?.status] || 'bg-gray-100 text-gray-600'}`}>
                          {tenant.subscription?.status || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[tenant.subscription?.plan] || 'bg-gray-100 text-gray-600'}`}>
                          {tenant.subscription?.plan || '—'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {tenant.subscription?.startDate ? formatSubscriptionDate(tenant.subscription.startDate, language) : '—'}
                          {' → '}
                          {tenant.subscription?.endDate ? formatSubscriptionDate(tenant.subscription.endDate, language) : '—'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${tenant.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500'}`}>
                      {tenant.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'متوقف' : 'Inactive')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </SuperAdminPortal>
      )}
    </div>
  )
}
