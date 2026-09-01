import { useEffect, useMemo, useState } from 'react'
import {
  TAX_COMPUTATION_METHODS,
  TAX_COUNTRIES,
  TAX_SCOPES,
  TAX_TYPES,
  VAT_TAX_GRID_OPTIONS,
  draftToPayload,
  emptyTaxDraft,
  taxToDraft,
} from '../../lib/taxConstants'

const TAB_KEYS = ['invoices', 'refunds', 'advanced']

function Field({ label, children, className = '' }) {
  return (
    <label className={`block text-xs font-medium text-slate-500 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function inputCls() {
  return 'block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900'
}

function selectCls() {
  return inputCls()
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold transition ${
        checked
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-500 dark:bg-dark-900 dark:text-slate-400'
      }`}
    >
      <span className={`h-4 w-7 rounded-full p-0.5 transition ${checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-dark-600'}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition ${checked ? 'translate-x-3' : ''}`} />
      </span>
      {label}
    </button>
  )
}

function DistributionTab({ draft, setDraft, section, accounts, isAr }) {
  const block = draft[section]
  const setLine = (lineKey, key, value) => {
    setDraft((p) => ({
      ...p,
      [section]: {
        ...p[section],
        [lineKey]: { ...p[section][lineKey], [key]: value },
      },
    }))
  }

  const accountOptions = accounts.map((a) => (
    <option key={a._id} value={a._id}>
      {a.code} — {isAr ? (a.nameAr || a.name) : a.name}
    </option>
  ))

  const gridOptions = VAT_TAX_GRID_OPTIONS.map((g) => (
    <option key={g.value || 'none'} value={g.value}>
      {isAr ? g.labelAr : g.labelEn}
    </option>
  ))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/5 dark:bg-dark-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {isAr ? 'سطر الأساس' : 'Base line'}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {isAr ? 'لا يُرحّل إلى GL — يُستخدم لشبكة الإقرار الضريبي' : 'Revenue/cost base — maps to VAT return grid, no GL tax entry'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={isAr ? '% من الأساس' : '% of base'}>
            <input
              type="number"
              min="0"
              max="100"
              value={block.baseLine.percentOfBase}
              onChange={(e) => setLine('baseLine', 'percentOfBase', e.target.value)}
              className={inputCls()}
            />
          </Field>
          <Field label={isAr ? 'شبكة الضريبة' : 'Tax grid'}>
            <select value={block.baseLine.taxGrid} onChange={(e) => setLine('baseLine', 'taxGrid', e.target.value)} className={selectCls()}>
              {gridOptions}
            </select>
          </Field>
          <Field label={isAr ? 'حساب (اختياري)' : 'Account (optional)'}>
            <select value={block.baseLine.accountId} onChange={(e) => setLine('baseLine', 'accountId', e.target.value)} className={selectCls()}>
              <option value="">{isAr ? '— بدون —' : '— None —'}</option>
              {accountOptions}
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/90">
          {isAr ? 'سطر الضريبة' : 'Tax line'}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {isAr ? 'ترحيل GL — حساب VAT المخرجات/المدخلات' : 'GL posting — VAT output/input account and return grid'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={isAr ? '% من الضريبة' : '% of tax'}>
            <input
              type="number"
              min="0"
              max="100"
              value={block.taxLine.percentOfTax}
              onChange={(e) => setLine('taxLine', 'percentOfTax', e.target.value)}
              className={inputCls()}
            />
          </Field>
          <Field label={isAr ? 'الحساب' : 'Account'}>
            <select value={block.taxLine.accountId || draft.accountId} onChange={(e) => setLine('taxLine', 'accountId', e.target.value)} className={selectCls()}>
              <option value="">{isAr ? '— افتراضي —' : '— Default —'}</option>
              {accountOptions}
            </select>
          </Field>
          <Field label={isAr ? 'شبكة الضريبة' : 'Tax grid'}>
            <select value={block.taxLine.taxGrid} onChange={(e) => setLine('taxLine', 'taxGrid', e.target.value)} className={selectCls()}>
              {gridOptions}
            </select>
          </Field>
        </div>
      </div>
    </div>
  )
}

export default function TaxConfigurationForm({
  language,
  tax,
  accounts = [],
  taxGroups = [],
  allTaxes = [],
  onSave,
  onCancel,
  saving,
  error,
}) {
  const isAr = language === 'ar'
  const [draft, setDraft] = useState(() => taxToDraft(tax))
  const [tab, setTab] = useState('invoices')

  useEffect(() => {
    setDraft(taxToDraft(tax))
    setTab('invoices')
  }, [tax?._id, tax?.updatedAt])

  const postable = useMemo(
    () => (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false),
    [accounts],
  )

  const childOptions = (Array.isArray(allTaxes) ? allTaxes : []).filter(
    (t) => t._id !== tax?._id && t.active !== false,
  )

  const set = (key, value) => setDraft((p) => ({ ...p, [key]: value }))

  const computationLabel = (m) => {
    const hit = TAX_COMPUTATION_METHODS.find((x) => x.value === m)
    return hit ? (isAr ? hit.labelAr : hit.labelEn) : m
  }

  const showRate = draft.computationMethod === 'percent_excluded' || draft.computationMethod === 'percent_included'
  const showAmount = draft.computationMethod === 'fixed'
  const showGroup = draft.computationMethod === 'group'

  const canSave = draft.code && draft.name && draft.accountId
    && (!showRate || Number(draft.rate) >= 0)
    && (!showAmount || Number(draft.amount) >= 0)

  const tabLabels = {
    invoices: isAr ? 'توزيع الفواتير' : 'Distribution: Invoices',
    refunds: isAr ? 'توزيع المرتجعات' : 'Distribution: Refunds',
    advanced: isAr ? 'إعدادات متقدمة' : 'Advanced Settings',
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-white/5 dark:bg-dark-900/60">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {isAr ? 'إعداد الضريبة' : 'Tax configuration'}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label={isAr ? 'الرمز' : 'Code'}>
            <input
              value={draft.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              disabled={Boolean(tax?._id && tax?.isSystem)}
              className={`${inputCls()} font-mono uppercase disabled:opacity-60`}
              placeholder="VAT15-OUT"
            />
          </Field>
          <Field label={isAr ? 'الاسم' : 'Name'}>
            <input value={draft.name} onChange={(e) => set('name', e.target.value)} className={inputCls()} placeholder="VAT 15% (Sales)" />
          </Field>
          <Field label={isAr ? 'الاسم العربي' : 'Arabic name'}>
            <input value={draft.nameAr} onChange={(e) => set('nameAr', e.target.value)} className={inputCls()} dir="rtl" placeholder="ضريبة القيمة المضافة 15%" />
          </Field>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Field label={isAr ? 'النوع' : 'Type'}>
            <select value={draft.type} onChange={(e) => set('type', e.target.value)} disabled={Boolean(tax?.isSystem)} className={selectCls()}>
              {TAX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.labelEn}</option>
              ))}
            </select>
          </Field>
          <Field label={isAr ? 'النطاق' : 'Scope'}>
            <select value={draft.scope} onChange={(e) => set('scope', e.target.value)} className={selectCls()}>
              {TAX_SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.labelEn}</option>
              ))}
            </select>
          </Field>
          <Field label={isAr ? 'طريقة الحساب' : 'Computation'}>
            <select value={draft.computationMethod} onChange={(e) => set('computationMethod', e.target.value)} className={selectCls()}>
              {TAX_COMPUTATION_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{isAr ? m.labelAr : m.labelEn}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {showRate ? (
            <Field label={isAr ? 'النسبة %' : 'Rate %'}>
              <input type="number" min="0" max="100" step="0.01" value={draft.rate} onChange={(e) => set('rate', e.target.value)} className={inputCls()} />
            </Field>
          ) : null}
          {showAmount ? (
            <Field label={isAr ? 'المبلغ الثابت' : 'Fixed amount'}>
              <input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => set('amount', e.target.value)} className={inputCls()} />
            </Field>
          ) : null}
          <Field label={isAr ? 'مجموعة الضريبة' : 'Tax group'}>
            <select value={draft.taxGroupCode} onChange={(e) => set('taxGroupCode', e.target.value)} className={selectCls()}>
              <option value="">{isAr ? '— بدون —' : '— None —'}</option>
              {(Array.isArray(taxGroups) ? taxGroups : []).map((g) => (
                <option key={g.code} value={g.code}>{g.code} — {isAr ? (g.nameAr || g.name) : g.name}</option>
              ))}
            </select>
          </Field>
          <Field label={isAr ? 'حساب GL' : 'GL account'}>
            <select value={draft.accountId} onChange={(e) => set('accountId', e.target.value)} className={selectCls()}>
              <option value="">—</option>
              {postable.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Toggle checked={draft.active} onChange={(v) => set('active', v)} label={draft.active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مؤرشف' : 'Archived')} />
            <Toggle checked={draft.includedInPrice} onChange={(v) => set('includedInPrice', v)} label={isAr ? 'شامل في السعر' : 'Included in price'} />
          </div>
        </div>

        {showGroup ? (
          <Field label={isAr ? 'ضرائب فرعية' : 'Child taxes'}>
            <select
              multiple
              value={draft.childTaxIds}
              onChange={(e) => set('childTaxIds', Array.from(e.target.selectedOptions, (o) => o.value))}
              className={`${selectCls()} min-h-[88px]`}
            >
              {childOptions.map((t) => (
                <option key={t._id} value={t._id}>{t.code} — {t.rate}% ({t.type})</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">{isAr ? 'Ctrl+Click لاختيار عدة ضرائب' : 'Ctrl+Click to select multiple taxes'}</p>
          </Field>
        ) : null}

        <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-white/5">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-4 py-2 text-xs font-semibold transition ${
                tab === key
                  ? 'border border-b-0 border-slate-200 bg-white text-emerald-700 dark:border-dark-600 dark:bg-dark-800 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {tab === 'invoices' ? (
          <DistributionTab draft={draft} setDraft={setDraft} section="distributionInvoices" accounts={postable} isAr={isAr} />
        ) : null}
        {tab === 'refunds' ? (
          <DistributionTab draft={draft} setDraft={setDraft} section="distributionRefunds" accounts={postable} isAr={isAr} />
        ) : null}
        {tab === 'advanced' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={isAr ? 'التسمية على الفاتورة' : 'Label on invoices'}>
              <input value={draft.invoiceLabel} onChange={(e) => set('invoiceLabel', e.target.value)} className={inputCls()} placeholder="VAT 15%" />
            </Field>
            <Field label={isAr ? 'البلد / التوطين' : 'Country / localization'}>
              <select value={draft.country} onChange={(e) => set('country', e.target.value)} className={selectCls()}>
                {TAX_COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{isAr ? c.labelAr : c.labelEn}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Toggle
                checked={draft.subsequentTaxBase}
                onChange={(v) => set('subsequentTaxBase', v)}
                label={isAr ? 'أساس للضرائب التالية' : 'Subsequent taxes base'}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-[11px] text-slate-500 dark:border-white/5 dark:bg-dark-900/30">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{computationLabel(draft.computationMethod)}</span>
              {' · '}
              {draft.includedInPrice
                ? (isAr ? 'أسعار السطر شاملة الضريبة' : 'Line unit prices are gross (tax-inclusive)')
                : (isAr ? 'أسعار السطر بدون ضريبة' : 'Line unit prices are net (tax-exclusive)')}
              {draft.subsequentTaxBase
                ? (isAr ? ' · تُحسب الضرائب اللاحقة فوق هذه الضريبة' : ' · Later taxes compound on top of this tax')
                : ''}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave(draftToPayload(draft))}
            className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? '…' : (tax?._id ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إنشاء' : 'Create'))}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold dark:border-dark-600">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export { emptyTaxDraft, taxToDraft }
