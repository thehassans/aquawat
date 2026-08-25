import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const CARRIERS = [
  { key: 'moduleCarrierSmsa', label: 'SMSA', note: 'Saudi — connector not installed' },
  { key: 'moduleCarrierAramex', label: 'Aramex', note: 'Saudi — connector not installed' },
  { key: 'moduleCarrierNaqel', label: 'Naqel', note: 'Saudi — connector not installed' },
  { key: 'moduleCarrierUps', label: 'UPS', note: 'Connector not installed — contact admin' },
  { key: 'moduleCarrierDhl', label: 'DHL', note: 'Connector not installed — contact admin' },
  { key: 'moduleCarrierFedex', label: 'FedEx', note: 'Connector not installed — contact admin' },
  { key: 'moduleCarrierUsps', label: 'USPS', note: 'Connector not installed — contact admin' },
  { key: 'moduleCarrierEasypost', label: 'Easypost', note: 'Connector not installed — contact admin' },
  { key: 'moduleCarrierSendcloud', label: 'Sendcloud', note: 'Connector not installed — contact admin' },
]

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`flex items-start gap-3 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="mt-0.5 rounded border-slate-300 text-primary-600"
        checked={!!checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>
        <span className="block text-slate-800 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  )
}

export default function InventorySettingsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
  })

  const [draft, setDraft] = useState(null)
  const current = draft || settings || {}
  const dirty = draft != null

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const setField = (key, value) => setDraft({ ...current, [key]: value })
  const toggle = (key) => {
    const next = { ...current, [key]: !current[key] }
    if (key === 'groupAdvLocation' && next.groupAdvLocation) {
      next.groupStockMultiLocations = true
    }
    setDraft(next)
  }

  const saveMut = useMutation({
    mutationFn: (body) => api.patch('/stock/settings', body),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['stock-settings'] })
      qc.invalidateQueries({ queryKey: ['inventory-menu'] })
      setDraft(null)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const ensureAcc = useMutation({
    mutationFn: () => api.post('/stock/accounting/ensure-accounts'),
    onSuccess: () => toast.success(ar ? 'تم تجهيز الحسابات' : 'Stock accounts ready'),
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const smsOk = !!current.smsProviderConfigured

  const stickyBar = useMemo(
    () => (
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-1 py-3 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'إعدادات المخزون' : 'Inventory Settings'}
          </h2>
          <p className="text-xs text-slate-500">
            {ar ? 'كل مفتاح يتحكم بالقائمة والسلوك' : 'Each flag gates menu and engine behaviour'}
            {dirty ? (ar ? ' · تغييرات غير محفوظة' : ' · Unsaved changes') : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ensureAcc.mutate()}>
            {ar ? 'تجهيز الحسابات' : 'Ensure accounts'}
          </button>
          {dirty && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>
              {ar ? 'تجاهل' : 'Discard'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending || !dirty}
            onClick={() => saveMut.mutate(draft)}
          >
            {ar ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    ),
    [ar, dirty, draft, ensureAcc, saveMut],
  )

  if (isLoading && !settings) return <div className="text-sm text-slate-500">…</div>

  return (
    <div className="space-y-5 pb-16">
      {stickyBar}

      <Section title={ar ? 'العمليات' : 'Operations'}>
        <Toggle
          label={ar ? 'الطرود' : 'Packages'}
          hint={ar ? 'تتبع الطرود ووضع في طرد' : 'Put in pack + package tracking'}
          checked={current.groupStockTrackingLot}
          onChange={() => toggle('groupStockTrackingLot')}
        />
        <Toggle
          label={ar ? 'تحويلات دفعية' : 'Batch Transfers'}
          checked={current.groupBatchTransfer}
          onChange={() => toggle('groupBatchTransfer')}
        />
        <Toggle
          label={ar ? 'تحذيرات الشركاء' : 'Partner warnings'}
          checked={current.groupStockWarning}
          onChange={() => toggle('groupStockWarning')}
        />
        <Toggle
          label={ar ? 'الجودة' : 'Quality checks'}
          checked={current.moduleQuality}
          onChange={() => toggle('moduleQuality')}
        />
        <Toggle
          label={ar ? 'تقرير الاستلام' : 'Reception report'}
          checked={current.receptionReportEnabled || current.groupReceptionReport}
          onChange={() => toggle('receptionReportEnabled')}
        />
        <div className="sm:col-span-2">
          <label className="label text-xs">{ar ? 'سياسة الانتقاء' : 'Picking policy'}</label>
          <select
            className="select select-sm max-w-xs"
            value={current.defaultPickingPolicy || 'direct'}
            onChange={(e) => setField('defaultPickingPolicy', e.target.value)}
          >
            <option value="direct">{ar ? 'مباشر (مع طلبات متأخرة)' : 'Direct (ship as available)'}</option>
            <option value="one">{ar ? 'شحنة واحدة (كل البنود)' : 'One (all moves available)'}</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">{ar ? 'يوم الجرد السنوي' : 'Annual inventory day'}</label>
          <input type="number" min={1} max={31} className="input input-sm" value={current.annualInventoryDay ?? 31} onChange={(e) => setField('annualInventoryDay', Number(e.target.value))} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'شهر الجرد السنوي' : 'Annual inventory month'}</label>
          <input type="number" min={1} max={12} className="input input-sm" value={current.annualInventoryMonth ?? 12} onChange={(e) => setField('annualInventoryMonth', Number(e.target.value))} />
        </div>
      </Section>

      <Section title={ar ? 'الباركود' : 'Barcode'}>
        <Toggle
          label={ar ? 'ماسح الباركود' : 'Barcode scanner'}
          checked={current.groupStockBarcode}
          onChange={() => toggle('groupStockBarcode')}
        />
        <Toggle
          label={ar ? 'GS1 للدفعات' : 'GS1 barcodes for lots'}
          checked={current.groupGs1Nomenclature}
          onChange={() => toggle('groupGs1Nomenclature')}
        />
        <p className="sm:col-span-2 text-xs text-slate-500">
          <Link to="/app/dashboard/inventory/barcode" className="text-primary-600 hover:underline">
            {ar ? 'تسمية الباركود' : 'Barcode nomenclature'}
          </Link>
          {' · '}
          <a href="/barcode-commands.pdf" className="text-primary-600 hover:underline" target="_blank" rel="noreferrer">
            {ar ? 'ورقة أوامر الطباعة' : 'Print command sheet'}
          </a>
        </p>
      </Section>

      <Section title={ar ? 'الشحن' : 'Shipping'}>
        <Toggle
          label={ar ? 'تأكيد بالبريد' : 'Email confirmation'}
          hint={ar ? 'يُرسل للعميل عند تحقق التسليم الصادر' : 'Sends to partner on outgoing validate'}
          checked={current.emailConfirmationOnDelivery}
          onChange={() => toggle('emailConfirmationOnDelivery')}
        />
        <Toggle
          label={ar ? 'تأكيد بالرسائل' : 'SMS confirmation'}
          hint={smsOk
            ? (ar ? 'يُرسل للعميل عند تحقق التسليم الصادر' : 'Sends to partner on outgoing validate')
            : (ar ? 'لا يوجد مزود رسائل مُعدّ' : 'No SMS provider configured')}
          checked={current.stockSmsConfirmation}
          disabled={!smsOk && !current.stockSmsConfirmation}
          onChange={() => toggle('stockSmsConfirmation')}
        />
        <Toggle
          label={ar ? 'توقيع عند التسليم' : 'Signature on delivery'}
          checked={current.signatureOnDelivery || current.groupStockSignDelivery}
          onChange={() => toggle('signatureOnDelivery')}
        />
        <Toggle
          label={ar ? 'طرق التسليم' : 'Delivery methods'}
          checked={current.groupDeliveryMethods}
          onChange={() => toggle('groupDeliveryMethods')}
        />
        <div className="sm:col-span-2 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-dark-800/60">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {ar ? 'موصلات الشحن (واجهة فقط — بلا API حي)' : 'Shipping connectors (UI only — no live API)'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CARRIERS.map((c) => (
              <Toggle
                key={c.key}
                label={c.label}
                hint={c.note}
                checked={current[c.key]}
                onChange={() => toggle(c.key)}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title={ar ? 'المنتجات' : 'Products'}>
        <Toggle label={ar ? 'المتغيرات' : 'Variants'} checked={current.groupProductVariant} onChange={() => toggle('groupProductVariant')} />
        <Toggle label={ar ? 'وحدات القياس' : 'Units of measure'} checked={current.groupUom} onChange={() => toggle('groupUom')} />
        <Toggle label={ar ? 'تعبئة المنتجات' : 'Product packagings'} checked={current.groupStockPackaging} onChange={() => toggle('groupStockPackaging')} />
      </Section>

      <Section title={ar ? 'التتبع' : 'Traceability'}>
        <Toggle label={ar ? 'الدفعات والأرقام التسلسلية' : 'Lots & serial numbers'} checked={current.groupProductionLot} onChange={() => toggle('groupProductionLot')} />
        <Toggle label={ar ? 'تواريخ الصلاحية' : 'Expiration dates'} checked={current.moduleProductExpiry} onChange={() => toggle('moduleProductExpiry')} />
        <Toggle label={ar ? 'الدفعات على سند التسليم' : 'Lots on delivery slips'} checked={current.showLotsOnDeliverySlips ?? current.groupLotOnDeliverySlip} onChange={() => toggle('showLotsOnDeliverySlips')} />
        <Toggle label={ar ? 'الدفعات على الفواتير' : 'Lots on invoices'} checked={current.showLotsOnInvoices ?? current.groupLotOnInvoice} onChange={() => toggle('showLotsOnInvoices')} />
        <Toggle label={ar ? 'الأمانة (مالك المخزون)' : 'Consignment (owner)'} checked={current.groupStockTrackingOwner} onChange={() => toggle('groupStockTrackingOwner')} />
      </Section>

      <Section title={ar ? 'التقييم' : 'Valuation'}>
        <Toggle label={ar ? 'محرك المخزون' : 'Inventory engine'} checked={current.engineEnabled} onChange={() => toggle('engineEnabled')} />
        <Toggle label={ar ? 'قيود تقييم المخزون' : 'Stock accounting'} checked={current.stockAccountingEnabled} onChange={() => toggle('stockAccountingEnabled')} />
        <Toggle label={ar ? 'التكاليف الإضافية' : 'Landed costs'} checked={current.groupLandedCosts} onChange={() => toggle('groupLandedCosts')} />
      </Section>

      <Section title={ar ? 'المستودع' : 'Warehouse'}>
        <Toggle
          label={ar ? 'مواقع التخزين' : 'Storage locations'}
          hint={ar ? 'إيقافه مرفوض إن وُجد مخزون في مواقع متعددة' : 'Cannot turn off while stock sits in multiple locations'}
          checked={current.groupStockMultiLocations}
          onChange={() => toggle('groupStockMultiLocations')}
        />
        <Toggle
          label={ar ? 'مسارات متعددة الخطوات' : 'Multi-step routes'}
          hint={ar ? 'يفعّل مواقع التخزين تلقائياً' : 'Force-enables storage locations'}
          checked={current.groupAdvLocation}
          onChange={() => toggle('groupAdvLocation')}
        />
        <Toggle label={ar ? 'فئات التخزين' : 'Storage categories'} checked={current.groupStockStorageCategories} onChange={() => toggle('groupStockStorageCategories')} />
        <Toggle label={ar ? 'قواعد التخزين' : 'Putaway rules'} checked={current.groupPutawayRules} onChange={() => toggle('groupPutawayRules')} />
        <Toggle label={ar ? 'تقييد المستودع' : 'Enforce warehouse restriction'} checked={current.enforceWarehouseRestriction} onChange={() => toggle('enforceWarehouseRestriction')} />
      </Section>

      <Section title={ar ? 'الجدولة المتقدمة' : 'Advanced scheduling'}>
        <div>
          <label className="label text-xs">{ar ? 'مهلة أمان المبيعات (أيام)' : 'Security lead — sales (days)'}</label>
          <input type="number" min={0} className="input input-sm" value={current.securityLeadTimeSales ?? 0} onChange={(e) => setField('securityLeadTimeSales', Number(e.target.value))} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'مهلة أمان الشراء (أيام)' : 'Security lead — purchase (days)'}</label>
          <input type="number" min={0} className="input input-sm" value={current.securityLeadTimePurchase ?? 0} onChange={(e) => setField('securityLeadTimePurchase', Number(e.target.value))} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'أيام حتى الشراء' : 'Days to purchase'}</label>
          <input type="number" min={0} className="input input-sm" value={current.daysToPurchase ?? 0} onChange={(e) => setField('daysToPurchase', Number(e.target.value))} />
        </div>
        <Toggle label={ar ? 'تفعيل المجدول' : 'Scheduler enabled'} checked={current.schedulerEnabled} onChange={() => toggle('schedulerEnabled')} />
      </Section>

      <Section title={ar ? 'القوائم' : 'Menu extras'}>
        <Toggle label={ar ? 'قائمة نقطة البيع' : 'PoS Orders menu'} checked={current.menuPos} onChange={() => toggle('menuPos')} />
        <Toggle label={ar ? 'قائمة التصنيع' : 'Manufacturing menu'} checked={current.menuManufacturing} onChange={() => toggle('menuManufacturing')} />
      </Section>

      <p className="text-xs text-slate-500">
        <Link to="/app/dashboard/inventory/import-export" className="text-primary-600 hover:underline">
          {ar ? 'استيراد / تصدير' : 'Import / Export'}
        </Link>
      </p>

      <MaintenanceSection language={language} />
    </div>
  )
}

function MaintenanceSection({ language }) {
  const { user } = useSelector((s) => s.auth)
  const qc = useQueryClient()
  const ar = language === 'ar'
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const bootstrap = useMutation({
    mutationFn: () => api.post('/stock/bootstrap'),
    onSuccess: () => {
      toast.success(ar ? 'تم التهيئة' : 'Bootstrap complete')
      qc.invalidateQueries({ queryKey: ['stock-'] })
      qc.invalidateQueries({ queryKey: ['inventory-menu'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const migrate = useMutation({
    mutationFn: () => api.post('/stock/migrate-opening-balances', { batchSize: 100, enableEngineAfter: true }),
    onSuccess: (res) => {
      toast.success(ar ? `ترحيل ${res.data.migrated} رصيد` : `Migrated ${res.data.migrated} balances`)
      qc.invalidateQueries({ queryKey: ['stock-'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const syncCache = useMutation({
    mutationFn: () => api.post('/stock/sync-product-cache', {}),
    onSuccess: (res) => {
      toast.success(ar ? `مزامنة ${res.data.synced ?? 0} منتج` : `Synced ${res.data.synced ?? 0} products`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  if (!isAdmin) return null

  const confirmRun = (message, run) => {
    if (window.confirm(message)) run()
  }

  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {ar ? 'الصيانة (مسؤول فقط)' : 'Maintenance (admin only)'}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {ar ? 'عمليات تغيّر بيانات المستأجر. أكّد قبل التشغيل.' : 'These change tenant data. Confirm before running.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={bootstrap.isPending}
          onClick={() => confirmRun(
            ar ? 'تهيئة المواقع وأنواع العمليات والمسارات؟' : 'Bootstrap locations, operation types, and routes?',
            () => bootstrap.mutate(),
          )}
        >
          {ar ? 'تهيئة' : 'Bootstrap'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={migrate.isPending}
          onClick={() => confirmRun(
            ar ? 'ترحيل الأرصدة الافتتاحية عبر تسوية مخزون؟' : 'Migrate opening balances via inventory adjustment?',
            () => migrate.mutate(),
          )}
        >
          {ar ? 'ترحيل الأرصدة' : 'Migrate balances'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={syncCache.isPending}
          onClick={() => confirmRun(
            ar ? 'إعادة بناء كاش الكميات على المنتجات؟' : 'Rebuild product on-hand cache?',
            () => syncCache.mutate(),
          )}
        >
          {ar ? 'مزامنة الكاش' : 'Sync product cache'}
        </button>
      </div>
    </section>
  )
}
