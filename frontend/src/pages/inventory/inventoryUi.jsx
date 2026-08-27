/** Shared inventory UI tokens — reuse Maqder primary/status classes only */

/** Horizontal-scroll list tables: prevents column crush when sidebar opens */
export const invTableWrapClass =
  'overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800'
export const invTableClass = 'w-full min-w-[720px] text-sm'
export const invThClass = 'min-w-[150px] px-4 py-3 text-start font-medium'
export const invTdClass = 'min-w-[150px] px-4 py-3'
export const invKpiCardClass =
  'rounded-xl border border-slate-200/70 bg-slate-50/90 px-3.5 py-3 dark:border-dark-600 dark:bg-dark-900/50'
export const invKpiLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400'
export const invKpiValueClass = 'mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-800 dark:text-slate-100'

export const TRANSFER_STATUS = {
  draft: {
    en: 'Draft',
    ar: 'مسودة',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  waiting: {
    en: 'Waiting',
    ar: 'انتظار',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  confirmed: {
    en: 'Confirmed',
    ar: 'مؤكد',
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  assigned: {
    en: 'Ready',
    ar: 'جاهز',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  done: {
    en: 'Done',
    ar: 'منجز',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  cancelled: {
    en: 'Cancelled',
    ar: 'ملغى',
    className: 'bg-slate-50 text-slate-400 line-through dark:bg-slate-900 dark:text-slate-500',
  },
};

export function StatusChip({ status, language = 'en' }) {
  const meta = TRANSFER_STATUS[status] || TRANSFER_STATUS.draft;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {language === 'ar' ? meta.ar : meta.en}
    </span>
  );
}

/** @deprecated v2 IA — use inventory.menu.js / GET /api/inventory/menu */
export { INVENTORY_MENU_TREE as INV_NAV } from './inventory.menu';
