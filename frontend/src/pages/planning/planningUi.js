/** Shared ultra-minimal tokens for MRP, MES, and planning surfaces. */
export {
  pageTitleClass,
  pageSubtitleClass,
  sectionCardClass,
  filterBarClass,
  listShellClass,
  salesTableClass,
  salesThClass,
  salesTdClass,
  salesTrClass,
  ghostActionClass,
  softChipClass,
  dangerActionClass,
  fieldControlClass,
  fieldLabelClass,
  sectionEyebrowClass,
  sectionTitleClass,
  rowActionBtnClass,
  rowActionPrimaryClass,
  rowActionsWrapClass,
  paginationBarClass,
  emptyStateClass,
  chipFilterClass,
  salesTabClass,
} from '../sales/salesUi'

export const pageHeaderClass =
  'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'

export const statGridClass = 'grid grid-cols-2 lg:grid-cols-4 gap-3'

export const statCardClass =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.22)] dark:border-dark-600 dark:bg-dark-800'

export const statLabelClass =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400'

export const statValueClass =
  'mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white'

export const statHintClass =
  'mt-1 text-[11px] text-slate-400 dark:text-slate-500'

export const primaryBtnClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-45 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'

export const secondaryBtnClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700'

export const planTabsWrapClass =
  'flex gap-1 overflow-x-auto border-b border-slate-200/90 pb-px dark:border-dark-600'

export const metricTrackClass = 'mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-700'

export const metricFillClass = 'h-full rounded-full bg-slate-900 dark:bg-white'

export const wipTileClass =
  'rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]'

export const variantPillClass =
  'mt-0.5 inline-flex text-[11px] font-medium text-teal-700 dark:text-teal-300'

export const monoCellClass = 'font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200'

export const suggestCellClass =
  'font-mono text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-300'
