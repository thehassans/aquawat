import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass } from './inventoryUi'

const FLAGS = [
  { key: 'groupStockProductionLot', en: 'Lots & Serial Numbers', ar: 'الدفعات والأرقام التسلسلية' },
  { key: 'groupLotOnDeliverySlip', en: 'Display Lots on Delivery Slips', ar: 'عرض الدفعات على قسائم التسليم' },
  { key: 'moduleProductExpiry', en: 'Expiration Dates', ar: 'تواريخ الصلاحية' },
  { key: 'groupStockTrackingLot', en: 'Packages', ar: 'الطرود' },
  { key: 'groupStockPackaging', en: 'Product Packagings', ar: 'تعبئة المنتجات' },
  { key: 'groupStockMultiLocations', en: 'Multi Locations', ar: 'مواقع متعددة' },
  { key: 'groupStockAdvLocation', en: 'Multi-Step Routes', ar: 'مسارات متعددة الخطوات' },
  { key: 'groupStockStorageCategories', en: 'Storage Categories', ar: 'فئات التخزين' },
  { key: 'groupStockPutawayRules', en: 'Putaway Rules', ar: 'قواعد التخزين' },
  { key: 'groupUom', en: 'Units of Measure', ar: 'وحدات القياس' },
  { key: 'groupProductVariant', en: 'Product Variants', ar: 'متغيرات المنتج' },
  { key: 'schedulerEnabled', en: 'Scheduler', ar: 'المجدول' },
  { key: 'useLandedCosts', en: 'Landed Costs', ar: 'التكاليف المرسية' },
  { key: 'stockAccountingEnabled', en: 'Stock Accounting Journals', ar: 'قيود تقييم المخزون' },
  { key: 'groupStockSignDelivery', en: 'Sign Deliveries', ar: 'توقيع التسليم' },
  { key: 'groupStockReceptionReport', en: 'Reception Report', ar: 'تقرير الاستلام' },
  { key: 'groupStockAutoReception', en: 'Auto Reception', ar: 'استلام تلقائي' },
  { key: 'stockMoveEmailValidation', en: 'Email Validation', ar: 'تحقق بالبريد' },
]

const ACCOUNT_FIELDS = [
  { key: 'propertyStockValuationAccountId', en: 'Inventory valuation', ar: 'حساب المخزون', hint: '1300' },
  { key: 'propertyStockInputAccountId', en: 'Stock interim received', ar: 'وسيط الاستلام', hint: '1310' },
  { key: 'propertyStockOutputAccountId', en: 'Stock interim delivered', ar: 'وسيط التسليم', hint: '1320' },
  { key: 'propertyLandedCostAccountId', en: 'Landed cost counterpart', ar: 'مقابل التكاليف المرسية', hint: '2200' },
]

export default function StockSettingsPage() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })

  const save = useMutation({
    mutationFn: (payload) => api.patch('/stock/settings', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      queryClient.invalidateQueries(['stock-settings'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const accountOptions = Array.isArray(accounts) ? accounts : (accounts.accounts || [])

  return (
    <div className="card p-6 max-w-2xl space-y-6 text-sm">
      <p className="text-slate-600 dark:text-slate-300">
        {isAr
          ? 'محرك المخزون Odoo-style. فعّل الميزات حسب الحاجة.'
          : 'Odoo-style stock engine. Toggle feature flags as needed.'}
      </p>

      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-dark-600">
        <div>
          <div className="font-medium">{isAr ? 'تفعيل محرك المخزون' : 'Stock engine enabled'}</div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAr
              ? 'عند التفعيل يُنشأ المستودع ووحدات القياس الافتراضية ويُحظر تعديل المخزون القديم'
              : 'Enabling bootstraps warehouses/UoMs and blocks legacy direct stock writes'}
          </p>
        </div>
        <input
          type="checkbox"
          checked={data?.engineEnabled === true}
          onChange={(e) => save.mutate({ engineEnabled: e.target.checked })}
        />
      </div>

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

      <div className="border-t border-slate-200 dark:border-dark-600 pt-4 space-y-3">
        <h3 className="font-medium">{isAr ? 'أوقات التوريد' : 'Lead times'}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { key: 'securityLeadTime', en: 'Security lead time', ar: 'هامش الأمان' },
            { key: 'daysToPurchase', en: 'Days to purchase', ar: 'أيام الشراء' },
            { key: 'poLeadTime', en: 'PO lead time', ar: 'مهلة أمر الشراء' },
          ].map((f) => (
            <div key={f.key}>
              <label className="label">{isAr ? f.ar : f.en}</label>
              <input
                type="number"
                className={fieldControlClass}
                defaultValue={data?.[f.key] ?? 0}
                key={`${f.key}-${data?._id || 'x'}-${data?.[f.key]}`}
                onBlur={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isNaN(n) && n !== data?.[f.key]) save.mutate({ [f.key]: n })
                }}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">{isAr ? 'شهر الجرد السنوي' : 'Annual inventory month'}</label>
            <input
              type="number"
              min={1}
              max={12}
              className={fieldControlClass}
              defaultValue={data?.annualInventoryMonth ?? 12}
              key={`m-${data?._id}-${data?.annualInventoryMonth}`}
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n) && n !== data?.annualInventoryMonth) save.mutate({ annualInventoryMonth: n })
              }}
            />
          </div>
          <div>
            <label className="label">{isAr ? 'يوم الجرد السنوي' : 'Annual inventory day'}</label>
            <input
              type="number"
              min={1}
              max={31}
              className={fieldControlClass}
              defaultValue={data?.annualInventoryDay ?? 31}
              key={`d-${data?._id}-${data?.annualInventoryDay}`}
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n) && n !== data?.annualInventoryDay) save.mutate({ annualInventoryDay: n })
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-dark-600 pt-4 space-y-3">
        <h3 className="font-medium">{isAr ? 'حسابات المخزون (اختياري)' : 'Stock accounts (optional)'}</h3>
        <p className="text-xs text-slate-500">
          {isAr ? 'اتركها فارغة لاستخدام الرموز الافتراضية' : 'Leave empty to use default COA codes'}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{isAr ? f.ar : f.en} ({f.hint})</label>
              <select
                className={fieldControlClass}
                value={data?.[f.key] ? String(data[f.key]) : ''}
                onChange={(e) => save.mutate({ [f.key]: e.target.value || null })}
              >
                <option value="">{isAr ? `افتراضي ${f.hint}` : `Default ${f.hint}`}</option>
                {accountOptions.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.code} — {a.nameEn || a.nameAr || a.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
