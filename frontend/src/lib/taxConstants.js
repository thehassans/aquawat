export const TAX_COMPUTATION_METHODS = [
  { value: 'percent_excluded', labelEn: 'Percentage of Price', labelAr: 'نسبة من السعر' },
  { value: 'percent_included', labelEn: 'Percentage of Price (Tax Included)', labelAr: 'نسبة من السعر (شامل الضريبة)' },
  { value: 'fixed', labelEn: 'Fixed Amount', labelAr: 'مبلغ ثابت' },
  { value: 'group', labelEn: 'Group of Taxes', labelAr: 'مجموعة ضرائب' },
]

export const TAX_SCOPES = [
  { value: 'all', labelEn: 'Goods & Services', labelAr: 'سلع وخدمات' },
  { value: 'goods', labelEn: 'Goods', labelAr: 'سلع' },
  { value: 'services', labelEn: 'Services', labelAr: 'خدمات' },
]

export const TAX_TYPES = [
  { value: 'sales', labelEn: 'Sales', labelAr: 'مبيعات' },
  { value: 'purchase', labelEn: 'Purchases', labelAr: 'مشتريات' },
  { value: 'none', labelEn: 'None', labelAr: 'بدون' },
]

export const VAT_TAX_GRID_OPTIONS = [
  { value: '', labelEn: '— No grid —', labelAr: '— بدون شبكة —' },
  { value: 'sales_standard_rated', labelEn: 'Sales — Standard rated', labelAr: 'مبيعات — خاضعة للنسبة' },
  { value: 'sales_zero_rated', labelEn: 'Sales — Zero rated', labelAr: 'مبيعات — صفرية' },
  { value: 'sales_exempt', labelEn: 'Sales — Exempt', labelAr: 'مبيعات — معفاة' },
  { value: 'sales_exports', labelEn: 'Sales — Exports', labelAr: 'مبيعات — صادرات' },
  { value: 'sales_special_citizen', labelEn: 'Sales — Special citizen', labelAr: 'مبيعات — مواطن خاص' },
  { value: 'purchases_standard_rated', labelEn: 'Purchases — Standard rated', labelAr: 'مشتريات — خاضعة للنسبة' },
  { value: 'purchases_zero_rated', labelEn: 'Purchases — Zero rated', labelAr: 'مشتريات — صفرية' },
  { value: 'purchases_exempt', labelEn: 'Purchases — Exempt', labelAr: 'مشتريات — معفاة' },
  { value: 'purchases_imports', labelEn: 'Purchases — Imports', labelAr: 'مشتريات — واردات' },
  { value: 'purchases_reverse_charge', labelEn: 'Purchases — Reverse charge', labelAr: 'مشتريات — احتساب عكسي' },
]

export const TAX_COUNTRIES = [
  { value: 'SA', labelEn: 'Saudi Arabia (KSA)', labelAr: 'المملكة العربية السعودية' },
  { value: 'AE', labelEn: 'United Arab Emirates', labelAr: 'الإمارات' },
  { value: 'MA', labelEn: 'Morocco', labelAr: 'المغرب' },
  { value: 'PK', labelEn: 'Pakistan', labelAr: 'باكستان' },
]

export const emptyTaxDraft = () => ({
  code: '',
  name: '',
  nameAr: '',
  rate: '15',
  amount: '',
  type: 'sales',
  scope: 'all',
  computationMethod: 'percent_excluded',
  accountId: '',
  includedInPrice: false,
  invoiceLabel: '',
  taxGroupCode: '',
  subsequentTaxBase: false,
  country: 'SA',
  childTaxIds: [],
  active: true,
  distributionInvoices: {
    baseLine: { percentOfBase: '100', percentOfTax: '', accountId: '', taxGrid: '' },
    taxLine: { percentOfBase: '', percentOfTax: '100', accountId: '', taxGrid: '' },
  },
  distributionRefunds: {
    baseLine: { percentOfBase: '100', percentOfTax: '', accountId: '', taxGrid: '' },
    taxLine: { percentOfBase: '', percentOfTax: '100', accountId: '', taxGrid: '' },
  },
})

export function taxToDraft(tax) {
  if (!tax) return emptyTaxDraft()
  const line = (src) => ({
    percentOfBase: src?.percentOfBase != null ? String(src.percentOfBase) : '',
    percentOfTax: src?.percentOfTax != null ? String(src.percentOfTax) : '',
    accountId: src?.accountId?._id || src?.accountId || '',
    taxGrid: src?.taxGrid || '',
  })
  return {
    code: tax.code || '',
    name: tax.name || '',
    nameAr: tax.nameAr || '',
    rate: tax.rate != null ? String(tax.rate) : '15',
    amount: tax.amount != null ? String(tax.amount) : '',
    type: tax.type || 'sales',
    scope: tax.scope || 'all',
    computationMethod: tax.computationMethod || 'percent_excluded',
    accountId: tax.accountId?._id || tax.accountId || '',
    includedInPrice: Boolean(tax.includedInPrice),
    invoiceLabel: tax.invoiceLabel || '',
    taxGroupCode: tax.taxGroupCode || '',
    subsequentTaxBase: Boolean(tax.subsequentTaxBase),
    country: tax.country || 'SA',
    childTaxIds: (tax.childTaxIds || []).map((t) => (typeof t === 'object' ? t._id : t)),
    active: tax.active !== false,
    distributionInvoices: {
      baseLine: line(tax.distributionInvoices?.baseLine),
      taxLine: line(tax.distributionInvoices?.taxLine),
    },
    distributionRefunds: {
      baseLine: line(tax.distributionRefunds?.baseLine),
      taxLine: line(tax.distributionRefunds?.taxLine),
    },
  }
}

export function draftToPayload(draft) {
  const line = (src) => ({
    percentOfBase: src.percentOfBase !== '' ? Number(src.percentOfBase) : undefined,
    percentOfTax: src.percentOfTax !== '' ? Number(src.percentOfTax) : undefined,
    accountId: src.accountId || null,
    taxGrid: src.taxGrid || '',
  })
  return {
    code: draft.code,
    name: draft.name,
    nameAr: draft.nameAr,
    rate: Number(draft.rate),
    amount: draft.amount !== '' ? Number(draft.amount) : null,
    type: draft.type,
    scope: draft.scope,
    computationMethod: draft.computationMethod,
    accountId: draft.accountId,
    includedInPrice: draft.includedInPrice,
    invoiceLabel: draft.invoiceLabel,
    taxGroupCode: draft.taxGroupCode,
    subsequentTaxBase: draft.subsequentTaxBase,
    country: draft.country,
    childTaxIds: draft.childTaxIds || [],
    active: draft.active,
    distributionInvoices: {
      baseLine: line(draft.distributionInvoices.baseLine),
      taxLine: line(draft.distributionInvoices.taxLine),
    },
    distributionRefunds: {
      baseLine: line(draft.distributionRefunds.baseLine),
      taxLine: line(draft.distributionRefunds.taxLine),
    },
  }
}
