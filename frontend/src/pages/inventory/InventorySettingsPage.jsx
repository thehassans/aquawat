import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
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

function Section({ title, children, search, matchKeys = [] }) {
  const q = (search || '').trim().toLowerCase()
  const visible = !q || matchKeys.some((k) => String(k).toLowerCase().includes(q))
    || String(title).toLowerCase().includes(q)
  if (!visible) return null
  return (
    <section className="space-y-3 rounded-xl border border-slate-200/80 p-4 dark:border-dark-600" data-section={title}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Toggle({ label, hint, checked, onChange, disabled, notImplemented, search }) {
  const q = (search || '').trim().toLowerCase()
  const blob = `${label} ${hint || ''}`.toLowerCase()
  if (q && !blob.includes(q)) return null
  return (
    <label className={`flex items-start gap-3 text-sm ${disabled || notImplemented ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="mt-0.5 rounded border-slate-300 text-primary-600"
        checked={!!checked}
        disabled={disabled || notImplemented}
        onChange={onChange}
      />
      <span>
        <span className="block text-slate-800 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
        {notImplemented && (
          <span className="mt-0.5 block text-xs font-medium text-amber-700">
            Not implemented
          </span>
        )}
      </span>
    </label>
  )
}

function AccountSelect({ label, hint, value, onChange, options, search, emptyLabel = '—' }) {
  const q = (search || '').trim().toLowerCase()
  const blob = `${label} ${hint || ''}`.toLowerCase()
  if (q && !blob.includes(q)) return null
  const selected = value && typeof value === 'object' ? (value._id || '') : (value || '')
  return (
    <div className="sm:col-span-2">
      <label className="label text-xs">{label}</label>
      {hint && <p className="mb-1 text-xs text-slate-500">{hint}</p>}
      <select
        className="input input-sm"
        value={selected}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{emptyLabel}</option>
        {(options || []).map((o) => (
          <option key={o._id} value={o._id}>{o.label}</option>
        ))}
      </select>
    </div>
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
  const { data: accounts } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })
  const { data: journalBooks } = useQuery({
    queryKey: ['stock-journal-books', 'stock'],
    queryFn: () => api.get('/stock/journal-books', { params: { type: 'stock' } }).then((r) => r.data || []),
    staleTime: 60_000,
  })

  const accountOptions = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts.filter((a) => a?.isActive !== false) : []
    return list.map((a) => ({
      _id: a._id,
      label: a.code
        ? `${a.code} · ${ar ? (a.nameAr || a.name) : a.name}`
        : (ar ? (a.nameAr || a.name) : a.name),
    }))
  }, [accounts, ar])

  const journalOptions = useMemo(() => {
    const list = Array.isArray(journalBooks) ? journalBooks.filter((j) => j?.active !== false) : []
    return list.map((j) => ({
      _id: j._id,
      label: j.code ? `${j.code} · ${ar ? (j.nameAr || j.name) : j.name}` : (ar ? (j.nameAr || j.name) : j.name),
    }))
  }, [journalBooks, ar])

  const [draft, setDraft] = useState(null)
  const [accountGaps, setAccountGaps] = useState(null)
  const [search, setSearch] = useState('')
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
    onSuccess: (res) => {
      const data = res.data || {}
      qc.invalidateQueries({ queryKey: ['stock-settings'] })
      qc.invalidateQueries({ queryKey: ['stock-journal-books'] })
      if (data.ok) {
        toast.success(ar ? 'كل فئات التقييم الآلي مكتملة' : 'All automated categories have accounts')
        setAccountGaps(null)
      } else {
        setAccountGaps(data)
        toast(ar
          ? `${data.gapCount} فئة تحتاج حسابات`
          : `${data.gapCount} categor${data.gapCount === 1 ? 'y' : 'ies'} missing accounts`, {
          icon: '⚠️',
        })
      }
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const smsOk = !!current.smsProviderConfigured

  const stickyBar = useMemo(
    () => (
      <div className="sticky top-0 z-10 -mx-1 space-y-3 border-b border-slate-200/80 bg-white/95 px-1 py-3 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              {ar ? 'التحقق من الحسابات' : 'Ensure accounts'}
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
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full ps-9"
            placeholder={ar ? 'بحث في الإعدادات…' : 'Search settings…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
    ),
    [ar, dirty, draft, ensureAcc, saveMut, search],
  )

  if (isLoading && !settings) return <div className="text-sm text-slate-500">…</div>

  const s = search

  return (
    <div className="space-y-5 pb-16">
      {stickyBar}

      {accountGaps && !accountGaps.ok && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {ar ? 'فجوات حسابات التقييم الآلي' : 'Automated valuation account gaps'}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {ar
                  ? 'لم تُنشأ حسابات تلقائياً — عيّن الحسابات الخمسة على كل فئة.'
                  : 'Nothing was auto-created on categories — set the five accounts on each gap.'}
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccountGaps(null)}>
              {ar ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
            {(accountGaps.gaps || []).map((g) => (
              <li key={g.categoryId} className="rounded-lg bg-white/70 px-2 py-1.5 dark:bg-dark-900/40">
                <Link
                  className="font-medium text-primary-700 hover:underline dark:text-primary-300"
                  to={`/app/dashboard/inventory/product-categories/${g.categoryId}/edit`}
                >
                  {g.completePath || g.name}
                </Link>
                <span className="ms-2 text-slate-500">missing: {(g.missing || []).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title={ar ? 'العمليات' : 'Operations'} search={s} matchKeys={['packages', 'batch', 'warning', 'quality', 'reception', 'picking', 'annual', 'negative']}>
        <Toggle search={s} label={ar ? 'الطرود' : 'Packages'} hint={ar ? 'تتبع الطرود ووضع في طرد' : 'Put in pack + package tracking'} checked={current.groupStockTrackingLot} onChange={() => toggle('groupStockTrackingLot')} />
        <Toggle search={s} label={ar ? 'تحويلات دفعية' : 'Batch Transfers'} checked={current.groupBatchTransfer} onChange={() => toggle('groupBatchTransfer')} />
        <Toggle search={s} label={ar ? 'تحذير الشريك' : 'Partner warnings'} checked={current.groupStockWarning} onChange={() => toggle('groupStockWarning')} />
        <Toggle search={s} label={ar ? 'الجودة' : 'Quality'} checked={current.moduleQuality} onChange={() => toggle('moduleQuality')} />
        <Toggle search={s} label={ar ? 'تقرير الاستلام' : 'Reception report'} checked={current.receptionReportEnabled ?? current.groupReceptionReport} onChange={() => toggle('receptionReportEnabled')} />
        <Toggle
          search={s}
          label={ar ? 'السماح بالمخزون السالب للكل' : 'Allow all negative stock'}
          hint={ar ? 'تجاوز فئة المنتج — يسمح بالكميات السالبة عند الاعتماد' : 'Overrides product category — allows negative qty on validate'}
          checked={current.allowNegativeStock}
          onChange={() => toggle('allowNegativeStock')}
        />
        <div className="sm:col-span-2">
          <label className="label text-xs">{ar ? 'سياسة الجني' : 'Picking policy'}</label>
          <select className="select select-sm mt-1" value={current.defaultPickingPolicy || 'direct'} onChange={(e) => setField('defaultPickingPolicy', e.target.value)}>
            <option value="direct">{ar ? 'مباشر' : 'Direct'}</option>
            <option value="one">{ar ? 'كامل' : 'All at once'}</option>
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

      <Section title={ar ? 'الباركود' : 'Barcode'} search={s} matchKeys={['barcode', 'gs1', 'scanner']}>
        <Toggle search={s} label={ar ? 'ماسح الباركود' : 'Barcode scanner'} checked={current.groupStockBarcode} onChange={() => toggle('groupStockBarcode')} />
        <Toggle search={s} label={ar ? 'تسمية GS1' : 'GS1 nomenclature'} checked={current.groupGs1Nomenclature} onChange={() => toggle('groupGs1Nomenclature')} />
      </Section>

      <Section title={ar ? 'الشحن' : 'Shipping'} search={s} matchKeys={['email', 'sms', 'signature', 'delivery', 'carrier', 'shipping']}>
        <Toggle search={s} label={ar ? 'تأكيد بالبريد' : 'Email confirmation'} checked={current.emailConfirmationOnDelivery} onChange={() => toggle('emailConfirmationOnDelivery')} />
        <Toggle search={s} label={ar ? 'تأكيد SMS' : 'SMS confirmation'} checked={current.stockSmsConfirmation} onChange={() => toggle('stockSmsConfirmation')} disabled={!smsOk} hint={!smsOk ? (ar ? 'فعّل مزود SMS أولاً' : 'Configure SMS provider first') : undefined} />
        <Toggle search={s} label={ar ? 'توقيع التسليم' : 'Signature on delivery'} checked={current.signatureOnDelivery ?? current.groupStockSignDelivery} onChange={() => toggle('signatureOnDelivery')} />
        <Toggle search={s} label={ar ? 'طرق التسليم' : 'Delivery methods'} checked={current.groupDeliveryMethods} onChange={() => toggle('groupDeliveryMethods')} />
        <div className="sm:col-span-2 space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-dark-600">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{ar ? 'الناقلون' : 'Carriers'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CARRIERS.map((c) => (
              <Toggle
                key={c.key}
                search={s}
                label={c.label}
                hint={c.note}
                checked={current[c.key]}
                onChange={() => toggle(c.key)}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title={ar ? 'المنتجات' : 'Products'} search={s} matchKeys={['variant', 'uom', 'packaging', 'product']}>
        <Toggle search={s} label={ar ? 'المتغيرات' : 'Variants'} checked={current.groupProductVariant} onChange={() => toggle('groupProductVariant')} />
        <Toggle search={s} label={ar ? 'وحدات القياس' : 'Units of measure'} hint={ar ? 'قائمة الوحدات + تحويل في المحرك' : 'UoM list + engine conversion'} checked={current.groupUom} onChange={() => toggle('groupUom')} />
        <Toggle search={s} label={ar ? 'تعبئة المنتجات' : 'Product packagings'} hint={ar ? 'كمية لكل عبوة · اختيار على أسطر النقل' : 'Qty per pack · selector on transfer lines'} checked={current.groupStockPackaging} onChange={() => toggle('groupStockPackaging')} />
        <p className="sm:col-span-2 text-xs text-slate-500">
          <Link to="/app/dashboard/inventory/uom" className="text-primary-600 hover:underline">{ar ? 'وحدات القياس' : 'Units of measure'}</Link>
          {' · '}
          <Link to="/app/dashboard/inventory/product-packagings" className="text-primary-600 hover:underline">{ar ? 'تعبئة المنتجات' : 'Product packagings'}</Link>
        </p>
      </Section>

      <Section title={ar ? 'التتبع' : 'Traceability'} search={s} matchKeys={['lot', 'serial', 'expiry', 'consignment', 'owner']}>
        <Toggle search={s} label={ar ? 'الدفعات والأرقام التسلسلية' : 'Lots & serial numbers'} checked={current.groupProductionLot} onChange={() => toggle('groupProductionLot')} />
        <Toggle search={s} label={ar ? 'تواريخ الصلاحية' : 'Expiration dates'} checked={current.moduleProductExpiry} onChange={() => toggle('moduleProductExpiry')} />
        <Toggle search={s} label={ar ? 'الدفعات على سند التسليم' : 'Lots on delivery slips'} checked={current.showLotsOnDeliverySlips ?? current.groupLotOnDeliverySlip} onChange={() => toggle('showLotsOnDeliverySlips')} />
        <Toggle search={s} label={ar ? 'الدفعات على الفواتير' : 'Lots on invoices'} checked={current.showLotsOnInvoices ?? current.groupLotOnInvoice} onChange={() => toggle('showLotsOnInvoices')} />
        <Toggle search={s} label={ar ? 'الأمانة (مالك المخزون)' : 'Consignment (owner)'} checked={current.groupStockTrackingOwner} onChange={() => toggle('groupStockTrackingOwner')} />
      </Section>

      <Section title={ar ? 'التقييم' : 'Valuation'} search={s} matchKeys={['valuation', 'evaluation', 'average', 'costing', 'accounting', 'landed', 'engine', 'avco', 'journal', 'account', 'interim', 'cogs']}>
        <Toggle search={s} label={ar ? 'محرك المخزون' : 'Inventory engine'} checked={current.engineEnabled} onChange={() => toggle('engineEnabled')} />
        <Toggle
          search={s}
          label={ar ? 'تقييم المخزون (متوسط التكلفة)' : 'Inventory evaluation (AVCO / FIFO)'}
          hint={ar ? 'يحدّث متوسط التكلفة عند الاستلام ويكتب طبقات التقييم' : 'Updates average cost on receipt and writes valuation layers'}
          checked={current.inventoryEvaluationEnabled !== false}
          onChange={() => setField('inventoryEvaluationEnabled', !(current.inventoryEvaluationEnabled !== false))}
        />
        <Toggle search={s} label={ar ? 'قيود تقييم المخزون' : 'Stock accounting'} hint={ar ? 'قيود اليومية عند التقييم' : 'Journal entries when evaluation runs'} checked={current.stockAccountingEnabled} onChange={() => toggle('stockAccountingEnabled')} />
        <Toggle search={s} label={ar ? 'التكاليف الإضافية' : 'Landed costs'} checked={current.groupLandedCosts} onChange={() => toggle('groupLandedCosts')} />
        {current.stockAccountingEnabled !== false && (
          <>
            <p className="sm:col-span-2 text-xs text-slate-500">
              {ar
                ? 'حسابات المستأجر الافتراضية — تُستخدم عند غياب تجاوز المنتج / الفئة / الموقع.'
                : 'Tenant defaults — used when product / category / location overrides are empty.'}
            </p>
            <AccountSelect
              search={s}
              label={ar ? 'دفتر المخزون الافتراضي' : 'Default stock journal'}
              hint={ar ? 'ترقيم قيود التقييم (مثل STJ)' : 'Valuation entry numbering (e.g. STJ)'}
              value={current.stockJournalId}
              onChange={(v) => setField('stockJournalId', v)}
              options={journalOptions}
              emptyLabel={ar ? '— دفتر النظام STJ —' : '— System STJ —'}
            />
            <AccountSelect
              search={s}
              label={ar ? 'حساب تقييم المخزون' : 'Stock valuation account'}
              hint="1300"
              value={current.propertyStockValuationAccountId}
              onChange={(v) => setField('propertyStockValuationAccountId', v)}
              options={accountOptions}
            />
            <AccountSelect
              search={s}
              label={ar ? 'حساب إدخال المخزون (وسيط)' : 'Stock input (interim)'}
              hint="1310"
              value={current.propertyStockInputAccountId}
              onChange={(v) => setField('propertyStockInputAccountId', v)}
              options={accountOptions}
            />
            <AccountSelect
              search={s}
              label={ar ? 'حساب إخراج المخزون' : 'Stock output account'}
              hint="1320 / COGS"
              value={current.propertyStockOutputAccountId}
              onChange={(v) => setField('propertyStockOutputAccountId', v)}
              options={accountOptions}
            />
            <AccountSelect
              search={s}
              label={ar ? 'حساب التكلفة الإضافية' : 'Landed cost credit account'}
              hint="2200"
              value={current.propertyLandedCostAccountId}
              onChange={(v) => setField('propertyLandedCostAccountId', v)}
              options={accountOptions}
            />
          </>
        )}
      </Section>

      <Section title={ar ? 'المستودع' : 'Warehouse'} search={s} matchKeys={['location', 'route', 'storage', 'putaway', 'warehouse']}>
        <Toggle search={s} label={ar ? 'مواقع التخزين' : 'Storage locations'} hint={ar ? 'إيقافه مرفوض إن وُجد مخزون في مواقع متعددة' : 'Cannot turn off while stock sits in multiple locations'} checked={current.groupStockMultiLocations} onChange={() => toggle('groupStockMultiLocations')} />
        <Toggle search={s} label={ar ? 'مسارات متعددة الخطوات' : 'Multi-step routes'} hint={ar ? 'يفعّل مواقع التخزين تلقائياً' : 'Force-enables storage locations'} checked={current.groupAdvLocation} onChange={() => toggle('groupAdvLocation')} />
        <Toggle search={s} label={ar ? 'فئات التخزين' : 'Storage categories'} checked={current.groupStockStorageCategories} onChange={() => toggle('groupStockStorageCategories')} />
        <Toggle search={s} label={ar ? 'قواعد التخزين' : 'Putaway rules'} checked={current.groupPutawayRules} onChange={() => toggle('groupPutawayRules')} />
        <Toggle search={s} label={ar ? 'تقييد المستودع' : 'Enforce warehouse restriction'} checked={current.enforceWarehouseRestriction} onChange={() => toggle('enforceWarehouseRestriction')} />
      </Section>

      <Section title={ar ? 'الجدولة المتقدمة' : 'Advanced scheduling'} search={s} matchKeys={['lead', 'scheduler', 'purchase', 'days']}>
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
        <Toggle search={s} label={ar ? 'تفعيل المجدول' : 'Scheduler enabled'} checked={current.schedulerEnabled} onChange={() => toggle('schedulerEnabled')} />
      </Section>

      <Section title={ar ? 'القوائم' : 'Menu extras'} search={s} matchKeys={['pos', 'manufacturing', 'menu']}>
        <Toggle search={s} label={ar ? 'قائمة نقطة البيع' : 'PoS Orders menu'} checked={current.menuPos} onChange={() => toggle('menuPos')} />
        <Toggle search={s} label={ar ? 'قائمة التصنيع' : 'Manufacturing menu'} checked={current.menuManufacturing} onChange={() => toggle('menuManufacturing')} />
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
