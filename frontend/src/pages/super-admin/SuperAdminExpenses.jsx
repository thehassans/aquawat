import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, DollarSign, Receipt, CreditCard, Calendar, 
  Trash2, Edit3, Eye, Download, X, UploadCloud, CheckCircle2, 
  AlertCircle, RefreshCw, FileText, Image as ImageIcon, Sparkles, 
  Building2, ExternalLink, Filter
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import api from '../../lib/api'

export const EXPENSE_CATEGORIES = [
  { id: 'servers_hosting', labelEn: 'Servers & Cloud Hosting', labelAr: 'خوادم واستضافة سحابية', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  { id: 'ai_credits', labelEn: 'AI & API Credits', labelAr: 'أرصدة ذكاء اصطناعي وواجهات برمجة', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
  { id: 'software_subscriptions', labelEn: 'Software & SaaS Subscriptions', labelAr: 'اشتراكات برمجيات وسحابية', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
  { id: 'domains_ssl', labelEn: 'Domains & SSL Security', labelAr: 'نطاقات وشهادات أمان', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800' },
  { id: 'marketing_ads', labelEn: 'Marketing & Advertising', labelAr: 'تسويق وحملات إعلانية', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  { id: 'salaries_contractors', labelEn: 'Salaries & Contractors', labelAr: 'رواتب ومستقلين', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  { id: 'office_rent', labelEn: 'Office Rent & Utilities', labelAr: 'إيجار مقرات ومرافق', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
  { id: 'telecom_internet', labelEn: 'Telecom & Internet', labelAr: 'اتصالات وإنترنت', color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800' },
  { id: 'legal_compliance', labelEn: 'Legal, ZATCA & Gov Fees', labelAr: 'رسوم حكومية وقانونية وزاتكا', color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800' },
  { id: 'maintenance', labelEn: 'Maintenance & Support', labelAr: 'صيانة ودعم فني', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' },
  { id: 'other', labelEn: 'Other Operational Expenses', labelAr: 'مصاريف تشغيلية أخرى', color: 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' }
]

const DEFAULT_FORM_STATE = {
  description: '',
  descriptionAr: '',
  category: 'servers_hosting',
  categoryAr: 'خوادم واستضافة سحابية',
  payeeName: '',
  amount: '',
  taxAmount: '',
  taxRatePercent: '15',
  expenseDate: new Date().toISOString().split('T')[0],
  paymentMethod: 'bank_transfer',
  paymentReference: '',
  status: 'paid',
  notes: '',
  attachments: []
}

export default function SuperAdminExpenses() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_STATE })
  const [activeProofView, setActiveProofView] = useState(null)

  // Fetch Expenses
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['super-admin-expenses', page, search, categoryFilter, statusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/expenses', {
        params: {
          page,
          search,
          category: categoryFilter || undefined,
          status: statusFilter || undefined,
          limit: 15
        }
      })
      return res.data
    },
    staleTime: 30 * 1000,
  })

  const expenses = data?.expenses || []
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 }
  const stats = data?.stats || { totalExpenses: 0, totalTax: 0, baseAmount: 0, count: 0 }
  const categoryStats = data?.categoryStats || []

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingExpense?._id) {
        const res = await api.put(`/super-admin/expenses/${editingExpense._id}`, payload)
        return res.data
      } else {
        const res = await api.post('/super-admin/expenses', payload)
        return res.data
      }
    },
    onSuccess: () => {
      toast.success(editingExpense ? (isAr ? 'تم تعديل المصروف بنجاح' : 'Expense updated successfully') : (isAr ? 'تم تسجيل المصروف بنجاح' : 'Expense logged successfully'))
      queryClient.invalidateQueries(['super-admin-expenses'])
      setIsModalOpen(false)
      setEditingExpense(null)
      setFormData({ ...DEFAULT_FORM_STATE })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ المصروف' : 'Failed to save expense'))
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/expenses/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف المصروف بنجاح' : 'Expense deleted successfully')
      queryClient.invalidateQueries(['super-admin-expenses'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حذف المصروف' : 'Failed to delete expense'))
    }
  })

  const handleDelete = (id, expenseNum) => {
    if (window.confirm(isAr ? `هل أنت متأكد من حذف المصروف ${expenseNum}؟` : `Are you sure you want to delete expense ${expenseNum}?`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingExpense(null)
    setFormData({ ...DEFAULT_FORM_STATE })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp)
    const baseAmt = exp.amount || 0
    const taxAmt = exp.taxAmount || 0
    const rate = baseAmt > 0 && taxAmt > 0 ? String(Math.round((taxAmt / baseAmt) * 100)) : (taxAmt > 0 ? '15' : '0')
    setFormData({
      description: exp.description || '',
      descriptionAr: exp.descriptionAr || '',
      category: exp.category || 'other',
      categoryAr: exp.categoryAr || '',
      payeeName: exp.payeeName || '',
      amount: String(exp.amount || ''),
      taxAmount: String(exp.taxAmount || ''),
      taxRatePercent: rate,
      expenseDate: exp.expenseDate ? exp.expenseDate.split('T')[0] : new Date().toISOString().split('T')[0],
      paymentMethod: exp.paymentMethod || 'bank_transfer',
      paymentReference: exp.paymentReference || '',
      status: exp.status || 'paid',
      notes: exp.notes || '',
      attachments: exp.attachments || []
    })
    setIsModalOpen(true)
  }

  // Handle Amount and Tax Calculations in form
  const handleAmountChange = (val) => {
    const numeric = parseFloat(val) || 0
    const rate = parseFloat(formData.taxRatePercent) || 0
    const tax = Number(((numeric * rate) / 100).toFixed(2))
    setFormData(prev => ({
      ...prev,
      amount: val,
      taxAmount: rate > 0 ? String(tax) : '0'
    }))
  }

  const handleTaxRateChange = (rateVal) => {
    const rate = parseFloat(rateVal) || 0
    const numeric = parseFloat(formData.amount) || 0
    const tax = Number(((numeric * rate) / 100).toFixed(2))
    setFormData(prev => ({
      ...prev,
      taxRatePercent: rateVal,
      taxAmount: rate > 0 ? String(tax) : '0'
    }))
  }

  // Image Upload as Proof
  const handleProofUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error(isAr ? 'حجم الصورة يجب أن لا يتجاوز 5 ميجابايت' : 'Proof image must not exceed 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      const newAttachment = {
        name: file.name,
        url: dataUrl,
        mimeType: file.type,
        size: file.size
      }
      setFormData(prev => ({
        ...prev,
        attachments: [newAttachment, ...(prev.attachments || [])]
      }))
      toast.success(isAr ? 'تم رفع صورة الإثبات بنجاح' : 'Proof image uploaded')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== index)
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const baseAmt = parseFloat(formData.amount) || 0
    const taxAmt = parseFloat(formData.taxAmount) || 0

    if (baseAmt <= 0) {
      toast.error(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount')
      return
    }

    const catObj = EXPENSE_CATEGORIES.find(c => c.id === formData.category)
    const payload = {
      ...formData,
      categoryAr: catObj?.labelAr || formData.categoryAr,
      amount: baseAmt,
      taxAmount: taxAmt,
      totalAmount: Number((baseAmt + taxAmt).toFixed(2))
    }

    saveMutation.mutate(payload)
  }

  const totalCalculated = (parseFloat(formData.amount) || 0) + (parseFloat(formData.taxAmount) || 0)

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {isAr ? 'المصاريف والتكاليف التشغيلية' : 'Expenses & Operational Costs'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAr ? 'إدارة وتتبع تكاليف الخوادم والاشتراكات والرواتب والذكاء الاصطناعي مع إرفاق صور الإثبات والسندات' : 'Track and manage platform operational costs, cloud hosting, AI credits, and upload proof receipts'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'تسجيل مصروف جديد' : 'Log New Expense'}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'إجمالي التكاليف والمصاريف' : 'Total Expenses'}
              </p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {(stats.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-500">SAR</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'المبلغ الأساسي (قبل الضريبة)' : 'Net Amount'}
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {(stats.baseAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-500">SAR</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'ضريبة القيمة المضافة المدفوعة' : 'VAT Paid (15%)'}
              </p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {(stats.totalTax || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-500">SAR</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'سندات المصروف المسجلة' : 'Logged Expenses'}
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.count || pagination.total || 0}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => { setCategoryFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            categoryFilter === ''
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
          }`}
        >
          {isAr ? 'الكل' : 'All Categories'}
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setCategoryFilter(cat.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
              categoryFilter === cat.id
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : `${cat.color} hover:opacity-80`
            }`}
          >
            {isAr ? cat.labelAr : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={isAr ? 'بحث برقم المصروف، الوصف، المورد / المستفيد...' : 'Search by expense #, description, payee...'}
              className="input ps-10"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">{isAr ? 'جميع التصنيفات' : 'All Categories'}</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isAr ? cat.labelAr : cat.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="paid">{isAr ? 'مدفوعة (Paid)' : 'Paid'}</option>
              <option value="pending_approval">{isAr ? 'قيد الموافقة (Pending)' : 'Pending Approval'}</option>
              <option value="approved">{isAr ? 'معتمدة (Approved)' : 'Approved'}</option>
              <option value="draft">{isAr ? 'مسودة (Draft)' : 'Draft'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{isAr ? 'جاري تحميل المصاريف...' : 'Loading expenses...'}</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-20 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
              {isAr ? 'لا توجد مصاريف مسجلة بعد' : 'No expenses logged yet'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
              {isAr ? 'ابدأ بتسجيل مصاريف الخوادم والاشتراكات والتكاليف التشغيلية مع إرفاق صور السندات' : 'Start tracking cloud, API, subscription, and operational expenses with image proofs'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary text-xs font-bold inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'تسجيل مصروف الآن' : 'Log Expense Now'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-gray-50/80 dark:bg-dark-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase font-bold border-b border-gray-100 dark:border-dark-700">
                <tr>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'رقم السند' : 'Expense #'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الوصف والتصنيف' : 'Description & Category'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المورد / المستفيد' : 'Payee / Vendor'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'المبلغ الأساسي' : 'Amount'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الضريبة (15%)' : 'VAT'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'إثبات الدفع' : 'Proof'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {expenses.map((exp) => {
                  const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                  const hasProof = exp.attachments && exp.attachments.length > 0 && exp.attachments[0]?.url
                  return (
                    <tr key={exp._id} className="hover:bg-gray-50/60 dark:hover:bg-dark-700/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900 dark:text-white">
                        {exp.expenseNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                            {isAr ? (exp.descriptionAr || exp.description) : (exp.description || exp.descriptionAr)}
                          </p>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${catObj?.color || 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                            {isAr ? (catObj?.labelAr || exp.category) : (catObj?.labelEn || exp.category)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {exp.payeeName || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-end font-mono text-gray-700 dark:text-gray-300">
                        {(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-end font-mono text-amber-600 dark:text-amber-400">
                        {(exp.taxAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-end font-bold font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {(exp.totalAmount || (exp.amount + exp.taxAmount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-gray-400">SAR</span>
                      </td>

                      {/* Proof Image / Receipt Thumbnail */}
                      <td className="py-3.5 px-4 text-center">
                        {hasProof ? (
                          <button
                            onClick={() => setActiveProofView(exp.attachments[0])}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all shadow-xs"
                            title={isAr ? 'عرض صورة الإثبات' : 'View Proof Image'}
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-rose-500" />
                            <span>{isAr ? 'إثبات' : 'Proof'}</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          exp.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : exp.status === 'pending_approval'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-dark-700 dark:text-slate-300'
                        }`}>
                          {exp.status === 'paid' ? (isAr ? 'مدفوع' : 'Paid') : exp.status === 'pending_approval' ? (isAr ? 'قيد المراجعة' : 'Pending') : (isAr ? 'مسودة' : 'Draft')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300 transition-colors"
                            title={isAr ? 'تعديل المصروف' : 'Edit Expense'}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp._id, exp.expenseNumber)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition-colors"
                            title={isAr ? 'حذف المصروف' : 'Delete Expense'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {isAr ? `صفحة ${pagination.page} من ${pagination.pages} (${pagination.total} مصروف)` : `Page ${pagination.page} of ${pagination.pages} (${pagination.total} expenses)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT EXPENSE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-700 w-full max-w-2xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/60 dark:bg-dark-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {editingExpense ? (isAr ? 'تعديل بيانات المصروف' : 'Edit Expense') : (isAr ? 'تسجيل مصروف / تكلفة جديدة' : 'Log New Expense & Cost')}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isAr ? 'أدخل تفاصيل التكلفة والمورد وارفق صورة السند أو الفاتورة كإثبات' : 'Enter expense details and upload receipt or invoice proof'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost btn-icon"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* Category and Payee */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{isAr ? 'تصنيف المصروف' : 'Expense Category'} *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="select font-bold"
                      required
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {isAr ? cat.labelAr : cat.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">{isAr ? 'المورد / المستفيد (Payee / Vendor)' : 'Payee / Vendor'}</label>
                    <input
                      type="text"
                      value={formData.payeeName}
                      onChange={(e) => setFormData(prev => ({ ...prev, payeeName: e.target.value }))}
                      placeholder="AWS, OpenAI, Hostinger, Landlord..."
                      className="input"
                    />
                  </div>
                </div>

                {/* Description EN & AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{isAr ? 'وصف المصروف (عربي)' : 'Description (Arabic)'}</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={formData.descriptionAr}
                      onChange={(e) => setFormData(prev => ({ ...prev, descriptionAr: e.target.value }))}
                      placeholder="استضافة سحابية لشهر أغسطس"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">{isAr ? 'وصف المصروف (إنجليزي)' : 'Description (English)'} *</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Cloud Hosting Server Bill - August"
                      className="input"
                      required
                    />
                  </div>
                </div>

                {/* Financial Amounts & VAT */}
                <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-dark-700/40 border border-gray-100 dark:border-dark-600/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">{isAr ? 'المبلغ قبل الضريبة (SAR)' : 'Base Amount (SAR)'} *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={formData.amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="100.00"
                        className="input font-mono font-bold text-center"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">{isAr ? 'نسبة الضريبة' : 'VAT Rate'}</label>
                      <select
                        value={formData.taxRatePercent}
                        onChange={(e) => handleTaxRateChange(e.target.value)}
                        className="select font-bold text-center"
                      >
                        <option value="15">15% (VAT)</option>
                        <option value="0">0% (Zero Tax)</option>
                        <option value="custom">{isAr ? 'مبلغ مخصص' : 'Custom Amount'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">{isAr ? 'مبلغ الضريبة (SAR)' : 'VAT Amount (SAR)'}</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, taxAmount: e.target.value }))}
                        className="input font-mono font-bold text-center text-amber-600 dark:text-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-dark-600">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAr ? 'إجمالي التكلفة شامل الضريبة:' : 'Total Cost with VAT:'}
                    </span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                      {totalCalculated.toFixed(2)} SAR
                    </span>
                  </div>
                </div>

                {/* Dates & Payment Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">{isAr ? 'تاريخ المصروف' : 'Expense Date'}</label>
                    <input
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expenseDate: e.target.value }))}
                      className="input font-mono"
                    />
                  </div>

                  <div>
                    <label className="label">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="select"
                    >
                      <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                      <option value="card">{isAr ? 'بطاقة ائتمان / مدى' : 'Credit / Debit Card'}</option>
                      <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                      <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
                      <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">{isAr ? 'رقم المرجع / الحوالة' : 'Reference / Tx ID'}</label>
                    <input
                      type="text"
                      value={formData.paymentReference}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                      placeholder="TX-987654 / INV-123"
                      className="input font-mono"
                    />
                  </div>
                </div>

                {/* PROOF IMAGE UPLOAD SECTION */}
                <div className="space-y-3">
                  <label className="label !mb-1 flex items-center justify-between">
                    <span>{isAr ? 'صورة إثبات الدفع / الفاتورة (Proof Image / Receipt)' : 'Proof Image / Receipt Attachment'}</span>
                    <span className="text-[11px] text-gray-400 font-normal">{isAr ? 'JPEG, PNG, WEBP حتى 5MB' : 'Max 5MB'}</span>
                  </label>

                  <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-600 bg-gray-50/40 dark:bg-dark-900/30 text-center space-y-3">
                    {formData.attachments && formData.attachments.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3 justify-center">
                        {formData.attachments.map((att, idx) => (
                          <div key={idx} className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 shadow-sm">
                            <img src={att.url} alt="Proof" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                              title={isAr ? 'إزالة' : 'Remove'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 text-gray-400">
                        <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
                        <p className="text-xs">{isAr ? 'لا توجد صورة إثبات مرفقة بعد' : 'No proof image attached yet'}</p>
                      </div>
                    )}

                    <div>
                      <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-rose-500" />
                        {isAr ? 'رفع صورة إثبات / فاتورة' : 'Upload Proof Image'}
                        <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">{isAr ? 'ملاحظات إضافية' : 'Notes & Remarks'}</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input"
                    placeholder={isAr ? 'أي تفاصيل أو بنود إضافية خاصة بالمصروف...' : 'Additional notes regarding this cost...'}
                  />
                </div>

                {/* Modal Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-secondary text-xs"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="btn btn-primary text-xs font-bold flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saveMutation.isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editingExpense ? (isAr ? 'حفظ التعديلات' : 'Update Expense') : (isAr ? 'تسجيل المصروف' : 'Save Expense'))}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROOF FULLSCREEN MODAL VIEWER */}
      <AnimatePresence>
        {activeProofView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-dark-800 rounded-3xl overflow-hidden max-w-3xl w-full shadow-2xl border border-gray-200 dark:border-dark-700"
            >
              <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/60 dark:bg-dark-900/40">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {activeProofView.name || (isAr ? 'إثبات الدفع / الفاتورة' : 'Payment Proof Image')}
                  </span>
                </div>
                <button
                  onClick={() => setActiveProofView(null)}
                  className="btn btn-ghost btn-icon"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex items-center justify-center max-h-[75vh] overflow-auto bg-slate-900">
                <img
                  src={activeProofView.url}
                  alt="Proof Document"
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-end">
                <a
                  href={activeProofView.url}
                  download={activeProofView.name || 'expense_proof.jpg'}
                  className="btn btn-secondary text-xs flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isAr ? 'تنزيل الصورة' : 'Download Image'}
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
