import LetterheadChrome from '../invoices/LetterheadChrome'
import { INVOICE_FONT_OPTIONS, getInvoiceTypography } from '../../lib/invoiceBranding'
import {
  fieldControlClass,
  fieldLabelClass,
  sectionCardClass,
  sectionEyebrowClass,
} from '../../pages/sales/salesUi'

export function ColorField({ label, value, onChange }) {
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

export function RangeField({ label, value, min, max, suffix, onChange }) {
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

/**
 * Font / colour / size / logo controls + live LetterheadChrome preview.
 * `appearance` shape matches tenant.settings.invoiceBranding (+ typography fields flattened).
 */
export default function DocumentAppearancePanel({
  isAr = false,
  appearance,
  onChange,
  previewTenant,
  titleEn = 'Appearance',
  titleAr = 'المظهر',
  showTaglines = false,
}) {
  const set = (key, val) => {
    const next = { ...appearance, [key]: val }
    // Keep typography.headingFontSize in sync with the company heading slider
    if (key === 'headingSize') next.headingFontSize = val
    if (key === 'bodyFontSize') next.bodyFontSize = val
    onChange(next)
  }
  const checkClass = 'flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-3 text-sm font-medium text-slate-700 dark:border-dark-600 dark:bg-dark-800/60 dark:text-slate-200'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]">
      <div className={`${sectionCardClass} space-y-5`}>
        <div>
          <p className={sectionEyebrowClass}>{isAr ? 'الطباعة والألوان' : 'Typography & color'}</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
            {isAr ? titleAr : titleEn}
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={fieldLabelClass}>{isAr ? 'خط العناوين' : 'Heading font'}</label>
            <select className={fieldControlClass} value={appearance.headingFontFamily} onChange={(e) => set('headingFontFamily', e.target.value)}>
              {INVOICE_FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{isAr ? f.labelAr : f.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'خط النص' : 'Body font'}</label>
            <select className={fieldControlClass} value={appearance.bodyFontFamily} onChange={(e) => set('bodyFontFamily', e.target.value)}>
              {INVOICE_FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{isAr ? f.labelAr : f.labelEn}</option>
              ))}
            </select>
          </div>
        </div>

        <RangeField label={isAr ? 'حجم اسم الشركة' : 'Company heading size'} value={appearance.headingSize} min={12} max={48} suffix="px" onChange={(v) => set('headingSize', v)} />
        <RangeField label={isAr ? 'حجم السجل / الضريبة' : 'CR / VAT text size'} value={appearance.crVatSize} min={9} max={24} suffix="px" onChange={(v) => set('crVatSize', v)} />
        <RangeField label={isAr ? 'حجم نص المحتوى' : 'Body text size'} value={appearance.bodyFontSize} min={9} max={18} suffix="px" onChange={(v) => set('bodyFontSize', v)} />
        <RangeField label={isAr ? 'حجم الشعار' : 'Logo size'} value={appearance.logoSize} min={40} max={240} suffix="px" onChange={(v) => set('logoSize', v)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label={isAr ? 'لون نص الفاتورة' : 'Invoice text color'}
            value={appearance.letterheadTextColor}
            onChange={(v) => set('letterheadTextColor', v)}
          />
          <ColorField
            label={isAr ? 'لون حدود الترويسة والتذييل' : 'Header & footer accent color'}
            value={appearance.letterheadAccentColor}
            onChange={(v) => set('letterheadAccentColor', v)}
          />
        </div>

        <label className={checkClass}>
          <input type="checkbox" checked={!!appearance.singleLineHeading} onChange={(e) => set('singleLineHeading', e.target.checked)} />
          {isAr ? 'اسم الشركة في سطر واحد' : 'Single-line company heading'}
        </label>

        {showTaglines ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClass}>{isAr ? 'سطر تحت العنوان (EN)' : 'Tagline under heading (EN)'}</label>
              <input className={fieldControlClass} value={appearance.headerTextEn || ''} onChange={(e) => set('headerTextEn', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'سطر تحت العنوان (AR)' : 'Tagline under heading (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={appearance.headerTextAr || ''} onChange={(e) => set('headerTextAr', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'سطر التذييل (EN)' : 'Footer line (EN)'}</label>
              <input className={fieldControlClass} value={appearance.footerTextEn || ''} onChange={(e) => set('footerTextEn', e.target.value)} />
            </div>
            <div>
              <label className={fieldLabelClass}>{isAr ? 'سطر التذييل (AR)' : 'Footer line (AR)'}</label>
              <input className={fieldControlClass} dir="rtl" value={appearance.footerTextAr || ''} onChange={(e) => set('footerTextAr', e.target.value)} />
            </div>
          </div>
        ) : null}
      </div>

      <div className={`${sectionCardClass} !p-4`}>
        <p className={`${sectionEyebrowClass} mb-3`}>{isAr ? 'معاينة حية' : 'Live preview'}</p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80 p-2 dark:border-dark-600 dark:bg-dark-900">
          {!previewTenant ? (
            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
              {isAr ? 'جاري التحميل…' : 'Loading…'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-dark-600">
              <LetterheadChrome
                tenant={previewTenant}
                compact
                bilingual
                className="!max-w-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function buildAppearanceFromTenant(tenant) {
  const b = tenant?.settings?.invoiceBranding || {}
  const typography = getInvoiceTypography(tenant)
  return {
    logoSize: b.logoSize ?? 112,
    headingSize: b.headingSize ?? typography.headingFontSize ?? 24,
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
    headingFontSize: b.headingSize ?? typography.headingFontSize,
  }
}

export function applyAppearanceToTenant(baseTenant, appearance) {
  if (!baseTenant) return null
  return {
    ...baseTenant,
    settings: {
      ...baseTenant.settings,
      invoiceBranding: {
        ...(baseTenant.settings?.invoiceBranding || {}),
        logoSize: appearance.logoSize,
        headingSize: appearance.headingSize,
        crVatSize: appearance.crVatSize,
        singleLineHeading: appearance.singleLineHeading,
        headerTextEn: appearance.headerTextEn,
        headerTextAr: appearance.headerTextAr,
        footerTextEn: appearance.footerTextEn,
        footerTextAr: appearance.footerTextAr,
        letterheadTextColor: appearance.letterheadTextColor,
        letterheadAccentColor: appearance.letterheadAccentColor,
        typography: {
          bodyFontFamily: appearance.bodyFontFamily,
          headingFontFamily: appearance.headingFontFamily,
          bodyFontSize: appearance.bodyFontSize,
          // Keep typography heading in sync with company heading size slider
          headingFontSize: appearance.headingSize ?? appearance.headingFontSize,
        },
      },
    },
  }
}

export function appearancePayload(appearance) {
  return {
    logoSize: Number(appearance.logoSize) || 112,
    headingSize: Number(appearance.headingSize) || 24,
    crVatSize: Number(appearance.crVatSize) || 14,
    singleLineHeading: Boolean(appearance.singleLineHeading),
    headerTextEn: appearance.headerTextEn || '',
    headerTextAr: appearance.headerTextAr || '',
    footerTextEn: appearance.footerTextEn || '',
    footerTextAr: appearance.footerTextAr || '',
    letterheadTextColor: appearance.letterheadTextColor || '#0F172A',
    letterheadAccentColor: appearance.letterheadAccentColor || '#0F172A',
    typography: {
      bodyFontFamily: appearance.bodyFontFamily,
      headingFontFamily: appearance.headingFontFamily,
      bodyFontSize: Number(appearance.bodyFontSize) || 12,
      headingFontSize: Number(appearance.headingSize ?? appearance.headingFontSize) || 24,
    },
  }
}
