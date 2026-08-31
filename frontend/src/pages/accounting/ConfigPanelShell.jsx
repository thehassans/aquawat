/**
 * Unified shell for Accounting → Configuration panels.
 * Surfaces purpose + backend impact so settings are treated as relational constraints.
 */
export function ConfigPanelShell({
  language,
  titleEn,
  titleAr,
  purposeEn,
  purposeAr,
  impactEn,
  impactAr,
  actions,
  children,
}) {
  const isAr = language === 'ar'
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.2)] dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-dark-800">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? titleAr : titleEn}</p>
        {(purposeEn || purposeAr) ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr ? purposeAr : purposeEn}
          </p>
        ) : null}
        {(impactEn || impactAr) ? (
          <p className="mt-2 rounded-xl border border-emerald-100/80 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-emerald-900/40 dark:bg-dark-900/50 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400/90">
              {isAr ? 'تأثير النظام' : 'System impact'}
            </span>
            {' · '}
            {isAr ? impactAr : impactEn}
          </p>
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}

export default ConfigPanelShell
