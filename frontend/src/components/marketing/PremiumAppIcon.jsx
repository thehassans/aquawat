/** Ultra-premium app glyphs — layered soft shapes, sharper than Odoo, green-forward. */

const C = {
  green: '#059669',
  greenDeep: '#047857',
  teal: '#0D9488',
  tealSoft: '#14B8A6',
  mint: '#34D399',
  orange: '#F97316',
  orangeDeep: '#EA580C',
  slate: '#0F766E',
  sky: '#0891B2',
  ink: '#134E4A',
  white: '#FFFFFF',
  wa: '#25D366',
  waDark: '#128C7E',
}

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
          <circle cx="9.2" cy="14.2" r="6.8" fill={C.greenDeep} />
          <circle cx="15.4" cy="9.6" r="6.4" fill={C.teal} opacity="0.94" />
          <path d="M12.4 7.6v8.2M10 9.8c.5-.95 1.25-1.4 2.15-1.4 1.35 0 2.2.8 2.2 1.85 0 2.1-4.5 1.05-4.5 3.15 0 .95.85 1.75 2.25 1.75.95 0 1.75-.4 2.25-1.15" stroke={C.white} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <circle cx="17.8" cy="6.2" r="2.4" fill={C.orange} opacity="0.95" />
        </g>
      )
    case 'invoicing':
      return (
        <g>
          <rect x="4.2" y="4" width="12.2" height="16" rx="2.4" fill={C.greenDeep} />
          <rect x="7.6" y="6" width="12.2" height="16" rx="2.4" fill={C.teal} opacity="0.92" />
          <path d="M10.6 11.2h5.8M10.6 14.4h4.2" stroke={C.white} strokeWidth="1.45" strokeLinecap="round" />
          <circle cx="17.2" cy="8.6" r="2.85" fill={C.orange} />
          <path d="M16 8.6h2.4M17.2 7.4v2.4" stroke={C.white} strokeWidth="1.15" strokeLinecap="round" />
        </g>
      )
    case 'hr':
      return (
        <g>
          <circle cx="7.8" cy="8.8" r="3.45" fill={C.orange} />
          <circle cx="15.4" cy="8.2" r="3.7" fill={C.sky} />
          <circle cx="11.6" cy="11" r="3.35" fill={C.teal} opacity="0.96" />
          <path d="M4.6 19.4c.65-3 2.35-4.45 4.15-4.45 1.3 0 2.35.75 3.05 1.9" fill={C.orange} opacity="0.88" />
          <path d="M9.8 19.6c.6-2.75 2.15-4.25 3.85-4.25 1.8 0 3.4 1.55 4.15 4.25" fill={C.sky} />
          <path d="M8.4 19.6c.7-2.4 2.1-3.6 3.5-3.6 1.45 0 2.85 1.2 3.55 3.6" fill={C.teal} opacity="0.85" />
        </g>
      )
    case 'payroll':
      return (
        <g>
          <circle cx="12" cy="12" r="9" fill={C.teal} />
          <circle cx="12" cy="12" r="6" fill={C.greenDeep} opacity="0.94" />
          <path d="M12 8.2v7.6M9.9 10c.45-.85 1.15-1.25 2.05-1.25 1.25 0 2.05.75 2.05 1.7 0 1.95-4.15 1-4.15 2.9 0 .9.8 1.6 2.1 1.6.9 0 1.65-.35 2.1-1" stroke={C.white} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <circle cx="17.6" cy="6.4" r="2.5" fill={C.orange} />
        </g>
      )
    case 'inventory':
      return (
        <g>
          <path d="M12 3.2 20.2 7.8v8.4L12 20.8 3.8 16.2V7.8L12 3.2Z" fill={C.orange} />
          <path d="M12 3.2 20.2 7.8 12 12.4 3.8 7.8 12 3.2Z" fill={C.greenDeep} opacity="0.82" />
          <path d="M12 12.4 20.2 7.8M12 12.4 3.8 7.8M12 12.4V20.8" stroke={C.white} strokeWidth="1.3" strokeLinecap="round" opacity="0.92" />
          <circle cx="12" cy="12.4" r="1.35" fill={C.white} />
        </g>
      )
    case 'warehouses':
      return (
        <g>
          <path d="M3.2 11.2 12 3.8 20.8 11.2V19.6a1.3 1.3 0 0 1-1.3 1.3H4.5A1.3 1.3 0 0 1 3.2 19.6V11.2Z" fill={C.teal} />
          <path d="M3.2 11.2 12 3.8 20.8 11.2Z" fill={C.sky} opacity="0.92" />
          <rect x="9" y="13" width="6" height="7.9" rx="0.9" fill={C.white} />
          <path d="M9 16.4h6" stroke={C.teal} strokeWidth="1.15" />
          <rect x="10.35" y="17.2" width="1.4" height="2.4" rx="0.35" fill={C.greenDeep} opacity="0.55" />
        </g>
      )
    case 'purchases':
      return (
        <g>
          <rect x="2.8" y="7.8" width="13.4" height="9" rx="2.2" fill={C.sky} />
          <path d="M16.2 10.4h2.8l1.7 3.3v4.4h-4.5" fill={C.greenDeep} />
          <circle cx="7.6" cy="19.2" r="1.95" fill={C.orange} />
          <circle cx="16.4" cy="19.2" r="1.95" fill={C.orange} />
          <rect x="5.2" y="10.4" width="7" height="1.5" rx="0.7" fill={C.white} opacity="0.8" />
          <rect x="5.2" y="13" width="4.8" height="1.3" rx="0.6" fill={C.white} opacity="0.45" />
        </g>
      )
    case 'expenses':
      return (
        <g>
          <rect x="4.8" y="3.4" width="14.4" height="17.2" rx="2.8" fill={C.greenDeep} />
          <rect x="7" y="6" width="10" height="3.2" rx="1.2" fill={C.teal} />
          <path d="M8.2 12.2h7.6M8.2 15.6h5.4" stroke={C.white} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="17" cy="5.8" r="3.15" fill={C.orange} />
          <path d="M15.8 5.8h2.4" stroke={C.white} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )
    case 'projects':
      return (
        <g>
          <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3.2" fill={C.teal} />
          <path d="M7 12.2 10.4 15.4 17.2 8.2" stroke={C.white} strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.8" cy="7" r="3.4" fill={C.greenDeep} />
          <path d="M16.4 7h2.8M17.8 5.6v2.8" stroke={C.white} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )
    case 'reports':
      return (
        <g>
          <rect x="2.8" y="3.6" width="18.4" height="16.8" rx="3.2" fill={C.sky} />
          <path d="M7 15.6V10.8M10.8 15.6V7.8M14.6 15.6v-4.2M18.4 15.6V7" stroke={C.orange} strokeWidth="2.1" strokeLinecap="round" />
          <path d="M6.6 9c2.6-2.2 5.2-1.1 7.8.9s4.5 1.5 5.6.4" stroke={C.white} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.88" />
        </g>
      )
    case 'pos':
      return (
        <g>
          <path d="M4.2 9h15.6l-.85 2.3H5.05z" fill={C.orange} />
          <path d="M5.3 6.8 7 9h10l1.7-2.2" fill={C.greenDeep} />
          <rect x="5.8" y="11.3" width="12.4" height="8.6" rx="1.6" fill={C.teal} />
          <rect x="7.6" y="13.2" width="8.8" height="3.4" rx="0.8" fill={C.white} opacity="0.88" />
          <circle cx="9" cy="18.4" r="0.9" fill={C.white} />
          <circle cx="12" cy="18.4" r="0.9" fill={C.white} />
          <circle cx="15" cy="18.4" r="0.9" fill={C.white} />
        </g>
      )
    case 'ecommerce':
      return (
        <g>
          <path d="M7.8 5h8.4c1 0 1.65.85 1.45 1.7l-1.5 8.6a2.15 2.15 0 0 1-2.15 1.7H9.95a2.15 2.15 0 0 1-2.15-1.8L6.4 6.7C6.25 5.8 6.95 5 7.8 5Z" fill={C.greenDeep} />
          <path d="M9 5V4.1a3 3 0 0 1 6 0V5" stroke={C.teal} strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <circle cx="10.2" cy="19.6" r="1.6" fill={C.orange} />
          <circle cx="15.4" cy="19.6" r="1.6" fill={C.orange} />
          <path d="M9.6 10.2h5.6M9.6 13h4" stroke={C.white} strokeWidth="1.25" strokeLinecap="round" opacity="0.75" />
        </g>
      )
    case 'crm':
      return (
        <g>
          <path d="M6.8 15.2c2-1.65 4-1.65 6 0 1.65 1.3 3.7 1.5 5.5.45" stroke={C.teal} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="8" cy="8.8" r="3.25" fill={C.sky} />
          <circle cx="16" cy="8.8" r="3.25" fill={C.greenDeep} />
          <circle cx="12" cy="10.4" r="2.6" fill={C.orange} opacity="0.92" />
          <path d="M10.4 10.2c.95.8 2.25.8 3.2 0" stroke={C.white} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'whatsapp':
      return (
        <g>
          <circle cx="11.2" cy="12.4" r="8.4" fill={C.wa} />
          <circle cx="14.6" cy="9.2" r="6.2" fill={C.waDark} opacity="0.88" />
          <path d="M7.2 16.8 7.7 14.6A4.6 4.6 0 1 1 13.8 16.2l-2.1.5z" fill={C.white} />
          <path d="M9.4 11.8h3.6M9.4 13.6h2.4" stroke={C.waDark} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="17.4" cy="6.4" r="2.6" fill={C.orange} />
          <path d="M16.4 6.4h2M17.4 5.4v2" stroke={C.white} strokeWidth="1.1" strokeLinecap="round" />
        </g>
      )
    case 'payments':
      return (
        <g>
          <rect x="2.6" y="6.4" width="18.8" height="11.8" rx="2.6" fill={C.greenDeep} />
          <rect x="2.6" y="9.2" width="18.8" height="2.7" fill={C.ink} opacity="0.28" />
          <rect x="5.4" y="14" width="5.6" height="1.8" rx="0.6" fill={C.white} opacity="0.92" />
          <circle cx="17.2" cy="14.8" r="1.7" fill={C.orange} />
          <circle cx="15.2" cy="14.8" r="1.7" fill={C.teal} opacity="0.88" />
        </g>
      )
    case 'analytics':
      return (
        <g>
          <circle cx="12" cy="12" r="9.2" fill={C.sky} />
          <path d="M12 12V4.5A7.5 7.5 0 0 1 19 15.2Z" fill={C.greenDeep} />
          <path d="M12 12 19 15.2A7.5 7.5 0 0 1 7.4 18.2Z" fill={C.orange} opacity="0.95" />
          <circle cx="12" cy="12" r="2.25" fill={C.white} />
          <circle cx="12" cy="12" r="1" fill={C.teal} />
        </g>
      )
    case 'compliance':
      return (
        <g>
          <path d="M12 2.5 19.6 5.8v5.4c0 4.7-3.15 8.25-7.6 9.9C7.55 19.45 4.4 15.9 4.4 11.2V5.8L12 2.5Z" fill={C.teal} />
          <path d="M8.6 12 11 14.4 15.8 9.4" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.4" cy="6.6" r="3" fill={C.greenDeep} />
          <path d="M16.2 6.6h2.4" stroke={C.white} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )
    case 'ai':
      return (
        <g>
          <circle cx="12" cy="12" r="9.2" fill={C.greenDeep} />
          <path d="M7.6 15.2c1.25-3.7 2.9-5.8 4.4-5.8s3.15 2.1 4.4 5.8" fill={C.orange} />
          <circle cx="9.7" cy="9.8" r="1.4" fill={C.white} />
          <circle cx="14.3" cy="9.8" r="1.4" fill={C.white} />
          <path d="M9.2 6.6 12 4 14.8 6.6" stroke={C.mint} strokeWidth="1.55" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="3.8" r="1.2" fill={C.mint} />
          <circle cx="12" cy="17.6" r="1" fill={C.tealSoft} opacity="0.9" />
        </g>
      )
    case 'support':
      return (
        <g>
          <circle cx="12" cy="12" r="8.9" fill={C.sky} />
          <rect x="5.8" y="10.2" width="3" height="5" rx="1.4" fill={C.greenDeep} />
          <rect x="15.2" y="10.2" width="3" height="5" rx="1.4" fill={C.greenDeep} />
          <path d="M8.8 10.6a3.2 3.2 0 0 1 6.4 0v2a1.7 1.7 0 0 1-1.7 1.7h-1" fill={C.white} opacity="0.4" />
          <path d="M12 17.2v1.5" stroke={C.orange} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="8.4" r="1.1" fill={C.white} opacity="0.7" />
        </g>
      )
    case 'integrations':
      return (
        <g>
          <rect x="2.8" y="2.8" width="7.8" height="7.8" rx="2.2" fill={C.greenDeep} />
          <rect x="13.4" y="2.8" width="7.8" height="7.8" rx="2.2" fill={C.teal} />
          <rect x="2.8" y="13.4" width="7.8" height="7.8" rx="2.2" fill={C.orange} />
          <rect x="13.4" y="13.4" width="7.8" height="7.8" rx="2.2" fill={C.sky} />
          <circle cx="12" cy="12" r="1.6" fill={C.white} opacity="0.9" />
        </g>
      )
    case 'settings':
      return (
        <g>
          <circle cx="12" cy="12" r="8.6" fill="none" stroke={C.teal} strokeWidth="2.2" opacity="0.55" />
          <path d="M12 3.2v2.3M12 18.5v2.3M3.2 12h2.3M18.5 12h2.3M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" stroke={C.greenDeep} strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3.4" fill={C.orange} />
          <circle cx="12" cy="12" r="1.35" fill={C.white} opacity="0.9" />
        </g>
      )
    default:
      return <circle cx="12" cy="12" r="8.2" fill={C.greenDeep} />
  }
}

export default function PremiumAppIcon({ name = 'invoicing', size = 56, className = '', showLabel = false, label, labelClassName = '' }) {
  const meta = PREMIUM_APP_CATALOG.find((a) => a.id === name) || PREMIUM_APP_CATALOG[0]

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-[22%] bg-gradient-to-b from-[#fbfcfd] to-[#f3f5f8] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-14px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.045]"
        style={{ width: size, height: size }}
      >
        <div className="pointer-events-none absolute inset-[1px] rounded-[21%] bg-gradient-to-b from-white/95 via-white/20 to-transparent" />
        <svg
          viewBox="0 0 24 24"
          width={size * 0.64}
          height={size * 0.64}
          className="relative drop-shadow-[0_1px_1px_rgba(15,23,42,0.08)]"
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
