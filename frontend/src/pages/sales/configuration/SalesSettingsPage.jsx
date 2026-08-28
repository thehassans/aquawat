import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import LetterheadChrome from '../../../components/invoices/LetterheadChrome'
import { INVOICE_FONT_OPTIONS, getInvoiceTypography } from '../../../lib/invoiceBranding'
import { updateTenant } from '../../../store/slices/authSlice'
import { INCOTERMS } from '../salesConfig.menu'
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
  { id: 'letterhead', en: 'Letterhead', ar: 'الترويسة' },
]

const defaultLetterhead = (tenant) => {
  const b = tenant?.settings?.invoiceBranding || {}
  const typography = getInvoiceTypography(tenant)
  return {
    logoSize: b.logoSize ?? 112,
    headingSize: b.headingSize ?? 24,
    crVatSize: b.crVatSize ?? 14,
    singleLineHeading: !!b.singleLineHeading,
    headerTextEn: b.headerTextEn || '',
    headerTextAr: b.headerTextAr || '',
    footerTextEn: b.footerTextEn || '',
    footerTextAr: b.footerTextAr || '',
    letterheadTextColor: b.letterheadTextColor || '#0F172A',
    letterheadAccentColor: b.letterheadAccentColor || '#0F172A',
    bodyFontFamily: typography.bodyFontFamily,
    headingFontFamily: typography.headingFontFamily,
    bodyFontSize: typography.bodyFontSize,
    headingFontSize: typography.headingFontSize,
  }
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className={fieldLabelClass}>{label}</label>
      <div className="mt-1.5 flex items-center gap-3">
        <input
          type="color"
          value={value || '#0F172A'}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-dark-500"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={`${fieldControlClass} font-mono uppercase`}
          maxLength={7}
        />
      </div>
    </div>
  )
}

function RangeField({ label, value, min, max, suffix, onChange }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className={`${fieldLabelClass} mb-0`}>{label}</label>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{value}{suffix || ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-900 dark:accent-white"
      />
    </div>
  )
}

export default function SalesSettingsPage() {
  const dispatch = useDispatch()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState({})
  const [letterhead, setLetterhead] = useState(() => defaultLetterhead(tenant))

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
    if (tenantFresh) setLetterhead(defaultLetterhead(tenantFresh))
  }, [tenantFresh])

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const setLh = (key, val) => setLetterhead((p) => ({ ...p, [key]: val }))

  const previewTenant = useMemo(() => {
    const base = tenantFresh || tenant
    if (!base) return null
    return {
      ...base,
      settings: {
        ...base.settings,
        invoiceBranding: {
          ...(base.settings?.invoiceBranding || {}),
          logoSize: letterhead.logoSize,
          headingSize: letterhead.headingSize,
          crVatSize: letterhead.crVatSize,
          singleLineHeading: letterhead.singleLineHeading,
          headerTextEn: letterhead.headerTextEn,
          headerTextAr: letterhead.headerTextAr,
          footerTextEn: letterhead.footerTextEn,
          footerTextAr: letterhead.footerTextAr,
          letterheadTextColor: letterhead.letterheadTextColor,
          letterheadAccentColor: letterhead.letterheadAccentColor,
          typography: {
            bodyFontFamily: letterhead.bodyFontFamily,
            headingFontFamily: letterhead.headingFontFamily,
            bodyFontSize: letterhead.bodyFontSize,
            headingFontSize: letterhead.headingFontSize,
          },
        },
      },
    }
  }, [tenant, tenantFresh, letterhead])

  const save = useMutation({
    mutationFn: async () => {
      const [salesRes, tenantRes] = await Promise.all([
        api.patch('/sales/settings', form),
        api.put('/tenants/current', {
          settings: {
            ...(tenantFresh?.settings || tenant?.settings || {}),
            termsAndConditions: form.invoiceDefaultTerms ?? '',
            notes: form.invoiceDefaultNotes ?? '',
            invoiceBranding: {
              ...((tenantFresh || tenant)?.settings?.invoiceBranding || {}),
              logoSize: letterhead.logoSize,
              headingSize: letterhead.headingSize,
              crVatSize: letterhead.crVatSize,
              singleLineHeading: letterhead.singleLineHeading,
              headerTextEn: letterhead.headerTextEn,
              headerTextAr: letterhead.headerTextAr,
              footerTextEn: letterhead.footerTextEn,
              footerTextAr: letterhead.footerTextAr,
              letterheadTextColor: letterhead.letterheadTextColor,
              letterheadAccentColor: letterhead.letterheadAccentColor,
              typography: {
                bodyFontFamily: letterhead.bodyFontFamily,
                headingFontFamily: letterhead.headingFontFamily,
                bodyFontSize: letterhead.bodyFontSize,
                headingFontSize: letterhead.headingFontSize,
              },
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
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'الفواتير، عروض الأسعار، والترويسة — خطوط وألوان وأحجام الشعار'
              : 'Invoices, quotations, and letterhead — fonts, colors, and logo scale'}
          </p>
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700"
        >
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
        <div className="space-y-4">
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
              <textarea
                rows={4}
                className={fieldControlClass}
                value={form.invoiceDefaultTerms || ''}
                onChange={(e) => set('invoiceDefaultTerms', e.target.value)}
                placeholder={isAr ? 'تظهر تلقائياً في فواتير المبيعات…' : 'Prefills on sales invoices…'}
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
          <p className="text-xs text-slate-500">
            {isAr
              ? 'مظهر الترويسة والخطوط يُدار من تبويب Letterhead ويُطبَّق على الفواتير وعروض الأسعار.'
              : 'Letterhead look & fonts are managed in the Letterhead tab and apply to invoices and quotations.'}
          </p>
        </div>
      ) : null}

      {tab === 'quotation' ? (
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
            <textarea
              rows={4}
              className={fieldControlClass}
              value={form.quotationDefaultTerms || ''}
              onChange={(e) => set('quotationDefaultTerms', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={fieldLabelClass}>{isAr ? 'ملاحظات العرض الافتراضية' : 'Default quotation notes'}</label>
            <textarea
              rows={3}
              className={fieldControlClass}
              value={form.quotationDefaultNotes || ''}
              onChange={(e) => set('quotationDefaultNotes', e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {tab === 'letterhead' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
          <div className="space-y-4">
            <div className={`${sectionCardClass} space-y-5`}>
              <div>
                <p className={sectionEyebrowClass}>{isAr ? 'الطباعة' : 'Typography'}</p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'الخطوط والأحجام' : 'Fonts & sizes'}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'خط العناوين' : 'Heading font'}</label>
                  <select className={fieldControlClass} value={letterhead.headingFontFamily} onChange={(e) => setLh('headingFontFamily', e.target.value)}>
                    {INVOICE_FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{isAr ? f.labelAr : f.labelEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'خط النص' : 'Body font'}</label>
                  <select className={fieldControlClass} value={letterhead.bodyFontFamily} onChange={(e) => setLh('bodyFontFamily', e.target.value)}>
                    {INVOICE_FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{isAr ? f.labelAr : f.labelEn}</option>
                    ))}
                  </select>
                </div>
              </div>
              <RangeField label={isAr ? 'حجم اسم الشركة' : 'Company heading size'} value={letterhead.headingSize} min={12} max={48} suffix="px" onChange={(v) => setLh('headingSize', v)} />
              <RangeField label={isAr ? 'حجم السجل / الضريبة' : 'CR / VAT text size'} value={letterhead.crVatSize} min={9} max={24} suffix="px" onChange={(v) => setLh('crVatSize', v)} />
              <RangeField label={isAr ? 'حجم نص المحتوى' : 'Body text size'} value={letterhead.bodyFontSize} min={9} max={18} suffix="px" onChange={(v) => setLh('bodyFontSize', v)} />
              <RangeField label={isAr ? 'ارتفاع الشعار' : 'Logo height'} value={letterhead.logoSize} min={40} max={180} suffix="px" onChange={(v) => setLh('logoSize', v)} />
              <label className={checkClass}>
                <input type="checkbox" checked={!!letterhead.singleLineHeading} onChange={(e) => setLh('singleLineHeading', e.target.checked)} />
                {isAr ? 'اسم الشركة في سطر واحد' : 'Single-line company heading'}
              </label>
            </div>

            <div className={`${sectionCardClass} space-y-5`}>
              <div>
                <p className={sectionEyebrowClass}>{isAr ? 'الألوان' : 'Colors'}</p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'ترويسة وتذييل' : 'Heading & footer'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isAr
                    ? 'لون النص يطبَّق على الترويسة والتذييل معاً. لون الحدود يغيّر خط الفاصل العلوي والسفلي.'
                    : 'Text color applies to both header and footer. Accent color drives the top and bottom rules.'}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  label={isAr ? 'لون نص الترويسة والتذييل' : 'Heading & footer text color'}
                  value={letterhead.letterheadTextColor}
                  onChange={(v) => setLh('letterheadTextColor', v)}
                />
                <ColorField
                  label={isAr ? 'لون حدود الترويسة والتذييل' : 'Header & footer accent color'}
                  value={letterhead.letterheadAccentColor}
                  onChange={(v) => setLh('letterheadAccentColor', v)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'سطر تحت العنوان (EN)' : 'Tagline under heading (EN)'}</label>
                  <input className={fieldControlClass} value={letterhead.headerTextEn} onChange={(e) => setLh('headerTextEn', e.target.value)} />
                </div>
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'سطر تحت العنوان (AR)' : 'Tagline under heading (AR)'}</label>
                  <input className={fieldControlClass} dir="rtl" value={letterhead.headerTextAr} onChange={(e) => setLh('headerTextAr', e.target.value)} />
                </div>
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'سطر التذييل (EN)' : 'Footer line (EN)'}</label>
                  <input className={fieldControlClass} value={letterhead.footerTextEn} onChange={(e) => setLh('footerTextEn', e.target.value)} />
                </div>
                <div>
                  <label className={fieldLabelClass}>{isAr ? 'سطر التذييل (AR)' : 'Footer line (AR)'}</label>
                  <input className={fieldControlClass} dir="rtl" value={letterhead.footerTextAr} onChange={(e) => setLh('footerTextAr', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className={`${sectionCardClass} !p-4`}>
            <p className={`${sectionEyebrowClass} mb-3`}>{isAr ? 'معاينة حية' : 'Live preview'}</p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-dark-600 dark:bg-dark-900">
              <div className="origin-top scale-[0.42] sm:scale-50" style={{ width: '238%', maxHeight: 420 }}>
                {previewTenant ? <LetterheadChrome tenant={previewTenant} /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
