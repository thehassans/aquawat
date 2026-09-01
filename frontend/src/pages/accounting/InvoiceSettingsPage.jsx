import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { updateTenant } from '../../store/slices/authSlice'
import DocumentAppearancePanel, {
  appearancePayload,
  applyAppearanceToTenant,
  buildAppearanceFromTenant,
} from '../../components/sales/DocumentAppearancePanel'
import {
  fieldControlClass,
  fieldLabelClass,
  sectionCardClass,
  sectionEyebrowClass,
} from '../sales/salesUi'
import { INVOICE_DATE_CALENDAR_OPTIONS, resolveInvoiceDateCalendar } from '../../lib/invoiceDateFormat'

const saveBtnClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700'

export default function InvoiceSettingsPage() {
  const dispatch = useDispatch()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [appearance, setAppearance] = useState(() => buildAppearanceFromTenant(tenant))
  const [appearanceDirty, setAppearanceDirty] = useState(false)
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
    queryKey: ['tenant-current-invoice-settings'],
    queryFn: async () => (await api.get('/tenants/current')).data,
  })

  useEffect(() => {
    if (!data && !tenantFresh) return
    setForm((prev) => ({
      ...prev,
      ...(data || {}),
      invoiceDateCalendar: resolveInvoiceDateCalendar(tenantFresh || tenant),
    }))
  }, [data, tenantFresh, tenant])

  useEffect(() => {
    if (!tenantFresh) return
    if (!appearanceDirty) {
      setAppearance(buildAppearanceFromTenant(tenantFresh))
    }
    const b = tenantFresh.settings?.invoiceBranding || {}
    setSignatory((prev) => ({
      presetAuthorizedPersonName: b.presetAuthorizedPersonName || '',
      presetAuthorizedPersonNameAr: b.presetAuthorizedPersonNameAr || '',
      presetAuthorizedPersonDesignation: b.presetAuthorizedPersonDesignation || '',
      presetAuthorizedPersonDesignationAr: b.presetAuthorizedPersonDesignationAr || '',
      presetSignature: prev.presetSignature?.startsWith?.('data:')
        ? prev.presetSignature
        : (b.presetSignature || b.signatureImage || null),
      presetStamp: prev.presetStamp?.startsWith?.('data:')
        ? prev.presetStamp
        : (b.presetStamp || b.stampImage || null),
    }))
  }, [tenantFresh, appearanceDirty])

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const setSig = (key, val) => setSignatory((p) => ({ ...p, [key]: val }))
  const onAppearanceChange = (next) => {
    setAppearanceDirty(true)
    setAppearance(next)
  }

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
      const existingBranding = base?.settings?.invoiceBranding || {}
      const keepAsset = (next, prev) => {
        const v = next == null ? prev : next
        if (typeof v === 'string' && v.startsWith('data:')) {
          if (v.length < 350_000) return v
          return prev || ''
        }
        return v || ''
      }
      const [salesRes, tenantRes] = await Promise.all([
        api.patch('/sales/settings', {
          defaultInvoicingPolicy: form.defaultInvoicingPolicy || 'ordered',
          invoiceDefaultTerms: form.invoiceDefaultTerms ?? '',
          invoiceDefaultNotes: form.invoiceDefaultNotes ?? '',
        }),
        api.put('/tenants/current', {
          settings: {
            invoiceDateCalendar: form.invoiceDateCalendar || 'both',
            useHijriDates: form.invoiceDateCalendar !== 'gregorian',
            termsAndConditions: form.invoiceDefaultTerms ?? '',
            notes: form.invoiceDefaultNotes ?? '',
            invoiceBranding: {
              ...appearancePayload(appearance),
              logo: existingBranding.logo || base?.branding?.logo || '',
              presetSignature: keepAsset(signatory.presetSignature, existingBranding.presetSignature || existingBranding.signatureImage),
              signatureImage: keepAsset(signatory.presetSignature, existingBranding.presetSignature || existingBranding.signatureImage),
              presetStamp: keepAsset(signatory.presetStamp, existingBranding.presetStamp || existingBranding.stampImage),
              stampImage: keepAsset(signatory.presetStamp, existingBranding.presetStamp || existingBranding.stampImage),
              presetAuthorizedPersonName: signatory.presetAuthorizedPersonName || '',
              presetAuthorizedPersonNameAr: signatory.presetAuthorizedPersonNameAr || '',
              presetAuthorizedPersonDesignation: signatory.presetAuthorizedPersonDesignation || '',
              presetAuthorizedPersonDesignationAr: signatory.presetAuthorizedPersonDesignationAr || '',
              termsAndConditions: form.invoiceDefaultTerms ?? '',
              defaultNotes: form.invoiceDefaultNotes ?? '',
            },
          },
        }),
      ])
      return { sales: salesRes.data, tenant: tenantRes.data }
    },
    onSuccess: ({ tenant: nextTenant }) => {
      toast.success(isAr ? 'تم حفظ إعدادات الفاتورة' : 'Invoice settings saved')
      qc.invalidateQueries({ queryKey: ['sales-settings'] })
      qc.invalidateQueries({ queryKey: ['tenant-current-invoice-settings'] })
      qc.invalidateQueries({ queryKey: ['tenant-current-sales-settings'] })
      if (nextTenant) {
        dispatch(updateTenant(nextTenant))
        setAppearance(buildAppearanceFromTenant(nextTenant))
        setAppearanceDirty(false)
      }
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={sectionEyebrowClass}>{isAr ? 'المحاسبة · الفواتير' : 'Accounting · Invoices'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'إعدادات الفاتورة' : 'Invoice settings'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isAr
              ? 'سياسة الفوترة والمظهر والتوقيع الافتراضي'
              : 'Invoicing policy, document appearance, and default signatory'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/dashboard/accounting/invoices"
            className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
          >
            {isAr ? 'كل الفواتير' : 'All invoices'}
          </Link>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={saveBtnClass}>
            {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>

      <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'سياسة الفوترة' : 'Invoicing policy'}</label>
          <select
            className={fieldControlClass}
            value={form.defaultInvoicingPolicy || 'ordered'}
            onChange={(e) => set('defaultInvoicingPolicy', e.target.value)}
          >
            <option value="ordered">{isAr ? 'فوترة المطلوب' : 'Invoice what is ordered'}</option>
            <option value="delivered">{isAr ? 'فوترة المسلّم' : 'Invoice what is delivered'}</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'تقويم التاريخ على الفاتورة' : 'Invoice date calendar'}</label>
          <select
            className={fieldControlClass}
            value={form.invoiceDateCalendar || resolveInvoiceDateCalendar(tenantFresh || tenant)}
            onChange={(e) => set('invoiceDateCalendar', e.target.value)}
          >
            {INVOICE_DATE_CALENDAR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            {isAr
              ? 'يظهر على PDF والمعاينة: ميلادي، هجري، أو كلاهما.'
              : 'Shown on PDF and preview: Gregorian, Hijri, or both.'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className={fieldLabelClass}>{isAr ? 'الشروط والأحكام الافتراضية' : 'Default terms & conditions'}</label>
          <textarea
            rows={4}
            className={fieldControlClass}
            value={form.invoiceDefaultTerms || ''}
            onChange={(e) => set('invoiceDefaultTerms', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={fieldLabelClass}>{isAr ? 'الملاحظات الافتراضية' : 'Default notes'}</label>
          <textarea
            rows={3}
            className={fieldControlClass}
            value={form.invoiceDefaultNotes || ''}
            onChange={(e) => set('invoiceDefaultNotes', e.target.value)}
          />
        </div>
      </div>

      <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
        <div className="sm:col-span-2">
          <p className={sectionEyebrowClass}>{isAr ? 'التوقيع' : 'Signatory'}</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
            {isAr ? 'المفوّض والختم الافتراضي' : 'Default authorized person & stamp'}
          </h3>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الاسم (EN)' : 'Name (EN)'}</label>
          <input
            className={fieldControlClass}
            value={signatory.presetAuthorizedPersonName}
            onChange={(e) => setSig('presetAuthorizedPersonName', e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الاسم (AR)' : 'Name (AR)'}</label>
          <input
            className={fieldControlClass}
            dir="rtl"
            value={signatory.presetAuthorizedPersonNameAr}
            onChange={(e) => setSig('presetAuthorizedPersonNameAr', e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'المسمى (EN)' : 'Designation (EN)'}</label>
          <input
            className={fieldControlClass}
            value={signatory.presetAuthorizedPersonDesignation}
            onChange={(e) => setSig('presetAuthorizedPersonDesignation', e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'المسمى (AR)' : 'Designation (AR)'}</label>
          <input
            className={fieldControlClass}
            dir="rtl"
            value={signatory.presetAuthorizedPersonDesignationAr}
            onChange={(e) => setSig('presetAuthorizedPersonDesignationAr', e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'التوقيع' : 'Signature'}</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="acc-inv-sig-upload"
              onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetSignature', r))}
            />
            <label htmlFor="acc-inv-sig-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
            {signatory.presetSignature ? (
              <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSig('presetSignature', null)}>
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            ) : null}
          </div>
          {signatory.presetSignature ? <img src={signatory.presetSignature} alt="" className="mt-2 h-12 object-contain" /> : null}
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الختم' : 'Stamp'}</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="acc-inv-stamp-upload"
              onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetStamp', r))}
            />
            <label htmlFor="acc-inv-stamp-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
            {signatory.presetStamp ? (
              <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSig('presetStamp', null)}>
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            ) : null}
          </div>
          {signatory.presetStamp ? <img src={signatory.presetStamp} alt="" className="mt-2 h-12 object-contain" /> : null}
        </div>
      </div>

      <DocumentAppearancePanel
        isAr={isAr}
        appearance={appearance}
        onChange={onAppearanceChange}
        previewTenant={previewTenant}
        titleEn="Invoice appearance"
        titleAr="مظهر الفاتورة"
      />
    </div>
  )
}
