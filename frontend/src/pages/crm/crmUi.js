export const crmShell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]'

export const crmInkBtn =
  'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'

export const crmGhostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-200 dark:hover:border-white/20'

export const crmInput =
  'w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/10 dark:bg-[#0c111a] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/25'

export const crmLabel = 'text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500'

export const crmModalBackdrop =
  'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]'

export const crmModalPanel =
  'w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'

export const DEAL_STAGES = [
  { id: 'prospecting', label: 'Prospecting', ar: 'استكشاف', dot: 'bg-slate-400' },
  { id: 'qualification', label: 'Qualification', ar: 'تأهيل', dot: 'bg-slate-500' },
  { id: 'proposal', label: 'Proposal', ar: 'عرض', dot: 'bg-slate-700' },
  { id: 'negotiation', label: 'Negotiation', ar: 'تفاوض', dot: 'bg-slate-900 dark:bg-white' },
  { id: 'closed_won', label: 'Won', ar: 'فوز', dot: 'bg-emerald-500' },
  { id: 'closed_lost', label: 'Lost', ar: 'خسارة', dot: 'bg-rose-500' },
]

export const LEAD_STATUSES = [
  { id: 'new', label: 'New', ar: 'جديد' },
  { id: 'contacted', label: 'Contacted', ar: 'تم التواصل' },
  { id: 'qualified', label: 'Qualified', ar: 'مؤهل' },
  { id: 'proposal_sent', label: 'Proposal sent', ar: 'عرض مرسل' },
  { id: 'negotiation', label: 'Negotiation', ar: 'تفاوض' },
  { id: 'converted', label: 'Converted', ar: 'محوّل' },
  { id: 'lost', label: 'Lost', ar: 'خسارة' },
]

export const CRM_SOURCES = [
  { id: 'website', label: 'Website', ar: 'الموقع' },
  { id: 'referral', label: 'Referral', ar: 'إحالة' },
  { id: 'social_media', label: 'Social', ar: 'تواصل اجتماعي' },
  { id: 'email_campaign', label: 'Email campaign', ar: 'حملة بريد' },
  { id: 'whatsapp', label: 'WhatsApp', ar: 'واتساب' },
  { id: 'phone', label: 'Phone', ar: 'هاتف' },
  { id: 'walk_in', label: 'Walk-in', ar: 'زيارة' },
  { id: 'other', label: 'Other', ar: 'أخرى' },
]

export const formatMoney = (value, currency = 'SAR') => {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: n % 1 ? 2 : 0,
    }).format(n)
  } catch {
    return `${n.toLocaleString()} ${currency}`
  }
}

export function CrmField({ label, children, rows, type = 'text', value, onChange, placeholder }) {
  const controlClass = crmInput
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children ? (
        <select value={value} onChange={onChange} className={controlClass}>
          {children}
        </select>
      ) : rows ? (
        <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} className={controlClass} />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={controlClass} />
      )}
    </div>
  )
}
