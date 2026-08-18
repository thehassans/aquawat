import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import { Search, Plus, User, Phone, MapPin, MoreVertical, Eye, Edit, ScanLine, Filter, AlertCircle, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { enUS, ar } from 'date-fns/locale'
import { downloadGymMemberCardPdf } from '../../lib/gymMemberCardPdf'

export default function GymMembers() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const limit = 12

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gym-members', search, status, page],
    queryFn: () => api.get(`/api/gym/members?search=${search}&status=${status}&page=${page}&limit=${limit}`).then(res => res.data.data),
    keepPreviousData: true
  })

  const members = data?.members || []
  const totalPages = data?.totalPages || 1
  const totalDocs = data?.totalDocs || 0

  const statusTabs = [
    { id: '', labelEn: 'All', labelAr: 'الكل' },
    { id: 'active', labelEn: 'Active', labelAr: 'نشط' },
    { id: 'inactive', labelEn: 'Inactive', labelAr: 'غير نشط' },
    { id: 'blacklisted', labelEn: 'Blacklisted', labelAr: 'القائمة السوداء' }
  ]

  const getStatusColor = (s) => {
    switch(s) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'blacklisted': return 'bg-rose-100 text-rose-700 border-rose-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 p-4 md:p-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            {isAr ? 'الأعضاء' : 'Members'}
            {!isLoading && (
              <span className="text-sm font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                {totalDocs}
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">{isAr ? 'إدارة أعضاء النادي واشتراكاتهم' : 'Manage gym members and their subscriptions'}</p>
        </div>
        <Link to="/app/dashboard/gym/members/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-sm shadow-blue-200 flex items-center gap-2">
          <Plus size={20} />
          {isAr ? 'عضو جديد' : 'New Member'}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder={isAr ? 'بحث بالاسم، الجوال، رقم العضوية...' : 'Search name, phone, member ID...'}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar gap-2">
          {statusTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatus(tab.id); setPage(1); }}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === tab.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-rose-500 flex flex-col items-center gap-2">
          <AlertCircle size={40} />
          <p>{isAr ? 'حدث خطأ أثناء تحميل البيانات' : 'Error loading members data'}</p>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center flex flex-col items-center justify-center">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <User size={40} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">{isAr ? 'لا يوجد أعضاء' : 'No Members Found'}</h3>
          <p className="text-slate-500 max-w-md mx-auto">{isAr ? 'لم يتم العثور على أعضاء يطابقون معايير البحث الخاصة بك. جرب تغيير الفلاتر أو إضافة عضو جديد.' : 'No members found matching your search criteria. Try changing filters or adding a new member.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence>
              {members.map(member => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={member._id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative"
                >
                  <div className="absolute top-4 right-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(member.status)}`}>
                      {isAr ? (member.status === 'active' ? 'نشط' : member.status === 'inactive' ? 'غير نشط' : 'قائمة سوداء') : member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center mt-2 mb-4">
                    <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 overflow-hidden mb-3">
                      {member.photoUrl ? <img src={member.photoUrl} alt="avatar" className="w-full h-full object-cover" /> : <User size={32} />}
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg text-center leading-tight">
                      {isAr ? member.nameAr || member.nameEn : member.nameEn || member.nameAr}
                    </h3>
                    <p className="text-xs font-mono text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded">{member.memberNumber}</p>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-slate-400" />
                      <span>{member.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <ScanLine size={14} className="text-slate-400" />
                      <span className="text-xs">
                        {member.lastCheckIn ? (isAr ? 'آخر دخول ' : 'Last seen ') + formatDistanceToNow(new Date(member.lastCheckIn), { addSuffix: true, locale: isAr ? ar : enUS }) : (isAr ? 'لم يسجل دخول أبداً' : 'Never checked in')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => downloadGymMemberCardPdf({ member, subscription: member.activeSubscription, tenant, language })}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors"
                      title={isAr ? 'طباعة بطاقة العضوية' : 'Print Membership Pass'}
                    >
                      <Download size={16} />
                    </button>
                    <Link to={`/app/dashboard/gym/members/${member._id}`} className="flex-1 flex justify-center items-center gap-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                      <Edit size={16} /> {isAr ? 'تعديل / الملف' : 'Edit / Profile'}
                    </Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10 gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50">
                {isAr ? 'السابق' : 'Prev'}
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} className={`w-10 h-10 rounded-lg font-medium transition-colors ${page === i + 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50">
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
