import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'

const FIXABLE = new Set([
  'customer',
  'b2b_vat',
  'seller_vat',
  'lines',
  'line_detail',
  'total',
  'income_account',
  'tax',
  'lock_date',
  'credit_limit',
])

/**
 * Ultra-premium collapsible pre-post checklist with click-to-fix.
 */
export default function InvoicePrePostChecklist({
  checks = [],
  canPost = false,
  hasWarnings = false,
  loading = false,
  language = 'en',
  className = '',
  onFix,
  defaultOpen,
}) {
  const isAr = language === 'ar'
  const failed = checks.filter((c) => !c.ok && c.blocking)
  const warnings = checks.filter((c) => !c.ok && !c.blocking)
  const passed = checks.filter((c) => c.ok)
  const failCount = failed.length
  const warnCount = warnings.length

  const [open, setOpen] = useState(() => (typeof defaultOpen === 'boolean' ? defaultOpen : false))

  useEffect(() => {
    if (failCount > 0) setOpen(true)
    else if (canPost && warnCount === 0) setOpen(false)
  }, [failCount, canPost, warnCount])

  const title = isAr ? 'قبل الترحيل' : 'Before posting'
  const statusLabel = loading
    ? (isAr ? 'جارٍ الفحص…' : 'Checking…')
    : !checks.length
      ? (isAr ? 'بانتظار البيانات' : 'Waiting for data')
      : !canPost
        ? (isAr ? `${failCount} يحتاج إصلاح` : `${failCount} to fix`)
        : hasWarnings
          ? (isAr ? 'تحذير — جاهز' : 'Ready with warning')
          : (isAr ? 'جاهز للترحيل' : 'Ready to post')

  const statusTone = loading
    ? 'slate'
    : !canPost
      ? 'rose'
      : hasWarnings
        ? 'amber'
        : 'emerald'

  const tone = {
    rose: {
      ring: 'ring-rose-500/15 border-rose-200/80 dark:border-rose-500/25',
      bar: 'from-rose-500/90 to-rose-600/80',
      chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
      glow: 'shadow-[0_12px_40px_-18px_rgba(225,29,72,0.55)]',
    },
    amber: {
      ring: 'ring-amber-500/15 border-amber-200/80 dark:border-amber-500/25',
      bar: 'from-amber-400/90 to-amber-500/80',
      chip: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
      glow: 'shadow-[0_12px_40px_-18px_rgba(217,119,6,0.45)]',
    },
    emerald: {
      ring: 'ring-emerald-500/15 border-emerald-200/80 dark:border-emerald-500/25',
      bar: 'from-emerald-500/90 to-teal-600/80',
      chip: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
      glow: 'shadow-[0_12px_40px_-18px_rgba(16,185,129,0.45)]',
    },
    slate: {
      ring: 'ring-slate-500/10 border-slate-200/80 dark:border-white/10',
      bar: 'from-slate-400/80 to-slate-500/70',
      chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
      glow: 'shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]',
    },
  }[statusTone]

  const handleFix = (check) => {
    if (check.ok) return
    if (!FIXABLE.has(check.id) && check.blocking !== false) {
      // duplicate warning — still allow callback for scroll/info
    }
    setOpen(true)
    onFix?.(check)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white/95 backdrop-blur-xl ring-1 dark:bg-[#0c111a]/95 ${tone.ring} ${tone.glow} ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${tone.bar}`} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !canPost ? (
            <XCircle className="h-4 w-4" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {statusLabel}
          </span>
        </span>
        {!loading && checks.length ? (
          <span className="hidden items-center gap-1 sm:flex" aria-hidden>
            {failCount > 0 ? (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {failCount}
              </span>
            ) : null}
            {warnCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-800 dark:text-amber-300">
                {warnCount}
              </span>
            ) : null}
            {canPost && !hasWarnings ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {passed.length}/{checks.length}
              </span>
            ) : null}
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100/90 px-2.5 pb-2.5 pt-1 dark:border-white/[0.06]">
              {!checks.length && !loading ? (
                <p className="px-2 py-3 text-xs text-slate-500">
                  {isAr ? 'أكمل الفاتورة لعرض الفحوصات' : 'Fill the invoice to see checks'}
                </p>
              ) : (
                <ul className="max-h-[min(52vh,22rem)] space-y-1 overflow-y-auto overscroll-contain pe-0.5">
                  {checks.map((c, index) => {
                    const msg = isAr ? (c.messageAr || c.message) : c.message
                    const isWarn = !c.blocking && !c.ok
                    const isFail = c.blocking && !c.ok
                    const clickable = !c.ok && (FIXABLE.has(c.id) || isWarn)
                    const ItemTag = clickable ? 'button' : 'div'
                    return (
                      <motion.li
                        key={c.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.24) }}
                      >
                        <ItemTag
                          type={clickable ? 'button' : undefined}
                          onClick={clickable ? () => handleFix(c) : undefined}
                          className={`group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start transition ${
                            clickable
                              ? isFail
                                ? 'hover:bg-rose-50/90 dark:hover:bg-rose-500/10'
                                : 'hover:bg-amber-50/90 dark:hover:bg-amber-500/10'
                              : c.ok
                                ? 'opacity-80'
                                : ''
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {c.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : isWarn ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-rose-500" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[12px] leading-snug ${
                                c.ok
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : isWarn
                                    ? 'font-medium text-amber-800 dark:text-amber-200'
                                    : 'font-medium text-rose-800 dark:text-rose-200'
                              }`}
                            >
                              {msg}
                            </span>
                            {clickable && isFail ? (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600/80 opacity-0 transition group-hover:opacity-100 dark:text-rose-300/90">
                                {isAr ? 'انقر للإصلاح' : 'Click to fix'}
                                <ArrowUpRight className="h-3 w-3" />
                              </span>
                            ) : null}
                            {clickable && isWarn ? (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700/80 opacity-0 transition group-hover:opacity-100">
                                {isAr ? 'عرض' : 'Review'}
                                <ArrowUpRight className="h-3 w-3" />
                              </span>
                            ) : null}
                          </span>
                        </ItemTag>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
