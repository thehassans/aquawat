import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, ArrowRight, Crown, Shield, Zap, Star, Sparkles, RotateCcw, Home } from 'lucide-react'
import api from '../lib/api'
import { useDispatch, useSelector } from 'react-redux'
import { getMe } from '../store/slices/authSlice'

const paymentLogos = {
  tabby: { src: '/tabby.png', alt: 'Tabby', className: 'h-7 w-auto' },
  tamara: { src: '/tamara.webp', alt: 'Tamara', className: 'h-7 w-auto' },
}

export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')

  const paymentId = searchParams.get('id')
  const paymentStatus = searchParams.get('status')
  const tenantId = searchParams.get('tenantId')
  const invoiceId = searchParams.get('invoice_id')
  const method = searchParams.get('method')
  const sessionId = searchParams.get('session_id')
  const logo = paymentLogos[method]

  useEffect(() => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const checkPayment = async () => {
      if (paymentStatus === 'failed' || paymentStatus === 'canceled') {
        setStatus('failed')
        setMessage(paymentStatus === 'failed' ? 'Payment failed. Please try again.' : 'Payment was canceled.')
        return
      }

      // Stripe Checkout success redirect
      if (method === 'stripe' && sessionId) {
        try {
          await api.get(`/payments/stripe-session/${sessionId}`)
          await dispatch(getMe())
          setStatus('success')
        } catch {
          if (tenantId) {
            for (let attempt = 0; attempt < 6; attempt++) {
              try {
                const { data } = await api.get(`/payments/tenant-status/${tenantId}`)
                if (data.demoUpgraded) {
                  await dispatch(getMe())
                  setStatus('success')
                  return
                }
              } catch { /* retry */ }
              await sleep(1200)
            }
          }
          setStatus('pending')
        }
        return
      }

      // Invoice-based flow: Moyasar redirects with invoice_id/tenantId (no payment ID).
      // Directly verify the invoice status (also applies the upgrade server-side as a
      // fallback in case the webhook hasn't landed yet), then poll tenant-status.
      if (tenantId) {
        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            if (invoiceId) {
              await api.get(`/payments/invoice/${invoiceId}`)
            }
            const { data } = await api.get(`/payments/tenant-status/${tenantId}`)
            if (data.demoUpgraded) {
              await dispatch(getMe())
              setStatus('success')
              return
            }
          } catch {
            // ignore and retry
          }
          await sleep(1500)
        }
        setStatus('pending')
        return
      }

      if (!paymentId) {
        setStatus('error')
        setMessage('No payment ID provided')
        return
      }

      if (paymentStatus === 'paid' || paymentStatus === 'successful') {
        try {
          await api.get(`/payments/${paymentId}`)
          await dispatch(getMe())
          setStatus('success')
        } catch {
          setStatus('success')
        }
        return
      }

      try {
        const { data } = await api.get(`/payments/${paymentId}`)
        if (data.status === 'paid') {
          await dispatch(getMe())
          setStatus('success')
        } else if (data.status === 'failed' || data.status === 'canceled') {
          setStatus('failed')
          setMessage('Payment was not completed.')
        } else {
          setStatus('pending')
        }
      } catch {
        setStatus('error')
        setMessage('Could not verify payment status.')
      }
    }

    checkPayment()
  }, [paymentId, paymentStatus, tenantId, invoiceId, dispatch])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {/* Checking state */}
        {status === 'checking' && (
          <motion.div
            key="checking"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-dark-800 shadow-2xl p-12 text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-dark-700">
              <Loader2 className="h-10 w-10 animate-spin text-[#0f3d2e]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isArabic ? 'جاري التحقق من الدفع...' : 'Verifying Payment...'}
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {isArabic ? 'يرجى الانتظار حتى نؤكد عملية الدفع الخاصة بك.' : 'Please wait while we confirm your payment.'}
            </p>
          </motion.div>
        )}

        {/* Success state — ultra premium */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-dark-800 shadow-2xl"
          >
            {/* Premium header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0f3d2e] via-[#1a5d44] to-[#0a2a1f] px-8 pt-12 pb-10 text-center text-white">
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2), transparent 60%)' }} />
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm border-2 border-white/30"
              >
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-black tracking-tight"
              >
                {isArabic ? 'تم الدفع بنجاح!' : 'Payment Successful!'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mt-2 text-sm text-white/70"
              >
                {isArabic ? 'تمت ترقية حسابك — مرحباً بك في النسخة الكاملة' : 'Your account has been upgraded — welcome to the full version'}
              </motion.p>
              {logo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 flex justify-center"
                >
                  <img src={logo.src} alt={logo.alt} className={`${logo.className} brightness-0 invert`} />
                </motion.div>
              )}
            </div>

            {/* Body */}
            <div className="px-8 py-8">
              {/* Welcome message */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mb-6 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-800/5 p-5 text-center"
              >
                <Crown className="mx-auto mb-2 h-7 w-7 text-amber-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isArabic ? 'مرحباً بك في عائلة ماقدر!' : 'Welcome to the Maqder family!'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isArabic ? 'تم إرسال بريد ترحيبي إلى بريدك الإلكتروني بتفاصيل اشتراكك.' : 'A welcome email has been sent to your inbox with your subscription details.'}
                </p>
              </motion.div>

              {/* Feature list */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="mb-6 grid grid-cols-2 gap-3"
              >
                {[
                  { icon: Shield, text: isArabic ? 'فوترة إلكترونية' : 'E-Invoicing' },
                  { icon: Zap, text: isArabic ? 'موارد بشرية' : 'HR & Payroll' },
                  { icon: Star, text: isArabic ? 'تقارير متقدمة' : 'Advanced Reports' },
                  { icon: Sparkles, text: isArabic ? 'كل الميزات' : 'All Features' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-dark-700 px-3.5 py-3">
                    <f.icon className="h-4 w-4 text-[#0f3d2e] dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{f.text}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                onClick={() => navigate('/app/dashboard')}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#0f3d2e] to-[#1a5d44] px-6 py-4 font-bold text-white shadow-lg shadow-[#0f3d2e]/20 transition hover:shadow-xl hover:shadow-[#0f3d2e]/30"
              >
                {isArabic ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}
                <ArrowRight className="h-5 w-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Failed state */}
        {status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-dark-800 shadow-2xl p-12 text-center"
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isArabic ? 'فشل الدفع' : 'Payment Failed'}
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{message}</p>
            <button
              onClick={() => navigate('/app/dashboard')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-200 dark:bg-dark-700 px-6 py-3 font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-300 dark:hover:bg-dark-600"
            >
              {isArabic ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
            </button>
          </motion.div>
        )}

        {/* Error / Pending state */}
        {(status === 'error' || status === 'pending') && (
          <motion.div
            key="error-pending"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-dark-800 shadow-2xl"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 px-8 pt-12 pb-10 text-center text-white">
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2), transparent 60%)' }} />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm border-2 border-white/30"
              >
                {status === 'pending' ? <Loader2 className="h-10 w-10 text-white animate-spin" /> : <XCircle className="h-10 w-10 text-white" />}
              </motion.div>
              <h2 className="text-3xl font-black tracking-tight">
                {status === 'error' ? (isArabic ? 'خطأ' : 'Error') : (isArabic ? 'الدفع قيد المعالجة' : 'Payment Pending')}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {message || (isArabic ? 'يتم معالجة دفعتك. سيتم تفعيل حسابك قريباً.' : 'Your payment is being processed. Your account will be activated shortly.')}
              </p>
              {logo && (
                <div className="mt-4 flex justify-center">
                  <img src={logo.src} alt={logo.alt} className={`${logo.className} brightness-0 invert`} />
                </div>
              )}
            </div>
            <div className="px-8 py-8">
              <div className="flex flex-col gap-3">
                {status === 'pending' && (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#0f3d2e] to-[#1a5d44] px-6 py-4 font-bold text-white shadow-lg shadow-[#0f3d2e]/20 transition hover:shadow-xl hover:shadow-[#0f3d2e]/30"
                  >
                    <RotateCcw className="h-5 w-5" />
                    {isArabic ? 'تحقق مرة أخرى' : 'Check Again'}
                  </button>
                )}
                <button
                  onClick={() => navigate('/app/dashboard')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-dark-700 px-6 py-3 font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-dark-600"
                >
                  <Home className="h-4 w-4" />
                  {isArabic ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
