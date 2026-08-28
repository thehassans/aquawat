import { useEffect, useMemo, useState } from 'react'
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
  { id: 'invoice', en: 'Invoice', ar: 'الفاتورة' },
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
  const [signatory, setSignatory] = useState({
    presetAuthorizedPersonName: '',
    presetAuthorizedPersonNameAr: '',
    presetAuthorizedPersonDesignation: '',
    presetAuthorizedPersonDesignationAr: '',
    presetSignature: null,
    presetStamp: null,
  })

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
    setAppearance(buildAppearanceFromTenant(tenantFresh))
    const b = tenantFresh.settings?.invoiceBranding || {}
    setSignatory({
      presetAuthorizedPersonName: b.presetAuthorizedPersonName || '',
      presetAuthorizedPersonNameAr: b.presetAuthorizedPersonNameAr || '',
      presetAuthorizedPersonDesignation: b.presetAuthorizedPersonDesignation || '',
      presetAuthorizedPersonDesignationAr: b.presetAuthorizedPersonDesignationAr || '',
      presetSignature: b.presetSignature || b.signatureImage || null,
      presetStamp: b.presetStamp || b.stampImage || null,
    })
  }, [tenantFresh])

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const setSig = (key, val) => setSignatory((p) => ({ ...p, [key]: val }))

  const previewTenant = useMemo(
    () => applyAppearanceToTenant(tenantFresh || tenant, appearance),
    [tenant, tenantFresh, appearance],
  )

  const readImage = (file, onDone) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onDone(reader.result)
    reader.readAsDataURL(file)
  }

  const save = useMutation({
    mutationFn: async () => {
      const base = tenantFresh || tenant
      const [salesRes, tenantRes] = await Promise.all([
        api.patch('/sales/settings', form),
        api.put('/tenants/current', {
          settings: {
            ...(base?.settings || {}),
            termsAndConditions: form.invoiceDefaultTerms ?? '',
            notes: form.invoiceDefaultNotes ?? '',
            invoiceBranding: {
              ...(base?.settings?.invoiceBranding || {}),
              ...appearancePayload(appearance),
              ...signatory,
              termsAndConditions: form.invoiceDefaultTerms ?? '',
              defaultNotes: form.invoiceDefaultNotes ?? '',
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
      if (nextTenant) dispatch(updateTenant(nextTenant))
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
        </div>
      ) : null}

      {tab === 'invoice' ? (
        <div className="space-y-6">
          <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'سياسة الفوترة' : 'Invoicing policy'}</label>
              <select className={fieldControlClass} value={form.defaultInvoicingPolicy || 'ordered'} onChange={(e) => set('defaultInvoicingPolicy', e.target.value)}>
                <option value="ordered">{isAr ? 'فوترة المطلوب' : 'Invoice what is ordered'}</option>
                <option value="delivered">{isAr ? 'فوترة المسلّم' : 'Invoice what is delivered'}</option>
              </select>
            </div>
            <label className={`${checkClass} self-end`}>
              <input type="checkbox" checked={form.enableProforma !== false} onChange={(e) => set('enableProforma', e.target.checked)} />
              {isAr ? 'تفعيل الفاتورة المبدئية' : 'Enable pro-forma invoices'}
            </label>
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{isAr ? 'الشروط والأحكام الافتراضية' : 'Default terms & conditions'}</label>
              <textarea rows={4} className={fieldControlClass} value={form.invoiceDefaultTerms || ''} onChange={(e) => set('invoiceDefaultTerms', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{isAr ? 'الملاحظات الافتراضية' : 'Default notes'}</label>
              <textarea rows={3} className={fieldControlClass} value={form.invoiceDefaultNotes || ''} onChange={(e) => set('invoiceDefaultNotes', e.target.value)} />
            </div>
          </div>

          <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
            <div>
              <p className={sectionEyebrowClass}>{isAr ? 'التوقيع' : 'Signatory'}</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'المفوّض والختم الافتراضي' : 'Default authorized person & stamp'}
              </h3>
            </div>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabelClass}>{isAr ? 'الاسم (EN)' : 'Name (EN)'}</label>
                <input className={fieldControlClass} value={signatory.presetAuthorizedPersonName} onChange={(e) => setSig('presetAuthorizedPersonName', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabelClass}>{isAr ? 'الاسم (AR)' : 'Name (AR)'}</label>
                <input className={fieldControlClass} dir="rtl" value={signatory.presetAuthorizedPersonNameAr} onChange={(e) => setSig('presetAuthorizedPersonNameAr', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabelClass}>{isAr ? 'المسمى (EN)' : 'Designation (EN)'}</label>
                <input className={fieldControlClass} value={signatory.presetAuthorizedPersonDesignation} onChange={(e) => setSig('presetAuthorizedPersonDesignation', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabelClass}>{isAr ? 'المسمى (AR)' : 'Designation (AR)'}</label>
                <input className={fieldControlClass} dir="rtl" value={signatory.presetAuthorizedPersonDesignationAr} onChange={(e) => setSig('presetAuthorizedPersonDesignationAr', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabelClass}>{isAr ? 'التوقيع' : 'Signature'}</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input type="file" accept="image/*" className="hidden" id="sales-sig-upload" onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetSignature', r))} />
                  <label htmlFor="sales-sig-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
                  {signatory.presetSignature ? (
                    <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSig('presetSignature', null)}>{isAr ? 'إزالة' : 'Remove'}</button>
                  ) : null}
                </div>
                {signatory.presetSignature ? <img src={signatory.presetSignature} alt="" className="mt-2 h-12 object-contain" /> : null}
              </div>
              <div>
                <label className={fieldLabelClass}>{isAr ? 'الختم' : 'Stamp'}</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input type="file" accept="image/*" className="hidden" id="sales-stamp-upload" onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetStamp', r))} />
                  <label htmlFor="sales-stamp-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
                  {signatory.presetStamp ? (
                    <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSig('presetStamp', null)}>{isAr ? 'إزالة' : 'Remove'}</button>
                  ) : null}
                </div>
                {signatory.presetStamp ? <img src={signatory.presetStamp} alt="" className="mt-2 h-12 object-contain" /> : null}
              </div>
            </div>
          </div>

          <DocumentAppearancePanel
            isAr={isAr}
            appearance={appearance}
            onChange={setAppearance}
            previewTenant={previewTenant}
            titleEn="Invoice appearance"
            titleAr="مظهر الفاتورة"
          />
        </div>
      ) : null}

      {tab === 'quotation' ? (
        <div className="space-y-6">
          <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'صلاحية العرض (أيام)' : 'Quotation validity (days)'}</label>
              <input type="number" min={1} max={365} className={fieldControlClass} value={form.quotationValidityDays ?? 30} onChange={(e) => set('quotationValidityDays', Number(e.target.value))} />
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
            onChange={setAppearance}
            previewTenant={previewTenant}
            titleEn="Quotation appearance"
            titleAr="مظهر عرض السعر"
          />
        </div>
      ) : null}
    </div>
  )
}
