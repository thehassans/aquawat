/**
 * Shared ultra-premium minimal tokens for Sales (invoices + quotations).
 * Keep create / view / studio surfaces aligned with the invoices list chrome.
 */

export const fieldLabelClass =
  'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200'

export const fieldControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400'

export const sectionCardClass =
  'rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] sm:p-6 dark:border-dark-600 dark:bg-dark-800'

export const sectionEyebrowClass =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300'

export const sectionTitleClass =
  'mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white'

export const pageTitleClass =
  'text-2xl font-bold tracking-tight text-slate-900 dark:text-white'

export const pageSubtitleClass =
  'mt-1 text-sm text-slate-500 dark:text-slate-400'

export const backBtnClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:bg-dark-700 dark:hover:text-white'

export const selectTileActiveClass =
  'border-slate-900 bg-slate-950 text-white shadow-lg dark:border-white dark:bg-white dark:text-slate-950'

export const selectTileIdleClass =
  'border-slate-200/90 bg-white hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800'

export const selectTileClass = (active) =>
  `group flex items-start gap-3 rounded-2xl border px-4 py-4 text-start transition ${
    active ? selectTileActiveClass : selectTileIdleClass
  }`

export const softChipClass =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'

export const actionBarClass =
  'flex flex-wrap items-center gap-2'

export const ghostActionClass =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700'

export const dangerActionClass =
  'inline-flex items-center gap-1.5 rounded-xl border border-red-200/90 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-red-300 hover:bg-red-50 dark:border-red-900/40 dark:bg-dark-800 dark:text-red-400 dark:hover:bg-red-950/30'

export const metaRowClass =
  'flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-300'

export const metaValueClass =
  'font-semibold text-slate-900 dark:text-white text-end'

/** List pages (Invoices / Quotations) */
export const filterBarClass =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.28)] space-y-3 dark:border-dark-600 dark:bg-dark-800'

export const listShellClass =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-24px_rgba(15,23,42,0.28)] dark:border-dark-600 dark:bg-dark-800'

export const salesTableClass = 'table-fixed w-full min-w-max text-sm'

export const salesPageShellClass = 'flex h-[calc(100vh-4rem)] flex-col'

export const salesGridScrollClass = 'flex-1 overflow-y-auto'

export const salesThClass =
  'px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 bg-slate-50/90 border-b border-slate-200/90 dark:bg-dark-800/90 dark:text-slate-400 dark:border-dark-600'

export const salesTdClass =
  'px-4 py-4 border-b border-slate-100 align-middle dark:border-dark-700'

export const salesTrClass =
  'bg-white transition-colors hover:bg-slate-50/70 dark:bg-dark-800 dark:hover:bg-dark-700/35'

export const docLinkClass =
  'inline-flex items-center gap-2 font-mono text-sm font-semibold text-slate-900 transition hover:text-teal-700 dark:text-white dark:hover:text-teal-300'

export const rowActionBtnClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'

export const rowActionPrimaryClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-teal-700 transition hover:bg-teal-50 hover:text-teal-800 disabled:opacity-40 dark:text-teal-300 dark:hover:bg-teal-950/30'

export const rowActionDangerClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/30'

export const rowActionsWrapClass =
  'inline-flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-0.5 dark:border-white/10 dark:bg-white/[0.03]'

export const chipFilterClass = (active) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
      : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-300 dark:hover:border-slate-500'
  }`

export const salesTabClass = (active) =>
  `relative px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? 'text-slate-900 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-slate-900 dark:text-white dark:after:bg-white'
      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
  }`

export const emptyStateClass =
  'py-16 text-center text-sm text-slate-400 dark:text-slate-500'

export const paginationBarClass =
  'flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row dark:border-dark-700'

