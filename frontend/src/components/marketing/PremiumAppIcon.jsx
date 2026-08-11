/** Soft overlapping shapes — Odoo-like, but cleaner and more premium. */

export const PREMIUM_APP_CATALOG = [
  { id: 'invoicing', labelEn: 'Invoicing', labelAr: 'الفوترة' },
  { id: 'accounting', labelEn: 'Accounting', labelAr: 'المحاسبة' },
  { id: 'hr', labelEn: 'HR', labelAr: 'الموارد البشرية' },
  { id: 'payroll', labelEn: 'Payroll', labelAr: 'الرواتب' },
  { id: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون' },
  { id: 'warehouses', labelEn: 'Warehouses', labelAr: 'المستودعات' },
  { id: 'purchases', labelEn: 'Purchases', labelAr: 'المشتريات' },
  { id: 'expenses', labelEn: 'Expenses', labelAr: 'المصروفات' },
  { id: 'projects', labelEn: 'Projects', labelAr: 'المشاريع' },
  { id: 'reports', labelEn: 'Reports', labelAr: 'التقارير' },
  { id: 'pos', labelEn: 'Point of Sale', labelAr: 'نقاط البيع' },
  { id: 'ecommerce', labelEn: 'eCommerce', labelAr: 'التجارة الإلكترونية' },
  { id: 'crm', labelEn: 'CRM', labelAr: 'CRM' },
  { id: 'whatsapp', labelEn: 'WhatsApp', labelAr: 'واتساب' },
  { id: 'payments', labelEn: 'Payments', labelAr: 'المدفوعات' },
  { id: 'analytics', labelEn: 'Analytics', labelAr: 'التحليلات' },
  { id: 'compliance', labelEn: 'Compliance', labelAr: 'الامتثال' },
  { id: 'ai', labelEn: 'AI', labelAr: 'الذكاء الاصطناعي' },
  { id: 'support', labelEn: 'Support', labelAr: 'الدعم' },
  { id: 'integrations', labelEn: 'Integrations', labelAr: 'التكاملات' },
  { id: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات' },
]

function Glyph({ id }) {
  switch (id) {
    case 'accounting':
      return (
        <g>
          <circle cx="9.5" cy="14" r="6.5" fill="#875A7B" />
          <circle cx="15" cy="10" r="6.2" fill="#00A09D" opacity="0.92" />
          <path d="M12.2 8.2v7.2M10 10.1c.45-.85 1.15-1.25 2-1.25 1.25 0 2.05.75 2.05 1.75 0 1.95-4.2 1-4.2 2.95 0 .9.8 1.65 2.1 1.65.9 0 1.65-.4 2.1-1.1" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'invoicing':
      return (
        <g>
          <rect x="5" y="4.5" width="11.5" height="15" rx="2.2" fill="#714B67" />
          <rect x="8" y="6.5" width="11.5" height="15" rx="2.2" fill="#00A09D" opacity="0.9" />
          <path d="M11 11.5h5.5M11 14.5h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="16.8" cy="9.2" r="2.6" fill="#F06E26" />
          <path d="M15.7 9.2h2.2M16.8 8.1v2.2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      )
    case 'hr':
      return (
        <g>
          <circle cx="8.2" cy="9" r="3.3" fill="#F06E26" />
          <circle cx="14.8" cy="8.5" r="3.6" fill="#5B899E" />
          <circle cx="11.5" cy="11.2" r="3.2" fill="#00A09D" opacity="0.95" />
          <path d="M5.2 19.2c.6-2.8 2.2-4.2 3.9-4.2 1.2 0 2.2.7 2.9 1.8" fill="#F06E26" opacity="0.85" />
          <path d="M10.2 19.5c.55-2.6 2-4 3.6-4 1.7 0 3.2 1.5 3.9 4" fill="#5B899E" />
        </g>
      )
    case 'payroll':
      return (
        <g>
          <circle cx="12" cy="12" r="8.8" fill="#00A09D" />
          <circle cx="12" cy="12" r="5.8" fill="#714B67" opacity="0.92" />
          <path d="M12 8.6v6.8M10 10.2c.4-.75 1.05-1.15 1.9-1.15 1.15 0 1.9.7 1.9 1.6 0 1.8-3.85.95-3.85 2.7 0 .85.75 1.5 1.95 1.5.85 0 1.55-.35 2-1" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'inventory':
      return (
        <g>
          <path d="M12 3.5 19.8 8v8L12 20.5 4.2 16V8L12 3.5Z" fill="#F06E26" />
          <path d="M12 3.5 19.8 8 12 12.5 4.2 8 12 3.5Z" fill="#714B67" opacity="0.75" />
          <path d="M12 12.5 19.8 8M12 12.5 4.2 8M12 12.5V20.5" stroke="#fff" strokeWidth="1.25" strokeLinecap="round" opacity="0.9" />
        </g>
      )
    case 'warehouses':
      return (
        <g>
          <path d="M3.5 11 12 4.2 20.5 11V19.5a1.2 1.2 0 0 1-1.2 1.2H4.7A1.2 1.2 0 0 1 3.5 19.5V11Z" fill="#00A09D" />
          <path d="M3.5 11 12 4.2 20.5 11Z" fill="#5B899E" opacity="0.9" />
          <rect x="9.2" y="13.2" width="5.6" height="7.5" rx="0.8" fill="#F6F7F8" />
          <path d="M9.2 16.5h5.6" stroke="#00A09D" strokeWidth="1.1" />
        </g>
      )
    case 'purchases':
      return (
        <g>
          <rect x="3.2" y="8.2" width="12.8" height="8.6" rx="2" fill="#5B899E" />
          <path d="M16 10.8h2.6l1.6 3.1v4.2H16" fill="#714B67" />
          <circle cx="7.8" cy="19" r="1.85" fill="#F06E26" />
          <circle cx="16.2" cy="19" r="1.85" fill="#F06E26" />
          <rect x="5.5" y="10.8" width="6.5" height="1.4" rx="0.6" fill="#fff" opacity="0.75" />
        </g>
      )
    case 'expenses':
      return (
        <g>
          <rect x="5.2" y="3.8" width="13.6" height="16.4" rx="2.6" fill="#714B67" />
          <rect x="7.4" y="6.4" width="9.2" height="3" rx="1.1" fill="#00A09D" />
          <path d="M8.4 12.4h7.2M8.4 15.6h5.2" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" />
          <circle cx="16.8" cy="6.2" r="3" fill="#F06E26" />
          <path d="M15.7 6.2h2.2" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" />
        </g>
      )
    case 'projects':
      return (
        <g>
          <rect x="3.5" y="5" width="17" height="14" rx="3" fill="#00A09D" />
          <path d="M7.2 12.4 10.4 15.4 17 8.6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.6" cy="7.4" r="3.3" fill="#714B67" />
          <path d="M16.3 7.4h2.6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )
    case 'reports':
      return (
        <g>
          <rect x="3.2" y="4" width="17.6" height="16" rx="3" fill="#5B899E" />
          <path d="M7.2 15.2V10.8M10.8 15.2V8.2M14.4 15.2v-4M18 15.2V7.4" stroke="#F06E26" strokeWidth="2.05" strokeLinecap="round" />
          <path d="M6.8 9.2c2.4-2 4.8-1 7.2.8s4.2 1.4 5.2.4" stroke="#fff" strokeWidth="1.35" fill="none" strokeLinecap="round" opacity="0.85" />
        </g>
      )
    case 'pos':
      return (
        <g>
          <path d="M4.5 9.2h15.2l-.8 2.2H5.3z" fill="#F06E26" />
          <path d="M5.5 7.2 7 9.2h10l1.5-2" fill="#714B67" />
          <rect x="6.2" y="11.4" width="11.6" height="8.2" rx="1.4" fill="#00A09D" />
          <rect x="8" y="13.2" width="8" height="3.2" rx="0.7" fill="#fff" opacity="0.85" />
          <circle cx="9.2" cy="18.2" r="0.85" fill="#fff" />
          <circle cx="12" cy="18.2" r="0.85" fill="#fff" />
          <circle cx="14.8" cy="18.2" r="0.85" fill="#fff" />
        </g>
      )
    case 'ecommerce':
      return (
        <g>
          <path d="M8.2 5.2h7.6c.9 0 1.5.8 1.3 1.6l-1.4 8.2a2 2 0 0 1-2 1.6H10.3a2 2 0 0 1-2-1.7L6.8 6.8c-.15-.85.5-1.6 1.4-1.6Z" fill="#714B67" />
          <path d="M9.2 5.2V4.4a2.8 2.8 0 0 1 5.6 0v.8" stroke="#00A09D" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="10.4" cy="19.4" r="1.5" fill="#F06E26" />
          <circle cx="15.2" cy="19.4" r="1.5" fill="#F06E26" />
        </g>
      )
    case 'crm':
      return (
        <g>
          <path d="M7.2 14.8c1.8-1.5 3.6-1.5 5.4 0 1.5 1.2 3.4 1.4 5.1.4" stroke="#00A09D" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="8.2" cy="9.2" r="3.1" fill="#5B899E" />
          <circle cx="15.8" cy="9.2" r="3.1" fill="#714B67" />
          <path d="M10.6 10.6c.9.75 2.1.75 3 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'whatsapp':
      return (
        <g>
          <circle cx="12" cy="12" r="9" fill="#25D366" />
          <path d="M8 17.1 8.6 14.6A5.3 5.3 0 1 1 15.5 16.4l-2.3.55-1.1 1.05z" fill="#fff" />
          <path d="M10 10.6c.2-.4.4-.4.6-.4h.35c.2 0 .32.12.38.4l.4 1.05c.06.2 0 .38-.12.5l-.28.28c-.1.1-.1.28 0 .42.3.5.95 1.15 1.55 1.45.18.1.35.06.45-.08l.38-.4c.12-.12.32-.12.48 0l1 .5c.28.12.38.3.32.52v.38c0 .22-.12.42-.42.52-.4.18-1.05.28-1.65.08-1.4-.42-2.95-1.7-3.65-3.15-.32-.6-.42-1.2-.28-1.7.06-.28.25-.45.42-.55z" fill="#128C7E" />
        </g>
      )
    case 'payments':
      return (
        <g>
          <rect x="3" y="6.8" width="18" height="11.2" rx="2.4" fill="#714B67" />
          <rect x="3" y="9.6" width="18" height="2.5" fill="#1f2937" opacity="0.28" />
          <rect x="5.8" y="14.2" width="5.2" height="1.7" rx="0.55" fill="#fff" opacity="0.9" />
          <circle cx="16.8" cy="14.9" r="1.55" fill="#F06E26" />
          <circle cx="15" cy="14.9" r="1.55" fill="#00A09D" opacity="0.85" />
        </g>
      )
    case 'analytics':
      return (
        <g>
          <circle cx="12" cy="12" r="9" fill="#5B899E" />
          <path d="M12 12V4.8A7.2 7.2 0 0 1 18.6 15Z" fill="#714B67" />
          <path d="M12 12 18.6 15A7.2 7.2 0 0 1 7.8 17.8Z" fill="#F06E26" opacity="0.95" />
          <circle cx="12" cy="12" r="2.1" fill="#fff" />
        </g>
      )
    case 'compliance':
      return (
        <g>
          <path d="M12 2.8 19.2 6v5.2c0 4.5-3 7.9-7.2 9.5C7.8 19.1 4.8 15.7 4.8 11.2V6L12 2.8Z" fill="#00A09D" />
          <path d="M9 12 11.2 14.2 15.5 9.6" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.2" cy="7" r="2.9" fill="#714B67" />
          <path d="M16.1 7h2.2" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" />
        </g>
      )
    case 'ai':
      return (
        <g>
          <circle cx="12" cy="12" r="9" fill="#714B67" />
          <path d="M8 14.8c1.15-3.5 2.7-5.5 4-5.5s2.85 2 4 5.5" fill="#F06E26" />
          <circle cx="9.9" cy="10" r="1.3" fill="#fff" />
          <circle cx="14.1" cy="10" r="1.3" fill="#fff" />
          <path d="M9.4 6.9 12 4.5 14.6 6.9" stroke="#00A09D" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="4.2" r="1.1" fill="#00A09D" />
        </g>
      )
    case 'support':
      return (
        <g>
          <circle cx="12" cy="12" r="8.6" fill="#5B899E" />
          <rect x="6.2" y="10.6" width="2.8" height="4.6" rx="1.3" fill="#714B67" />
          <rect x="15" y="10.6" width="2.8" height="4.6" rx="1.3" fill="#714B67" />
          <path d="M9 11.2a3 3 0 0 1 6 0v1.8a1.6 1.6 0 0 1-1.6 1.6h-.9" fill="#fff" opacity="0.35" />
          <path d="M12 17.4v1.3" stroke="#F06E26" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )
    case 'integrations':
      return (
        <g>
          <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2" fill="#714B67" />
          <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2" fill="#00A09D" />
          <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2" fill="#F06E26" />
          <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2" fill="#5B899E" />
        </g>
      )
    case 'settings':
      return (
        <g>
          <circle cx="12" cy="12" r="3.2" fill="#F06E26" />
          <path d="M12 3.5v2.1M12 18.4v2.1M3.5 12h2.1M18.4 12h2.1M6.2 6.2l1.5 1.5M16.3 16.3l1.5 1.5M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5" stroke="#714B67" strokeWidth="2.05" strokeLinecap="round" />
          <circle cx="12" cy="12" r="8.2" fill="none" stroke="#00A09D" strokeWidth="2.1" opacity="0.55" />
        </g>
      )
    default:
      return <circle cx="12" cy="12" r="8" fill="#714B67" />
  }
}

export default function PremiumAppIcon({ name = 'invoicing', size = 56, className = '', showLabel = false, label, labelClassName = '' }) {
  const meta = PREMIUM_APP_CATALOG.find((a) => a.id === name) || PREMIUM_APP_CATALOG[0]

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-[22%] bg-[#f8f9fb] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-12px_rgba(15,23,42,0.22)] ring-1 ring-black/[0.04]"
        style={{ width: size, height: size }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[22%] bg-gradient-to-b from-white/90 to-transparent" />
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          className="relative"
          aria-hidden
        >
          <Glyph id={meta.id} />
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
