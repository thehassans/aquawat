import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Search, Plus, Snowflake, RefreshCw, Eye, X, Activity, User, Calendar, DollarSign, Clock, ShieldAlert } from 'lucide-react'

export default function GymSubscriptions() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const currency = tenant?.settings?.currency || 'SAR'
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  
  // Modals state
  const [freezeDays, setFreezeDays] = useState(7)
  const [freezeReason, setFreezeReason] = useState('')
  
  const [newSubForm, setNewSubForm] = useState({
    memberId: '',
    planId: '',
    paymentMethod: 'cash',
    discount: 0,
    startDate: new Date().toISOString().split('T')[0]
  })

  // Data fetching
  const { data: subsData, isLoading } = useQuery({
    queryKey: ['gym-subscriptions'],
    queryFn: () => api.get('/api/gym/subscriptions').then(res => res.data)
  })

  const { data: membersData } = useQuery({
    queryKey: ['gym-members'],
    queryFn: () => api.get('/api/gym/members').then(res => res.data)
  })

  const { data: plansData } = useQuery({
    queryKey: ['gym-plans'],
    queryFn: () => api.get('/api/gym/plans').then(res => res.data)
  })

  // Mutations
  const freezeMutation = useMutation({
    mutationFn: (data) => api.put(`/api/gym/subscriptions/${selectedSub._id}/freeze`, data),
    onSuccess: () => {
      toast.success(isAr ? 'تم تجميد الاشتراك' : 'Subscription frozen')
      queryClient.invalidateQueries(['gym-subscriptions'])
      setIsFreezeModalOpen(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Error freezing subscription')
  })

  const unfreezeMutation = useMutation({
    mutationFn: (id) => api.put(`/api/gym/subscriptions/${id}/unfreeze`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إلغاء التجميد' : 'Subscription unfrozen')
      queryClient.invalidateQueries(['gym-subscriptions'])
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Error unfreezing subscription')
  })

  const renewMutation = useMutation({
    mutationFn: (id) => api.put(`/api/gym/subscriptions/${id}/renew`),
    onSuccess: () => {
      toast.success(isAr ? 'تم التجديد' : 'Subscription renewed')
      queryClient.invalidateQueries(['gym-subscriptions'])
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Error renewing subscription')
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/subscriptions', data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الاشتراك' : 'Subscription created')
      queryClient.invalidateQueries(['gym-subscriptions'])
      setIsNewModalOpen(false)
      setNewSubForm({ memberId: '', planId: '', paymentMethod: 'cash', discount: 0, startDate: new Date().toISOString().split('T')[0] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Error creating subscription')
  })

  const subscriptions = subsData?.data || []
  const members = membersData?.data || []
  const plans = plansData?.data || []

  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchSearch = sub.member?.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.member?.nameAr?.includes(searchTerm) ||
                          sub.member?.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchSearch) return false
      
      if (activeTab === 'All') return true
      if (activeTab === 'Active') return sub.status === 'active'
      if (activeTab === 'Frozen') return sub.status === 'frozen'
      if (activeTab === 'Expired') return sub.status === 'expired'
      if (activeTab === 'Cancelled') return sub.status === 'cancelled'
      return true
    })
  }, [subscriptions, searchTerm, activeTab])

  const activeCount = subscriptions.filter(s => s.status === 'active').length

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'frozen': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getDaysColor = (days) => {
    if (days > 30) return 'text-green-600'
    if (days >= 7) return 'text-amber-500'
    return 'text-red-600'
  }

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-6 rounded-2xl shadow-sm border border-slate-100 backdrop-blur">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            {isAr ? 'الاشتراكات' : 'Subscriptions'}
          </h1>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {activeCount} {isAr ? 'نشط' : 'Active'}
            </span>
            {isAr ? 'إدارة اشتراكات الأعضاء' : 'Manage member subscriptions'}
          </p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95 font-medium"
        >
          <Plus className="w-5 h-5" />
          {isAr ? 'اشتراك جديد' : 'New Subscription'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Active', 'Frozen', 'Expired', 'Cancelled'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isAr ? {
                'All': 'الكل', 'Active': 'نشط', 'Frozen': 'مجمد', 'Expired': 'منتهي', 'Cancelled': 'ملغى'
              }[tab] : tab}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400`} />
          <input 
            type="text"
            placeholder={isAr ? 'بحث بالاسم أو الرقم...' : 'Search name or number...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none ${isAr ? 'pr-10 pl-4' : ''}`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">{isAr ? 'العضو' : 'Member'}</th>
                <th className="px-6 py-4 font-medium">{isAr ? 'الباقة' : 'Plan Name'}</th>
                <th className="px-6 py-4 font-medium">{isAr ? 'التاريخ' : 'Dates'}</th>
                <th className="px-6 py-4 font-medium">{isAr ? 'متبقي' : 'Remaining'}</th>
                <th className="px-6 py-4 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                    {isAr ? 'جاري التحميل...' : 'Loading subscriptions...'}
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    {isAr ? 'لا توجد اشتراكات' : 'No subscriptions found'}
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={sub._id} 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          {sub.member?.nameEn?.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{isAr ? sub.member?.nameAr : sub.member?.nameEn}</div>
                          <div className="text-xs text-slate-500">{sub.member?.memberNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {isAr ? sub.plan?.nameAr : sub.plan?.nameEn}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-slate-800">{new Date(sub.startDate).toLocaleDateString()}</div>
                        <div className="text-slate-500 text-xs">→ {new Date(sub.endDate).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${getDaysColor(sub.remainingDays)}`}>
                        {sub.remainingDays} {isAr ? 'يوم' : 'days'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(sub.status)}`}>
                        {isAr ? {
                          'active': 'نشط', 'frozen': 'مجمد', 'expired': 'منتهي', 'cancelled': 'ملغى'
                        }[sub.status] : sub.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {sub.status === 'active' && (
                          <button 
                            onClick={() => { setSelectedSub(sub); setIsFreezeModalOpen(true); }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors tooltip-trigger"
                            title={isAr ? 'تجميد' : 'Freeze'}
                          >
                            <Snowflake className="w-4 h-4" />
                          </button>
                        )}
                        {sub.status === 'frozen' && (
                          <button 
                            onClick={() => unfreezeMutation.mutate(sub._id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={isAr ? 'إلغاء التجميد' : 'Unfreeze'}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {(sub.status === 'expired' || sub.status === 'active') && (
                          <button 
                            onClick={() => renewMutation.mutate(sub._id)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={isAr ? 'تجديد' : 'Renew'}
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freeze Modal */}
      <AnimatePresence>
        {isFreezeModalOpen && selectedSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-blue-500" />
                  {isAr ? 'تجميد الاشتراك' : 'Freeze Subscription'}
                </h3>
                <button onClick={() => setIsFreezeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'أيام التجميد' : 'Freeze Days'}</label>
                  <input 
                    type="number" 
                    value={freezeDays}
                    onChange={e => setFreezeDays(parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {isAr ? 'الأيام المتبقية للتجميد:' : 'Remaining freeze days:'} <span className="font-bold text-slate-700">{selectedSub.plan?.maxFreezeDays || 0}</span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'السبب' : 'Reason'}</label>
                  <textarea 
                    value={freezeReason}
                    onChange={e => setFreezeReason(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                    placeholder={isAr ? 'سبب التجميد...' : 'Reason for freezing...'}
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsFreezeModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    onClick={() => freezeMutation.mutate({ days: freezeDays, reason: freezeReason })}
                    disabled={freezeMutation.isLoading}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                  >
                    {freezeMutation.isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Snowflake className="w-5 h-5" />}
                    {isAr ? 'تأكيد التجميد' : 'Confirm Freeze'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Subscription Modal */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" />
                  {isAr ? 'اشتراك جديد' : 'New Subscription'}
                </h3>
                <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Member Select */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'العضو' : 'Member'}</label>
                  <div className="relative">
                    <User className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-5 h-5 text-slate-400`} />
                    <select 
                      value={newSubForm.memberId}
                      onChange={e => setNewSubForm({...newSubForm, memberId: e.target.value})}
                      className={`w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-slate-50 ${isAr ? 'pr-10' : 'pl-10'}`}
                    >
                      <option value="">{isAr ? 'اختر العضو...' : 'Select Member...'}</option>
                      {members.map(m => (
                        <option key={m._id} value={m._id}>{isAr ? m.nameAr : m.nameEn} ({m.memberNumber})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Plan Select */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الباقة' : 'Plan'}</label>
                  <div className="relative">
                    <Activity className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-5 h-5 text-slate-400`} />
                    <select 
                      value={newSubForm.planId}
                      onChange={e => setNewSubForm({...newSubForm, planId: e.target.value})}
                      className={`w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-slate-50 ${isAr ? 'pr-10' : 'pl-10'}`}
                    >
                      <option value="">{isAr ? 'اختر الباقة...' : 'Select Plan...'}</option>
                      {plans.filter(p => p.isActive).map(p => (
                        <option key={p._id} value={p._id}>{isAr ? p.nameAr : p.nameEn} - {p.price} {currency}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'تاريخ البدء' : 'Start Date'}</label>
                    <div className="relative">
                      <Calendar className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-5 h-5 text-slate-400`} />
                      <input 
                        type="date"
                        value={newSubForm.startDate}
                        onChange={e => setNewSubForm({...newSubForm, startDate: e.target.value})}
                        className={`w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 ${isAr ? 'pr-10' : 'pl-10'}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الخصم' : 'Discount'}</label>
                    <div className="relative">
                      <DollarSign className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-5 h-5 text-slate-400`} />
                      <input 
                        type="number"
                        min="0"
                        value={newSubForm.discount}
                        onChange={e => setNewSubForm({...newSubForm, discount: parseFloat(e.target.value) || 0})}
                        className={`w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 ${isAr ? 'pr-10' : 'pl-10'}`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <div className="relative">
                    <CreditCard className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3' : 'left-3'} w-5 h-5 text-slate-400`} />
                    <select 
                      value={newSubForm.paymentMethod}
                      onChange={e => setNewSubForm({...newSubForm, paymentMethod: e.target.value})}
                      className={`w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-slate-50 ${isAr ? 'pr-10' : 'pl-10'}`}
                    >
                      <option value="cash">{isAr ? 'كاش' : 'Cash'}</option>
                      <option value="card">{isAr ? 'بطاقة ائتمان' : 'Credit Card'}</option>
                      <option value="transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                    </select>
                  </div>
                </div>

              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setIsNewModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition-colors shadow-sm"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={() => createMutation.mutate(newSubForm)}
                  disabled={createMutation.isLoading || !newSubForm.memberId || !newSubForm.planId}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex justify-center items-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {createMutation.isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {isAr ? 'تأكيد' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
