import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut, Phone, Mail, PauseCircle, RefreshCw, Crown } from 'lucide-react'
import { useTranslation } from '../../lib/translations'
import { logout } from '../../store/slices/authSlice'

export function isTenantTerminated(tenant) {
  if (!tenant) return false
  if (tenant.subscription?.status === 'terminated') return true
  if (tenant.terminationNotice?.date) {
    if (new Date(tenant.terminationNotice.date) <= new Date()) {
      return true
    }
  }
  return false
}

export function hasTerminationNotice(tenant) {
  if (!tenant) return false
  if (isTenantTerminated(tenant)) return false // If terminated, it's fully blocked, no banner needed
  if (tenant.terminationNotice?.date) {
    return new Date(tenant.terminationNotice.date) > new Date()
  }
  return false
}

export default function TerminationBanner() {
  const navigate = useNavigate()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const [timeLeft, setTimeLeft] = useState('')
  
  useEffect(() => {
    if (!tenant?.terminationNotice?.date) return
    
    const targetDate = new Date(tenant.terminationNotice.date).getTime()
    
    const updateCountdown = () => {
      const now = new Date().getTime()
      const distance = targetDate - now
      
      if (distance < 0) {
        setTimeLeft(language === 'ar' ? 'انتهى الوقت' : 'Time expired')
        return
      }
      
      const hours = Math.floor(distance / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(interval)
  }, [tenant?.terminationNotice?.date, language])

  if (!hasTerminationNotice(tenant)) return null

  const date = new Date(tenant.terminationNotice.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="bg-rose-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-between z-50 relative shadow-sm">
      <div className="flex items-center gap-2 flex-1 justify-center ms-auto lg:ms-24">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-center">
          {language === 'ar' 
            ? `إنذار: سيتم إنهاء اشتراكك في هذا النظام بتاريخ ${date}. يرجى اتخاذ الإجراء اللازم.`
            : `Warning: Your panel will be terminated on ${date}. Please take necessary action.`}
        </span>
        <div className="ms-2 px-2.5 py-0.5 rounded bg-white/20 font-bold tabular-nums tracking-widest text-xs flex items-center gap-1 shadow-sm">
          {timeLeft}
        </div>
        <button
          onClick={() => navigate('/demo-checkout')}
          className="ms-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors"
        >
          <Crown className="w-3.5 h-3.5" />
          {language === 'ar' ? 'احصل على النسخة الكاملة' : 'Get Full Version'}
        </button>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <a href="tel:+966596775485" title={language === 'ar' ? 'اتصال' : 'Call'} className="hover:text-rose-200 transition-colors">
          <Phone className="w-4 h-4" />
        </a>
        <a href="https://wa.me/966596775485" target="_blank" rel="noopener noreferrer" title="WhatsApp" className="hover:text-green-300 transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
        </a>
        <a href="mailto:support@maqder.com" title={language === 'ar' ? 'مراسلة' : 'Email'} className="hover:text-rose-200 transition-colors">
          <Mail className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

export function TerminationBlocker() {
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const dispatch = useDispatch()

  const handleLogout = () => {
    dispatch(logout())
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const reason = tenant?.terminationNotice?.reason

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-dark-900 flex flex-col items-center justify-center p-6 text-center antialiased overflow-y-auto">
      <div className="w-full max-w-lg flex flex-col items-center my-auto py-10">
        
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-auto h-20 flex items-center justify-center mb-4">
            {tenant?.branding?.logo ? (
              <img src={tenant.branding.logo} alt="Logo" className="w-full h-full object-contain rounded-xl bg-white" />
            ) : (
              <img src="/maqdernewlogo.webp" alt="Maqder" className="h-full w-auto object-contain" />
            )}
          </div>
        </div>

        <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
          {language === 'ar' ? 'تم إيقاف اللوحة' : 'Panel Terminated'}
        </h1>
        
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
          {language === 'ar' 
            ? 'لقد تم إنهاء الوصول إلى هذا النظام نهائياً. يرجى التواصل مع قسم المبيعات لاستعادة حسابك.'
            : 'Access to this system has been permanently terminated. Please contact sales to reactivate your account.'}
        </p>
        
        {reason && (
          <div className="w-full max-w-sm mb-10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              {language === 'ar' ? 'سبب الإيقاف' : 'Reason for termination'}
            </p>
            <p className="text-gray-900 dark:text-gray-100 text-lg font-medium bg-gray-50 dark:bg-dark-800 py-4 px-6 rounded-2xl border border-gray-100 dark:border-dark-700">
              {reason}
            </p>
          </div>
        )}

        {/* Contact Sales Section */}
        <div className="w-full max-w-sm bg-gray-50 dark:bg-dark-800 rounded-3xl p-6 mb-10 border border-gray-100 dark:border-dark-700 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
            {language === 'ar' ? 'تواصل مع المبيعات' : 'Contact Sales'}
          </h3>
          <div className="flex flex-col gap-3">
            <a href="mailto:support@maqder.com" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-white dark:bg-dark-900 rounded-xl text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors shadow-sm border border-gray-100 dark:border-dark-700 font-medium">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              support@maqder.com
            </a>
            <div className="grid grid-cols-2 gap-3">
              <a href="tel:+966596775485" className="flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-dark-900 rounded-xl text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors shadow-sm border border-gray-100 dark:border-dark-700 font-medium">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Call
              </a>
              <a href="https://wa.me/966596775485" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 px-4 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-xl transition-colors shadow-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogout} 
          className="group inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-gray-900/20 dark:shadow-white/10"
        >
          <LogOut className="w-4 h-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  )
}

// ─── Inactive Blocker (tenant stopped by super admin) ─────────────────────────

export function isTenantInactive(tenant) {
  if (!tenant) return false
  return tenant.isActive === false
}

export function InactiveBlocker() {
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const dispatch = useDispatch()
  const isAr = language === 'ar'

  const [dots, setDots] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 600)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => {
    dispatch(logout())
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-center p-6 select-none overflow-hidden">
      {/* Animated background rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-white/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
        {/* Icon */}
        <div className="relative mb-10">
          <div className="w-32 h-32 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center shadow-2xl shadow-amber-500/10">
            <PauseCircle className="w-16 h-16 text-amber-400" strokeWidth={1.5} />
          </div>
          <div className="absolute -inset-4 rounded-[2.5rem] border border-amber-500/10 animate-pulse" />
        </div>

        {/* Main Message */}
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-none mb-6"
          style={{ textShadow: '0 0 60px rgba(251,191,36,0.15)' }}
        >
          {isAr ? 'هذه اللوحة' : 'This Panel Is'}
          <br />
          <span className="text-amber-400">
            {isAr ? 'غير متاحة' : 'Not Available'}
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 mb-3 max-w-lg leading-relaxed">
          {isAr
            ? 'تم إيقاف هذا الحساب مؤقتاً من قِبل المسؤول. يرجى التواصل مع الدعم لإعادة تفعيله.'
            : 'This account has been temporarily suspended by the administrator. Please contact support to reactivate it.'}
        </p>

        <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-12">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
          <span>{isAr ? 'انتظار إعادة التفعيل' : 'Waiting for reactivation'}{''.padEnd(dots, '.')}</span>
        </div>

        {/* Contact card */}
        <div className="w-full max-w-sm bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-6 mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            {isAr ? 'تواصل مع الدعم' : 'Contact Support'}
          </p>
          <div className="flex flex-col gap-3">
            <a href="mailto:support@maqder.com"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium text-sm"
            >
              <Mail className="w-4 h-4" />
              support@maqder.com
            </a>
            <div className="grid grid-cols-2 gap-3">
              <a href="tel:+966596775485"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium text-sm"
              >
                <Phone className="w-4 h-4" />
                {isAr ? 'اتصال' : 'Call'}
              </a>
              <a href="https://wa.me/966596775485" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#4ade80] rounded-xl transition-colors font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          {isAr ? 'تسجيل الخروج' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
