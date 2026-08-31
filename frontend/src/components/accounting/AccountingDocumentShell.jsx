import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { backBtnClass, ghostActionClass, pageSubtitleClass, pageTitleClass, sectionEyebrowClass } from '../../pages/sales/salesUi'

export function DocumentStatusRibbon({ steps = [], activeStep, language = 'en', cancelled = false }) {
  const isAr = language === 'ar'
  if (cancelled) {
    return (
      <div className="flex gap-1 rounded-xl bg-red-50 p-1 dark:bg-red-950/30">
        <div className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-red-700 shadow-sm dark:bg-dark-800 dark:text-red-300">
          {isAr ? 'ملغاة' : 'Cancelled'}
        </div>
      </div>
    )
  }

  const activeIndex = steps.findIndex((s) => s.id === activeStep)

  return (
    <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-dark-700">
      {steps.map((step, index) => {
        const active = step.id === activeStep
        const completed = activeIndex >= 0 && index < activeIndex
        return (
          <div
            key={step.id}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-semibold ${
              active
                ? 'bg-white text-slate-800 shadow-sm dark:bg-dark-800 dark:text-slate-100'
                : completed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
            }`}
          >
            {isAr ? step.ar : step.en}
            {index < steps.length - 1 ? (
              <ChevronRight className={`hidden h-3 w-3 sm:inline ${active ? 'text-slate-300' : 'text-slate-300/70'}`} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function DocumentActionBar({ children, className = '' }) {
  return (
    <div className={`sticky top-0 z-20 -mx-1 border-b border-slate-200/80 bg-[#f8f9fb]/95 px-1 py-2 backdrop-blur dark:border-white/10 dark:bg-[#0b0f16]/95 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function DocumentSmartButtons({ buttons = [], language = 'en' }) {
  if (!buttons.length) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {buttons.map((btn) => {
        const label = typeof btn.label === 'function' ? btn.label(language) : btn.label
        const content = (
          <>
            {btn.icon ? <span className="inline-flex">{btn.icon}</span> : null}
            {label}
          </>
        )
        if (btn.href) {
          return (
            <Link key={btn.id || label} to={btn.href} className={ghostActionClass}>
              {content}
            </Link>
          )
        }
        return (
          <button
            key={btn.id || label}
            type="button"
            className={ghostActionClass}
            onClick={btn.onClick}
            disabled={btn.disabled}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

export function DocumentFormTabs({ tabs = [], activeTab, onChange, language = 'en' }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 dark:border-white/10 dark:bg-dark-800">
      {tabs.map((tab) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${
              active
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200'
            }`}
          >
            {language === 'ar' ? tab.labelAr : tab.labelEn}
            {tab.count != null ? (
              <span className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Unified Odoo-style document chrome: breadcrumb, title, status ribbon (top-right),
 * frozen action bar, smart buttons, and optional tab strip.
 */
export default function AccountingDocumentShell({
  language = 'en',
  eyebrow,
  title,
  subtitle,
  backTo,
  onBack,
  statusSteps = [],
  activeStatusStep,
  statusCancelled = false,
  actionBar,
  smartButtons = [],
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  const isAr = language === 'ar'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {onBack || backTo ? (
            backTo ? (
              <Link to={backTo} className={backBtnClass} aria-label={isAr ? 'رجوع' : 'Back'}>
                ←
              </Link>
            ) : (
              <button type="button" onClick={onBack} className={backBtnClass} aria-label={isAr ? 'رجوع' : 'Back'}>
                ←
              </button>
            )
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className={sectionEyebrowClass}>{eyebrow}</p> : null}
            <h1 className={pageTitleClass}>{title}</h1>
            {subtitle ? <p className={pageSubtitleClass}>{subtitle}</p> : null}
          </div>
        </div>
        {statusSteps.length ? (
          <div className="w-full max-w-md shrink-0 lg:w-72">
            <DocumentStatusRibbon
              steps={statusSteps}
              activeStep={activeStatusStep}
              language={language}
              cancelled={statusCancelled}
            />
          </div>
        ) : null}
      </div>

      {actionBar ? <DocumentActionBar>{actionBar}</DocumentActionBar> : null}
      {smartButtons.length ? <DocumentSmartButtons buttons={smartButtons} language={language} /> : null}
      {tabs?.length ? (
        <DocumentFormTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} language={language} />
      ) : null}
      {children}
    </div>
  )
}
