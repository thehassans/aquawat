import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Search, Clock, Users, Calendar } from 'lucide-react'
import api from '../../lib/api'

export default function GymCheckin() {
  const { tenant } = useSelector(s => s.auth)
  const language = tenant?.settings?.language || 'en'
  const isAr = language === 'ar'
  
  const [identifier, setIdentifier] = useState('')
  const [time, setTime] = useState(new Date())
  const [checkinResult, setCheckinResult] = useState(null) // { success, member, message, subscription }

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-clear result
  useEffect(() => {
    if (checkinResult) {
      const timer = setTimeout(() => {
        setCheckinResult(null)
        setIdentifier('')
        document.getElementById('checkin-input')?.focus()
      }, checkinResult.success ? 3000 : 4000)
      return () => clearTimeout(timer)
    }
  }, [checkinResult])

  const { data: liveData } = useQuery({
    queryKey: ['gym-live-attendance'],
    queryFn: () => api.get('/api/gym/attendance/live').then(res => res.data),
    refetchInterval: 10000 // refresh every 10s
  })

  const checkinMutation = useMutation({
    mutationFn: (id) => api.post('/api/gym/attendance/checkin', { identifier: id }),
    onSuccess: (res) => {
      setCheckinResult({
        success: true,
        member: res.data.member,
        subscription: res.data.subscription,
        message: isAr ? 'تم تسجيل الدخول بنجاح' : 'Access Granted'
      })
    },
    onError: (err) => {
      setCheckinResult({
        success: false,
        member: err.response?.data?.member,
        message: err.response?.data?.message || (isAr ? 'وصول مرفوض' : 'Access Denied')
      })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!identifier.trim() || checkinMutation.isLoading) return
    checkinMutation.mutate(identifier.trim())
  }

  const occupancy = liveData?.data?.occupancy || 0

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900 flex flex-col overflow-hidden ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Background Gradient & Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 opacity-90"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 tracking-tight uppercase mb-4 shadow-sm drop-shadow-lg">
            {tenant?.name || 'GYM PORTAL'}
          </h1>
          <div className="text-8xl font-light text-white tracking-widest tabular-nums drop-shadow-2xl font-mono">
            {time.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        </motion.div>

        <motion.form 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit} 
          className="w-full max-w-2xl"
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
              <Search className={`w-10 h-10 text-slate-400 mx-6 ${isAr ? 'order-last' : 'order-first'}`} />
              <input
                id="checkin-input"
                type="text"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isAr ? 'أدخل رقم العضوية أو الجوال' : 'Enter Member ID or Phone'}
                className="flex-1 h-24 bg-transparent text-3xl text-white placeholder-slate-500 outline-none px-4"
                disabled={checkinMutation.isLoading || !!checkinResult}
              />
              <button 
                type="submit"
                disabled={!identifier.trim() || checkinMutation.isLoading}
                className="h-24 px-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-2xl transition-colors"
              >
                {isAr ? 'دخول' : 'ENTER'}
              </button>
            </div>
          </div>
        </motion.form>
      </div>

      {/* Bottom Bar */}
      <div className="relative z-10 h-24 bg-slate-950/80 backdrop-blur-lg border-t border-slate-800 flex justify-between items-center px-12 text-slate-300">
        <div className="flex items-center gap-4 text-xl">
          <Calendar className="w-8 h-8 text-cyan-500" />
          <span className="font-medium">{time.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 px-8 py-4 rounded-2xl border border-slate-800 shadow-inner">
          <Users className="w-8 h-8 text-indigo-400" />
          <div className="flex flex-col">
            <span className="text-sm text-slate-400 uppercase tracking-wider font-semibold">{isAr ? 'التواجد الحالي' : 'Live Occupancy'}</span>
            <span className="text-3xl font-bold text-white leading-none">{occupancy}</span>
          </div>
        </div>
      </div>

      {/* Result Overlay */}
      <AnimatePresence>
        {checkinResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-2xl ${
              checkinResult.success ? 'bg-green-900/90' : 'bg-red-900/90'
            }`}
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-3xl p-12 max-w-2xl w-full text-center shadow-2xl flex flex-col items-center"
            >
              {checkinResult.success ? (
                <CheckCircle className="w-40 h-40 text-green-500 mb-8" />
              ) : (
                <XCircle className="w-40 h-40 text-red-500 mb-8" />
              )}
              
              <h2 className={`text-5xl font-black mb-6 ${checkinResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {checkinResult.message}
              </h2>

              {checkinResult.member && (
                <div className="mt-4 p-8 bg-slate-50 rounded-2xl w-full border border-slate-100">
                  <h3 className="text-3xl font-bold text-slate-800 mb-2">
                    {isAr ? checkinResult.member.nameAr : checkinResult.member.nameEn}
                  </h3>
                  <p className="text-xl text-slate-500">{checkinResult.member.memberNumber}</p>
                  
                  {checkinResult.subscription && (
                    <div className="mt-6 pt-6 border-t border-slate-200 flex justify-center gap-12">
                      <div>
                        <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">{isAr ? 'الباقة' : 'Plan'}</div>
                        <div className="text-lg font-semibold text-slate-700">
                          {isAr ? checkinResult.subscription.plan?.nameAr : checkinResult.subscription.plan?.nameEn}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">{isAr ? 'ينتهي في' : 'Expires'}</div>
                        <div className="text-lg font-semibold text-slate-700">
                          {new Date(checkinResult.subscription.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
