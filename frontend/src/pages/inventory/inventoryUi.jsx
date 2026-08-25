/** Shared inventory UI tokens — reuse Maqder primary/status classes only */

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

export const INV_NAV = [
  { id: 'overview', path: '/app/dashboard/inventory', end: true, en: 'Overview', ar: 'نظرة عامة' },
  { id: 'products', path: '/app/dashboard/inventory/products', en: 'Products', ar: 'المنتجات' },
  { id: 'warehouses', path: '/app/dashboard/inventory/warehouses', en: 'Warehouses', ar: 'المستودعات' },
  { id: 'manufacturing', path: '/app/dashboard/inventory/manufacturing', en: 'Manufacturing', ar: 'التصنيع' },
  { id: 'mrp', path: '/app/dashboard/inventory/mrp', en: 'MRP', ar: 'تخطيط الاحتياجات' },
  { id: 'receipts', path: '/app/dashboard/inventory/receipts', code: 'incoming', en: 'Receipts', ar: 'الاستلامات' },
  { id: 'deliveries', path: '/app/dashboard/inventory/deliveries', code: 'outgoing', en: 'Deliveries', ar: 'التسليمات' },
  { id: 'internal', path: '/app/dashboard/inventory/internal', code: 'internal', en: 'Internal', ar: 'داخلي' },
  { id: 'physical', path: '/app/dashboard/inventory/physical', en: 'Physical', ar: 'جرد' },
  { id: 'scrap', path: '/app/dashboard/inventory/scrap', en: 'Scrap', ar: 'خردة' },
  { id: 'lots', path: '/app/dashboard/inventory/lots', en: 'Lots', ar: 'دفعات' },
  { id: 'moves', path: '/app/dashboard/inventory/moves', en: 'Moves', ar: 'حركات' },
  { id: 'replenish', path: '/app/dashboard/inventory/replenishment', en: 'Replenish', ar: 'توريد' },
  { id: 'routes', path: '/app/dashboard/inventory/routes', en: 'Routes', ar: 'مسارات' },
  { id: 'putaway', path: '/app/dashboard/inventory/putaway', en: 'Putaway', ar: 'تخزين' },
  { id: 'valuation', path: '/app/dashboard/inventory/valuation', en: 'Valuation', ar: 'تقييم' },
  { id: 'reports', path: '/app/dashboard/inventory/reports', en: 'Reports', ar: 'تقارير' },
  { id: 'stock', path: '/app/dashboard/inventory/stock', en: 'Stock', ar: 'المخزون' },
  { id: 'settings', path: '/app/dashboard/inventory/settings', en: 'Settings', ar: 'إعدادات' },
];
