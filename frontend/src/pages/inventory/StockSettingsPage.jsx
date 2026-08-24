import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const FLAGS = [
  { key: 'groupStockProductionLot', en: 'Lots & Serial Numbers', ar: 'الدفعات والأرقام التسلسلية' },
  { key: 'moduleProductExpiry', en: 'Expiration Dates', ar: 'تواريخ الصلاحية' },
  { key: 'groupStockTrackingLot', en: 'Packages', ar: 'الطرود' },
  { key: 'groupStockPackaging', en: 'Product Packagings', ar: 'تعبئة المنتجات' },
  { key: 'groupStockMultiLocations', en: 'Multi Locations', ar: 'مواقع متعددة' },
  { key: 'groupStockAdvLocation', en: 'Multi-Step Routes', ar: 'مسارات متعددة الخطوات' },
  { key: 'groupStockStorageCategories', en: 'Storage Categories', ar: 'فئات التخزين' },
  { key: 'groupStockPutawayRules', en: 'Putaway Rules', ar: 'قواعد التخزين' },
  { key: 'groupUom', en: 'Units of Measure', ar: 'وحدات القياس' },
  { key: 'schedulerEnabled', en: 'Scheduler', ar: 'المجدول' },
  { key: 'useLandedCosts', en: 'Landed Costs', ar: 'التكاليف المرسية' },
  { key: 'stockAccountingEnabled', en: 'Stock Accounting Journals', ar: 'قيود تقييم المخزون' },
  { key: 'groupStockSignDelivery', en: 'Sign Deliveries', ar: 'توقيع التسليم' },
  { key: 'groupStockReceptionReport', en: 'Reception Report', ar: 'تقرير الاستلام' },
  { key: 'groupStockAutoReception', en: 'Auto Reception', ar: 'استلام تلقائي' },
  { key: 'stockMoveEmailValidation', en: 'Email Validation', ar: 'تحقق بالبريد' },
]

export default function StockSettingsPage() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
  })

  const save = useMutation({
    mutationFn: (payload) => api.patch('/stock/settings', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      queryClient.invalidateQueries(['stock-settings'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="card p-6 max-w-xl space-y-4 text-sm">
      <p className="text-slate-600 dark:text-slate-300">
        {isAr
          ? 'محرك المخزون Odoo-style. فعّل الميزات حسب الحاجة.'
          : 'Odoo-style stock engine. Toggle feature flags as needed.'}
      </p>
      <ul className="space-y-3">
        {FLAGS.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-4">
            <span>{isAr ? f.ar : f.en}</span>
            <input
              type="checkbox"
              checked={Boolean(data?.[f.key])}
              onChange={(e) => save.mutate({ [f.key]: e.target.checked })}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400">
        {isAr ? 'المحرك' : 'Engine'}: {data?.engineEnabled !== false ? (isAr ? 'مفعّل' : 'Enabled') : (isAr ? 'معطّل' : 'Disabled')}
      </p>
    </div>
  )
}
