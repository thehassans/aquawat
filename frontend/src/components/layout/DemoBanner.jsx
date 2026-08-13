import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Clock, X, AlertTriangle } from 'lucide-react'
import { getSubscriptionState } from '../../lib/subscriptionState'

function formatTimeRemaining(ms) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, expired: false }
}

export default function DemoBanner() {
  const navigate = useNavigate()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'

  const [timeLeft, setTimeLeft] = useState(null)
  const [showBanner, setShowBanner] = useState(true)

  const subState = getSubscriptionState(tenant)
  const isDemo = tenant?.isDemo === true
  const isTrialPlan = subState.isTrialPlan
  const trialEndsAt = subState.endDate
  const isUpgraded = tenant?.demoUpgraded === true
  const showForTrial = isDemo || (isTrialPlan && trialEndsAt)

  useEffect(() => {
    if (!showForTrial || !trialEndsAt || isUpgraded) return

    const updateTimer = () => {
      const remaining = new Date(trialEndsAt).getTime() - Date.now()
      setTimeLeft(formatTimeRemaining(remaining))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [showForTrial, trialEndsAt, isUpgraded])

  if (!showForTrial || isUpgraded || !showBanner) return null

  const expired = timeLeft?.expired || subState.isTrialEnded || subState.isExpired
  const urgent = timeLeft && !expired && timeLeft.days === 0

  return (
    <div className={`relative border-b px-4 py-2 text-sm ${
      expired
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : urgent
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-slate-200 bg-white text-slate-600'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {expired ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="truncate">
            {expired
              ? (isArabic ? 'انتهت التجربة — النظام مفتوح، اشترك للمتابعة' : 'Trial ended — subscribe to continue')
              : (
                <>
                  {isArabic ? 'تجربة — متبقي: ' : 'Trial — '}
                  {timeLeft && (
                    <span className="font-medium tabular-nums text-slate-900">
                      {timeLeft.days > 0 && `${timeLeft.days}d `}
                      {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  )}
                </>
              )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/demo-checkout')}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {expired
              ? (isArabic ? 'تغيير الباقة' : 'Change plan')
              : (isArabic ? 'اشترك' : 'Subscribe')}
          </button>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
