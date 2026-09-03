import { useEffect, useMemo } from 'react'

const toDateInput = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const DEPOSIT_STATUSES = [
  { value: 'pending', labelEn: 'Pending', labelAr: 'معلّق' },
  { value: 'held', labelEn: 'Held', labelAr: 'محجوز' },
  { value: 'partially_refunded', labelEn: 'Partially refunded', labelAr: 'مسترد جزئياً' },
  { value: 'fully_refunded', labelEn: 'Fully refunded', labelAr: 'مسترد بالكامل' },
  { value: 'forfeited', labelEn: 'Forfeited', labelAr: 'مصادر' },
]

const PAYMENT_METHODS = [
  { value: 'cash', labelEn: 'Cash', labelAr: 'نقدي' },
  { value: 'card', labelEn: 'Card', labelAr: 'بطاقة' },
  { value: 'bank_transfer', labelEn: 'Bank transfer', labelAr: 'تحويل بنكي' },
  { value: 'online', labelEn: 'Online', labelAr: 'إلكتروني' },
]

/**
 * Boutique rental extras for sell invoices (A4 path — not POS).
 * Mirrors boutiqueDetails used by ModernZatcaTemplate / PDF.
 */
export default function BoutiqueInvoiceFields({
  language = 'en',
  register,
  watch,
  setValue,
  fieldControlClass = 'input',
  fieldLabelClass = 'label',
  dense = false,
  onRemove,
}) {
  const isAr = language === 'ar'
  const startDate = watch('boutiqueDetails.startDate')
  const endDate = watch('boutiqueDetails.endDate')
  const transactionType = watch('boutiqueDetails.transactionType') || 'rental'
  const isRental = transactionType === 'rental'

  const rentalDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
  }, [startDate, endDate])

  useEffect(() => {
    if (!isRental) return
    if (!startDate) {
      setValue('boutiqueDetails.startDate', toDateInput(new Date()), { shouldDirty: false })
    }
    if (!endDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setValue('boutiqueDetails.endDate', toDateInput(tomorrow), { shouldDirty: false })
    }
  }, [isRental, startDate, endDate, setValue])

  // Keep invoice payment fields aligned with boutique rental payment (POS parity)
  const boutiqueAmountPaid = watch('boutiqueDetails.amountPaid')
  const boutiquePaymentMethod = watch('boutiqueDetails.paymentMethod')
  useEffect(() => {
    if (!boutiquePaymentMethod) return
    const mapped = boutiquePaymentMethod === 'online' ? 'other' : boutiquePaymentMethod
    if (['cash', 'card', 'bank_transfer', 'other'].includes(mapped)) {
      setValue('paymentMethod', mapped, { shouldDirty: true })
    }
  }, [boutiquePaymentMethod, setValue])

  useEffect(() => {
    if (boutiqueAmountPaid == null || Number.isNaN(Number(boutiqueAmountPaid))) return
    setValue('paidAmount', Number(boutiqueAmountPaid) || 0, { shouldDirty: true })
  }, [boutiqueAmountPaid, setValue])

  const label = (en, ar) => (isAr ? ar : en)
  const control = dense ? fieldControlClass : 'input'
  const labelCls = dense ? fieldLabelClass : 'label'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {label('Boutique rental', 'إيجار البوتيك')}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {label(
              'Rental dates, deposit, and payment — shown on the A4 tax invoice.',
              'تواريخ الإيجار والتأمين والدفع — تظهر على فاتورة الضريبة A4.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-dark-900/50">
            {[
              { id: 'rental', en: 'Rental', ar: 'إيجار' },
              { id: 'sale', en: 'Sale', ar: 'بيع' },
            ].map((opt) => {
              const active = transactionType === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setValue('boutiqueDetails.transactionType', opt.id, { shouldDirty: true })}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {isAr ? opt.ar : opt.en}
                </button>
              )
            })}
          </div>
          {onRemove ? (
            <button type="button" onClick={onRemove} className="text-xs font-semibold text-slate-500 hover:text-red-600">
              {label('Remove', 'إزالة')}
            </button>
          ) : null}
        </div>
      </div>

      <input type="hidden" {...register('boutiqueDetails.transactionType')} />
      <input type="hidden" {...register('boutiqueDetails.rentalId')} />
      <input type="hidden" {...register('boutiqueDetails.rentalNumber')} />

      {isRental ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>{label('Rental start', 'بداية الإيجار')}</label>
            <input type="date" {...register('boutiqueDetails.startDate')} className={`mt-1 ${control}`} />
          </div>
          <div>
            <label className={labelCls}>{label('Rental end', 'نهاية الإيجار')}</label>
            <input type="date" {...register('boutiqueDetails.endDate')} className={`mt-1 ${control}`} />
          </div>
          <div>
            <label className={labelCls}>{label('Rental days', 'عدد الأيام')}</label>
            <input
              type="text"
              readOnly
              value={rentalDays || '—'}
              className={`mt-1 ${control} opacity-80`}
            />
          </div>
          <div>
            <label className={labelCls}>{label('Security deposit', 'تأمين')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('boutiqueDetails.totalDeposit', { valueAsNumber: true })}
              className={`mt-1 ${control}`}
              placeholder="0.00"
            />
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.02]">
          {label(
            'Boutique sale invoice — no rental period. Deposit and fees below are optional.',
            'فاتورة بيع بوتيك — بدون فترة إيجار. التأمين والرسوم أدناه اختيارية.',
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls}>{label('Payment method', 'طريقة الدفع')}</label>
          <select {...register('boutiqueDetails.paymentMethod')} className={`mt-1 ${control}`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{isAr ? m.labelAr : m.labelEn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{label('Amount paid', 'المبلغ المدفوع')}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('boutiqueDetails.amountPaid', { valueAsNumber: true })}
            className={`mt-1 ${control}`}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className={labelCls}>{label('Deposit status', 'حالة التأمين')}</label>
          <select {...register('boutiqueDetails.depositStatus')} className={`mt-1 ${control}`}>
            {DEPOSIT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.labelEn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{label('Amount refunded', 'المبلغ المسترد')}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('boutiqueDetails.amountRefunded', { valueAsNumber: true })}
            className={`mt-1 ${control}`}
            placeholder="0.00"
          />
        </div>
      </div>

      {isRental ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{label('Late fee', 'رسوم تأخير')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('boutiqueDetails.totalLateFee', { valueAsNumber: true })}
              className={`mt-1 ${control}`}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={labelCls}>{label('Damage fee', 'رسوم تلف')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('boutiqueDetails.totalDamageFee', { valueAsNumber: true })}
              className={`mt-1 ${control}`}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={labelCls}>{label('Cleaning fee', 'رسوم تنظيف')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('boutiqueDetails.totalCleaningFee', { valueAsNumber: true })}
              className={`mt-1 ${control}`}
              placeholder="0.00"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function emptyBoutiqueDetails(overrides = {}) {
  const today = toDateInput(new Date())
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toDateInput(d)
  })()
  return {
    rentalId: '',
    rentalNumber: '',
    transactionType: 'rental',
    startDate: today,
    endDate: tomorrow,
    totalDeposit: 0,
    totalLateFee: 0,
    totalDamageFee: 0,
    totalCleaningFee: 0,
    amountPaid: 0,
    amountRefunded: 0,
    depositStatus: 'pending',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    ...overrides,
  }
}

export function sanitizeBoutiqueDetails(raw = {}) {
  const transactionType = raw?.transactionType === 'sale' ? 'sale' : 'rental'
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const dateOrUndef = (v) => {
    if (!v) return undefined
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  const details = {
    rentalId: raw?.rentalId || undefined,
    rentalNumber: String(raw?.rentalNumber || '').trim() || undefined,
    transactionType,
    startDate: dateOrUndef(raw?.startDate),
    endDate: dateOrUndef(raw?.endDate),
    totalDeposit: num(raw?.totalDeposit),
    totalLateFee: num(raw?.totalLateFee),
    totalDamageFee: num(raw?.totalDamageFee),
    totalCleaningFee: num(raw?.totalCleaningFee),
    amountPaid: num(raw?.amountPaid),
    amountRefunded: num(raw?.amountRefunded),
    depositStatus: ['pending', 'held', 'partially_refunded', 'fully_refunded', 'forfeited'].includes(raw?.depositStatus)
      ? raw.depositStatus
      : 'pending',
    paymentMethod: ['cash', 'card', 'bank_transfer', 'online', 'other'].includes(raw?.paymentMethod)
      ? raw.paymentMethod
      : 'cash',
    paymentStatus: ['pending', 'partial', 'paid'].includes(raw?.paymentStatus)
      ? raw.paymentStatus
      : (num(raw?.amountPaid) > 0 ? 'partial' : 'pending'),
  }
  if (transactionType === 'sale') {
    details.startDate = undefined
    details.endDate = undefined
  }
  return details
}

export function boutiqueDetailsFromInvoice(invoice) {
  const src = invoice?.boutiqueDetails || {}
  return emptyBoutiqueDetails({
    rentalId: src.rentalId?._id || src.rentalId || invoice?.rentalId || '',
    rentalNumber: src.rentalNumber || invoice?.rentalNumber || '',
    transactionType: src.transactionType === 'sale' ? 'sale' : 'rental',
    startDate: toDateInput(src.startDate) || toDateInput(new Date()),
    endDate: toDateInput(src.endDate) || '',
    totalDeposit: Number(src.totalDeposit) || 0,
    totalLateFee: Number(src.totalLateFee) || 0,
    totalDamageFee: Number(src.totalDamageFee) || 0,
    totalCleaningFee: Number(src.totalCleaningFee) || 0,
    amountPaid: Number(src.amountPaid ?? invoice?.paidAmount) || 0,
    amountRefunded: Number(src.amountRefunded) || 0,
    depositStatus: src.depositStatus || 'pending',
    paymentMethod: src.paymentMethod || invoice?.paymentMethod || 'cash',
    paymentStatus: src.paymentStatus || invoice?.paymentStatus || 'pending',
  })
}
