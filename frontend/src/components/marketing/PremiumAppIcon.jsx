/** Layered optimistic app icons — richer than flat lucide glyphs. */

export const PREMIUM_APP_CATALOG = [
  { id: 'invoicing', labelEn: 'Invoicing', labelAr: 'الفوترة', c1: '#8b5cf6', c2: '#14b8a6' },
  { id: 'accounting', labelEn: 'Accounting', labelAr: 'المحاسبة', c1: '#14b8a6', c2: '#6366f1' },
  { id: 'hr', labelEn: 'HR', labelAr: 'الموارد البشرية', c1: '#38bdf8', c2: '#8b5cf6' },
  { id: 'payroll', labelEn: 'Payroll', labelAr: 'الرواتب', c1: '#f59e0b', c2: '#14b8a6' },
  { id: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون', c1: '#f97316', c2: '#8b5cf6' },
  { id: 'warehouses', labelEn: 'Warehouses', labelAr: 'المستودعات', c1: '#14b8a6', c2: '#f59e0b' },
  { id: 'purchases', labelEn: 'Purchases', labelAr: 'المشتريات', c1: '#3b82f6', c2: '#8b5cf6' },
  { id: 'expenses', labelEn: 'Expenses', labelAr: 'المصروفات', c1: '#f43f5e', c2: '#8b5cf6' },
  { id: 'projects', labelEn: 'Projects', labelAr: 'المشاريع', c1: '#14b8a6', c2: '#6366f1' },
  { id: 'reports', labelEn: 'Reports', labelAr: 'التقارير', c1: '#6366f1', c2: '#f59e0b' },
  { id: 'pos', labelEn: 'Point of Sale', labelAr: 'نقاط البيع', c1: '#f59e0b', c2: '#8b5cf6' },
  { id: 'ecommerce', labelEn: 'eCommerce', labelAr: 'التجارة الإلكترونية', c1: '#8b5cf6', c2: '#14b8a6' },
  { id: 'crm', labelEn: 'CRM', labelAr: 'CRM', c1: '#14b8a6', c2: '#8b5cf6' },
  { id: 'whatsapp', labelEn: 'WhatsApp', labelAr: 'واتساب', c1: '#25D366', c2: '#128C7E' },
  { id: 'payments', labelEn: 'Payments', labelAr: 'المدفوعات', c1: '#8b5cf6', c2: '#f59e0b' },
  { id: 'analytics', labelEn: 'Analytics', labelAr: 'التحليلات', c1: '#3b82f6', c2: '#14b8a6' },
  { id: 'compliance', labelEn: 'Compliance', labelAr: 'الامتثال', c1: '#10b981', c2: '#3b82f6' },
  { id: 'ai', labelEn: 'AI', labelAr: 'الذكاء الاصطناعي', c1: '#8b5cf6', c2: '#f97316' },
  { id: 'support', labelEn: 'Support', labelAr: 'الدعم', c1: '#f43f5e', c2: '#8b5cf6' },
  { id: 'integrations', labelEn: 'Integrations', labelAr: 'التكاملات', c1: '#6366f1', c2: '#14b8a6' },
  { id: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', c1: '#64748b', c2: '#8b5cf6' },
]

function Glyph({ id, c1, c2 }) {
  switch (id) {
    case 'invoicing':
      return (
        <>
          <rect x="7" y="3" width="12" height="16" rx="2.5" fill={c1} opacity="0.45" />
          <rect x="5" y="5" width="12" height="16" rx="2.5" fill={c2} />
          <path d="M8 11h6M8 14.5h4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="15.5" cy="8" r="3" fill={c1} />
          <path d="M14.3 8h2.4M15.5 6.8v2.4" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" />
        </>
      )
    case 'accounting':
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3.5" fill={c1} />
          <path d="M8 9h8M8 12.5h8M8 16h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="17" cy="16" r="3.2" fill={c2} />
          <path d="M17 14.7v2.6M15.7 16h2.6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )
    case 'hr':
      return (
        <>
          <circle cx="9" cy="9" r="3.4" fill={c1} />
          <circle cx="15.2" cy="9.4" r="2.9" fill={c2} />
          <path d="M4.6 19c.7-3.1 2.6-4.8 4.7-4.8s4 1.7 4.7 4.8" fill={c1} />
          <path d="M12.2 19c.6-2.5 2.1-3.8 3.8-3.8 1.4 0 2.7.9 3.4 2.6" fill={c2} opacity="0.9" />
        </>
      )
    case 'payroll':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={c1} />
          <circle cx="12" cy="12" r="6.2" fill={c2} />
          <path d="M12 8.4v7.2M9.8 10.2c.5-.9 1.3-1.3 2.2-1.3 1.4 0 2.3.8 2.3 1.9 0 2.1-4.6 1.1-4.6 3.2 0 1 .9 1.8 2.3 1.8 1 0 1.8-.4 2.3-1.2" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" fill="none" />
        </>
      )
    case 'inventory':
      return (
        <>
          <path d="M12 3.2 20 8v8l-8 4.5L4 16V8l8-4.8Z" fill={c1} />
          <path d="M12 3.2 20 8l-8 4.5L4 8l8-4.8Z" fill={c2} opacity="0.7" />
          <path d="M12 12.5 20 8M12 12.5 4 8M12 12.5V21" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" opacity="0.9" />
        </>
      )
    case 'warehouses':
      return (
        <>
          <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z" fill={c1} />
          <rect x="9" y="13" width="6" height="8" rx="1" fill={c2} />
          <path d="M3 10.5 12 4l9 6.5" stroke="#fff" strokeWidth="1.3" fill="none" opacity="0.5" />
        </>
      )
    case 'purchases':
      return (
        <>
          <rect x="3" y="8" width="13.5" height="9.5" rx="2.2" fill={c1} />
          <path d="M16.5 11H19l1.5 3v4h-4" fill={c2} />
          <circle cx="8" cy="19.3" r="1.9" fill="#fbbf24" />
          <circle cx="16.5" cy="19.3" r="1.9" fill="#fbbf24" />
        </>
      )
    case 'expenses':
      return (
        <>
          <rect x="5" y="4" width="14" height="16.5" rx="2.8" fill={c1} />
          <rect x="7.5" y="7" width="9" height="2.8" rx="1" fill={c2} />
          <path d="M8.5 13h7M8.5 16.2h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )
    case 'projects':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="3" fill={c1} />
          <path d="M7 12.5 10.3 15.6 17 8.6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy="7.2" r="3.2" fill={c2} />
        </>
      )
    case 'reports':
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="3" fill={c1} />
          <path d="M7 15V11M11 15V8.2M15 15v-3.5M18.5 15V7.5" stroke={c2} strokeWidth="2.1" strokeLinecap="round" />
        </>
      )
    case 'pos':
      return (
        <>
          <rect x="5" y="3.5" width="14" height="17" rx="2.4" fill={c1} />
          <rect x="7" y="6" width="10" height="6" rx="1.2" fill={c2} />
          <circle cx="9" cy="15.2" r="1.05" fill="#fff" />
          <circle cx="12" cy="15.2" r="1.05" fill="#fff" />
          <circle cx="15" cy="15.2" r="1.05" fill="#fff" />
        </>
      )
    case 'ecommerce':
      return (
        <>
          <path d="M7 7h12l-1.1 6.6a2.1 2.1 0 0 1-2.1 1.7H10a2.1 2.1 0 0 1-2.1-1.8L6.6 5H4" fill={c1} />
          <circle cx="10.5" cy="19" r="1.55" fill={c2} />
          <circle cx="16" cy="19" r="1.55" fill={c2} />
        </>
      )
    case 'crm':
      return (
        <>
          <circle cx="8.4" cy="9" r="3" fill={c1} />
          <circle cx="15.6" cy="9" r="3" fill={c2} />
          <path d="M4.4 18.5c.7-2.7 2.3-4.1 4-4.1s3.3 1.4 4 4.1" fill={c1} />
          <path d="M11.6 18.5c.7-2.7 2.3-4.1 4-4.1s3.3 1.4 4 4.1" fill={c2} />
        </>
      )
    case 'whatsapp':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={c1} />
          <path d="M8.1 16.9 8.7 14.5A5.2 5.2 0 1 1 15.4 16.3l-2.2.5-1 .9z" fill="#fff" />
          <path d="M10.1 10.7c.2-.35.35-.35.55-.35h.35c.2 0 .3.1.35.35l.35.95c.05.2 0 .35-.1.45l-.25.25c-.1.1-.1.25 0 .4.25.45.85 1 1.4 1.3.15.1.3.05.4-.05l.35-.35c.1-.1.3-.1.45 0l.95.45c.25.1.35.25.3.45v.35c0 .2-.1.4-.4.5-.35.15-.95.25-1.5.05-1.3-.4-2.75-1.55-3.4-2.9-.3-.55-.4-1.1-.25-1.55.05-.25.25-.4.4-.5z" fill={c2} />
        </>
      )
    case 'payments':
      return (
        <>
          <rect x="3" y="7" width="18" height="11" rx="2.4" fill={c1} />
          <rect x="3" y="10" width="18" height="2.4" fill="#0f172a" opacity="0.22" />
          <rect x="6" y="14.4" width="5" height="1.7" rx="0.5" fill="#fff" opacity="0.9" />
          <circle cx="16.8" cy="15.1" r="1.5" fill={c2} />
          <circle cx="15" cy="15.1" r="1.5" fill="#fff" opacity="0.55" />
        </>
      )
    case 'analytics':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={c1} opacity="0.9" />
          <path d="M12 12V5a7 7 0 0 1 6.2 9.8Z" fill={c2} />
          <path d="M12 12 18.2 14.8A7 7 0 0 1 8.2 18Z" fill="#fff" opacity="0.35" />
          <circle cx="12" cy="12" r="2" fill="#fff" />
        </>
      )
    case 'compliance':
      return (
        <>
          <path d="M12 3.2 19 6.4v5c0 4.3-2.9 7.6-7 9.1-4.1-1.5-7-4.8-7-9.1v-5L12 3.2Z" fill={c1} />
          <path d="M9 12.1 11.2 14.3 15.4 9.7" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.4" cy="7.4" r="2.8" fill={c2} />
        </>
      )
    case 'ai':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={c1} />
          <path d="M8.2 14.6c1.1-3.3 2.6-5.2 3.8-5.2s2.7 1.9 3.8 5.2" fill={c2} opacity="0.95" />
          <circle cx="10" cy="10" r="1.25" fill="#fff" />
          <circle cx="14" cy="10" r="1.25" fill="#fff" />
          <path d="M9.6 7.1 12 4.9 14.4 7.1" stroke="#fbbf24" strokeWidth="1.45" strokeLinecap="round" fill="none" />
        </>
      )
    case 'support':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" fill={c1} />
          <rect x="6.4" y="10.8" width="2.7" height="4.4" rx="1.2" fill={c2} />
          <rect x="14.9" y="10.8" width="2.7" height="4.4" rx="1.2" fill={c2} />
          <path d="M9.1 11a2.9 2.9 0 0 1 5.8 0v1.6a1.5 1.5 0 0 1-1.5 1.5h-.8" fill="#fff" opacity="0.35" />
        </>
      )
    case 'integrations':
      return (
        <>
          <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.8" fill={c1} />
          <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.8" fill={c2} />
          <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.8" fill={c2} opacity="0.85" />
          <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.8" fill={c1} opacity="0.85" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3.1" fill={c2} />
          <path d="M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" stroke={c1} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="8" fill="none" stroke={c1} strokeWidth="2" opacity="0.35" />
        </>
      )
    default:
      return <circle cx="12" cy="12" r="8" fill={c1} />
  }
}

export default function PremiumAppIcon({ name = 'invoicing', size = 56, className = '', showLabel = false, label, labelClassName = '' }) {
  const meta = PREMIUM_APP_CATALOG.find((a) => a.id === name) || PREMIUM_APP_CATALOG[0]
  const c1 = meta.c1
  const c2 = meta.c2

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-white to-slate-50 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35),0_2px_8px_-2px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05]"
        style={{ width: size, height: size }}
      >
        <div className="pointer-events-none absolute inset-[1px] rounded-[1.05rem] bg-gradient-to-br from-white/90 via-transparent to-slate-100/40" />
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} className="relative drop-shadow-sm" aria-hidden>
          <Glyph id={meta.id} c1={c1} c2={c2} />
        </svg>
      </div>
      {showLabel && (
        <span className={`text-center text-[11px] font-semibold leading-tight text-slate-600 ${labelClassName}`}>
          {label || meta.labelEn}
        </span>
      )}
    </div>
  )
}
