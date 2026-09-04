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

const emptyCompany = () => ({
  legalNameEn: '',
  legalNameAr: '',
  contactPhone: '',
  contactEmail: '',
  website: '',
  vatNumber: '',
  crNumber: '',
  address: {
    street: '',
    streetAr: '',
    district: '',
    districtAr: '',
    city: '',
    cityAr: '',
    postalCode: '',
    country: 'SA',
    buildingNumber: '',
    additionalNumber: '',
    shortAddress: '',
  },
})

function companyFromTenant(tenant) {
  const b = tenant?.business || {}
  const a = b.address || {}
  return {
    legalNameEn: b.legalNameEn || tenant?.name || '',
    legalNameAr: b.legalNameAr || '',
    contactPhone: b.contactPhone || tenant?.phone || '',
    contactEmail: b.contactEmail || '',
    website: b.website || '',
    vatNumber: b.vatNumber || '',
    crNumber: b.crNumber || b.commercialRegistration?.crNumber || '',
    address: {
      street: a.street || '',
      streetAr: a.streetAr || '',
      district: a.district || '',
      districtAr: a.districtAr || '',
      city: a.city || '',
      cityAr: a.cityAr || '',
      postalCode: a.postalCode || '',
      country: a.country || 'SA',
      buildingNumber: a.buildingNumber || '',
      additionalNumber: a.additionalNumber || '',
      shortAddress: a.shortAddress || b.nationalAddress?.shortAddress || '',
    },
  }
}

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
  const [company, setCompany] = useState(() => companyFromTenant(tenant) || emptyCompany())
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
    if (!appearanceDirty) {
      setAppearance(buildAppearanceFromTenant(tenantFresh))
    }
    setCompany(companyFromTenant(tenantFresh))
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
  const setCompanyField = (key, val) => setCompany((p) => ({ ...p, [key]: val }))
  const setAddress = (key, val) => setCompany((p) => ({
    ...p,
    address: { ...(p.address || {}), [key]: val },
  }))
  const onAppearanceChange = (next) => {
    setAppearanceDirty(true)
    setAppearance(next)
  }

  const previewTenant = useMemo(
    () => {
      const styled = applyAppearanceToTenant(tenantFresh || tenant, appearance)
      if (!styled) return null
      return {
        ...styled,
        business: {
          ...(styled.business || {}),
          legalNameEn: company.legalNameEn || styled.business?.legalNameEn,
          legalNameAr: company.legalNameAr || styled.business?.legalNameAr,
          contactPhone: company.contactPhone,
          contactEmail: company.contactEmail,
          website: company.website,
          vatNumber: company.vatNumber || styled.business?.vatNumber,
          crNumber: company.crNumber || styled.business?.crNumber,
          address: {
            ...(styled.business?.address || {}),
            ...(company.address || {}),
          },
        },
      }
    },
    [tenant, tenantFresh, appearance, company],
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
        api.patch('/sales/settings', form),
        api.put('/tenants/current', {
          business: {
            legalNameEn: company.legalNameEn || base?.business?.legalNameEn || base?.name || 'Company',
            legalNameAr: company.legalNameAr || base?.business?.legalNameAr || company.legalNameEn || 'شركة',
            contactPhone: company.contactPhone || '',
            contactEmail: company.contactEmail || '',
            website: company.website || '',
            vatNumber: company.vatNumber || base?.business?.vatNumber || '',
            crNumber: company.crNumber || base?.business?.crNumber || '',
            address: {
              ...(base?.business?.address || {}),
              ...(company.address || {}),
            },
            nationalAddress: {
              ...(base?.business?.nationalAddress || {}),
              shortAddress: company.address?.shortAddress || base?.business?.nationalAddress?.shortAddress || '',
              buildingNo: company.address?.buildingNumber || base?.business?.nationalAddress?.buildingNo || '',
              secondaryNo: company.address?.additionalNumber || base?.business?.nationalAddress?.secondaryNo || '',
              postalCode: company.address?.postalCode || base?.business?.nationalAddress?.postalCode || '',
              neighborhood: company.address?.district || base?.business?.nationalAddress?.neighborhood || '',
              neighborhoodAr: company.address?.districtAr || base?.business?.nationalAddress?.neighborhoodAr || '',
              region: company.address?.city || base?.business?.nationalAddress?.region || '',
              regionAr: company.address?.cityAr || base?.business?.nationalAddress?.regionAr || '',
            },
          },
          settings: {
            invoiceBranding: {
              ...existingBranding,
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
      qc.invalidateQueries({ queryKey: ['tenant-current-invoice-settings'] })
      if (nextTenant) {
        dispatch(updateTenant(nextTenant))
        setAppearance(buildAppearanceFromTenant(nextTenant))
        setCompany(companyFromTenant(nextTenant))
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
        {isAr ? 'إعدادات الفاتورة المنفصلة متاحة في المحاسبة.' : 'Dedicated invoice settings live under Accounting.'}
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
            <div className="sm:col-span-2">
              <p className={sectionEyebrowClass}>{isAr ? 'سياسة العرض' : 'Quotation policy'}</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'القالب والشروط الافتراضية' : 'Template & defaults'}
              </h3>
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'صلاحية العرض (أيام)' : 'Quotation validity (days)'}</label>
              <input type="number" min={1} max={365} className={fieldControlClass} value={form.quotationValidityDays ?? 30} onChange={(e) => set('quotationValidityDays', Number(e.target.value))} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'قالب عرض السعر الافتراضي' : 'Default quotation template'}</label>
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
            <label className={`${checkClass} self-end sm:col-span-2`}>
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

          <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
            <div className="sm:col-span-2">
              <p className={sectionEyebrowClass}>{isAr ? 'بيانات الشركة على العرض' : 'Company on quotation'}</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'الاسم والعنوان والهاتف والبريد' : 'Name, address, phone & email'}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {isAr
                  ? 'تظهر في ترويسة وتذييل عرض السعر (نفس مصدر الفواتير والخطابات).'
                  : 'Shown on quotation letterhead footer/header (shared with invoices & letterhead).'}
              </p>
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الاسم القانوني (EN)' : 'Legal name (EN)'}</label>
              <input className={fieldControlClass} value={company.legalNameEn} onChange={(e) => setCompanyField('legalNameEn', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الاسم القانوني (AR)' : 'Legal name (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={company.legalNameAr} onChange={(e) => setCompanyField('legalNameAr', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الهاتف' : 'Phone'}</label>
              <input className={fieldControlClass} value={company.contactPhone} onChange={(e) => setCompanyField('contactPhone', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" className={fieldControlClass} value={company.contactEmail} onChange={(e) => setCompanyField('contactEmail', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الموقع' : 'Website'}</label>
              <input className={fieldControlClass} value={company.website} onChange={(e) => setCompanyField('website', e.target.value)} placeholder="example.com" />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الرقم الضريبي' : 'VAT number'}</label>
              <input className={fieldControlClass} value={company.vatNumber} onChange={(e) => setCompanyField('vatNumber', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'السجل التجاري' : 'CR number'}</label>
              <input className={fieldControlClass} value={company.crNumber} onChange={(e) => setCompanyField('crNumber', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'العنوان المختصر' : 'Short address'}</label>
              <input className={fieldControlClass} value={company.address?.shortAddress || ''} onChange={(e) => setAddress('shortAddress', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'رقم المبنى' : 'Building number'}</label>
              <input className={fieldControlClass} value={company.address?.buildingNumber || ''} onChange={(e) => setAddress('buildingNumber', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الشارع (EN)' : 'Street (EN)'}</label>
              <input className={fieldControlClass} value={company.address?.street || ''} onChange={(e) => setAddress('street', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الشارع (AR)' : 'Street (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={company.address?.streetAr || ''} onChange={(e) => setAddress('streetAr', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الحي (EN)' : 'District (EN)'}</label>
              <input className={fieldControlClass} value={company.address?.district || ''} onChange={(e) => setAddress('district', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الحي (AR)' : 'District (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={company.address?.districtAr || ''} onChange={(e) => setAddress('districtAr', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'المدينة (EN)' : 'City (EN)'}</label>
              <input className={fieldControlClass} value={company.address?.city || ''} onChange={(e) => setAddress('city', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'المدينة (AR)' : 'City (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={company.address?.cityAr || ''} onChange={(e) => setAddress('cityAr', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الرمز البريدي' : 'Postal code'}</label>
              <input className={fieldControlClass} value={company.address?.postalCode || ''} onChange={(e) => setAddress('postalCode', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'الدولة' : 'Country'}</label>
              <input className={fieldControlClass} value={company.address?.country || ''} onChange={(e) => setAddress('country', e.target.value)} />
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
                  id="quot-sig-upload"
                  onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetSignature', r))}
                />
                <label htmlFor="quot-sig-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
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
                  id="quot-stamp-upload"
                  onChange={(e) => readImage(e.target.files?.[0], (r) => setSig('presetStamp', r))}
                />
                <label htmlFor="quot-stamp-upload" className={saveBtnClass}>{isAr ? 'رفع' : 'Upload'}</label>
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
            showTaglines
            titleEn="Quotation appearance"
            titleAr="مظهر عرض السعر"
          />
        </div>
      ) : null}
    </div>
  )
}
