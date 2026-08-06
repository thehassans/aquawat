import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, CheckCircle2, XCircle, Loader2, X, RefreshCw, Terminal } from 'lucide-react'
import api from '../../lib/api'

/* ─── Pure CSS/JS confetti particles ──────────────────────────────────────
   No external library. 5 emoji particles float upward on approval.        */
function ConfettiBurst() {
  const particles = ['🎉', '✨', '💳', '⭐', '🎊']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
      {particles.map((emoji, i) => (
        <motion.span
          key={i}
          className="absolute text-xl select-none"
          initial={{
            y: 0,
            x: (i - 2) * 30,
            opacity: 1,
            scale: 0.5,
          }}
          animate={{
            y: -120 - i * 15,
            x: (i - 2) * 50 + (i % 2 === 0 ? 10 : -10),
            opacity: 0,
            scale: 1.2,
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.1,
            ease: 'easeOut',
          }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  )
}

/* ─── Pulsing ring loader ─────────────────────────────────────────────────  */
function PulsingLoader() {
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {/* Outer pulsing rings */}
      <span className="absolute inline-flex h-28 w-28 rounded-full bg-primary-400/20 animate-ping" />
      <span className="absolute inline-flex h-20 w-20 rounded-full bg-primary-400/30 animate-ping" style={{ animationDelay: '0.3s' }} />
      {/* Inner bordered circle */}
      <div className="relative w-24 h-24 rounded-full border-4 border-primary-100 dark:border-primary-900/40 flex items-center justify-center bg-white dark:bg-dark-800 shadow-lg">
        <Loader2 className="w-11 h-11 text-primary-600 animate-spin" />
      </div>
    </div>
  )
}

/**
 * CardPaymentModal – drives a physical POS terminal card payment.
 *
 * Props:
 *  - open: boolean
 *  - amount: number
 *  - currency?: string          default 'SAR'
 *  - source/orderType/orderNumber?: metadata forwarded to the API
 *  - terminalLabel?: string     e.g. "Geidea Terminal 1" – shown in header
 *  - onApproved(payment):       called when the terminal approves the card
 *  - onDeclined?(payment):      optional – called on decline
 *  - onFailed?(payment):        optional – called on failure
 *  - onExpired?(payment):       optional – called on timeout/expiry
 *  - onClose():                 close without completing
 */
export default function CardPaymentModal({
  open,
  amount,
  currency = 'SAR',
  source = 'pos',
  orderType = '',
  orderNumber = '',
  terminalLabel = '',
  onApproved,
  onDeclined,
  onFailed,
  onExpired,
  onClose,
}) {
  const { language } = useSelector((state) => state.ui)
  const isRtl = language === 'ar'
  const [payment, setPayment] = useState(null)
  const [status, setStatus] = useState('idle') // idle | starting | processing | approved | declined | cancelled | failed | expired | error
  const [error, setError] = useState('')
  const [simulation, setSimulation] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const pollRef = useRef(null)
  const approvedFiredRef = useRef(false)

  const clearPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPayment = async () => {
    setError('')
    setStatus('starting')
    setShowConfetti(false)
    approvedFiredRef.current = false
    try {
      const { data } = await api.post('/pos/payments', { amount, currency, source, orderType, orderNumber })
      setPayment(data)
      setSimulation(Boolean(data.simulation))
      setStatus(data.status === 'approved' ? 'approved' : 'processing')
    } catch (err) {
      setStatus('error')
      setError(err.response?.data?.error || (isRtl ? 'تعذر بدء الدفع' : 'Could not start payment'))
    }
  }

  /* Initiate when opened */
  useEffect(() => {
    if (open) {
      startPayment()
    } else {
      clearPolling()
      setPayment(null)
      setStatus('idle')
      setError('')
      setShowConfetti(false)
    }
    return clearPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* Poll while processing */
  useEffect(() => {
    clearPolling()
    if (status !== 'processing' || !payment?._id) return

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/pos/payments/${payment._id}`)
        setPayment(data)
        if (['approved', 'declined', 'cancelled', 'failed', 'expired'].includes(data.status)) {
          setStatus(data.status)
          clearPolling()
        }
      } catch {
        // transient errors ignored; keep polling until timeout
      }
    }, 3000)

    return clearPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, payment?._id])

  /* Fire approval callback once + confetti */
  useEffect(() => {
    if (status === 'approved' && payment && !approvedFiredRef.current) {
      approvedFiredRef.current = true
      setShowConfetti(true)
      const timer = setTimeout(() => {
        onApproved?.(payment)
        onDeclined // noop reference to satisfy lint
      }, 900)
      return () => clearTimeout(timer)
    }
    // Fire specific callbacks
    if (status === 'declined' && payment) onDeclined?.(payment)
    if (status === 'failed' && payment) onFailed?.(payment)
    if (status === 'expired' && payment) onExpired?.(payment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, payment])

  const handleCancel = async () => {
    clearPolling()
    try {
      if (payment?._id && ['processing', 'starting'].includes(status)) {
        await api.post(`/pos/payments/${payment._id}/cancel`)
      }
    } catch {
      // ignore
    }
    onClose?.()
  }

  if (!open) return null

  const isWaiting = status === 'starting' || status === 'processing'
  const isFailure = ['declined', 'cancelled', 'failed', 'expired', 'error'].includes(status)

  const statusText = {
    starting: isRtl ? 'جارٍ إرسال المبلغ إلى الجهاز...' : 'Sending amount to terminal...',
    processing: isRtl ? 'في انتظار تمرير البطاقة على الجهاز...' : 'Waiting for card on the terminal...',
    approved: isRtl ? 'تمت الموافقة على الدفع' : 'Payment approved',
    declined: isRtl ? 'تم رفض البطاقة' : 'Card declined',
    cancelled: isRtl ? 'تم إلغاء الدفع' : 'Payment cancelled',
    failed: isRtl ? 'فشل الدفع' : 'Payment failed',
    expired: isRtl ? 'انتهت مهلة الدفع' : 'Payment timed out',
    error: error,
  }[status] || ''

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white dark:bg-dark-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                <CreditCard className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isRtl ? 'الدفع بالبطاقة' : 'Card Payment'}
                </h3>
                {terminalLabel && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Terminal className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{terminalLabel}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 flex flex-col items-center text-center relative">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {isRtl ? 'المبلغ المطلوب' : 'Amount due'}
            </div>
            <div className="text-4xl font-black text-gray-900 dark:text-white mt-1">
              {currency} {Number(amount).toFixed(2)}
            </div>
            {terminalLabel && (
              <div className="mt-2 text-xs text-gray-400 font-medium">
                {terminalLabel}
              </div>
            )}

            <div className="my-8 relative">
              {/* Processing: pulsing ring */}
              {isWaiting && <PulsingLoader />}

              {/* Approved: big checkmark + confetti */}
              {status === 'approved' && (
                <div className="relative">
                  {showConfetti && <ConfettiBurst />}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
                    className="w-28 h-28 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </motion.div>
                </div>
              )}

              {/* Failure */}
              {isFailure && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-28 h-28 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
                >
                  <XCircle className="w-16 h-16 text-red-500" />
                </motion.div>
              )}
            </div>

            <p className={`text-base font-semibold ${
              status === 'approved' ? 'text-green-600 dark:text-green-400'
                : isFailure ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {statusText}
            </p>

            {simulation && isWaiting && (
              <div className="mt-3 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {isRtl
                    ? 'وضع المحاكاة: ستتم الموافقة تلقائياً.'
                    : 'Simulation mode: payment will auto-approve.'}
                </p>
              </div>
            )}

            {payment?.approvalCode && status === 'approved' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 text-xs text-gray-600 dark:text-gray-300"
              >
                <span className="font-semibold">{isRtl ? 'رمز الموافقة:' : 'Approval code:'}</span>{' '}
                {payment.approvalCode}
                {payment.cardLast4
                  ? ` • ${payment.cardScheme || ''} ****${payment.cardLast4}`
                  : ''}
              </motion.div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-5 border-t border-gray-100 dark:border-dark-700 flex gap-3">
            {isWaiting && (
              <button onClick={handleCancel} className="flex-1 btn btn-secondary">
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            )}
            {isFailure && (
              <>
                <button onClick={handleCancel} className="flex-1 btn btn-secondary">
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
                <button onClick={startPayment} className="flex-1 btn btn-primary">
                  <RefreshCw className="w-4 h-4" />
                  {isRtl ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
