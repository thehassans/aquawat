import React from 'react'

function Tile({ uid, className, from, to, glow, stroke, children }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`sheen_${uid}`} x1="12" y1="6" x2="48" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={`flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor={glow} floodOpacity="0.48" />
        </filter>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="16" fill={`url(#bg_${uid})`} filter={`url(#flt_${uid})`} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.55" />
      <path d="M16 12C22 10 30 11 40 16C28 18 18 26 14 38C12 28 12 18 16 12Z" fill={`url(#sheen_${uid})`} />
      {children}
    </svg>
  )
}

const ICONS = {
  zatca: (uid, className) => (
    <Tile uid={uid} className={className} from="#065F46" to="#10B981" glow="#047857" stroke="#A7F3D0">
      <rect x="19" y="16" width="26" height="32" rx="4" fill="#FFFFFF" />
      <rect x="23" y="20" width="7" height="7" fill="#047857" />
      <rect x="33" y="20" width="7" height="7" fill="#059669" />
      <rect x="23" y="30" width="7" height="7" fill="#059669" />
      <rect x="33" y="30" width="7" height="7" fill="#10B981" />
      <circle cx="45" cy="44" r="7" fill="#065F46" />
      <path d="M42 44l2.2 2.2L49 41.4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </Tile>
  ),
  gosi: (uid, className) => (
    <Tile uid={uid} className={className} from="#C2410C" to="#F97316" glow="#EA580C" stroke="#FED7AA">
      <rect x="18" y="18" width="28" height="28" rx="6" fill="#FFFFFF" />
      <path d="M24 36V26h4.2l3.3 6.4L34.8 26H39v10h-3.1V31l-2.7 5h-2.4l-2.7-5v5H24z" fill="#EA580C" />
    </Tile>
  ),
  elm: (uid, className) => (
    <Tile uid={uid} className={className} from="#0F766E" to="#14B8A6" glow="#0D9488" stroke="#99F6E4">
      <circle cx="32" cy="32" r="14" fill="#FFFFFF" />
      <path d="M24 34c2.4-7 6-11 8-12 2 1 5.6 5 8 12-2.8 4-5.4 6-8 7-2.6-1-5.2-3-8-7z" fill="#0D9488" />
      <circle cx="32" cy="30" r="3.2" fill="#FFFFFF" />
    </Tile>
  ),
  qiwa: (uid, className) => (
    <Tile uid={uid} className={className} from="#1D4ED8" to="#38BDF8" glow="#1E40AF" stroke="#BFDBFE">
      <rect x="20" y="15" width="24" height="34" rx="4" fill="#FFFFFF" />
      <circle cx="32" cy="25" r="4.5" fill="#2563EB" />
      <path d="M24 38c0-4 3.2-6 8-6s8 2 8 6H24z" fill="#1D4ED8" />
      <path d="M24 44h16" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />
    </Tile>
  ),
  saber: (uid, className) => (
    <Tile uid={uid} className={className} from="#0369A1" to="#38BDF8" glow="#0284C7" stroke="#BAE6FD">
      <circle cx="32" cy="32" r="15" fill="#FFFFFF" />
      <path d="M22 33l6 6 14-16" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Tile>
  ),
  balady: (uid, className) => (
    <Tile uid={uid} className={className} from="#BE185D" to="#FB7185" glow="#DB2777" stroke="#FECDD3">
      <path d="M16 42V28l16-12 16 12v14H16z" fill="#FFFFFF" />
      <rect x="28" y="32" width="8" height="10" rx="1" fill="#DB2777" />
      <path d="M22 28h20" stroke="#F9A8D4" strokeWidth="2" />
    </Tile>
  ),
  etimad: (uid, className) => (
    <Tile uid={uid} className={className} from="#0E7490" to="#22D3EE" glow="#0891B2" stroke="#A5F3FC">
      <rect x="16" y="20" width="32" height="24" rx="5" fill="#FFFFFF" />
      <path d="M16 24h32" stroke="#22D3EE" strokeWidth="4" />
      <path d="M22 32h12M22 37h8" stroke="#0E7490" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42" cy="35" r="4" fill="#0891B2" />
    </Tile>
  ),
  smsa: (uid, className) => (
    <Tile uid={uid} className={className} from="#1E3A8A" to="#2563EB" glow="#1D4ED8" stroke="#BFDBFE">
      <path d="M14 36c8-2 14-10 18-18 3 6 8 12 18 16-8 2-14 4-18 10-3-6-8-8-18-8z" fill="#FFFFFF" />
      <circle cx="22" cy="42" r="3" fill="#93C5FD" />
      <circle cx="42" cy="42" r="3" fill="#93C5FD" />
    </Tile>
  ),
  aramex: (uid, className) => (
    <Tile uid={uid} className={className} from="#DC2626" to="#F97316" glow="#B91C1C" stroke="#FED7AA">
      <path d="M18 40L32 16l14 24H18z" fill="#FFFFFF" />
      <path d="M26 40l6-12 6 12" stroke="#DC2626" strokeWidth="2.4" />
    </Tile>
  ),
  jnt: (uid, className) => (
    <Tile uid={uid} className={className} from="#EA580C" to="#FBBF24" glow="#C2410C" stroke="#FDE68A">
      <rect x="16" y="22" width="32" height="20" rx="6" fill="#FFFFFF" />
      <path d="M22 32h8M34 28v8M40 28v8" stroke="#EA580C" strokeWidth="2.8" strokeLinecap="round" />
    </Tile>
  ),
  naqel: (uid, className) => (
    <Tile uid={uid} className={className} from="#0F766E" to="#34D399" glow="#047857" stroke="#A7F3D0">
      <path d="M14 38h24l10-10H24L14 38z" fill="#FFFFFF" />
      <circle cx="22" cy="42" r="3.5" fill="#ECFDF5" />
      <circle cx="40" cy="42" r="3.5" fill="#ECFDF5" />
    </Tile>
  ),
  imile: (uid, className) => (
    <Tile uid={uid} className={className} from="#4F46E5" to="#818CF8" glow="#4338CA" stroke="#C7D2FE">
      <path d="M20 40V24l12-8 12 8v16H20z" fill="#FFFFFF" />
      <path d="M32 18v22" stroke="#6366F1" strokeWidth="2" />
    </Tile>
  ),
  spl: (uid, className) => (
    <Tile uid={uid} className={className} from="#166534" to="#22C55E" glow="#15803D" stroke="#BBF7D0">
      <rect x="18" y="16" width="28" height="32" rx="4" fill="#FFFFFF" />
      <path d="M24 24h16M24 30h12M24 36h8" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="40" cy="40" r="4" fill="#16A34A" />
    </Tile>
  ),
  hungerstation: (uid, className) => (
    <Tile uid={uid} className={className} from="#DB2777" to="#F472B6" glow="#BE185D" stroke="#FBCFE8">
      <path d="M32 14c-7 0-12 5.4-12 12 0 8 12 22 12 22s12-14 12-22c0-6.6-5-12-12-12z" fill="#FFFFFF" />
      <circle cx="32" cy="25" r="4.5" fill="#DB2777" />
    </Tile>
  ),
  jahez: (uid, className) => (
    <Tile uid={uid} className={className} from="#EA580C" to="#FB923C" glow="#C2410C" stroke="#FED7AA">
      <path d="M18 18h26v5H33v23h-7V23H18V18z" fill="#FFFFFF" />
      <circle cx="44" cy="40" r="5" fill="#FFFFFF" />
    </Tile>
  ),
  keeta: (uid, className) => (
    <Tile uid={uid} className={className} from="#047857" to="#34D399" glow="#059669" stroke="#A7F3D0">
      <path d="M32 14c-2.5 5-8 8-13 8 0 10 5.5 18 13 22 7.5-4 13-12 13-22-5 0-10.5-3-13-8z" fill="#FFFFFF" />
    </Tile>
  ),
  mrsool: (uid, className) => (
    <Tile uid={uid} className={className} from="#1D4ED8" to="#60A5FA" glow="#1E40AF" stroke="#BFDBFE">
      <rect x="16" y="18" width="32" height="22" rx="5" fill="#FFFFFF" />
      <circle cx="22" cy="44" r="3.5" fill="#FFFFFF" />
      <circle cx="42" cy="44" r="3.5" fill="#FFFFFF" />
    </Tile>
  ),
  ninja: (uid, className) => (
    <Tile uid={uid} className={className} from="#6D28D9" to="#A78BFA" glow="#5B21B6" stroke="#DDD6FE">
      <path d="M32 14l14 8v16L32 50 18 38V22l14-8z" fill="#FFFFFF" />
      <path d="M24 28h16M24 34h10" stroke="#7C3AED" strokeWidth="2.4" strokeLinecap="round" />
    </Tile>
  ),
  toyou: (uid, className) => (
    <Tile uid={uid} className={className} from="#0284C7" to="#38BDF8" glow="#0369A1" stroke="#BAE6FD">
      <circle cx="32" cy="32" r="14" fill="#FFFFFF" />
      <path d="M24 33l5 5 11-12" stroke="#0284C7" strokeWidth="3.2" strokeLinecap="round" />
    </Tile>
  ),
  jumlaty: (uid, className) => (
    <Tile uid={uid} className={className} from="#B45309" to="#F59E0B" glow="#C2410C" stroke="#FDE68A">
      <path d="M32 14l14 8v12c0 8-6 13-14 16-8-3-14-8-14-16V22l14-8z" fill="#FFFFFF" />
      <path d="M24 31l4.5 4.5L40 24" stroke="#B45309" strokeWidth="2.6" strokeLinecap="round" />
    </Tile>
  ),
  fedex: (uid, className) => (
    <Tile uid={uid} className={className} from="#4D148C" to="#7C3AED" glow="#4D148C" stroke="#DDD6FE">
      <path d="M16 34h32" stroke="#FF6600" strokeWidth="5" strokeLinecap="round" />
      <path d="M36 24l12 10-12 10" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 24h14" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
    </Tile>
  ),
  dhl: (uid, className) => (
    <Tile uid={uid} className={className} from="#FFCC00" to="#F59E0B" glow="#D40511" stroke="#FEF08A">
      <path d="M14 28h36M14 36h36" stroke="#D40511" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 22l8 20M34 22l8 20" stroke="#4A1C14" strokeWidth="2.4" strokeLinecap="round" />
    </Tile>
  ),
  ups: (uid, className) => (
    <Tile uid={uid} className={className} from="#351C15" to="#8B5A2B" glow="#351C15" stroke="#FDE68A">
      <path d="M32 14l16 8v16c0 8-7 14-16 18-9-4-16-10-16-18V22l16-8z" fill="#FFB500" />
      <path d="M32 24v16M26 30h12" stroke="#351C15" strokeWidth="2.8" strokeLinecap="round" />
    </Tile>
  ),
  tnt: (uid, className) => (
    <Tile uid={uid} className={className} from="#FF6600" to="#F97316" glow="#C2410C" stroke="#FED7AA">
      <rect x="16" y="22" width="32" height="20" rx="4" fill="#FFFFFF" />
      <path d="M22 32h6M32 26v12M42 26v12" stroke="#FF6600" strokeWidth="2.8" strokeLinecap="round" />
    </Tile>
  ),
  fbr: (uid, className) => (
    <Tile uid={uid} className={className} from="#01411C" to="#0B8A3C" glow="#016630" stroke="#86EFAC">
      <rect x="18" y="16" width="28" height="32" rx="4" fill="#FFFFFF" />
      <path d="M24 24h16M24 30h12M24 36h8" stroke="#016630" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="40" cy="40" r="4" fill="#0B8A3C" />
    </Tile>
  ),
  email: (uid, className) => (
    <Tile uid={uid} className={className} from="#0F766E" to="#14B8A6" glow="#0D9488" stroke="#99F6E4">
      <rect x="18" y="22" width="28" height="20" rx="4" fill="#FFFFFF" />
      <path d="M18 24l14 10 14-10" stroke="#0D9488" strokeWidth="2.2" fill="none" />
    </Tile>
  ),
  sms: (uid, className) => (
    <Tile uid={uid} className={className} from="#6D28D9" to="#D946EF" glow="#7C3AED" stroke="#E9D5FF">
      <rect x="18" y="18" width="22" height="22" rx="6" fill="#FFFFFF" />
      <path d="M24 26h10M24 31h7" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M28 40l6 6v-10" fill="#FFFFFF" />
      <circle cx="44" cy="42" r="6" fill="#A855F7" />
    </Tile>
  ),
  whatsapp: (uid, className) => (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`wa_bg_${uid}`} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id={`wa_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#10B981" floodOpacity="0.35" />
        </filter>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#wa_bg_${uid})`} filter={`url(#wa_flt_${uid})`} />
      <circle cx="30" cy="33" r="18" fill="#25D366" />
      <circle cx="40" cy="24" r="13" fill="#128C7E" opacity="0.88" />
      <path d="M20 46.5 21.2 40.8A12.2 12.2 0 1 1 37.5 44.8l-5.6 1.35z" fill="#FFFFFF" />
      <path d="M26.2 33.5h8.2M26.2 37.6h5.6" stroke="#128C7E" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="46" cy="18" r="6.5" fill="#F97316" />
      <path d="M43.6 18h4.8M46 15.6v4.8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  tabby: (uid, className) => (
    <Tile uid={uid} className={className} from="#3EEDBF" to="#10B981" glow="#14B8A6" stroke="#A7F3D0">
      <rect x="16" y="22" width="32" height="20" rx="6" fill="#111827" />
      <path d="M22 32h8M34 28v8M42 32h-4" stroke="#3EEDBF" strokeWidth="2.6" strokeLinecap="round" />
    </Tile>
  ),
  tamara: (uid, className) => (
    <Tile uid={uid} className={className} from="#F0A985" to="#E11D48" glow="#F43F5E" stroke="#FECDD3">
      <circle cx="32" cy="32" r="14" fill="#FFFFFF" />
      <path d="M26 34c2 4 10 4 12 0M26 27h2M36 27h2" stroke="#E11D48" strokeWidth="2.4" strokeLinecap="round" />
    </Tile>
  ),
  dumbbell: (uid, className) => (
    <Tile uid={uid} className={className} from="#F97316" to="#EA580C" glow="#C2410C" stroke="#FED7AA">
      {/* 3D Dumbbell Bar */}
      <rect x="22" y="30" width="20" height="4" rx="2" fill="#FFFFFF" />
      {/* Left Inner Weight */}
      <rect x="18" y="22" width="4" height="20" rx="2" fill="#FFFFFF" />
      {/* Left Outer Weight */}
      <rect x="14" y="25" width="4" height="14" rx="2" fill="#FED7AA" />
      {/* Right Inner Weight */}
      <rect x="42" y="22" width="4" height="20" rx="2" fill="#FFFFFF" />
      {/* Right Outer Weight */}
      <rect x="46" y="25" width="4" height="14" rx="2" fill="#FED7AA" />
    </Tile>
  ),
}

const APP_ID_MAP = {
  gym_fitness_club: 'dumbbell',
  gym: 'dumbbell',
  fitness: 'dumbbell',
  zatca_phase2_pro: 'zatca',
  zatca_phase2: 'zatca',
  gosi_mudad_compliance: 'gosi',
  elm_identity_pro: 'elm',
  qiwa_hr_integration: 'qiwa',
  saber_conformity: 'saber',
  balady_municipal: 'balady',
  etimad_procurement: 'etimad',
  pakistan_fbr_einvoicing: 'fbr',
  bangladesh_nbr_einvoicing: 'zatca',
  smsa_express: 'smsa',
  aramex_shipping: 'aramex',
  jnt_express: 'jnt',
  naqel_express: 'naqel',
  imile_courier: 'imile',
  spl_saudi_post: 'spl',
  fedex_shipping: 'fedex',
  dhl_express: 'dhl',
  ups_shipping: 'ups',
  tnt_express: 'tnt',
  tabby_bnpl: 'tabby',
  tamara_bnpl: 'tamara',
  multicourier_shipping: 'smsa',
  hungerstation_delivery: 'hungerstation',
  jahez_delivery: 'jahez',
  keeta_delivery: 'keeta',
  mrsool_delivery: 'mrsool',
  ninja_delivery: 'ninja',
  toyou_delivery: 'toyou',
  jumlaty_delivery: 'jumlaty',
  delivery_platforms: 'hungerstation',
  email_suite: 'email',
  sms_marketing: 'sms',
  whatsapp_cloud_auto: 'whatsapp',
}

export function resolveAppStoreBrandIcon({ appId = '', icon = '', label = '', uid, className }) {
  const key = APP_ID_MAP[appId] || (ICONS[icon] ? icon : '')
  const fromLabel = Object.keys(ICONS).find((k) => label.includes(k) || label.includes(k.replace('jnt', 'j&t')))
  const resolved = key || fromLabel
  if (!resolved || !ICONS[resolved]) return null
  return ICONS[resolved](uid, className)
}
