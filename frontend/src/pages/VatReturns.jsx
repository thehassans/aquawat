import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Building2, Calendar, Receipt, RefreshCw, Save, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet, ArrowRight, Activity, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import Money from '../components/ui/Money'

const getCurrentPeriod = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

const createEmptyManual = () => ({
  salesStandardRated: { amount: 0, adjustment: 0, vatAmount: 0 },
  salesSpecialCitizen: { amount: 0, adjustment: 0, vatAmount: 0 },
  salesZeroRatedDomestic: { amount: 0, adjustment: 0, vatAmount: 0 },
  salesExports: { amount: 0, adjustment: 0, vatAmount: 0 },
  salesExempt: { amount: 0, adjustment: 0, vatAmount: 0 },
  purchasesStandardRatedDomestic: { amount: 0, adjustment: 0, vatAmount: 0 },
  purchasesImportsCustoms: { amount: 0, adjustment: 0, vatAmount: 0 },
  purchasesImportsReverseCharge: { amount: 0, adjustment: 0, vatAmount: 0 },
  purchasesZeroRated: { amount: 0, adjustment: 0, vatAmount: 0 },
  purchasesExempt: { amount: 0, adjustment: 0, vatAmount: 0 },
})

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const buildStatementFromManual = ({ baseStatement, savedManual, currentManual, correctionsPreviousPeriod, vatCreditCarriedForward }) => {
  const getBaseLine = (key) => {
    const finalLine = baseStatement?.[key] || { amount: 0, adjustment: 0, vatAmount: 0 }
    const savedLine = savedManual?.[key] || { amount: 0, adjustment: 0, vatAmount: 0 }
    return {
      amount: toNumber(finalLine.amount) - toNumber(savedLine.amount),
      adjustment: 0,
      vatAmount: toNumber(finalLine.vatAmount) - toNumber(savedLine.vatAmount),
    }
  }

  const mergeLine = (key) => {
    const baseLine = getBaseLine(key)
    const currentLine = currentManual?.[key] || { amount: 0, adjustment: 0, vatAmount: 0 }
    return {
      amount: toNumber(baseLine.amount) + toNumber(currentLine.amount),
      adjustment: toNumber(currentLine.adjustment),
      vatAmount: toNumber(baseLine.vatAmount) + toNumber(currentLine.vatAmount),
    }
  }

  const salesStandardRated = mergeLine('salesStandardRated')
  const salesSpecialCitizen = mergeLine('salesSpecialCitizen')
  const salesZeroRatedDomestic = mergeLine('salesZeroRatedDomestic')
  const salesExports = mergeLine('salesExports')
  const salesExempt = mergeLine('salesExempt')
  const totalSales = {
    amount: salesStandardRated.amount + salesSpecialCitizen.amount + salesZeroRatedDomestic.amount + salesExports.amount + salesExempt.amount,
    adjustment: salesStandardRated.adjustment + salesSpecialCitizen.adjustment + salesZeroRatedDomestic.adjustment + salesExports.adjustment + salesExempt.adjustment,
    vatAmount: salesStandardRated.vatAmount + salesSpecialCitizen.vatAmount + salesZeroRatedDomestic.vatAmount + salesExports.vatAmount + salesExempt.vatAmount,
  }

  const purchasesStandardRatedDomestic = mergeLine('purchasesStandardRatedDomestic')
  const purchasesImportsCustoms = mergeLine('purchasesImportsCustoms')
  const purchasesImportsReverseCharge = mergeLine('purchasesImportsReverseCharge')
  const purchasesZeroRated = mergeLine('purchasesZeroRated')
  const purchasesExempt = mergeLine('purchasesExempt')
  const totalPurchases = {
    amount: purchasesStandardRatedDomestic.amount + purchasesImportsCustoms.amount + purchasesImportsReverseCharge.amount + purchasesZeroRated.amount + purchasesExempt.amount,
    adjustment: purchasesStandardRatedDomestic.adjustment + purchasesImportsCustoms.adjustment + purchasesImportsReverseCharge.adjustment + purchasesZeroRated.adjustment + purchasesExempt.adjustment,
    vatAmount: purchasesStandardRatedDomestic.vatAmount + purchasesImportsCustoms.vatAmount + purchasesImportsReverseCharge.vatAmount + purchasesZeroRated.vatAmount + purchasesExempt.vatAmount,
  }

  const totalVatDueCurrentPeriod = totalSales.vatAmount - totalPurchases.vatAmount
  const corrections = toNumber(correctionsPreviousPeriod)
  const credit = toNumber(vatCreditCarriedForward)
  const netVatDue = totalVatDueCurrentPeriod + corrections - credit

  return {
    salesStandardRated,
    salesSpecialCitizen,
    salesZeroRatedDomestic,
    salesExports,
    salesExempt,
    totalSales,
    purchasesStandardRatedDomestic,
    purchasesImportsCustoms,
    purchasesImportsReverseCharge,
    purchasesZeroRated,
    purchasesExempt,
    totalPurchases,
    totalVatDueCurrentPeriod: { amount: 0, adjustment: 0, vatAmount: totalVatDueCurrentPeriod },
    correctionsPreviousPeriod: { amount: 0, adjustment: 0, vatAmount: corrections },
    vatCreditCarriedForward: { amount: 0, adjustment: 0, vatAmount: credit },
    netVatDue: { amount: 0, adjustment: 0, vatAmount: netVatDue },
  }
}

export default function VatReturns() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'
  const [filters, setFilters] = useState(getCurrentPeriod)

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      businessLocation: 'all',
      manual: createEmptyManual(),
      correctionsPreviousPeriod: 0,
      vatCreditCarriedForward: 0,
      notes: '',
      status: 'draft',
    },
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vat-returns', filters.startDate, filters.endDate],
    queryFn: () => api.get('/reports/vat-return', { params: filters }).then((res) => res.data),
  })

  useEffect(() => {
    if (!data?.vatReturn) return
    reset({
      businessLocation: data.vatReturn.businessLocation || 'all',
      manual: data.vatReturn.manual || createEmptyManual(),
      correctionsPreviousPeriod: toNumber(data.vatReturn.correctionsPreviousPeriod),
      vatCreditCarriedForward: toNumber(data.vatReturn.vatCreditCarriedForward),
      notes: data.vatReturn.notes || '',
      status: data.vatReturn.status || 'draft',
    })
  }, [data, reset])

  const watchedManual = watch('manual') || createEmptyManual()
  const watchedCorrections = watch('correctionsPreviousPeriod')
  const watchedCredit = watch('vatCreditCarriedForward')
  const watchedBusinessLocation = watch('businessLocation')
  const watchedNotes = watch('notes')
  const watchedStatus = watch('status')

  const statement = useMemo(() => buildStatementFromManual({
    baseStatement: data?.vatReturn?.statement || {},
    savedManual: data?.vatReturn?.manual || createEmptyManual(),
    currentManual: watchedManual,
    correctionsPreviousPeriod: watchedCorrections,
    vatCreditCarriedForward: watchedCredit,
  }), [data, watchedManual, watchedCorrections, watchedCredit])

  const currency = data?.currency || 'SAR'
  const renderMoney = (value, extraProps = {}) => (
    <Money
      value={toNumber(value)}
      currency={currency}
      language={language}
      minimumFractionDigits={2}
      maximumFractionDigits={2}
      {...extraProps}
    />
  )
  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/reports/vat-return', payload).then((res) => res.data),
    onSuccess: () => {
      toast.success(isArabic ? 'تم حفظ إقرار ضريبة القيمة المضافة' : 'VAT return saved successfully')
      queryClient.invalidateQueries(['vat-returns'])
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Failed to save VAT return'),
  })

  const submitReturn = (status = 'draft') => handleSubmit((formData) => {
    saveMutation.mutate({
      startDate: filters.startDate,
      endDate: filters.endDate,
      businessLocation: formData.businessLocation,
      manual: formData.manual,
      correctionsPreviousPeriod: toNumber(formData.correctionsPreviousPeriod),
      vatCreditCarriedForward: toNumber(formData.vatCreditCarriedForward),
      notes: formData.notes,
      status,
    })
  })()

  const rows = [
    { number: 1, key: 'salesStandardRated', labelEn: 'Standard rated sales (15%)', labelAr: 'المبيعات الخاضعة للنسبة الأساسية (15%)', manualKey: 'salesStandardRated', section: 'sales' },
    { number: 2, key: 'salesSpecialCitizen', labelEn: 'Sales on which the government bears the VAT', labelAr: 'المبيعات التي تتحمل الدولة ضريبتها', manualKey: 'salesSpecialCitizen', section: 'sales' },
    { number: 3, key: 'salesZeroRatedDomestic', labelEn: 'Zero rated domestic sales', labelAr: 'المبيعات المحلية الخاضعة لنسبة الصفر', manualKey: 'salesZeroRatedDomestic', section: 'sales' },
    { number: 4, key: 'salesExports', labelEn: 'Exports', labelAr: 'الصادرات', manualKey: 'salesExports', section: 'sales' },
    { number: 5, key: 'salesExempt', labelEn: 'Exempt sales', labelAr: 'المبيعات المعفاة', manualKey: 'salesExempt', section: 'sales' },
    { number: 6, key: 'totalSales', labelEn: 'Total Sales', labelAr: 'إجمالي المبيعات', section: 'sales', readOnly: true },
    { number: 7, key: 'purchasesStandardRatedDomestic', labelEn: 'Standard rated domestic purchases (15%)', labelAr: 'المشتريات المحلية الخاضعة للنسبة الأساسية (15%)', manualKey: 'purchasesStandardRatedDomestic', section: 'purchases' },
    { number: 8, key: 'purchasesImportsCustoms', labelEn: 'Imports subject to VAT paid on import (15%)', labelAr: 'الواردات الخاضعة لضريبة القيمة المضافة والمدفوعة في الجمارك (15%)', manualKey: 'purchasesImportsCustoms', section: 'purchases' },
    { number: 9, key: 'purchasesImportsReverseCharge', labelEn: 'Supplies subject to VAT under the reverse charge, and imports for which tax payment is deferred upon customs release (15%)', labelAr: 'التوريدات الخاضعة لضريبة القيمة المضافة وفقا لآلية الاحتساب العكسي والواردات التي تؤجل فيها الضريبة', manualKey: 'purchasesImportsReverseCharge', section: 'purchases' },
    { number: 10, key: 'purchasesZeroRated', labelEn: 'Zero rated purchases', labelAr: 'المشتريات الخاضعة لنسبة الصفر', manualKey: 'purchasesZeroRated', section: 'purchases' },
    { number: 11, key: 'purchasesExempt', labelEn: 'Exempt purchases', labelAr: 'المشتريات المعفاة', manualKey: 'purchasesExempt', section: 'purchases' },
    { number: 12, key: 'totalPurchases', labelEn: 'Total purchases', labelAr: 'إجمالي المشتريات', section: 'purchases', readOnly: true },
    { number: 13, key: 'totalVatDueCurrentPeriod', labelEn: 'Total VAT due for current period', labelAr: 'إجمالي ضريبة القيمة المضافة المستحقة للفترة الحالية', section: 'settlement', vatOnly: true, readOnly: true },
    { number: 14, key: 'correctionsPreviousPeriod', labelEn: 'Corrections from previous period ( between ﷼ ± 15000.00 )', labelAr: 'تصحيحات من الفترة السابقة ( بين ﷼ ± 15000.00 )', section: 'settlement', vatOnly: true, topLevelField: 'correctionsPreviousPeriod' },
    { number: 15, key: 'vatCreditCarriedForward', labelEn: 'VAT credit carried forward from previous period(s)', labelAr: 'رصيد ضريبة القيمة المضافة المرحل من فترات سابقة', section: 'settlement', vatOnly: true, topLevelField: 'vatCreditCarriedForward' },
    { number: 16, key: 'netVatDue', labelEn: 'Net VAT due (or reclaimed)', labelAr: 'صافي ضريبة القيمة المضافة المستحقة (أو المستردة)', section: 'settlement', vatOnly: true, readOnly: true },
  ]

  const summaryCards = [
    {
      title: isArabic ? 'إجمالي المبيعات' : 'Total Sales',
      value: renderMoney(statement.totalSales?.amount, { className: 'text-2xl font-bold' }),
      icon: TrendingUp,
      tone: 'from-[#0e1c26] to-[#2a4365]',
    },
    {
      title: isArabic ? 'إجمالي المشتريات' : 'Total Purchases',
      value: renderMoney(statement.totalPurchases?.amount, { className: 'text-2xl font-bold' }),
      icon: Wallet,
      tone: 'from-[#2b1836] to-[#4c2966]',
    },
    {
      title: isArabic ? 'الضريبة المستحقة للفترة' : 'VAT Due This Period',
      value: renderMoney(statement.totalVatDueCurrentPeriod?.vatAmount, { className: 'text-2xl font-bold' }),
      icon: Receipt,
      tone: 'from-[#1a362d] to-[#2f855a]',
    },
    {
      title: isArabic ? 'الصافي النهائي' : 'Net VAT Position',
      value: renderMoney(statement.netVatDue?.vatAmount, { className: 'text-2xl font-bold' }),
      icon: TrendingDown,
      tone: 'from-[#4a1a1a] to-[#9b2c2c]',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="relative">
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-900 border-t-transparent animate-spin" />
          <ShieldCheck className="h-6 w-6 text-slate-900 m-4 animate-pulse" />
        </div>
      </div>
    )
  }

  const renderSection = (sectionName, titleEn, titleAr, icon) => {
    const sectionRows = rows.filter(r => r.section === sectionName)
    const isSettlement = sectionName === 'settlement'
    
    return (
      <div className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white/50 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-800/60 dark:bg-slate-900/50">
        <div className="border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-transparent px-8 py-5 dark:border-slate-800/50 dark:from-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900">
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight dark:text-white">{isArabic ? titleAr : titleEn}</h2>
            </div>
          </div>
        </div>
        
        <div className="px-8 py-2 overflow-x-auto">
          <div className="min-w-[1020px]">
            <div className="grid grid-cols-[60px_minmax(300px,1fr)_160px_160px_160px] gap-4 border-b border-slate-100 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
              <div>#</div>
              <div>{isArabic ? 'البند' : 'VAT Line Item'}</div>
              <div>{isArabic ? 'المبلغ' : 'Amount'}</div>
              {!isSettlement && <div>{isArabic ? 'التعديل' : 'Adjustment'}</div>}
              {isSettlement && <div className="text-transparent">N/A</div>}
              <div>{isArabic ? 'قيمة الضريبة' : 'VAT Amount'}</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {sectionRows.map((row) => {
                const line = statement?.[row.key] || { amount: 0, adjustment: 0, vatAmount: 0 }
                const savedManualLine = data?.vatReturn?.manual?.[row.manualKey] || { amount: 0, adjustment: 0, vatAmount: 0 }
                const baseAmount = row.manualKey ? toNumber((data?.vatReturn?.statement?.[row.key]?.amount || 0) - savedManualLine.amount) : toNumber(line.amount)
                const baseVat = row.manualKey ? toNumber((data?.vatReturn?.statement?.[row.key]?.vatAmount || 0) - savedManualLine.vatAmount) : toNumber(line.vatAmount)
                const editablePrefix = row.manualKey ? `manual.${row.manualKey}` : null
                const isTotal = row.readOnly

                return (
                  <div key={row.key} className={`group grid grid-cols-[60px_minmax(300px,1fr)_160px_160px_160px] gap-4 items-center py-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${isTotal ? 'rounded-2xl bg-slate-50/80 px-4 -mx-4 my-2 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-700/50' : ''}`}>
                    <div className={`text-sm font-black ${isTotal ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>{row.number}</div>
                    <div className="pr-6">
                      <p className={`text-sm font-semibold leading-relaxed ${isTotal ? 'text-slate-900 dark:text-white text-base' : 'text-slate-700 dark:text-slate-300'}`}>
                        {isArabic ? row.labelAr : row.labelEn}
                      </p>
                      {row.manualKey && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100/50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                          <Activity className="h-3 w-3" />
                          {isArabic ? 'محسوب من النظام:' : 'System:'} {renderMoney(baseAmount)} / {renderMoney(baseVat)}
                        </div>
                      )}
                    </div>

                    {/* Amount Column */}
                    <div>
                      {row.vatOnly || isTotal ? (
                        <div className={`flex h-11 items-center px-4 text-sm font-bold ${isTotal ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {row.vatOnly ? '—' : renderMoney(line.amount)}
                        </div>
                      ) : (
                        <div className="relative">
                          <input type="number" step="0.01" {...register(`${editablePrefix}.amount`, { valueAsNumber: true })} className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-white dark:focus:ring-white" />
                        </div>
                      )}
                    </div>

                    {/* Adjustment Column */}
                    <div>
                      {isSettlement || isTotal ? (
                         <div className="flex h-11 items-center px-4 text-sm font-bold text-slate-400">—</div>
                      ) : (
                        <div className="relative">
                          <input type="number" step="0.01" {...register(`${editablePrefix}.adjustment`, { valueAsNumber: true })} className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-white dark:focus:ring-white" />
                        </div>
                      )}
                    </div>

                    {/* VAT Amount Column */}
                    <div>
                      {isTotal ? (
                        <div className="flex h-11 items-center px-4 text-sm font-bold text-slate-900 dark:text-white">
                          {renderMoney(line.vatAmount)}
                        </div>
                      ) : row.topLevelField ? (
                        <div className="relative">
                          <input type="number" step="0.01" {...register(row.topLevelField, { valueAsNumber: true })} className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-white dark:focus:ring-white" />
                        </div>
                      ) : row.vatOnly ? (
                        <div className="flex h-11 items-center px-4 text-sm font-bold text-slate-900 dark:text-white">
                          {renderMoney(line.vatAmount)}
                        </div>
                      ) : (
                        <div className="relative">
                          <input type="number" step="0.01" {...register(`${editablePrefix}.vatAmount`, { valueAsNumber: true })} className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-white dark:focus:ring-white" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-20">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="absolute -right-64 -top-64 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[120px]"></div>
        <div className="absolute -left-64 -bottom-64 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px]"></div>
        
        <div className="relative grid gap-8 px-8 py-10 lg:grid-cols-[1.5fr_1fr] lg:px-12 lg:py-14">
          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-md w-fit">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {isArabic ? 'الضرائب والإقرارات' : 'ZATCA Compliance'}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight lg:text-5xl">{isArabic ? 'إقرار ضريبة القيمة المضافة' : 'VAT Returns'}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
              {isArabic
                ? 'إدارة احترافية للإقرارات الضريبية مصممة لتتوافق بالكامل مع هيئة الزكاة والضريبة والجمارك. اعتمد إقراراتك بكل دقة وأمان.'
                : 'Enterprise-grade VAT return management designed for strict compliance with ZATCA regulations. Review, adjust, and submit with absolute confidence.'}
            </p>
          </div>
          
          <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-1">
            <div className="group rounded-2xl bg-white/5 p-4 transition-colors hover:bg-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{isArabic ? 'الفترة الضريبية' : 'Tax Period'}</p>
              <p className="mt-2 text-lg font-black text-white">{filters.startDate} <span className="text-slate-500 mx-2">→</span> {filters.endDate}</p>
            </div>
            <div className="group rounded-2xl bg-white/5 p-4 transition-colors hover:bg-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{isArabic ? 'آخر مزامنة' : 'Last Sync'}</p>
              <p className="mt-2 text-lg font-bold text-white">{data?.vatReturn?.lastImportedAt ? new Date(data.vatReturn.lastImportedAt).toLocaleString(isArabic ? 'ar-SA' : 'en-GB') : (isArabic ? 'غير متوفر' : 'Not synced yet')}</p>
            </div>
            <div className="group rounded-2xl bg-white/5 p-4 transition-colors hover:bg-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{isArabic ? 'حالة الإقرار' : 'Filing Status'}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-300">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                {data?.vatReturn?.status === 'submitted' ? (isArabic ? 'تم الإرسال لـ ZATCA' : 'Submitted to ZATCA') : (isArabic ? 'مسودة قيد المراجعة' : 'Draft under review')}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{isArabic ? 'موقع العمل' : 'Business Location'}</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <select {...register('businessLocation')} className="h-14 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white pl-12 pr-10 text-sm font-bold text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="all">{isArabic ? 'كل المواقع' : 'All locations'}</option>
                <option value="head-office">{isArabic ? 'المكتب الرئيسي' : 'Head Office'}</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{isArabic ? 'من تاريخ' : 'From Date'}</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters((current) => ({ ...current, startDate: e.target.value }))} className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{isArabic ? 'إلى تاريخ' : 'To Date'}</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters((current) => ({ ...current, endDate: e.target.value }))} className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>
          <div className="flex items-end gap-3 self-end sm:flex-row xl:flex-col pt-6 xl:pt-0">
            <button type="button" onClick={() => refetch()} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700" disabled={isFetching}>
              {isFetching ? <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-slate-400 border-t-transparent" /> : <RefreshCw className="h-4 w-4" />}
              {isArabic ? 'مزامنة السجلات' : 'Sync Records'}
            </button>
            <button type="button" onClick={() => submitReturn('draft')} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 px-8 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/30 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:shadow-white/10" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}
              {isArabic ? 'حفظ التقدم' : 'Save Progress'}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + (index * 0.04) }} className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-0 text-white shadow-xl">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.tone} opacity-80 mix-blend-multiply`}></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">{card.title}</p>
                  <div className="mt-4">{card.value}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <form onSubmit={(event) => {
        event.preventDefault()
        submitReturn('draft')
      }} className="space-y-8">
        
        {renderSection('sales', 'VAT on Sales', 'الضريبة على المبيعات', <TrendingUp className="h-5 w-5" />)}
        {renderSection('purchases', 'VAT on Purchases', 'الضريبة على المشتريات', <Wallet className="h-5 w-5" />)}
        {renderSection('settlement', 'Net VAT Settlement', 'تسوية الضريبة النهائية', <Receipt className="h-5 w-5" />)}

        <div className="grid gap-8 xl:grid-cols-[1fr_400px]">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-[2rem] border border-slate-200/60 bg-white/50 p-8 backdrop-blur-xl shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" />{isArabic ? 'ملاحظات الإقرار' : 'Filing Notes'}</h3>
            <textarea {...register('notes')} className="mt-6 min-h-[260px] w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-sm font-medium text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder={isArabic ? 'أضف ملاحظات داخلية، تفسيرات للتعديلات اليدوية، أو تفاصيل المرفقات...' : 'Add internal filing notes, explanations for manual adjustments, or attachment references...'} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col gap-6">
            <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/20 blur-[60px]"></div>
               <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">{isArabic ? 'الصافي النهائي للمطالبة' : 'Final Net Position'}</p>
                <div className="mt-4">{renderMoney(statement.netVatDue?.vatAmount, { className: 'text-4xl font-black tracking-tight' })}</div>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className={`h-3 w-3 rounded-full ${statement.netVatDue?.vatAmount >= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                  <p className="text-sm font-bold text-white/90">{statement.netVatDue?.vatAmount >= 0
                    ? (isArabic ? 'رصيد ضريبي مستحق الدفع لهيئة الزكاة' : 'VAT liability payable to ZATCA')
                    : (isArabic ? 'رصيد ضريبي قابل للاسترداد من هيئة الزكاة' : 'Recoverable VAT credit from ZATCA')}
                  </p>
                </div>
               </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/60 bg-white/50 p-6 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => submitReturn('draft')} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-slate-400 border-t-transparent" /> : <Save className="h-4 w-4" />}
                  {isArabic ? 'حفظ مسودة' : 'Save as Draft'}
                </button>
                <button type="button" onClick={() => submitReturn('submitted')} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-600/30 disabled:opacity-50" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/30 border-t-white" /> : <ShieldCheck className="h-4 w-4" />}
                  {isArabic ? 'اعتماد وإغلاق الإقرار' : 'Finalize & Submit Return'}
                </button>
              </div>
              <input type="hidden" {...register('status')} value={watchedStatus || 'draft'} readOnly />
            </div>
          </motion.div>
        </div>
      </form>
    </div>
  )
}
