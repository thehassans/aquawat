import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { updateTenant } from '../../../store/slices/authSlice'
import { INCOTERMS } from '../salesConfig.menu'
import DocumentAppearancePanel, {
  appearancePayload,
  applyAppearanceToTenant,
  buildAppearanceFromTenant,
} from '../../../components/sales/DocumentAppearancePanel'
import {
  fieldControlClass,
  fieldLabelClass,
  sectionCardClass,
  sectionEyebrowClass,
  salesTabClass,
} from '../salesUi'

const TABS = [
  { id: 'general', en: 'General', ar: 'عام' },
  { id: 'quotation', en: 'Quotation', ar: 'عرض السعر' },
]

const saveBtnClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700'

export default function SalesSettingsPage() {
  const dispatch = useDispatch()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState({})
  const [appearance, setAppearance] = useState(() => buildAppearanceFromTenant(tenant))
  const [appearanceDirty, setAppearanceDirty] = useState(false)

  const { data } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: async () => (await api.get('/sales/settings')).data,
  })

  const { data: tenantFresh } = useQuery({
    queryKey: ['tenant-current-sales-settings'],
    queryFn: async () => (await api.get('/tenants/current')).data,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  useEffect(() => {
    if (!tenantFresh) return
    if (!appearanceDirty) {
      setAppearance(buildAppearanceFromTenant(tenantFresh))
    }
  }, [tenantFresh, appearanceDirty])

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const onAppearanceChange = (next) => {
    setAppearanceDirty(true)
    setAppearance(next)
  }

  const previewTenant = useMemo(
    () => applyAppearanceToTenant(tenantFresh || tenant, appearance),
    [tenant, tenantFresh, appearance],
  )

  const save = useMutation({
    mutationFn: async () => {
      const base = tenantFresh || tenant
      const existingBranding = base?.settings?.invoiceBranding || {}
      const [salesRes, tenantRes] = await Promise.all([
        api.patch('/sales/settings', form),
        api.put('/tenants/current', {
          settings: {
            invoiceBranding: {
              ...existingBranding,
              ...appearancePayload(appearance),
              logo: existingBranding.logo || base?.branding?.logo || '',
            },
          },
        }),
      ])
      return { sales: salesRes.data, tenant: tenantRes.data }
    },
    onSuccess: ({ tenant: nextTenant }) => {
      toast.success(isAr ? 'تم حفظ إعدادات المبيعات' : 'Sales settings saved')
      qc.invalidateQueries({ queryKey: ['sales-settings'] })
      qc.invalidateQueries({ queryKey: ['sales-configuration'] })
      qc.invalidateQueries({ queryKey: ['tenant-current-sales-settings'] })
      if (nextTenant) {
        dispatch(updateTenant(nextTenant))
        setAppearance(buildAppearanceFromTenant(nextTenant))
        setAppearanceDirty(false)
      }
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const checkClass = 'flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-3 text-sm font-medium text-slate-700 dark:border-dark-600 dark:bg-dark-800/60 dark:text-slate-200'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={sectionEyebrowClass}>{isAr ? 'إعدادات المستندات' : 'Document engine'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'إعدادات المبيعات' : 'Sales settings'}
          </h2>
        </div>
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={saveBtnClass}>
          {save.isPending ? '…' : (isAr ? 'حفظ الكل' : 'Save all')}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-dark-600 dark:bg-dark-800/50 dark:text-slate-300">
        {isAr ? 'إعدادات الفاتورة والمظهر والتوقيع أصبحت في المحاسبة.' : 'Invoice policy, appearance, and signatory live under Accounting.'}
        {' '}
        <Link
          to="/app/dashboard/accounting/invoices/settings"
          className="font-semibold text-primary-700 hover:underline dark:text-primary-300"
        >
          {isAr ? 'فتح إعدادات الفاتورة' : 'Open invoice settings'}
        </Link>
      </div>

      <div className="overflow-x-auto border-b border-slate-200/90 dark:border-dark-600">
        <nav className="flex min-w-max items-center gap-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={salesTabClass(tab === t.id)} onClick={() => setTab(t.id)}>
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'general' ? (
        <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'Incoterm افتراضي' : 'Default incoterm'}</label>
            <select className={fieldControlClass} value={form.defaultIncoterm || 'EXW'} onChange={(e) => set('defaultIncoterm', e.target.value)}>
              {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'وضع بوابة العملاء' : 'Customer portal signup'}</label>
            <select className={fieldControlClass} value={form.portalSignupMode || 'invitation_only'} onChange={(e) => set('portalSignupMode', e.target.value)}>
              <option value="disabled">{isAr ? 'معطّل' : 'Disabled'}</option>
              <option value="invitation_only">{isAr ? 'بدعوة فقط' : 'Invitation only'}</option>
              <option value="free_signup">{isAr ? 'تسجيل حر' : 'Free signup'}</option>
            </select>
          </div>
          <label className={checkClass}>
            <input type="checkbox" checked={form.lockConfirmedOrders !== false} onChange={(e) => set('lockConfirmedOrders', e.target.checked)} />
            {isAr ? 'قفل الطلبات المؤكدة' : 'Lock confirmed sales orders'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={form.enableSaleWarnings !== false} onChange={(e) => set('enableSaleWarnings', e.target.checked)} />
            {isAr ? 'تحذيرات البيع' : 'Enable sale warnings'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.showIncotermOnDocuments} onChange={(e) => set('showIncotermOnDocuments', e.target.checked)} />
            {isAr ? 'إظهار Incoterm في المستندات' : 'Show Incoterm on documents'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.showComputeShipping} onChange={(e) => set('showComputeShipping', e.target.checked)} />
            {isAr ? 'حساب الشحن' : 'Show compute shipping'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.showPromoCodes} onChange={(e) => set('showPromoCodes', e.target.checked)} />
            {isAr ? 'أكواد الخصم / العروض' : 'Show promo / coupon codes'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.showCrmTagsOnDocuments} onChange={(e) => set('showCrmTagsOnDocuments', e.target.checked)} />
            {isAr ? 'وسوم CRM على المستندات' : 'Show CRM tags on documents'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.showMarginsByDefault} onChange={(e) => set('showMarginsByDefault', e.target.checked)} />
            {isAr ? 'إظهار الهوامش افتراضياً' : 'Show margins by default'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.amazonSyncEnabled} onChange={(e) => set('amazonSyncEnabled', e.target.checked)} />
            {isAr ? 'مزامنة Amazon' : 'Amazon marketplace sync'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.requireOnlinePayment} onChange={(e) => set('requireOnlinePayment', e.target.checked)} />
            {isAr ? 'يتطلب دفعاً قبل التأكيد' : 'Require online payment before confirm'}
          </label>
          <label className={checkClass}>
            <input type="checkbox" checked={!!form.requireOnlineSignature} onChange={(e) => set('requireOnlineSignature', e.target.checked)} />
            {isAr ? 'يتطلب توقيعاً قبل التأكيد' : 'Require online signature before confirm'}
          </label>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'الحد الأدنى لهامش الربح %' : 'Minimum margin %'}</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className={fieldControlClass}
              value={form.minMarginPercent ?? 0}
              onChange={(e) => set('minMarginPercent', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'سياسة تجاوز المخزون' : 'Oversell policy'}</label>
            <select
              className={fieldControlClass}
              value={form.oversellPolicy || 'warn'}
              onChange={(e) => set('oversellPolicy', e.target.value)}
            >
              <option value="warn">{isAr ? 'تحذير والسماح' : 'Warn and allow'}</option>
              <option value="block">{isAr ? 'منع التأكيد' : 'Block confirm'}</option>
              <option value="allow">{isAr ? 'السماح دائماً' : 'Always allow'}</option>
            </select>
          </div>
        </div>
      ) : null}

      {tab === 'quotation' ? (
        <div className="space-y-6">
          <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'صلاحية العرض (أيام)' : 'Quotation validity (days)'}</label>
              <input type="number" min={1} max={365} className={fieldControlClass} value={form.quotationValidityDays ?? 30} onChange={(e) => set('quotationValidityDays', Number(e.target.value))} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'تنسيق عرض السعر الافتراضي' : 'Default quotation layout'}</label>
              <select
                className={fieldControlClass}
                value={Number(form.defaultQuotationTemplateId) === 1 ? 1 : 9}
                onChange={(e) => set('defaultQuotationTemplateId', Number(e.target.value))}
              >
                <option value={9}>{isAr ? 'ورق رسمي (Letterhead)' : 'Letterhead'}</option>
                <option value={1}>{isAr ? 'أساسي (Essential)' : 'Essential'}</option>
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {isAr
                  ? 'يُستخدم تلقائياً عند إنشاء عروض الأسعار الجديدة.'
                  : 'Applied automatically when creating new quotations.'}
              </p>
            </div>
            <label className={`${checkClass} self-end`}>
              <input type="checkbox" checked={!!form.quotationAutoSendOnCreate} onChange={(e) => set('quotationAutoSendOnCreate', e.target.checked)} />
              {isAr ? 'إرسال تلقائي بعد الإنشاء' : 'Mark Sent automatically on create'}
            </label>
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{isAr ? 'شروط عرض السعر الافتراضية' : 'Default quotation terms'}</label>
              <textarea rows={4} className={fieldControlClass} value={form.quotationDefaultTerms || ''} onChange={(e) => set('quotationDefaultTerms', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{isAr ? 'ملاحظات العرض الافتراضية' : 'Default quotation notes'}</label>
              <textarea rows={3} className={fieldControlClass} value={form.quotationDefaultNotes || ''} onChange={(e) => set('quotationDefaultNotes', e.target.value)} />
            </div>
          </div>

          <DocumentAppearancePanel
            isAr={isAr}
            appearance={appearance}
            onChange={onAppearanceChange}
            previewTenant={previewTenant}
            titleEn="Quotation appearance"
            titleAr="مظهر عرض السعر"
          />
        </div>
      ) : null}
    </div>
  )
}
