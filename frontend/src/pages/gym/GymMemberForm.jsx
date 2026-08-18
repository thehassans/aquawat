import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { ArrowLeft, ArrowRight, Camera, Save, Download, QrCode } from 'lucide-react'
import { downloadGymMemberCardPdf } from '../../lib/gymMemberCardPdf'

export default function GymMemberForm() {
  const { tenant } = useSelector(s => s.auth)
  const language = tenant?.settings?.language || 'en'
  const isAr = language === 'ar'
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState({
    nameEn: '', nameAr: '', gender: 'male', dateOfBirth: '', nationalId: '', bloodType: '',
    phone: '', email: '', emergencyContactName: '', emergencyContactPhone: '',
    healthNotes: '', source: 'Walk-in', notes: ''
  })

  const { data: memberData, isLoading: isLoadingMember } = useQuery({
    queryKey: ['gym-member', id],
    queryFn: () => api.get(`/api/gym/members/${id}`).then(res => res.data.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (memberData) {
      setFormData({
        nameEn: memberData.nameEn || '',
        nameAr: memberData.nameAr || '',
        gender: memberData.gender || 'male',
        dateOfBirth: memberData.dateOfBirth ? memberData.dateOfBirth.split('T')[0] : '',
        nationalId: memberData.nationalId || '',
        bloodType: memberData.bloodType || '',
        phone: memberData.phone || '',
        email: memberData.email || '',
        emergencyContactName: memberData.emergencyContact?.name || '',
        emergencyContactPhone: memberData.emergencyContact?.phone || '',
        healthNotes: memberData.healthNotes || '',
        source: memberData.source || 'Walk-in',
        notes: memberData.notes || ''
      })
    }
  }, [memberData])

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        emergencyContact: { name: data.emergencyContactName, phone: data.emergencyContactPhone }
      }
      if (isEdit) return api.put(`/api/gym/members/${id}`, payload)
      return api.post('/api/gym/members', payload)
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ العضو بنجاح' : 'Member saved successfully')
      queryClient.invalidateQueries(['gym-members'])
      navigate('/app/dashboard/gym/members')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || (isAr ? 'حدث خطأ' : 'An error occurred'))
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.nameEn && !formData.nameAr) {
      toast.error(isAr ? 'الرجاء إدخال الاسم' : 'Please enter a name')
      return
    }
    if (!formData.phone) {
      toast.error(isAr ? 'الرجاء إدخال رقم الجوال' : 'Please enter a phone number')
      return
    }
    mutation.mutate(formData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  if (isEdit && isLoadingMember) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 p-4 md:p-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/app/dashboard/gym/members" className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-slate-100 text-slate-600">
              {isAr ? <ArrowRight size={24} /> : <ArrowLeft size={24} />}
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{isEdit ? (isAr ? 'تعديل بيانات العضو' : 'Edit Member') : (isAr ? 'إضافة عضو جديد' : 'New Member')}</h1>
              <p className="text-sm text-slate-500">{isAr ? 'يرجى تعبئة بيانات العضو بدقة' : 'Please fill in the member details accurately'}</p>
            </div>
          </div>

          {isEdit && memberData && (
            <button
              type="button"
              onClick={() => downloadGymMemberCardPdf({ member: memberData, subscription: memberData.activeSubscription, tenant, language })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
            >
              <Download size={18} />
              <span>{isAr ? 'طباعة بطاقة العضوية (QR Pass)' : 'Print Member Pass (PDF)'}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col - Personal Info */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">{isAr ? 'المعلومات الشخصية' : 'Personal Information'}</h2>
              
              <div className="flex justify-center mb-8">
                <div className="relative w-28 h-28 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center group cursor-pointer overflow-hidden">
                  {memberData?.photoUrl ? (
                    <img src={memberData.photoUrl} alt="avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                  ) : (
                    <Camera size={32} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">{isAr ? 'تغيير الصورة' : 'Change Photo'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الاسم الأول (إنجليزي)' : 'First Name (En)'}</label>
                  <input type="text" name="nameEn" value={formData.nameEn} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الاسم الأول (عربي)' : 'First Name (Ar)'}</label>
                  <input type="text" name="nameAr" value={formData.nameAr} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الجنس' : 'Gender'}</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
                    <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الهوية الوطنية / الإقامة' : 'National ID / Iqama'}</label>
                  <input type="text" name="nationalId" value={formData.nationalId} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'فصيلة الدم' : 'Blood Type'}</label>
                  <select name="bloodType" value={formData.bloodType} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Col - Contact & Details */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">{isAr ? 'معلومات الاتصال' : 'Contact Details'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'رقم الجوال *' : 'Phone Number *'}</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'جهة اتصال الطوارئ' : 'Emergency Contact Name'}</label>
                    <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'جوال الطوارئ' : 'Emergency Contact Phone'}</label>
                    <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              {isEdit && memberData?.memberNumber && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg border border-slate-700 p-6 text-white text-center">
                  <QrCode size={48} className="mx-auto mb-3 text-emerald-400" />
                  <h3 className="text-xl font-bold mb-1">{memberData.memberNumber}</h3>
                  <p className="text-sm text-slate-400 mb-4">{isAr ? 'رقم العضوية' : 'Member ID'}</p>
                  <button type="button" className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                    <Download size={16} /> {isAr ? 'تحميل البطاقة' : 'Download Card'}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom - Extra Details */}
            <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">{isAr ? 'تفاصيل إضافية' : 'Additional Details'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'ملاحظات صحية (إن وجدت)' : 'Health Notes (if any)'}</label>
                  <textarea name="healthNotes" value={formData.healthNotes} onChange={handleChange} rows="3" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none placeholder:text-slate-400"></textarea>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'المصدر' : 'Source'}</label>
                    <select name="source" value={formData.source} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Walk-in">Walk-in / زيارة</option>
                      <option value="Referral">Referral / إحالة</option>
                      <option value="Social Media">Social Media / تواصل اجتماعي</option>
                      <option value="Website">Website / الموقع الإلكتروني</option>
                      <option value="Corporate">Corporate / شركات</option>
                      <option value="Other">Other / أخرى</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'ملاحظات إدارية' : 'Administrative Notes'}</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-4 pb-12">
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {mutation.isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save size={20} />}
              {isAr ? 'حفظ بيانات العضو' : 'Save Member Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
