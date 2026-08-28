/**
 * Ultra-premium minimal tokens for Contacts (directory + partner form).
 * Aligned with Sales list chrome and Inventory KPI/filter patterns.
 */

export {
  filterBarClass,
  listShellClass,
  fieldControlClass,
  fieldLabelClass,
  sectionCardClass,
  emptyStateClass,
  paginationBarClass,
  rowActionBtnClass,
  rowActionPrimaryClass,
  rowActionsWrapClass,
  backBtnClass,
  selectTileClass,
  ghostActionClass,
  softChipClass,
  salesTabClass as contactTabClass,
} from '../sales/salesUi'

export const contactsEyebrowClass =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300'

export const contactsTitleClass =
  'mt-1 font-[Outfit,sans-serif] text-3xl font-semibold tracking-tight text-slate-900 dark:text-white'

export const contactsSubtitleClass =
  'mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400'

export const contactsTableClass = 'w-full min-w-[820px] text-sm'

export const contactsThClass =
  'px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 bg-slate-50/90 border-b border-slate-200/90 dark:bg-dark-800/90 dark:text-slate-400 dark:border-dark-600'

export const contactsTdClass =
  'px-4 py-4 border-b border-slate-100 align-middle dark:border-dark-700'

export const contactsTrClass =
  'bg-white transition-colors hover:bg-slate-50/70 dark:bg-dark-800 dark:hover:bg-dark-700/35'

export const kpiTileClass = (active) =>
  `rounded-2xl border p-4 text-start transition ${
    active
      ? 'border-teal-200 bg-white shadow-[0_16px_40px_-24px_rgba(20,184,166,.45)] ring-1 ring-teal-100 dark:border-teal-800/60 dark:ring-teal-900/40'
      : 'border-slate-200/90 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-dark-600 dark:bg-dark-800/50 dark:hover:bg-dark-800'
  }`

export const kpiTileIconClass =
  'flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'

export const kpiTileValueClass =
  'font-[Outfit,sans-serif] text-2xl font-semibold tabular-nums text-slate-900 dark:text-white'

export const kpiTileLabelClass =
  'mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400'

export const primaryBtnClass =
  'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'

export const outlinedBtnClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700'

export const createMenuClass =
  'absolute end-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800'

export const createMenuItemClass =
  'flex w-full items-start gap-2.5 px-3.5 py-3 text-start transition hover:bg-slate-50 dark:hover:bg-dark-700'

export const formCanvasClass =
  'min-h-[calc(100vh-6rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-dark-900 dark:via-dark-900 dark:to-dark-950'

export const formTabBarClass =
  'flex flex-wrap gap-1 border-b border-slate-200/90 dark:border-dark-600'

export const entitySegmentWrapClass =
  'grid grid-cols-2 gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-dark-600 dark:bg-dark-800/80'

export const entitySegmentClass = (active) =>
  `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active
      ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-950'
      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
  }`

export const roleCheckClass =
  'inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200'

export const avatarClass = (tint = 'bg-slate-100 text-slate-700') =>
  `flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ring-1 ring-black/[0.04] ${tint}`

export const typeChipClass = (tint) =>
  `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-black/[0.04] ${tint}`

export const statusActiveClass =
  'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40'

export const statusInactiveClass =
  'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200/80 dark:bg-dark-700 dark:text-slate-400'

export const searchInputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 ps-10 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-dark-500 dark:bg-dark-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400'
