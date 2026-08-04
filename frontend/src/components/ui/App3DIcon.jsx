import React from 'react'

/**
 * Ultra-premium 3D SVG app icons.
 * Every module gets a completely unique, semantically correct, hand-crafted icon.
 * Matching is based on path SEGMENTS (last / secondLast) so /app/dashboard/X → "X".
 */
export function App3DIcon({ path = '', label = '', className = 'w-11 h-11 sm:w-12 sm:h-12' }) {
  const uid = React.useId().replace(/:/g, '')
  const segments = (path || '').toLowerCase().split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  const second = segments[segments.length - 2] || ''
  const third = segments[segments.length - 3] || ''

  // ─── 1. POS / CHECKOUT ──────────────────────────────────────────────────────
  if (last === 'pos' || (last === 'checkout' && second !== 'rental')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`a_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF416C"/><stop offset="100%" stopColor="#FF4B2B"/>
          </linearGradient>
        </defs>
        {/* Screen */}
        <rect x="12" y="8" width="40" height="28" rx="5" fill="#1A0010"/>
        <rect x="16" y="12" width="32" height="20" rx="3" fill={`url(#a_${uid})`}/>
        {/* Price display */}
        <rect x="20" y="16" width="24" height="5" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="20" y="24" width="14" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        {/* Body */}
        <rect x="18" y="36" width="28" height="14" rx="4" fill={`url(#a_${uid})`}/>
        {/* Keys */}
        <rect x="22" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="29" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="36" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="22" y="46" width="20" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 2. MENU ITEMS ──────────────────────────────────────────────────────────
  if (last === 'menu-items' || (last === 'menu' && second === 'restaurant')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`b_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C00"/><stop offset="100%" stopColor="#FF4500"/>
          </linearGradient>
        </defs>
        {/* Fork */}
        <line x1="18" y1="10" x2="18" y2="30" stroke={`url(#b_${uid})`} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="14" y1="10" x2="14" y2="20" stroke={`url(#b_${uid})`} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="22" y1="10" x2="22" y2="20" stroke={`url(#b_${uid})`} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M14 20C14 22 18 24 22 20" stroke={`url(#b_${uid})`} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <line x1="18" y1="30" x2="18" y2="54" stroke={`url(#b_${uid})`} strokeWidth="3.5" strokeLinecap="round"/>
        {/* Knife */}
        <path d="M46 10C46 10 50 18 50 26C50 30 48 32 46 32V54" stroke={`url(#b_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        {/* Plate */}
        <ellipse cx="32" cy="44" rx="18" ry="5" fill={`url(#b_${uid})`} fillOpacity="0.25"/>
        <ellipse cx="32" cy="44" rx="18" ry="5" fill="none" stroke={`url(#b_${uid})`} strokeWidth="2.5"/>
      </svg>
    )
  }

  // ─── 3. TABLES ──────────────────────────────────────────────────────────────
  if (last === 'tables') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`c_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C6FF"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
        </defs>
        {/* Table top (isometric) */}
        <path d="M32 10L54 22L32 34L10 22L32 10Z" fill={`url(#c_${uid})`}/>
        {/* Left face */}
        <path d="M10 22V38L32 50V34L10 22Z" fill="#0052D4"/>
        {/* Right face */}
        <path d="M54 22V38L32 50V34L54 22Z" fill="#003DAB"/>
        {/* Chair left */}
        <circle cx="16" cy="46" r="5" fill={`url(#c_${uid})`} fillOpacity="0.8"/>
        {/* Chair right */}
        <circle cx="48" cy="46" r="5" fill={`url(#c_${uid})`} fillOpacity="0.8"/>
        {/* Highlight */}
        <ellipse cx="32" cy="16" rx="8" ry="3" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 4. INVENTORY / WAREHOUSES / PRODUCTS / STOCK ───────────────────────────
  if (['inventory'].includes(last) && !['ecommerce', 'restaurant', 'bakala', 'bookstore'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`d_${uid}`} x1="8" y1="8" x2="56" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008"/><stop offset="100%" stopColor="#FFC837"/>
          </linearGradient>
          <linearGradient id={`dl_${uid}`} x1="8" y1="24" x2="32" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF5722"/><stop offset="100%" stopColor="#BF360C"/>
          </linearGradient>
          <linearGradient id={`dr_${uid}`} x1="32" y1="24" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF9800"/><stop offset="100%" stopColor="#E65100"/>
          </linearGradient>
        </defs>
        <path d="M32 10L52 21L32 32L12 21L32 10Z" fill={`url(#d_${uid})`}/>
        <path d="M12 21L32 32V50L12 39V21Z" fill={`url(#dl_${uid})`}/>
        <path d="M32 32L52 21V39L32 50V32Z" fill={`url(#dr_${uid})`}/>
        <path d="M24 15L44 26" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4"/>
        <ellipse cx="32" cy="14" rx="5" ry="2" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 5. ORDERS ──────────────────────────────────────────────────────────────
  if (last === 'orders' && !['ecommerce'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`e_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#C026D3"/>
          </linearGradient>
        </defs>
        {/* Main receipt */}
        <rect x="16" y="10" width="32" height="44" rx="6" fill="#1A0030"/>
        <rect x="16" y="10" width="32" height="8" rx="4" fill={`url(#e_${uid})`}/>
        {/* Wavy bottom */}
        <path d="M16 54V50C20 50 20 54 24 54C28 54 28 50 32 50C36 50 36 54 40 54C44 54 44 50 48 50V54H16Z" fill={`url(#e_${uid})`}/>
        {/* Lines */}
        <rect x="22" y="24" width="20" height="3" rx="1.5" fill={`url(#e_${uid})`} fillOpacity="0.8"/>
        <rect x="22" y="31" width="14" height="2.5" rx="1.25" fill={`url(#e_${uid})`} fillOpacity="0.55"/>
        <rect x="22" y="37" width="18" height="2.5" rx="1.25" fill={`url(#e_${uid})`} fillOpacity="0.55"/>
        {/* Price */}
        <rect x="32" y="43" width="12" height="3" rx="1.5" fill={`url(#e_${uid})`} fillOpacity="0.9"/>
      </svg>
    )
  }

  // ─── 6. CASHIER PANEL ───────────────────────────────────────────────────────
  if (last === 'cashier') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`f_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0891B2"/>
          </linearGradient>
        </defs>
        {/* Monitor */}
        <rect x="8" y="10" width="48" height="32" rx="6" fill="#0C1428"/>
        <rect x="12" y="14" width="40" height="24" rx="4" fill={`url(#f_${uid})`} fillOpacity="0.85"/>
        {/* Screen UI */}
        <rect x="16" y="18" width="16" height="8" rx="2" fill="#FFFFFF" fillOpacity="0.3"/>
        <rect x="36" y="18" width="12" height="3.5" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="36" y="24" width="8" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.35"/>
        <rect x="16" y="30" width="32" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.25"/>
        {/* Stand */}
        <rect x="28" y="42" width="8" height="8" rx="2" fill="#0C1428"/>
        <rect x="20" y="50" width="24" height="5" rx="2.5" fill="#0C1428"/>
      </svg>
    )
  }

  // ─── 7. KITCHEN ─────────────────────────────────────────────────────────────
  if (last === 'kitchen') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`g_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFC107"/><stop offset="100%" stopColor="#FF8F00"/>
          </linearGradient>
        </defs>
        {/* Puff top */}
        <circle cx="24" cy="22" r="10" fill={`url(#g_${uid})`}/>
        <circle cx="32" cy="18" r="12" fill={`url(#g_${uid})`}/>
        <circle cx="40" cy="22" r="10" fill={`url(#g_${uid})`}/>
        {/* Flat band */}
        <rect x="18" y="28" width="28" height="7" rx="0" fill={`url(#g_${uid})`}/>
        {/* Brim */}
        <rect x="16" y="34" width="32" height="8" rx="4" fill={`url(#g_${uid})`}/>
        {/* Blue stripe on brim */}
        <rect x="16" y="35" width="32" height="2" rx="1" fill="#0072FF" fillOpacity="0.45"/>
        {/* Highlight on top */}
        <ellipse cx="29" cy="18" rx="6" ry="3.5" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ─── 8. KDS BOARD ───────────────────────────────────────────────────────────
  if (last === 'kds') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`h_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#4F46E5"/>
          </linearGradient>
        </defs>
        {/* Wide display */}
        <rect x="6" y="14" width="52" height="36" rx="6" fill="#0A0720"/>
        <rect x="10" y="18" width="44" height="28" rx="4" fill={`url(#h_${uid})`} fillOpacity="0.8"/>
        {/* Order tickets */}
        <rect x="14" y="22" width="12" height="16" rx="3" fill="#FFFFFF" fillOpacity="0.15"/>
        <rect x="28" y="22" width="12" height="16" rx="3" fill="#10B981" fillOpacity="0.5"/>
        <rect x="42" y="22" width="8" height="16" rx="3" fill="#F59E0B" fillOpacity="0.5"/>
        {/* Order numbers */}
        <rect x="16" y="24" width="8" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="30" y="24" width="8" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="44" y="24" width="4" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.7"/>
        {/* Stand */}
        <rect x="28" y="50" width="8" height="6" rx="2" fill="#0A0720"/>
        <rect x="22" y="56" width="20" height="4" rx="2" fill="#0A0720"/>
      </svg>
    )
  }

  // ─── 9. BRANCHES ────────────────────────────────────────────────────────────
  if (last === 'branches') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`i_${uid}`} x1="8" y1="8" x2="28" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#047857"/>
          </linearGradient>
          <linearGradient id={`i2_${uid}`} x1="24" y1="4" x2="40" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
          <linearGradient id={`i3_${uid}`} x1="38" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/>
          </linearGradient>
        </defs>
        <rect x="6" y="30" width="14" height="26" rx="3" fill={`url(#i_${uid})`}/>
        <rect x="6" y="22" width="14" height="10" rx="2" fill={`url(#i_${uid})`} fillOpacity="0.7"/>
        <rect x="22" y="18" width="16" height="38" rx="3" fill={`url(#i2_${uid})`}/>
        <rect x="22" y="8" width="16" height="12" rx="2" fill={`url(#i2_${uid})`} fillOpacity="0.7"/>
        <rect x="40" y="24" width="14" height="32" rx="3" fill={`url(#i3_${uid})`}/>
        <rect x="40" y="16" width="14" height="10" rx="2" fill={`url(#i3_${uid})`} fillOpacity="0.7"/>
        {/* Windows */}
        <rect x="9" y="34" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="9" y="42" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="26" y="22" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="34" y="22" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="43" y="28" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="43" y="36" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 10. QR MENU ────────────────────────────────────────────────────────────
  if (last === 'qr-menu' || last === 'qr') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`j_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/>
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="18" height="18" rx="4" fill={`url(#j_${uid})`}/>
        <rect x="14" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="36" y="10" width="18" height="18" rx="4" fill={`url(#j_${uid})`}/>
        <rect x="40" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="10" y="36" width="18" height="18" rx="4" fill={`url(#j_${uid})`}/>
        <rect x="14" y="40" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="36" y="36" width="7" height="7" rx="2" fill={`url(#j_${uid})`}/>
        <rect x="47" y="36" width="7" height="7" rx="2" fill={`url(#j_${uid})`}/>
        <rect x="36" y="47" width="7" height="7" rx="2" fill={`url(#j_${uid})`}/>
        <rect x="47" y="47" width="7" height="7" rx="2" fill={`url(#j_${uid})`}/>
      </svg>
    )
  }

  // ─── 11. RESERVATIONS / CALENDAR ────────────────────────────────────────────
  if (['reservations', 'reservation', 'appointments', 'rental-calendar'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`k_${uid}`} x1="8" y1="8" x2="56" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#DC2626"/>
          </linearGradient>
          <linearGradient id={`kg_${uid}`} x1="8" y1="30" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FCD34D"/><stop offset="100%" stopColor="#F59E0B"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="42" rx="10" fill="#1A0808"/>
        <rect x="10" y="14" width="44" height="16" rx="8" fill={`url(#k_${uid})`}/>
        <rect x="18" y="8" width="5" height="12" rx="2.5" fill="#EF4444"/>
        <rect x="41" y="8" width="5" height="12" rx="2.5" fill="#EF4444"/>
        <rect x="18" y="8" width="5" height="6" rx="2.5" fill="#FFFFFF"/>
        <rect x="41" y="8" width="5" height="6" rx="2.5" fill="#FFFFFF"/>
        {/* Day grid */}
        <rect x="15" y="34" width="6" height="6" rx="2" fill={`url(#kg_${uid})`}/>
        <rect x="24" y="34" width="6" height="6" rx="2" fill={`url(#kg_${uid})`} fillOpacity="0.6"/>
        <rect x="33" y="34" width="6" height="6" rx="2" fill={`url(#kg_${uid})`} fillOpacity="0.6"/>
        <rect x="42" y="34" width="6" height="6" rx="2" fill={`url(#kg_${uid})`} fillOpacity="0.3"/>
        <rect x="15" y="44" width="6" height="6" rx="2" fill={`url(#kg_${uid})`} fillOpacity="0.6"/>
        <rect x="24" y="44" width="6" height="6" rx="2" fill="#10B981" fillOpacity="0.8"/>
        <rect x="33" y="44" width="6" height="6" rx="2" fill={`url(#kg_${uid})`} fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 12. COMBOS & DEALS / TAG ───────────────────────────────────────────────
  if (['combos', 'deals'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`l_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        {/* Big tag */}
        <path d="M12 12H38C39.7 12 41.3 12.8 42.5 14.2L54 30L42.5 45.8C41.3 47.2 39.7 48 38 48H12C9.8 48 8 46.2 8 44V16C8 13.8 9.8 12 12 12Z" fill={`url(#l_${uid})`}/>
        {/* Hole */}
        <circle cx="20" cy="24" r="5" fill="#1A0808"/>
        <circle cx="20" cy="24" r="3" fill={`url(#l_${uid})`}/>
        {/* % symbol */}
        <circle cx="28" cy="34" r="4" fill="#FFFFFF" fillOpacity="0.9"/>
        <circle cx="40" cy="24" r="4" fill="#FFFFFF" fillOpacity="0.9"/>
        <path d="M24 38L44 20" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round"/>
        {/* Ribbon */}
        <rect x="50" y="20" width="6" height="20" rx="3" fill="#EF4444"/>
      </svg>
    )
  }

  // ─── 13. ANALYTICS / REPORTS ────────────────────────────────────────────────
  if (['analytics', 'reports', 'hr-reports', 'report', 'sales-report'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`m_${uid}`} x1="10" y1="42" x2="22" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#B91C1C"/>
          </linearGradient>
          <linearGradient id={`m2_${uid}`} x1="24" y1="28" x2="40" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
          <linearGradient id={`m3_${uid}`} x1="40" y1="14" x2="54" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#047857"/>
          </linearGradient>
        </defs>
        <rect x="10" y="38" width="12" height="18" rx="6" fill={`url(#m_${uid})`}/>
        <rect x="26" y="24" width="12" height="32" rx="6" fill={`url(#m2_${uid})`}/>
        <rect x="42" y="12" width="12" height="44" rx="6" fill={`url(#m3_${uid})`}/>
        {/* Trend line */}
        <path d="M16 36L32 22L48 10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.8" fill="none"/>
        <circle cx="16" cy="36" r="3" fill="#FFFFFF"/>
        <circle cx="32" cy="22" r="3" fill="#FFFFFF"/>
        <circle cx="48" cy="10" r="3" fill="#FFFFFF"/>
      </svg>
    )
  }

  // ─── 14. MESS / CAFETERIA ───────────────────────────────────────────────────
  if (last === 'mess') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`n_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#EA580C"/>
          </linearGradient>
        </defs>
        {/* Tray */}
        <rect x="8" y="40" width="48" height="8" rx="4" fill={`url(#n_${uid})`}/>
        {/* Plate */}
        <ellipse cx="24" cy="36" rx="12" ry="8" fill="#F97316" fillOpacity="0.6"/>
        <ellipse cx="24" cy="36" rx="10" ry="6" fill="#FFFFFF" fillOpacity="0.15"/>
        {/* Cup */}
        <rect x="40" y="30" width="12" height="14" rx="4" fill={`url(#n_${uid})`} fillOpacity="0.8"/>
        {/* Steam */}
        <path d="M26 24C26 24 28 20 26 16" stroke={`url(#n_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M32 26C32 26 34 22 32 18" stroke={`url(#n_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M20 22C20 22 22 18 20 14" stroke={`url(#n_${uid})`} strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 15. DELIVERY PLATFORMS (restaurant) ────────────────────────────────────
  if (last === 'delivery' && (second === 'restaurant' || third === 'restaurant')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`o_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#B91C1C"/>
          </linearGradient>
        </defs>
        {/* Scooter body */}
        <path d="M12 38H44L46 30H34C32 30 30 32 30 34V38H12Z" fill={`url(#o_${uid})`}/>
        {/* Front */}
        <path d="M44 38L48 30H52L50 38H44Z" fill={`url(#o_${uid})`} fillOpacity="0.7"/>
        {/* Food bag on back */}
        <rect x="8" y="28" width="14" height="12" rx="4" fill="#F97316"/>
        {/* Bag strap */}
        <path d="M10 30L8 24" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M20 30L22 24" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Wheels */}
        <circle cx="18" cy="42" r="7" fill="#1A0808"/>
        <circle cx="18" cy="42" r="4" fill="#FFFFFF" fillOpacity="0.3"/>
        <circle cx="18" cy="42" r="2" fill={`url(#o_${uid})`}/>
        <circle cx="48" cy="42" r="7" fill="#1A0808"/>
        <circle cx="48" cy="42" r="4" fill="#FFFFFF" fillOpacity="0.3"/>
        <circle cx="48" cy="42" r="2" fill={`url(#o_${uid})`}/>
        {/* Handlebar */}
        <path d="M46 28L52 24" stroke={`url(#o_${uid})`} strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  }

  // ─── 16. DASHBOARD (root) ───────────────────────────────────────────────────
  if (last === 'dashboard' || path === '/app/dashboard') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`p_${uid}`} x1="10" y1="10" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#DC2626"/>
          </linearGradient>
          <linearGradient id={`p2_${uid}`} x1="34" y1="10" x2="54" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0891B2"/>
          </linearGradient>
          <linearGradient id={`p3_${uid}`} x1="10" y1="34" x2="28" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#BE185D"/>
          </linearGradient>
          <linearGradient id={`p4_${uid}`} x1="34" y1="28" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="17" height="17" rx="6" fill={`url(#p_${uid})`}/>
        <rect x="34" y="10" width="20" height="12" rx="5" fill={`url(#p2_${uid})`}/>
        <rect x="10" y="34" width="17" height="20" rx="6" fill={`url(#p3_${uid})`}/>
        <rect x="34" y="28" width="20" height="26" rx="6" fill={`url(#p4_${uid})`}/>
        {/* Mini chart in bottom right */}
        <rect x="38" y="40" width="4" height="8" rx="2" fill="#FFFFFF" fillOpacity="0.6"/>
        <rect x="44" y="36" width="4" height="12" rx="2" fill="#FFFFFF" fillOpacity="0.6"/>
        <rect x="50" y="32" width="2" height="16" rx="1" fill="#FFFFFF" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 17. INVOICES ───────────────────────────────────────────────────────────
  if (last === 'invoices' || last === 'bills') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`q_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#5B21B6"/>
          </linearGradient>
        </defs>
        {/* Document */}
        <path d="M14 10C14 7.8 15.8 6 18 6H36L50 20V54C50 56.2 48.2 58 46 58H18C15.8 58 14 56.2 14 54V10Z" fill="#0A0020"/>
        <path d="M36 6V18C36 19.1 36.9 20 38 20H50L36 6Z" fill={`url(#q_${uid})`} fillOpacity="0.5"/>
        {/* Dollar icon */}
        <circle cx="32" cy="36" r="12" fill={`url(#q_${uid})`}/>
        <text x="32" y="41" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle">$</text>
        {/* Lines */}
        <rect x="18" y="48" width="12" height="2.5" rx="1.25" fill={`url(#q_${uid})`} fillOpacity="0.6"/>
        <rect x="32" y="48" width="10" height="2.5" rx="1.25" fill={`url(#q_${uid})`} fillOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 18. CUSTOMERS ──────────────────────────────────────────────────────────
  if (last === 'customers' && second !== 'ecommerce') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`r_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#EA580C"/>
          </linearGradient>
        </defs>
        {/* ID Card */}
        <rect x="8" y="14" width="48" height="36" rx="8" fill={`url(#r_${uid})`}/>
        {/* Photo circle */}
        <circle cx="24" cy="28" r="10" fill="#FFFFFF" fillOpacity="0.2"/>
        <circle cx="24" cy="25" r="5" fill="#FFFFFF" fillOpacity="0.8"/>
        <path d="M14 38C14 33 18.5 30 24 30C29.5 30 34 33 34 38H14Z" fill="#FFFFFF" fillOpacity="0.8"/>
        {/* Info lines */}
        <rect x="38" y="20" width="14" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.8"/>
        <rect x="38" y="27" width="10" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.55"/>
        <rect x="38" y="33" width="12" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.55"/>
        <rect x="38" y="39" width="8" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ─── 19. CUSTOMER STATEMENT ─────────────────────────────────────────────────
  if (last === 'statement') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`s_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
        </defs>
        {/* Scroll */}
        <rect x="16" y="8" width="32" height="48" rx="6" fill="#0A1828"/>
        <rect x="10" y="8" width="12" height="48" rx="6" fill={`url(#s_${uid})`}/>
        <rect x="42" y="8" width="12" height="48" rx="6" fill={`url(#s_${uid})`}/>
        {/* Lines */}
        <rect x="20" y="18" width="24" height="3" rx="1.5" fill={`url(#s_${uid})`} fillOpacity="0.8"/>
        <rect x="20" y="25" width="18" height="2.5" rx="1.25" fill={`url(#s_${uid})`} fillOpacity="0.6"/>
        <rect x="20" y="32" width="22" height="2.5" rx="1.25" fill={`url(#s_${uid})`} fillOpacity="0.6"/>
        <rect x="20" y="39" width="14" height="2.5" rx="1.25" fill={`url(#s_${uid})`} fillOpacity="0.4"/>
        {/* Total line */}
        <rect x="20" y="46" width="24" height="3" rx="1.5" fill={`url(#s_${uid})`}/>
      </svg>
    )
  }

  // ─── 20. QUOTATIONS ─────────────────────────────────────────────────────────
  if (last === 'quotations') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`t_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9"/><stop offset="100%" stopColor="#0284C7"/>
          </linearGradient>
          <linearGradient id={`tp_${uid}`} x1="28" y1="34" x2="56" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#FCA5A5"/>
          </linearGradient>
        </defs>
        {/* Notepad */}
        <path d="M12 12C12 9.8 13.8 8 16 8H38L50 20V50C50 52.2 48.2 54 46 54H16C13.8 54 12 52.2 12 50V12Z" fill={`url(#t_${uid})`} fillOpacity="0.15"/>
        <path d="M12 12C12 9.8 13.8 8 16 8H38L50 20V50C50 52.2 48.2 54 46 54H16C13.8 54 12 52.2 12 50V12Z" fill="none" stroke={`url(#t_${uid})`} strokeWidth="2.5"/>
        <path d="M38 8V18C38 19.1 38.9 20 40 20H50L38 8Z" fill={`url(#t_${uid})`}/>
        <rect x="18" y="28" width="20" height="2.5" rx="1.25" fill={`url(#t_${uid})`} fillOpacity="0.7"/>
        <rect x="18" y="35" width="16" height="2.5" rx="1.25" fill={`url(#t_${uid})`} fillOpacity="0.55"/>
        <rect x="18" y="42" width="22" height="2.5" rx="1.25" fill={`url(#t_${uid})`} fillOpacity="0.55"/>
        {/* Pen */}
        <path d="M36 46L40 38L50 48L42 52L36 46Z" fill={`url(#tp_${uid})`}/>
        <circle cx="51" cy="37" r="4" fill="#EF4444"/>
        <path d="M36 46L39 48L38 52L36 46Z" fill="#2A2C34"/>
      </svg>
    )
  }

  // ─── 21. DELIVERY NOTES ─────────────────────────────────────────────────────
  if (last === 'delivery-notes') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`u_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        {/* Box */}
        <path d="M12 24L32 14L52 24V44L32 54L12 44V24Z" fill={`url(#u_${uid})`} fillOpacity="0.2"/>
        <path d="M12 24L32 34L52 24" stroke={`url(#u_${uid})`} strokeWidth="2.5" fill="none"/>
        <path d="M32 34V54" stroke={`url(#u_${uid})`} strokeWidth="2.5"/>
        <path d="M12 24L32 14L52 24V44L32 54L12 44V24Z" stroke={`url(#u_${uid})`} strokeWidth="2.5" fill="none"/>
        {/* Arrow up */}
        <circle cx="32" cy="34" r="10" fill={`url(#u_${uid})`}/>
        <path d="M32 30V38M28 34L32 30L36 34" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // ─── 22. CONTACTS ───────────────────────────────────────────────────────────
  if (last === 'contacts' && second !== 'crm') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`v_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#1D4ED8"/>
          </linearGradient>
        </defs>
        {/* Book */}
        <rect x="10" y="8" width="36" height="48" rx="6" fill={`url(#v_${uid})`}/>
        <rect x="6" y="10" width="8" height="44" rx="4" fill={`url(#v_${uid})`} fillOpacity="0.6"/>
        {/* Tabs */}
        <rect x="42" y="14" width="8" height="6" rx="3" fill="#60A5FA"/>
        <rect x="42" y="24" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.7"/>
        <rect x="42" y="34" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.5"/>
        <rect x="42" y="44" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.3"/>
        {/* Person icon */}
        <circle cx="28" cy="26" r="7" fill="#FFFFFF" fillOpacity="0.9"/>
        <path d="M16 42C16 36 21 32 28 32C35 32 40 36 40 42H16Z" fill="#FFFFFF" fillOpacity="0.9"/>
      </svg>
    )
  }

  // ─── 23. LETTERHEAD ─────────────────────────────────────────────────────────
  if (last === 'letterhead') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`w_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0284C7"/>
          </linearGradient>
        </defs>
        {/* Envelope */}
        <rect x="8" y="16" width="48" height="36" rx="6" fill="#0A1828"/>
        <path d="M8 20L32 38L56 20" stroke={`url(#w_${uid})`} strokeWidth="3" fill="none" strokeLinecap="round"/>
        <rect x="8" y="16" width="48" height="6" rx="3" fill={`url(#w_${uid})`} fillOpacity="0.3"/>
        {/* Letter inside */}
        <rect x="18" y="26" width="28" height="20" rx="3" fill={`url(#w_${uid})`} fillOpacity="0.2"/>
        {/* Logo watermark */}
        <circle cx="32" cy="32" r="6" fill={`url(#w_${uid})`} fillOpacity="0.5"/>
        <rect x="20" y="40" width="24" height="2" rx="1" fill={`url(#w_${uid})`} fillOpacity="0.4"/>
        <rect x="24" y="44" width="16" height="2" rx="1" fill={`url(#w_${uid})`} fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 24. PURCHASE ORDERS ────────────────────────────────────────────────────
  if (last === 'purchase-orders' || last === 'auto-reorder') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`x_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#047857"/>
          </linearGradient>
        </defs>
        {/* Shopping cart */}
        <path d="M8 12H14L20 38H50L56 20H18" stroke={`url(#x_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Items in cart */}
        <rect x="22" y="22" width="8" height="10" rx="2" fill={`url(#x_${uid})`} fillOpacity="0.4"/>
        <rect x="32" y="22" width="8" height="10" rx="2" fill={`url(#x_${uid})`} fillOpacity="0.6"/>
        <rect x="42" y="22" width="7" height="10" rx="2" fill={`url(#x_${uid})`} fillOpacity="0.8"/>
        {/* Wheels */}
        <circle cx="24" cy="46" r="5" fill={`url(#x_${uid})`}/>
        <circle cx="44" cy="46" r="5" fill={`url(#x_${uid})`}/>
        <circle cx="24" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.6"/>
        <circle cx="44" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 25. SUPPLIERS ──────────────────────────────────────────────────────────
  if (last === 'suppliers') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`y_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6"/><stop offset="100%" stopColor="#0F766E"/>
          </linearGradient>
        </defs>
        {/* Left hand */}
        <path d="M10 38C10 38 12 28 20 26C28 24 28 28 28 28V44C28 44 28 48 24 48H10V38Z" fill={`url(#y_${uid})`}/>
        {/* Right hand */}
        <path d="M54 38C54 38 52 28 44 26C36 24 36 28 36 28V44C36 44 36 48 40 48H54V38Z" fill={`url(#y_${uid})`} fillOpacity="0.8"/>
        {/* Handshake center */}
        <rect x="26" y="28" width="12" height="14" rx="4" fill={`url(#y_${uid})`} fillOpacity="0.9"/>
        {/* Cuffs */}
        <rect x="8" y="44" width="20" height="6" rx="3" fill="#0F766E"/>
        <rect x="36" y="44" width="20" height="6" rx="3" fill="#0F766E"/>
        {/* Clasp */}
        <circle cx="32" cy="34" r="4" fill="#FFFFFF" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 26. SUPPLIER PERFORMANCE ───────────────────────────────────────────────
  if (last === 'supplier-performance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`z_${uid}`} x1="8" y1="48" x2="56" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6"/><stop offset="100%" stopColor="#F59E0B"/>
          </linearGradient>
        </defs>
        {/* Grid base */}
        <rect x="8" y="8" width="48" height="48" rx="6" fill="#0A1018"/>
        {/* Axes */}
        <path d="M14 52V14" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.3"/>
        <path d="M14 52H52" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.3"/>
        {/* Rising trend line */}
        <path d="M18 46L28 36L38 28L50 14" stroke={`url(#z_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Arrow head */}
        <path d="M46 12L52 14L50 20" stroke={`url(#z_${uid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Dots */}
        <circle cx="18" cy="46" r="3.5" fill={`url(#z_${uid})`}/>
        <circle cx="28" cy="36" r="3.5" fill={`url(#z_${uid})`}/>
        <circle cx="38" cy="28" r="3.5" fill={`url(#z_${uid})`}/>
        <circle cx="50" cy="14" r="3.5" fill={`url(#z_${uid})`}/>
      </svg>
    )
  }

  // ─── 27. GRN / GOODS RECEIPT ────────────────────────────────────────────────
  if (last === 'grn') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`aa_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#15803D"/>
          </linearGradient>
        </defs>
        {/* Warehouse building */}
        <rect x="8" y="22" width="48" height="36" rx="4" fill="#0A1808"/>
        <path d="M6 26L32 10L58 26" stroke={`url(#aa_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none"/>
        <rect x="8" y="22" width="48" height="6" fill={`url(#aa_${uid})`}/>
        {/* Doors */}
        <rect x="22" y="36" width="10" height="22" rx="2" fill={`url(#aa_${uid})`} fillOpacity="0.4"/>
        <rect x="34" y="36" width="10" height="22" rx="2" fill={`url(#aa_${uid})`} fillOpacity="0.4"/>
        {/* Check badge */}
        <circle cx="48" cy="20" r="10" fill={`url(#aa_${uid})`}/>
        <path d="M43 20L47 24L54 16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // ─── 28. PURCHASE RETURNS ───────────────────────────────────────────────────
  if (last === 'purchase-returns' || (last === 'returns' && second === 'ecommerce')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ab_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F43F5E"/><stop offset="100%" stopColor="#BE123C"/>
          </linearGradient>
        </defs>
        {/* Box */}
        <rect x="14" y="24" width="36" height="30" rx="5" fill={`url(#ab_${uid})`} fillOpacity="0.2"/>
        <rect x="14" y="24" width="36" height="30" rx="5" fill="none" stroke={`url(#ab_${uid})`} strokeWidth="2.5"/>
        {/* Box top flaps */}
        <path d="M14 24L32 14L50 24" stroke={`url(#ab_${uid})`} strokeWidth="2.5" fill="none"/>
        {/* Return arrow */}
        <path d="M26 10C20 10 14 16 14 22" stroke={`url(#ab_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M20 6L26 10L20 14" fill={`url(#ab_${uid})`}/>
        {/* X mark on box */}
        <path d="M24 34L40 48M40 34L24 48" stroke={`url(#ab_${uid})`} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    )
  }

  // ─── 29. SHIPMENTS ──────────────────────────────────────────────────────────
  if (last === 'shipments' || last === 'shipment') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ac_${uid}`} x1="8" y1="18" x2="56" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#B45309"/>
          </linearGradient>
        </defs>
        {/* Truck body */}
        <rect x="6" y="22" width="34" height="24" rx="4" fill={`url(#ac_${uid})`}/>
        {/* Cab */}
        <path d="M40 28V46H56V36L50 28H40Z" fill={`url(#ac_${uid})`} fillOpacity="0.8"/>
        {/* Windshield */}
        <path d="M42 30V36H54L50 30H42Z" fill="#00E5FF" fillOpacity="0.7"/>
        {/* Cargo door lines */}
        <rect x="10" y="26" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.3"/>
        <rect x="10" y="32" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.3"/>
        <rect x="10" y="38" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.3"/>
        {/* Wheels */}
        <circle cx="16" cy="48" r="6" fill="#1A0808"/>
        <circle cx="16" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.3"/>
        <circle cx="30" cy="48" r="6" fill="#1A0808"/>
        <circle cx="30" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.3"/>
        <circle cx="48" cy="48" r="6" fill="#1A0808"/>
        <circle cx="48" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 30. PRODUCTS ───────────────────────────────────────────────────────────
  if (last === 'products' && !['ecommerce', 'bakala', 'bookstore'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ad_${uid}`} x1="8" y1="8" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#B91C1C"/>
          </linearGradient>
          <linearGradient id={`ad2_${uid}`} x1="30" y1="8" x2="56" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#1D4ED8"/>
          </linearGradient>
          <linearGradient id={`ad3_${uid}`} x1="8" y1="30" x2="30" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#047857"/>
          </linearGradient>
          <linearGradient id={`ad4_${uid}`} x1="30" y1="30" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="22" height="22" rx="5" fill={`url(#ad_${uid})`}/>
        <rect x="34" y="8" width="22" height="22" rx="5" fill={`url(#ad2_${uid})`}/>
        <rect x="8" y="34" width="22" height="22" rx="5" fill={`url(#ad3_${uid})`}/>
        <rect x="34" y="34" width="22" height="22" rx="5" fill={`url(#ad4_${uid})`}/>
        {/* Highlight on each */}
        <ellipse cx="17" cy="13" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
        <ellipse cx="43" cy="13" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
        <ellipse cx="17" cy="39" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
        <ellipse cx="43" cy="39" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 31. WAREHOUSES ─────────────────────────────────────────────────────────
  if (last === 'warehouses' || last === 'warehouse') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ae_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#4338CA"/>
          </linearGradient>
        </defs>
        {/* Base */}
        <rect x="6" y="28" width="52" height="30" rx="4" fill="#080A20"/>
        {/* Roof */}
        <path d="M4 30L32 8L60 30" fill={`url(#ae_${uid})`}/>
        <path d="M4 30L32 8L60 30Z" stroke={`url(#ae_${uid})`} strokeWidth="1" fill={`url(#ae_${uid})`}/>
        {/* Door */}
        <rect x="24" y="40" width="16" height="18" rx="3" fill={`url(#ae_${uid})`} fillOpacity="0.5"/>
        <line x1="32" y1="40" x2="32" y2="58" stroke={`url(#ae_${uid})`} strokeWidth="1.5"/>
        {/* Side windows */}
        <rect x="10" y="34" width="10" height="8" rx="2" fill={`url(#ae_${uid})`} fillOpacity="0.5"/>
        <rect x="44" y="34" width="10" height="8" rx="2" fill={`url(#ae_${uid})`} fillOpacity="0.5"/>
        {/* Roof highlight */}
        <path d="M32 10L58 28" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.2"/>
      </svg>
    )
  }

  // ─── 32. FINANCE / ACCOUNTING ───────────────────────────────────────────────
  if (last === 'finance' || (last === 'dashboard' && second === 'finance')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`af_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EAB308"/><stop offset="100%" stopColor="#A16207"/>
          </linearGradient>
        </defs>
        {/* Coin stack */}
        <ellipse cx="32" cy="50" rx="22" ry="7" fill={`url(#af_${uid})`} fillOpacity="0.6"/>
        <rect x="10" y="42" width="44" height="8" rx="4" fill={`url(#af_${uid})`}/>
        <ellipse cx="32" cy="42" rx="22" ry="7" fill={`url(#af_${uid})`}/>
        <rect x="10" y="34" width="44" height="8" rx="4" fill={`url(#af_${uid})`} fillOpacity="0.85"/>
        <ellipse cx="32" cy="34" rx="22" ry="7" fill={`url(#af_${uid})`} fillOpacity="0.85"/>
        <rect x="10" y="26" width="44" height="8" rx="4" fill={`url(#af_${uid})`} fillOpacity="0.7"/>
        <ellipse cx="32" cy="26" rx="22" ry="7" fill={`url(#af_${uid})`} fillOpacity="0.7"/>
        {/* Top coin face */}
        <ellipse cx="32" cy="18" rx="22" ry="7" fill={`url(#af_${uid})`}/>
        <rect x="10" y="11" width="44" height="7" rx="3" fill={`url(#af_${uid})`}/>
        <ellipse cx="32" cy="11" rx="22" ry="7" fill={`url(#af_${uid})`}/>
        <text x="32" y="15" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle" fillOpacity="0.8">$$$</text>
      </svg>
    )
  }

  // ─── 33. VOUCHERS ───────────────────────────────────────────────────────────
  if (last === 'vouchers') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ag_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#BE185D"/>
          </linearGradient>
        </defs>
        {/* Ticket / coupon shape with notch */}
        <path d="M8 18C8 15.8 9.8 14 12 14H52C54.2 14 56 15.8 56 18V26C54 26 52 28 52 30C52 32 54 34 56 34V42C56 44.2 54.2 46 52 46H12C9.8 46 8 44.2 8 42V34C10 34 12 32 12 30C12 28 10 26 8 26V18Z" fill={`url(#ag_${uid})`}/>
        {/* Perforated line */}
        <line x1="8" y1="30" x2="56" y2="30" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.5"/>
        {/* Content */}
        <rect x="16" y="18" width="20" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="16" y="23" width="14" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <text x="46" y="25" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle" fillOpacity="0.9">%</text>
        <rect x="16" y="35" width="24" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="16" y="40" width="16" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 34. EXPENSES ───────────────────────────────────────────────────────────
  if (last === 'expenses' || last === 'expense-claims') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ah_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#C2410C"/>
          </linearGradient>
        </defs>
        {/* Wallet body */}
        <rect x="8" y="16" width="48" height="36" rx="8" fill="#200E00"/>
        <rect x="8" y="16" width="48" height="8" rx="4" fill={`url(#ah_${uid})`}/>
        {/* Card slot area */}
        <rect x="32" y="26" width="20" height="20" rx="4" fill={`url(#ah_${uid})`} fillOpacity="0.3"/>
        <rect x="32" y="26" width="20" height="6" rx="3" fill={`url(#ah_${uid})`} fillOpacity="0.6"/>
        {/* Cash lines */}
        <rect x="12" y="30" width="16" height="3" rx="1.5" fill={`url(#ah_${uid})`} fillOpacity="0.7"/>
        <rect x="12" y="36" width="12" height="2.5" rx="1.25" fill={`url(#ah_${uid})`} fillOpacity="0.5"/>
        <rect x="12" y="42" width="14" height="2.5" rx="1.25" fill={`url(#ah_${uid})`} fillOpacity="0.5"/>
        {/* Coin */}
        <circle cx="44" cy="38" r="6" fill={`url(#ah_${uid})`}/>
        <text x="44" y="42" fill="#FFFFFF" fontSize="9" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle">$</text>
      </svg>
    )
  }

  // ─── 35. VAT RETURNS ────────────────────────────────────────────────────────
  if (last === 'vat-returns') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ai_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#4338CA"/>
          </linearGradient>
        </defs>
        {/* Document */}
        <rect x="12" y="8" width="40" height="48" rx="6" fill="#0A0820"/>
        <rect x="12" y="8" width="40" height="10" rx="5" fill={`url(#ai_${uid})`}/>
        {/* % symbol */}
        <circle cx="26" cy="32" r="7" fill={`url(#ai_${uid})`} fillOpacity="0.7"/>
        <circle cx="38" cy="44" r="7" fill={`url(#ai_${uid})`} fillOpacity="0.7"/>
        <path d="M22 46L42 26" stroke={`url(#ai_${uid})`} strokeWidth="3.5" strokeLinecap="round"/>
        {/* Inner circles */}
        <circle cx="26" cy="32" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
        <circle cx="38" cy="44" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
        {/* Lines above */}
        <rect x="18" y="14" width="12" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 36. EMPLOYEES ──────────────────────────────────────────────────────────
  if (last === 'employees') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`aj_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#047857"/>
          </linearGradient>
        </defs>
        {/* Three people */}
        {/* Left */}
        <circle cx="16" cy="22" r="7" fill={`url(#aj_${uid})`} fillOpacity="0.7"/>
        <path d="M6 42C6 36 10.5 32 16 32C18.5 32 20.8 33 22.5 34.7" stroke={`url(#aj_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* Right */}
        <circle cx="48" cy="22" r="7" fill={`url(#aj_${uid})`} fillOpacity="0.7"/>
        <path d="M58 42C58 36 53.5 32 48 32C45.5 32 43.2 33 41.5 34.7" stroke={`url(#aj_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* Center (front) */}
        <circle cx="32" cy="20" r="9" fill={`url(#aj_${uid})`}/>
        <path d="M18 46C18 38 24.3 32 32 32C39.7 32 46 38 46 46V52H18V46Z" fill={`url(#aj_${uid})`}/>
        {/* Collar */}
        <path d="M26 32L32 38L38 32" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 37. ATTENDANCE / BIOMETRICS ────────────────────────────────────────────
  if (last === 'attendance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ak_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
        </defs>
        {/* Fingerprint arcs */}
        <circle cx="32" cy="32" r="5" fill={`url(#ak_${uid})`}/>
        <circle cx="32" cy="32" r="11" fill="none" stroke={`url(#ak_${uid})`} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray="34 10"/>
        <circle cx="32" cy="32" r="17" fill="none" stroke={`url(#ak_${uid})`} strokeWidth="3" strokeLinecap="round"
          strokeDasharray="54 16"/>
        <circle cx="32" cy="32" r="23" fill="none" stroke={`url(#ak_${uid})`} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="72 22" strokeOpacity="0.7"/>
        {/* Scan line */}
        <path d="M8 32H56" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="4 4"/>
      </svg>
    )
  }

  // ─── 38. COMPLIANCE (HR) ────────────────────────────────────────────────────
  if (last === 'compliance' && second === 'hr') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`al_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#15803D"/>
          </linearGradient>
        </defs>
        {/* Scale of justice */}
        {/* Center post */}
        <rect x="30" y="10" width="4" height="44" rx="2" fill={`url(#al_${uid})`}/>
        <rect x="16" y="54" width="32" height="4" rx="2" fill={`url(#al_${uid})`}/>
        {/* Crossbar */}
        <rect x="10" y="20" width="44" height="4" rx="2" fill={`url(#al_${uid})`}/>
        {/* Left pan */}
        <path d="M14 24L10 40H22L18 24" stroke={`url(#al_${uid})`} strokeWidth="2" fill="none"/>
        <ellipse cx="16" cy="40" rx="8" ry="3" fill={`url(#al_${uid})`} fillOpacity="0.6"/>
        {/* Right pan */}
        <path d="M50 24L46 40H58L54 24" stroke={`url(#al_${uid})`} strokeWidth="2" fill="none"/>
        <ellipse cx="52" cy="40" rx="8" ry="3" fill={`url(#al_${uid})`} fillOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 39. HIRING ─────────────────────────────────────────────────────────────
  if (last === 'hiring') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`am_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/>
          </linearGradient>
        </defs>
        {/* Person */}
        <circle cx="28" cy="22" r="10" fill={`url(#am_${uid})`}/>
        <path d="M10 50C10 40.6 18.1 33 28 33C33 33 37.5 35 40.5 38.4" stroke={`url(#am_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        {/* Plus badge */}
        <circle cx="48" cy="44" r="12" fill="#1A0830"/>
        <circle cx="48" cy="44" r="10" fill={`url(#am_${uid})`}/>
        <path d="M48 38V50M42 44H54" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    )
  }

  // ─── 40. LEAVES ─────────────────────────────────────────────────────────────
  if (last === 'leaves') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`an_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#16A34A"/>
          </linearGradient>
        </defs>
        {/* Tree */}
        <circle cx="32" cy="22" r="18" fill={`url(#an_${uid})`}/>
        <circle cx="20" cy="28" r="12" fill={`url(#an_${uid})`}/>
        <circle cx="44" cy="28" r="12" fill={`url(#an_${uid})`}/>
        {/* Trunk */}
        <rect x="28" y="40" width="8" height="16" rx="4" fill="#92400E"/>
        {/* Highlight */}
        <ellipse cx="26" cy="18" rx="6" ry="4" fill="#FFFFFF" fillOpacity="0.25"/>
      </svg>
    )
  }

  // ─── 41. PERFORMANCE ────────────────────────────────────────────────────────
  if (last === 'performance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ao_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F43F5E"/><stop offset="100%" stopColor="#E11D48"/>
          </linearGradient>
        </defs>
        {/* Bullseye / Target */}
        <circle cx="32" cy="32" r="24" fill="none" stroke={`url(#ao_${uid})`} strokeWidth="3"/>
        <circle cx="32" cy="32" r="16" fill="none" stroke={`url(#ao_${uid})`} strokeWidth="3" strokeOpacity="0.7"/>
        <circle cx="32" cy="32" r="8" fill="none" stroke={`url(#ao_${uid})`} strokeWidth="3" strokeOpacity="0.5"/>
        <circle cx="32" cy="32" r="4" fill={`url(#ao_${uid})`}/>
        {/* Arrow */}
        <path d="M52 12L36 28" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M44 10L54 10L54 20" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    )
  }

  // ─── 42. PAYROLL ────────────────────────────────────────────────────────────
  if (last === 'payroll') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ap_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#14532D"/>
          </linearGradient>
        </defs>
        {/* Bank building */}
        <rect x="8" y="30" width="48" height="26" rx="3" fill="#080A20"/>
        {/* Columns */}
        <rect x="12" y="30" width="6" height="24" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.7"/>
        <rect x="22" y="30" width="6" height="24" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.7"/>
        <rect x="32" y="30" width="6" height="24" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.7"/>
        <rect x="42" y="30" width="6" height="24" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.7"/>
        <rect x="50" y="30" width="6" height="24" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.7"/>
        {/* Entablature */}
        <rect x="6" y="26" width="52" height="6" rx="2" fill={`url(#ap_${uid})`}/>
        {/* Pediment / Triangle */}
        <path d="M8 26L32 8L56 26" fill={`url(#ap_${uid})`} fillOpacity="0.8"/>
        {/* Steps */}
        <rect x="4" y="54" width="56" height="4" rx="2" fill={`url(#ap_${uid})`} fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 43. PAYROLL CALCULATORS ────────────────────────────────────────────────
  if (last === 'calculators') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`aq_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#4F46E5"/>
          </linearGradient>
        </defs>
        <rect x="12" y="8" width="40" height="48" rx="8" fill={`url(#aq_${uid})`}/>
        {/* Screen */}
        <rect x="18" y="14" width="28" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="38" y="18" width="6" height="4" rx="1" fill={`url(#aq_${uid})`}/>
        {/* Buttons grid */}
        <rect x="18" y="32" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="28" y="32" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="38" y="32" width="7" height="6" rx="2" fill="#EF4444" fillOpacity="0.8"/>
        <rect x="18" y="42" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.4"/>
        <rect x="28" y="42" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.4"/>
        <rect x="38" y="42" width="7" height="6" rx="2" fill="#22C55E" fillOpacity="0.8"/>
      </svg>
    )
  }

  // ─── 44. CRM / PIPELINE ─────────────────────────────────────────────────────
  if (last === 'crm' || (last === 'dashboard' && second === 'crm')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ar_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#7C3AED"/>
          </linearGradient>
        </defs>
        {/* Funnel */}
        <path d="M8 12H56L44 30H20L8 12Z" fill={`url(#ar_${uid})`}/>
        <rect x="22" y="30" width="20" height="14" rx="2" fill={`url(#ar_${uid})`} fillOpacity="0.7"/>
        <path d="M28 44H36V54C36 55.1 34.7 55.7 33.8 55L30.2 52.4C29.5 51.9 28 52.3 28 53V44Z" fill={`url(#ar_${uid})`} fillOpacity="0.6"/>
        {/* Dividers */}
        <line x1="22" y1="20" x2="42" y2="20" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 45. LEADS ──────────────────────────────────────────────────────────────
  if (last === 'leads') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`as_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#EF4444"/>
          </linearGradient>
        </defs>
        {/* Magnet */}
        <path d="M16 10C16 10 10 10 10 22C10 34 22 38 28 38" stroke={`url(#as_${uid})`} strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M48 10C48 10 54 10 54 22C54 34 42 38 36 38" stroke={`url(#as_${uid})`} strokeWidth="6" strokeLinecap="round" fill="none"/>
        <rect x="12" y="10" width="8" height="8" rx="4" fill={`url(#as_${uid})`}/>
        <rect x="44" y="10" width="8" height="8" rx="4" fill={`url(#as_${uid})`}/>
        <rect x="28" y="34" width="8" height="10" rx="4" fill={`url(#as_${uid})`}/>
        {/* Attraction dots */}
        <circle cx="32" cy="50" r="4" fill={`url(#as_${uid})`}/>
        <circle cx="22" cy="48" r="3" fill={`url(#as_${uid})`} fillOpacity="0.7"/>
        <circle cx="42" cy="48" r="3" fill={`url(#as_${uid})`} fillOpacity="0.7"/>
      </svg>
    )
  }

  // ─── 46. DEALS ──────────────────────────────────────────────────────────────
  if (last === 'deals') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`at_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#F59E0B"/>
          </linearGradient>
        </defs>
        {/* Handshake */}
        <path d="M8 30L24 22H32L40 30L28 38L20 34L8 38V30Z" fill={`url(#at_${uid})`}/>
        <path d="M56 30L40 22H32L24 30L36 38L44 34L56 38V30Z" fill={`url(#at_${uid})`} fillOpacity="0.75"/>
        <ellipse cx="32" cy="32" rx="6" ry="4" fill="#FFFFFF" fillOpacity="0.4"/>
        {/* Stars above */}
        <path d="M20 16L22 12L24 16L20 14L24 14L20 16Z" fill="#F59E0B"/>
        <path d="M40 16L42 12L44 16L40 14L44 14L40 16Z" fill="#F59E0B"/>
        <path d="M30 10L32 6L34 10L30 8L34 8L30 10Z" fill="#FFFFFF"/>
      </svg>
    )
  }

  // ─── 47. ACTIVITIES ─────────────────────────────────────────────────────────
  if (last === 'activities') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`au_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#8B5CF6"/>
          </linearGradient>
        </defs>
        {/* Checklist */}
        <rect x="12" y="10" width="40" height="44" rx="7" fill="#080A20"/>
        {/* Header */}
        <rect x="12" y="10" width="40" height="10" rx="5" fill={`url(#au_${uid})`}/>
        {/* Check item 1 */}
        <circle cx="22" cy="30" r="5" fill={`url(#au_${uid})`}/>
        <path d="M19 30L21.5 32.5L26 27" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="30" y="28" width="16" height="3" rx="1.5" fill={`url(#au_${uid})`} fillOpacity="0.6"/>
        {/* Check item 2 */}
        <circle cx="22" cy="44" r="5" fill={`url(#au_${uid})`} fillOpacity="0.5"/>
        <rect x="30" y="42" width="12" height="3" rx="1.5" fill={`url(#au_${uid})`} fillOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 48. CAMPAIGNS ──────────────────────────────────────────────────────────
  if (last === 'campaigns') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`av_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#DB2777"/>
          </linearGradient>
        </defs>
        {/* Megaphone */}
        <path d="M10 26H24L48 12V52L24 38H10V26Z" fill={`url(#av_${uid})`}/>
        {/* Sound waves */}
        <path d="M52 22C56 26 56 38 52 42" stroke={`url(#av_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" strokeOpacity="0.8"/>
        <path d="M56 16C64 24 64 40 56 48" stroke={`url(#av_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.5"/>
        {/* Handle */}
        <rect x="10" y="38" width="6" height="14" rx="3" fill={`url(#av_${uid})`} fillOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 49. COMMUNICATE / WHATSAPP ─────────────────────────────────────────────
  if (['communicate', 'whatsapp'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`aw_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#15803D"/>
          </linearGradient>
        </defs>
        {/* Phone circle */}
        <circle cx="32" cy="30" r="22" fill={`url(#aw_${uid})`}/>
        {/* Phone icon */}
        <path d="M24 20C24 20 20 24 20 28C20 36 28 44 36 44C40 44 44 40 44 40L40 36L36 38C34 36 28 30 30 28L32 24L24 20Z" fill="#FFFFFF" fillOpacity="0.9"/>
        {/* Tail */}
        <path d="M22 50L26 40L18 48L22 50Z" fill={`url(#aw_${uid})`}/>
      </svg>
    )
  }

  // ─── 50. EMAIL ──────────────────────────────────────────────────────────────
  if (last === 'email' || last === 'newsletter' || last === 'mailbox') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ax_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#6D28D9"/>
          </linearGradient>
        </defs>
        {/* Paper airplane */}
        <path d="M8 30L56 12L36 54L26 38L8 30Z" fill={`url(#ax_${uid})`}/>
        <path d="M26 38L56 12L36 54L26 38Z" fill="#6D28D9" fillOpacity="0.6"/>
        <path d="M26 38L30 30L38 36L26 38Z" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ─── 51. PROFILE / COMPANY PROFILE ─────────────────────────────────────────
  if (last === 'profile') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ay_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#1D4ED8"/>
          </linearGradient>
        </defs>
        {/* Office building silhouette */}
        <rect x="14" y="20" width="36" height="40" rx="4" fill={`url(#ay_${uid})`}/>
        <path d="M10 22L32 8L54 22" fill={`url(#ay_${uid})`}/>
        {/* Windows */}
        <rect x="18" y="26" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="30" y="26" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="42" y="26" width="6" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="18" y="36" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="30" y="36" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="42" y="36" width="6" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.5"/>
        {/* Door */}
        <rect x="26" y="46" width="12" height="14" rx="2" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 52. SETTINGS ───────────────────────────────────────────────────────────
  if (last === 'settings') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`az_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#64748B"/><stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <linearGradient id={`az2_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94A3B8"/><stop offset="100%" stopColor="#64748B"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="20" fill={`url(#az_${uid})`}/>
        {/* Gear teeth */}
        {[0,45,90,135,180,225,270,315].map((deg, i) => {
          const rad = deg * Math.PI / 180
          const x = 32 + 22 * Math.sin(rad) - 3
          const y = 32 - 22 * Math.cos(rad) - 3
          return <rect key={i} x={x} y={y} width="6" height="6" rx="2" fill={`url(#az2_${uid})`} transform={`rotate(${deg} ${x+3} ${y+3})`}/>
        })}
        <circle cx="32" cy="32" r="10" fill={`url(#az2_${uid})`}/>
        <circle cx="32" cy="32" r="5" fill="#0A1018"/>
      </svg>
    )
  }

  // ─── 53. USERS ──────────────────────────────────────────────────────────────
  if (last === 'users') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ba_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#4C1D95"/>
          </linearGradient>
        </defs>
        {/* Main user */}
        <circle cx="26" cy="22" r="10" fill={`url(#ba_${uid})`}/>
        <path d="M8 50C8 40 16.1 32 26 32C30 32 33.7 33.4 36.6 35.8" stroke={`url(#ba_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        {/* Admin shield badge */}
        <circle cx="46" cy="44" r="14" fill="#1A0030"/>
        <path d="M46 32L56 36V44C56 50.6 51.5 55.6 46 57C40.5 55.6 36 50.6 36 44V36L46 32Z" fill={`url(#ba_${uid})`}/>
        {/* Star on shield */}
        <path d="M46 39L47.5 43H52L48.5 45.5L50 49.5L46 47L42 49.5L43.5 45.5L40 43H44.5L46 39Z" fill="#FFFFFF" fillOpacity="0.9"/>
      </svg>
    )
  }

  // ─── 54. BACKUP ─────────────────────────────────────────────────────────────
  if (last === 'backup') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bb_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#0284C7"/>
          </linearGradient>
        </defs>
        {/* Cloud */}
        <path d="M44 32C44 32 48 32 50 28C52 24 50 18 44 18C44 18 42 12 36 12C28 12 24 18 24 18C24 18 16 18 16 26C16 32 22 34 26 34H44C44 34 44 34 44 32Z" fill={`url(#bb_${uid})`}/>
        {/* Down arrow */}
        <path d="M32 38V54" stroke={`url(#bb_${uid})`} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M24 46L32 54L40 46" stroke={`url(#bb_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Base line */}
        <rect x="16" y="56" width="32" height="4" rx="2" fill={`url(#bb_${uid})`} fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 55. HIDDEN NAVBARS ─────────────────────────────────────────────────────
  if (last === 'hidden-navbars') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bc_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94A3B8"/><stop offset="100%" stopColor="#475569"/>
          </linearGradient>
        </defs>
        {/* Eye */}
        <path d="M8 32C8 32 18 14 32 14C46 14 56 32 56 32C56 32 46 50 32 50C18 50 8 32 8 32Z" fill={`url(#bc_${uid})`} fillOpacity="0.3"/>
        <path d="M8 32C8 32 18 14 32 14C46 14 56 32 56 32C56 32 46 50 32 50C18 50 8 32 8 32Z" stroke={`url(#bc_${uid})`} strokeWidth="2.5" fill="none"/>
        <circle cx="32" cy="32" r="8" fill={`url(#bc_${uid})`}/>
        {/* Slash */}
        <path d="M14 50L50 14" stroke="#EF4444" strokeWidth="4" strokeLinecap="round"/>
        <path d="M14 50L50 14" stroke="#1A0808" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.5"/>
        <line x1="16" y1="50" x2="50" y2="16" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    )
  }

  // ─── 56. IOT ────────────────────────────────────────────────────────────────
  if (last === 'iot') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bd_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#8B5CF6"/>
          </linearGradient>
        </defs>
        {/* Central hub */}
        <circle cx="32" cy="32" r="8" fill={`url(#bd_${uid})`}/>
        {/* Connected nodes */}
        <circle cx="12" cy="18" r="5" fill={`url(#bd_${uid})`} fillOpacity="0.7"/>
        <circle cx="52" cy="18" r="5" fill={`url(#bd_${uid})`} fillOpacity="0.7"/>
        <circle cx="12" cy="46" r="5" fill={`url(#bd_${uid})`} fillOpacity="0.7"/>
        <circle cx="52" cy="46" r="5" fill={`url(#bd_${uid})`} fillOpacity="0.7"/>
        <circle cx="32" cy="8" r="4" fill={`url(#bd_${uid})`} fillOpacity="0.5"/>
        <circle cx="32" cy="56" r="4" fill={`url(#bd_${uid})`} fillOpacity="0.5"/>
        {/* Connections */}
        <path d="M32 32L12 18M32 32L52 18M32 32L12 46M32 32L52 46M32 32L32 8M32 32L32 56" stroke={`url(#bd_${uid})`} strokeWidth="2" strokeOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 57. JOB COSTING / JOB CARDS / WORKSHOP ────────────────────────────────
  if (['job-costing', 'job-cards', 'workshop'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`be_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#92400E"/>
          </linearGradient>
        </defs>
        {/* Wrench */}
        <path d="M44 8C38 8 34 13 34 18C34 20 34.7 21.7 36 23L14 45C12 47 12 50 14 52C16 54 19 54 21 52L43 30C44.3 31.3 46 32 48 32C53 32 58 28 58 22C58 20 57.4 18.3 56.3 17L50 23L45 18L51 12C49.5 9.5 46.9 8 44 8Z" fill={`url(#be_${uid})`}/>
        {/* Screwdriver crossed */}
        <path d="M8 12L20 24M16 8L28 20" stroke={`url(#be_${uid})`} strokeWidth="5" strokeLinecap="round"/>
        <rect x="6" y="8" width="8" height="6" rx="2" transform="rotate(-45 6 8)" fill={`url(#be_${uid})`}/>
      </svg>
    )
  }

  // ─── 58. MAINTENANCE / MAINTENANCE-ALERTS / SERVICE-HISTORY ─────────────────
  if (['maintenance', 'maintenance-alerts', 'service-history', 'damage-matrix'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bf_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#F97316"/>
          </linearGradient>
        </defs>
        {/* Alert hexagon */}
        <path d="M32 6L54 20V44L32 58L10 44V20L32 6Z" fill="#200808"/>
        <path d="M32 6L54 20V44L32 58L10 44V20L32 6Z" stroke={`url(#bf_${uid})`} strokeWidth="2.5" fill="none"/>
        {/* Warning symbol */}
        <path d="M32 18L32 38" stroke={`url(#bf_${uid})`} strokeWidth="5" strokeLinecap="round"/>
        <circle cx="32" cy="48" r="4" fill={`url(#bf_${uid})`}/>
      </svg>
    )
  }

  // ─── 59. MRP / MANUFACTURING ────────────────────────────────────────────────
  if (['mrp', 'manufacturing'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#0D9488"/>
          </linearGradient>
        </defs>
        {/* Factory */}
        <rect x="6" y="30" width="52" height="26" rx="3" fill="#080A20"/>
        <path d="M6 30V18L18 26V18L30 26V18L42 26V30" fill="#080A20" stroke={`url(#bg_${uid})`} strokeWidth="2.5" strokeLinejoin="round"/>
        <rect x="42" y="20" width="16" height="36" rx="3" fill={`url(#bg_${uid})`} fillOpacity="0.5"/>
        {/* Chimneys */}
        <rect x="44" y="12" width="5" height="12" rx="2" fill={`url(#bg_${uid})`}/>
        <rect x="53" y="14" width="4" height="10" rx="2" fill={`url(#bg_${uid})`} fillOpacity="0.7"/>
        {/* Smoke */}
        <path d="M46 10C46 10 48 8 46 6" stroke={`url(#bg_${uid})`} strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.5"/>
        {/* Windows */}
        <rect x="10" y="34" width="8" height="6" rx="1.5" fill={`url(#bg_${uid})`} fillOpacity="0.5"/>
        <rect x="22" y="34" width="8" height="6" rx="1.5" fill={`url(#bg_${uid})`} fillOpacity="0.5"/>
        <rect x="34" y="34" width="4" height="6" rx="1.5" fill={`url(#bg_${uid})`} fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 60. FLEET / VEHICLES / CARS ────────────────────────────────────────────
  if (['fleet', 'vehicles', 'all-cars', 'active'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bh_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#1D4ED8"/>
          </linearGradient>
        </defs>
        {/* Car body */}
        <path d="M10 36L16 24H48L54 36V44H10V36Z" fill={`url(#bh_${uid})`}/>
        {/* Roof */}
        <path d="M20 24L26 14H38L44 24" fill={`url(#bh_${uid})`} fillOpacity="0.7"/>
        {/* Windshields */}
        <path d="M22 24L26 16H38L42 24" fill="#00E5FF" fillOpacity="0.7"/>
        {/* Wheels */}
        <circle cx="20" cy="46" r="8" fill="#0A1018"/>
        <circle cx="20" cy="46" r="5" fill="#1E40AF"/>
        <circle cx="20" cy="46" r="2" fill="#FFFFFF" fillOpacity="0.5"/>
        <circle cx="44" cy="46" r="8" fill="#0A1018"/>
        <circle cx="44" cy="46" r="5" fill="#1E40AF"/>
        <circle cx="44" cy="46" r="2" fill="#FFFFFF" fillOpacity="0.5"/>
        {/* Door line */}
        <line x1="32" y1="24" x2="32" y2="44" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3"/>
      </svg>
    )
  }

  // ─── 61. ECOMMERCE / ONLINE STORE ───────────────────────────────────────────
  if (last === 'ecommerce' || second === 'ecommerce') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bi_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#DC2626"/>
          </linearGradient>
        </defs>
        {/* Shopping bag */}
        <path d="M14 22H50L46 54H18L14 22Z" fill={`url(#bi_${uid})`}/>
        {/* Handle */}
        <path d="M24 22C24 16 28 12 32 12C36 12 40 16 40 22" stroke={`url(#bi_${uid})`} strokeWidth="4" strokeLinecap="round" fill="none"/>
        {/* Store logo on bag */}
        <circle cx="32" cy="38" r="8" fill="#FFFFFF" fillOpacity="0.2"/>
        <path d="M28 38L31 41L36 35" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Ribbon */}
        <rect x="14" y="30" width="36" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.2"/>
      </svg>
    )
  }

  // ─── 62. VAT/COMPLIANCE/GOV/ZATCA ───────────────────────────────────────────
  if (['vat-returns', 'zatca-logs', 'zatca', 'government-integrations', 'saudi-compliance'].includes(last) || second === 'government-integrations') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bj_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#15803D"/>
          </linearGradient>
        </defs>
        {/* Shield */}
        <path d="M32 6L54 16V34C54 46 44 56 32 58C20 56 10 46 10 34V16L32 6Z" fill={`url(#bj_${uid})`} fillOpacity="0.15"/>
        <path d="M32 6L54 16V34C54 46 44 56 32 58C20 56 10 46 10 34V16L32 6Z" stroke={`url(#bj_${uid})`} strokeWidth="2.5" fill="none"/>
        {/* Checkmark */}
        <path d="M20 34L28 42L44 26" stroke={`url(#bj_${uid})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // ─── 63. KHAYYAT / TAILORING ────────────────────────────────────────────────
  if (second === 'khayyat' || last === 'khayyat') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bk_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#9D174D"/>
          </linearGradient>
        </defs>
        {/* Sewing machine / needle + thread */}
        {/* Needle */}
        <path d="M42 10L42 36" stroke={`url(#bk_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <ellipse cx="42" cy="38" rx="3" ry="5" fill={`url(#bk_${uid})`}/>
        {/* Thread spool */}
        <rect x="8" y="28" width="24" height="16" rx="5" fill={`url(#bk_${uid})`} fillOpacity="0.8"/>
        <rect x="10" y="32" width="20" height="8" rx="3" fill={`url(#bk_${uid})`} fillOpacity="0.5"/>
        {/* Thread line to needle */}
        <path d="M32 36C36 36 38 36 42 36" stroke={`url(#bk_${uid})`} strokeWidth="2" strokeDasharray="3 2"/>
        {/* Needle eye hole */}
        <ellipse cx="42" cy="36" rx="1.5" ry="2.5" fill="#1A0020"/>
        {/* Fabric lines at bottom */}
        <path d="M8 50H56" stroke={`url(#bk_${uid})`} strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round"/>
        <path d="M8 56H56" stroke={`url(#bk_${uid})`} strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeOpacity="0.6"/>
      </svg>
    )
  }

  // ─── 64. LAUNDRY ────────────────────────────────────────────────────────────
  if (second === 'laundry' || last === 'laundry') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bl_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8"/><stop offset="100%" stopColor="#0284C7"/>
          </linearGradient>
        </defs>
        {/* Washing machine body */}
        <rect x="8" y="10" width="48" height="50" rx="8" fill="#0A1828"/>
        <rect x="8" y="10" width="48" height="12" rx="6" fill={`url(#bl_${uid})`}/>
        {/* Control dots */}
        <circle cx="18" cy="16" r="3" fill="#FFFFFF" fillOpacity="0.8"/>
        <circle cx="27" cy="16" r="3" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="36" y="13" width="14" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.3"/>
        {/* Drum circle */}
        <circle cx="32" cy="38" r="18" fill="none" stroke={`url(#bl_${uid})`} strokeWidth="3"/>
        <circle cx="32" cy="38" r="12" fill={`url(#bl_${uid})`} fillOpacity="0.15"/>
        <circle cx="32" cy="38" r="6" fill={`url(#bl_${uid})`} fillOpacity="0.3"/>
        {/* Drum holes */}
        <circle cx="26" cy="32" r="2" fill={`url(#bl_${uid})`} fillOpacity="0.5"/>
        <circle cx="38" cy="32" r="2" fill={`url(#bl_${uid})`} fillOpacity="0.5"/>
        <circle cx="26" cy="44" r="2" fill={`url(#bl_${uid})`} fillOpacity="0.5"/>
        <circle cx="38" cy="44" r="2" fill={`url(#bl_${uid})`} fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 65. SALOON / BARBERSHOP ────────────────────────────────────────────────
  if (second === 'saloon' || last === 'saloon') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bm_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#7C3AED"/>
          </linearGradient>
        </defs>
        {/* Barber pole */}
        <rect x="26" y="6" width="12" height="52" rx="6" fill="#0A0820"/>
        <path d="M26 12L38 18L26 24L38 30L26 36L38 42L26 48L38 54" stroke="#EF4444" strokeWidth="5" strokeLinecap="round"/>
        <path d="M38 12L26 18L38 24L26 30L38 36L26 42L38 48" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round"/>
        <path d="M26 12L38 18L26 24L38 30L26 36L38 42L26 48L38 54" stroke={`url(#bm_${uid})`} strokeWidth="2" strokeLinecap="round"/>
        {/* Top cap */}
        <ellipse cx="32" cy="6" rx="7" ry="3" fill={`url(#bm_${uid})`}/>
        <ellipse cx="32" cy="58" rx="7" ry="3" fill={`url(#bm_${uid})`}/>
      </svg>
    )
  }

  // ─── 66. BOUTIQUE / DRESSES ─────────────────────────────────────────────────
  if (second === 'boutique' || last === 'boutique' || last === 'dresses') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bn_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#BE185D"/>
          </linearGradient>
        </defs>
        {/* Dress silhouette */}
        <path d="M26 8H38L44 20C44 20 40 24 40 28L52 56H12L24 28C24 24 20 20 20 20L26 8Z" fill={`url(#bn_${uid})`}/>
        {/* Neckline */}
        <path d="M26 8C28 12 36 12 38 8" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.5"/>
        {/* Waistline */}
        <path d="M22 32C26 30 38 30 42 32" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.5"/>
        {/* Sparkles */}
        <circle cx="46" cy="14" r="2.5" fill="#FFD700"/>
        <circle cx="50" cy="8" r="1.5" fill="#FFD700" fillOpacity="0.7"/>
        <circle cx="52" cy="18" r="1.5" fill="#FFD700" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ─── 67. BOOKSTORE / BOOKS ──────────────────────────────────────────────────
  if (second === 'bookstore' || last === 'bookstore') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bo_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="50%" stopColor="#EC4899"/><stop offset="100%" stopColor="#F97316"/>
          </linearGradient>
        </defs>
        {/* 3 stacked books */}
        <rect x="10" y="38" width="44" height="14" rx="4" fill={`url(#bo_${uid})`}/>
        <rect x="8" y="38" width="6" height="14" rx="3" fill="#6D28D9"/>
        <rect x="14" y="26" width="38" height="14" rx="4" fill={`url(#bo_${uid})`} fillOpacity="0.8"/>
        <rect x="12" y="26" width="6" height="14" rx="3" fill="#EC4899"/>
        <rect x="16" y="14" width="34" height="14" rx="4" fill={`url(#bo_${uid})`} fillOpacity="0.6"/>
        <rect x="14" y="14" width="6" height="14" rx="3" fill="#F97316"/>
        {/* Page lines */}
        <rect x="26" y="40" width="24" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="26" y="44" width="18" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ─── 68. BAKALA / GROCERY ───────────────────────────────────────────────────
  if (second === 'bakala' || last === 'bakala') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bp_${uid}`} x1="8" y1="24" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        {/* Shopping basket */}
        <path d="M14 34H50L46 54H18L14 34Z" fill={`url(#bp_${uid})`}/>
        <rect x="12" y="30" width="40" height="6" rx="3" fill={`url(#bp_${uid})`}/>
        {/* Handle */}
        <path d="M22 30C22 22 42 22 42 30" stroke={`url(#bp_${uid})`} strokeWidth="4" strokeLinecap="round" fill="none"/>
        {/* Basket weave lines */}
        <line x1="28" y1="34" x2="28" y2="54" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3"/>
        <line x1="36" y1="34" x2="36" y2="54" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3"/>
        <line x1="14" y1="44" x2="50" y2="44" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3"/>
        {/* Produce on top */}
        <circle cx="24" cy="28" r="5" fill="#EF4444"/>
        <circle cx="32" cy="26" r="5" fill="#22C55E"/>
        <circle cx="40" cy="28" r="5" fill="#F59E0B"/>
      </svg>
    )
  }

  // ─── 69. TRAVEL / TRAVEL BOOKINGS ───────────────────────────────────────────
  if (second === 'travel' || last === 'travel-bookings') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bq_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#8B5CF6"/>
          </linearGradient>
        </defs>
        {/* Airplane */}
        <path d="M32 8C32 8 26 14 14 24L20 26L10 38L18 36L20 42L36 30C40 36 44 44 44 52C50 46 54 38 54 30C54 18 44 8 32 8Z" fill={`url(#bq_${uid})`}/>
        {/* Wing detail */}
        <path d="M20 26L36 30" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.4"/>
        {/* Contrail */}
        <path d="M10 38L6 50" stroke={`url(#bq_${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5"/>
        <path d="M18 36L14 48" stroke={`url(#bq_${uid})`} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35"/>
      </svg>
    )
  }

  // ─── 70. CAR RENTAL ─────────────────────────────────────────────────────────
  if (second === 'rental' || (last === 'checkout' && second === 'rental')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`br_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        {/* Key */}
        <circle cx="22" cy="26" r="14" fill="none" stroke={`url(#br_${uid})`} strokeWidth="5"/>
        <circle cx="22" cy="26" r="6" fill={`url(#br_${uid})`} fillOpacity="0.5"/>
        <path d="M32 32L52 52" stroke={`url(#br_${uid})`} strokeWidth="5" strokeLinecap="round"/>
        <path d="M44 44L48 40" stroke={`url(#br_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <path d="M50 50L54 46" stroke={`url(#br_${uid})`} strokeWidth="4" strokeLinecap="round"/>
      </svg>
    )
  }

  // ─── 71. FURNITURE ──────────────────────────────────────────────────────────
  if (second === 'furniture' || last === 'furniture') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bs_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9"/><stop offset="100%" stopColor="#0369A1"/>
          </linearGradient>
        </defs>
        {/* Sofa */}
        {/* Main cushion */}
        <rect x="16" y="28" width="32" height="18" rx="8" fill={`url(#bs_${uid})`}/>
        {/* Arms */}
        <rect x="8" y="28" width="10" height="18" rx="5" fill={`url(#bs_${uid})`} fillOpacity="0.8"/>
        <rect x="46" y="28" width="10" height="18" rx="5" fill={`url(#bs_${uid})`} fillOpacity="0.8"/>
        {/* Back */}
        <rect x="10" y="18" width="44" height="14" rx="6" fill={`url(#bs_${uid})`} fillOpacity="0.7"/>
        {/* Cushion divider */}
        <rect x="30" y="28" width="3" height="18" rx="1.5" fill="#FFFFFF" fillOpacity="0.2"/>
        {/* Legs */}
        <rect x="14" y="46" width="6" height="10" rx="3" fill="#0369A1"/>
        <rect x="44" y="46" width="6" height="10" rx="3" fill="#0369A1"/>
      </svg>
    )
  }

  // ─── FALLBACK: Unique-per-path colored crystal ───────────────────────────────
  const hash = (path + label).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const shapes = [
    // Pentagon
    ([c1,c2]) => <path d={`M32 8L54 24L46 50H18L10 24L32 8Z`} fill={`url(#fc_${uid})`}/>,
    // Octagon  
    ([c1,c2]) => <path d={`M22 8H42L56 22V42L42 56H22L8 42V22L22 8Z`} fill={`url(#fc_${uid})`}/>,
    // Star
    ([c1,c2]) => <path d={`M32 6L37 22H54L40 32L45 48L32 38L19 48L24 32L10 22H27L32 6Z`} fill={`url(#fc_${uid})`}/>,
    // Diamond
    ([c1,c2]) => <path d={`M32 6L56 32L32 58L8 32L32 6Z`} fill={`url(#fc_${uid})`}/>,
    // Circle
    ([c1,c2]) => <circle cx="32" cy="32" r="24" fill={`url(#fc_${uid})`}/>,
  ]
  const palettes = [
    ['#FF0844','#FFB199'],['#00E5FF','#7F00FF'],['#FF8008','#FFC837'],
    ['#10B981','#0D9488'],['#FF61D2','#FE0979'],['#4facfe','#00f2fe'],
    ['#F9D423','#FF4E50'],['#654EA3','#EAAFC8'],['#00F2FE','#4FACFE'],
    ['#FF512F','#DD2476'],['#43e97b','#38f9d7'],['#fa709a','#fee140'],
    ['#a18cd1','#fbc2eb'],['#fccb90','#d57eeb'],['#a1c4fd','#c2e9fb'],
  ]
  const [c1, c2] = palettes[hash % palettes.length]
  const ShapeComp = shapes[hash % shapes.length]

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`fc_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/>
        </linearGradient>
        <linearGradient id={`fc2_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c2}/><stop offset="100%" stopColor={c1}/>
        </linearGradient>
      </defs>
      {ShapeComp([c1,c2])}
      <circle cx="32" cy="32" r="6" fill="#FFFFFF" fillOpacity="0.6"/>
      <circle cx="22" cy="22" r="4" fill="#FFFFFF" fillOpacity="0.2"/>
    </svg>
  )
}

export default App3DIcon
