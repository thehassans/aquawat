import React from 'react'

/**
 * Ultra-professional 3D SVG icons — one unique icon per app path.
 * Matching is done on path segments so /app/dashboard/foo matches "foo",
 * not every path that contains "dashboard".
 */
export function App3DIcon({ path = '', label = '', className = 'w-11 h-11 sm:w-12 sm:h-12' }) {
  const uid = React.useId().replace(/:/g, '')
  // Extract last meaningful segment(s)
  const segments = (path || '').toLowerCase().split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  const secondLast = segments[segments.length - 2] || ''
  const l = (label || '').toLowerCase()

  // ─── HELPER: full-icon shorthand ────────────────────────────────────────────
  const G = (id, stops) => (
    <linearGradient key={id} id={id} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </linearGradient>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // POS / CHECKOUT  →  Red-white striped awning + teal counter
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'pos' || last === 'checkout' || (secondLast === 'bakala' && last === 'pos') || (secondLast === 'bookstore' && last === 'pos')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`r_${uid}`} x1="8" y1="14" x2="56" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <path d="M10 16H54L50 36C50 40 46 42 43 38C40 42 36 42 33 38C30 42 26 42 23 38C20 42 16 42 14 36L10 16Z" fill="#3A0007"/>
        <path d="M10 16L15 36C16.5 39.5 20 39.5 21.5 36L20 16H10Z" fill={`url(#r_${uid})`}/>
        <path d="M20 16L21.5 36C23 39.5 26.5 39.5 28 36L27.5 16H20Z" fill="#F5F5F5"/>
        <path d="M27.5 16L28 36C29.5 39.5 33 39.5 34.5 36L35 16H27.5Z" fill={`url(#r_${uid})`}/>
        <path d="M35 16L34.5 36C36 39.5 39.5 39.5 41 36L42.5 16H35Z" fill="#F5F5F5"/>
        <path d="M42.5 16L41 36C42.5 39.5 46 39.5 47.5 36L54 16H42.5Z" fill={`url(#r_${uid})`}/>
        <rect x="14" y="42" width="36" height="8" rx="4" fill="#2A2C34"/>
        <rect x="22" y="44" width="20" height="4" rx="2" fill="#00E5FF"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MENU ITEMS / FOOD CATALOG  →  Gold 3-D serving cloche
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'menu-items' || last === 'catalog' || last === 'mess' || l.includes('menu items') || l.includes('mess')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`g_${uid}`} x1="8" y1="14" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="18" r="5" fill={`url(#g_${uid})`}/>
        <path d="M13 38C13 25.85 21.508 20 32 20C42.492 20 51 25.85 51 38H13Z" fill={`url(#g_${uid})`}/>
        <rect x="10" y="40" width="44" height="7" rx="3.5" fill="#202228"/>
        <rect x="12" y="40" width="40" height="3" rx="1.5" fill="#FF4E50"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TABLES  →  Cyan 3-D isometric grid table top
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'tables' || l.includes('tables') || l.includes('طاولات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`t1_${uid}`} x1="8" y1="10" x2="56" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
          <linearGradient id={`t2_${uid}`} x1="8" y1="28" x2="56" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0052D4"/><stop offset="100%" stopColor="#4364F7"/>
          </linearGradient>
        </defs>
        {/* Tabletop face */}
        <path d="M32 10L56 22L32 34L8 22L32 10Z" fill={`url(#t1_${uid})`}/>
        {/* Left leg panel */}
        <path d="M8 22L8 40L14 44L14 26L8 22Z" fill={`url(#t2_${uid})`}/>
        {/* Right leg panel */}
        <path d="M56 22L56 40L50 44L50 26L56 22Z" fill="#0041A8"/>
        {/* Under face */}
        <path d="M14 26L14 44L50 44L50 26L32 34L14 26Z" fill={`url(#t2_${uid})`}/>
        <ellipse cx="32" cy="16" rx="6" ry="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INVENTORY / PRODUCTS / WAREHOUSE / STOCK  →  Orange 3-D isometric cube
  // ════════════════════════════════════════════════════════════════════════════
  if (['inventory', 'products', 'warehouses', 'warehouse', 'stock', 'items', 'boxes', 'produce'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ct_${uid}`} x1="16" y1="10" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008"/><stop offset="100%" stopColor="#FFC837"/>
          </linearGradient>
          <linearGradient id={`cl_${uid}`} x1="8" y1="28" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#C3073F"/>
          </linearGradient>
          <linearGradient id={`cr_${uid}`} x1="32" y1="28" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF4E50"/><stop offset="100%" stopColor="#F9D423"/>
          </linearGradient>
        </defs>
        <path d="M32 10L50 20L32 30L14 20L32 10Z" fill={`url(#ct_${uid})`}/>
        <path d="M14 20L32 30V50L14 40V20Z" fill={`url(#cl_${uid})`}/>
        <path d="M32 30L50 20V40L32 50V30Z" fill={`url(#cr_${uid})`}/>
        <ellipse cx="32" cy="14" rx="5" ry="2" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ORDERS / RECEIPTS / RETURNS / PURCHASE-RETURNS  →  Purple stacked receipts
  // ════════════════════════════════════════════════════════════════════════════
  if (['orders', 'order', 'returns', 'purchase-returns', 'receipts', 'grn'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`rc1_${uid}`} x1="8" y1="12" x2="40" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
          <linearGradient id={`rc2_${uid}`} x1="16" y1="8" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F"/><stop offset="100%" stopColor="#DD2476"/>
          </linearGradient>
        </defs>
        <rect x="14" y="20" width="28" height="36" rx="5" transform="rotate(-10 14 20)" fill={`url(#rc1_${uid})`}/>
        <rect x="20" y="14" width="28" height="36" rx="5" fill={`url(#rc2_${uid})`}/>
        <rect x="26" y="22" width="16" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="26" y="28" width="12" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="26" y="34" width="14" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CASHIER PANEL / MONITOR / KDS BOARD  →  Glowing screen monitor
  // ════════════════════════════════════════════════════════════════════════════
  if (['cashier', 'kds', 'monitor', 'queue', 'kanban'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mon_${uid}`} x1="8" y1="12" x2="56" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4facfe"/><stop offset="100%" stopColor="#00f2fe"/>
          </linearGradient>
        </defs>
        <rect x="8" y="12" width="48" height="32" rx="6" fill="#1A1A2E"/>
        <rect x="12" y="16" width="40" height="24" rx="4" fill={`url(#mon_${uid})`} fillOpacity="0.9"/>
        {/* Screen glare */}
        <path d="M14 18L20 18L14 26Z" fill="#FFFFFF" fillOpacity="0.25"/>
        {/* Stand */}
        <rect x="28" y="44" width="8" height="8" rx="2" fill="#2A2C34"/>
        <rect x="22" y="52" width="20" height="4" rx="2" fill="#2A2C34"/>
        {/* Screen UI lines */}
        <rect x="18" y="24" width="28" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6"/>
        <rect x="18" y="30" width="20" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KITCHEN  →  Chef hat (orange/cream)
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'kitchen') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ch_${uid}`} x1="8" y1="10" x2="56" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFECD2"/><stop offset="100%" stopColor="#FCB69F"/>
          </linearGradient>
        </defs>
        {/* Brim */}
        <rect x="16" y="40" width="32" height="10" rx="5" fill={`url(#ch_${uid})`}/>
        {/* Puff */}
        <path d="M24 40C24 40 20 30 26 22C26 22 30 14 40 20C40 20 48 24 46 34C46 34 46 40 38 40H26C26 40 24 40 24 40Z" fill={`url(#ch_${uid})`}/>
        {/* Stripe on brim */}
        <rect x="16" y="40" width="32" height="3" rx="1.5" fill="#FF8C00" fillOpacity="0.5"/>
        {/* Highlight */}
        <ellipse cx="36" cy="26" rx="4" ry="3" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BRANCHES  →  Teal multi-building cityscape
  // ════════════════════════════════════════════════════════════════════════════
  if (['branches', 'branch'].includes(last) || l.includes('فروع') || l.includes('branches')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`b1_${uid}`} x1="8" y1="10" x2="28" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF"/><stop offset="100%" stopColor="#0D9488"/>
          </linearGradient>
          <linearGradient id={`b2_${uid}`} x1="24" y1="18" x2="40" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/>
          </linearGradient>
          <linearGradient id={`b3_${uid}`} x1="38" y1="24" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B"/><stop offset="100%" stopColor="#96C93D"/>
          </linearGradient>
        </defs>
        <rect x="8" y="28" width="16" height="28" rx="3" fill={`url(#b1_${uid})`}/>
        <rect x="24" y="18" width="16" height="38" rx="3" fill={`url(#b2_${uid})`}/>
        <rect x="40" y="24" width="16" height="32" rx="3" fill={`url(#b3_${uid})`}/>
        {/* Windows */}
        <rect x="11" y="32" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="11" y="40" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="27" y="22" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="27" y="30" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="43" y="28" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="43" y="36" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QR MENU / QR CODE  →  QR code squares
  // ════════════════════════════════════════════════════════════════════════════
  if (['qr-menu', 'qr', 'qrcode'].includes(last) || l.includes('qr') || l.includes('باركود')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`qr_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="18" height="18" rx="3" fill={`url(#qr_${uid})`}/>
        <rect x="14" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="36" y="10" width="18" height="18" rx="3" fill={`url(#qr_${uid})`}/>
        <rect x="40" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="10" y="36" width="18" height="18" rx="3" fill={`url(#qr_${uid})`}/>
        <rect x="14" y="40" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.9"/>
        <rect x="36" y="36" width="7" height="7" rx="1.5" fill={`url(#qr_${uid})`}/>
        <rect x="47" y="36" width="7" height="7" rx="1.5" fill={`url(#qr_${uid})`}/>
        <rect x="36" y="47" width="7" height="7" rx="1.5" fill={`url(#qr_${uid})`}/>
        <rect x="47" y="47" width="7" height="7" rx="1.5" fill={`url(#qr_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RESERVATIONS / CALENDAR / APPOINTMENTS  →  Red calendar with 31
  // ════════════════════════════════════════════════════════════════════════════
  if (['reservations', 'reservation', 'appointments', 'appointment', 'calendar', 'rental-calendar'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cr_${uid}`} x1="8" y1="12" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF416C"/><stop offset="100%" stopColor="#FF4B2B"/>
          </linearGradient>
          <linearGradient id={`cg_${uid}`} x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="40" rx="10" fill="#202228"/>
        <rect x="10" y="14" width="44" height="14" rx="8" fill={`url(#cr_${uid})`}/>
        <rect x="18" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF"/>
        <rect x="41" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF"/>
        <text x="32" y="44" fill={`url(#cg_${uid})`} fontSize="20" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle">31</text>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMBOS & DEALS / TAG / PROMOTIONS / COUPONS  →  Gold 3D tag ribbon
  // ════════════════════════════════════════════════════════════════════════════
  if (['combos', 'deals', 'promotions', 'coupons', 'loyalty', 'gift-cards', 'bundles'].includes(last) || l.includes('عروض') || l.includes('كوبون') || l.includes('هدايا')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`tg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <path d="M14 14H36C37.7 14 39 14.7 40 16L52 32L40 48C39 49.3 37.7 50 36 50H14C11.8 50 10 48.2 10 46V18C10 15.8 11.8 14 14 14Z" fill={`url(#tg_${uid})`}/>
        <circle cx="22" cy="26" r="4" fill="#FFFFFF" fillOpacity="0.9"/>
        <circle cx="22" cy="26" r="2" fill="#FF0844"/>
        <path d="M30 30L46 46" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.6"/>
        <path d="M30 38L40 48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ANALYTICS / REPORTS / PNL / BESTSELLERS  →  Ascending bar chart
  // ════════════════════════════════════════════════════════════════════════════
  if (['analytics', 'reports', 'pnl', 'bestsellers', 'report', 'sales-report', 'profit-margins'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`b1a_${uid}`} x1="12" y1="36" x2="22" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F"/><stop offset="100%" stopColor="#DD2476"/>
          </linearGradient>
          <linearGradient id={`b2a_${uid}`} x1="26" y1="22" x2="38" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F09819"/><stop offset="100%" stopColor="#EDDE5D"/>
          </linearGradient>
          <linearGradient id={`b3a_${uid}`} x1="42" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
        </defs>
        <rect x="12" y="32" width="10" height="22" rx="5" fill={`url(#b1a_${uid})`}/>
        <rect x="27" y="20" width="10" height="34" rx="5" fill={`url(#b2a_${uid})`}/>
        <rect x="42" y="10" width="10" height="44" rx="5" fill={`url(#b3a_${uid})`}/>
        <ellipse cx="17" cy="35" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.55"/>
        <ellipse cx="32" cy="23" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.55"/>
        <ellipse cx="47" cy="13" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.55"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DELIVERY PLATFORMS / SHIPMENTS / COURIERS / TRUCKS / DELIVERY NOTES / GRN
  // ════════════════════════════════════════════════════════════════════════════
  if (['delivery', 'shipments', 'shipment', 'couriers', 'delivery-notes', 'grn', 'routes'].includes(last) || l.includes('توصيل') || l.includes('شحنات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`tr_${uid}`} x1="8" y1="18" x2="56" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F9D423"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        {/* Truck body */}
        <rect x="8" y="22" width="32" height="22" rx="4" fill={`url(#tr_${uid})`}/>
        {/* Cab */}
        <path d="M40 30L40 44L56 44L56 34L50 28L40 28L40 30Z" fill="#FF4E50"/>
        {/* Windshield */}
        <path d="M42 30L42 34L54 34L54 34L50 30L42 30Z" fill="#00E5FF" fillOpacity="0.8"/>
        {/* Wheels */}
        <circle cx="20" cy="46" r="5" fill="#202228"/>
        <circle cx="20" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.4"/>
        <circle cx="48" cy="46" r="5" fill="#202228"/>
        <circle cx="48" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD (root only)  →  4 Colorful tiles
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'dashboard' || path === '/app/dashboard' || l === 'dashboard' || l === 'لوحة التحكم' || l === 'insights') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`d1_${uid}`} x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
          <linearGradient id={`d2_${uid}`} x1="34" y1="12" x2="52" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
          <linearGradient id={`d3_${uid}`} x1="12" y1="34" x2="28" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F857A6"/><stop offset="100%" stopColor="#FF5858"/>
          </linearGradient>
          <linearGradient id={`d4_${uid}`} x1="34" y1="30" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB300"/><stop offset="100%" stopColor="#F77737"/>
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="16" height="16" rx="6" fill={`url(#d1_${uid})`}/>
        <rect x="34" y="12" width="18" height="12" rx="5" fill={`url(#d2_${uid})`}/>
        <rect x="12" y="34" width="16" height="18" rx="6" fill={`url(#d3_${uid})`}/>
        <rect x="34" y="29" width="18" height="23" rx="7" fill={`url(#d4_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INVOICES / BILLS  →  Purple lightning bolt on dark hexagon
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'invoices' || last === 'bills') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`inv_${uid}`} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
        </defs>
        <path d="M32 6L56 20V44L32 58L8 44V20L32 6Z" fill="#1A0030"/>
        <path d="M38 10L22 30H34L28 54L48 32H36L38 10Z" fill={`url(#inv_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOMERS / MEMBERS / CONTACTS  →  Gold ID card with face silhouette
  // ════════════════════════════════════════════════════════════════════════════
  if (['customers', 'contacts', 'members', 'registry', 'khata'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`card_${uid}`} x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008"/><stop offset="100%" stopColor="#FFC837"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="36" rx="10" fill={`url(#card_${uid})`}/>
        {/* Photo area */}
        <rect x="16" y="20" width="16" height="18" rx="6" fill="#FFFFFF" fillOpacity="0.3"/>
        <circle cx="24" cy="27" r="5" fill="#FFFFFF" fillOpacity="0.8"/>
        <path d="M16 38C16 33.5 19.6 31 24 31C28.4 31 32 33.5 32 38H16Z" fill="#FFFFFF" fillOpacity="0.8"/>
        {/* Info lines */}
        <rect x="36" y="22" width="14" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="36" y="28" width="10" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.5"/>
        <rect x="36" y="34" width="12" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.5"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOMER STATEMENT  →  Cyan scroll with lines
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'statement') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`st_${uid}`} x1="8" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
        </defs>
        <rect x="14" y="10" width="36" height="44" rx="8" fill="#131824"/>
        <rect x="14" y="10" width="36" height="10" rx="5" fill={`url(#st_${uid})`}/>
        <rect x="20" y="28" width="24" height="3" rx="1.5" fill={`url(#st_${uid})`}/>
        <rect x="20" y="35" width="18" height="3" rx="1.5" fill={`url(#st_${uid})`} fillOpacity="0.7"/>
        <rect x="20" y="42" width="22" height="3" rx="1.5" fill={`url(#st_${uid})`} fillOpacity="0.5"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QUOTATIONS / LETTERHEAD / NOTES  →  Cyan notepad + red pen
  // ════════════════════════════════════════════════════════════════════════════
  if (['quotations', 'letterhead', 'notes', 'forms'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`np_${uid}`} x1="10" y1="10" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
          <linearGradient id={`pen_${uid}`} x1="22" y1="44" x2="52" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FFB199"/>
          </linearGradient>
        </defs>
        <path d="M12 14C12 10.686 14.686 8 18 8H36L48 20V48C48 51.314 45.314 54 42 54H18C14.686 54 12 51.314 12 48V14Z" fill={`url(#np_${uid})`}/>
        <path d="M36 8V20C36 21.1 36.9 22 38 22H48L36 8Z" fill="#0072FF" fillOpacity="0.45"/>
        <path d="M22 48L24 40L44 20L50 26L30 46L22 48Z" fill={`url(#pen_${uid})`}/>
        <circle cx="51" cy="17" r="4" fill="#FF2E93"/>
        <path d="M22 48L26 46L24 44L22 48Z" fill="#202228"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDERS / ORDERS (main)  →  Cyan-Purple-Green layered wallets
  // ════════════════════════════════════════════════════════════════════════════
  if (['purchase-orders', 'auto-reorder'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`p1_${uid}`} x1="8" y1="14" x2="56" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
          <linearGradient id={`p2_${uid}`} x1="8" y1="28" x2="56" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
          <linearGradient id={`p3_${uid}`} x1="8" y1="42" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="11" rx="4" fill={`url(#p1_${uid})`}/>
        <rect x="10" y="28" width="44" height="13" rx="4" fill={`url(#p2_${uid})`}/>
        <rect x="10" y="44" width="44" height="9" rx="4" fill={`url(#p3_${uid})`}/>
        <circle cx="54" cy="19" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
        <circle cx="54" cy="34" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
        <circle cx="54" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUPPLIERS / SUPPLIER-PERFORMANCE  →  Teal handshake-like hexagons
  // ════════════════════════════════════════════════════════════════════════════
  if (['suppliers', 'supplier-performance'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sp_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF"/><stop offset="100%" stopColor="#0D9488"/>
          </linearGradient>
        </defs>
        <path d="M22 8L36 8L42 20L36 32H22L16 20L22 8Z" fill={`url(#sp_${uid})`}/>
        <path d="M28 32L42 32L48 44L42 56H28L22 44L28 32Z" fill={`url(#sp_${uid})`} fillOpacity="0.7"/>
        <ellipse cx="29" cy="16" rx="4" ry="2" fill="#FFFFFF" fillOpacity="0.4"/>
        <ellipse cx="35" cy="40" rx="4" ry="2" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FINANCE / ACCOUNTING / LANDED COSTS  →  Purple/pink segmented pie
  // ════════════════════════════════════════════════════════════════════════════
  if (['finance', 'accounting', 'landed-costs'].includes(last) || l === 'finance' || l === 'المالية') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pie1_${uid}`} x1="8" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#654EA3"/><stop offset="100%" stopColor="#EAAFC8"/>
          </linearGradient>
          <linearGradient id={`pie2_${uid}`} x1="28" y1="8" x2="56" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FFB199"/>
          </linearGradient>
        </defs>
        <path d="M30 34V10C17 10 6 21 6 34C6 47 17 58 30 58C43 58 54 47 54 34H30Z" fill={`url(#pie1_${uid})`}/>
        <path d="M36 8V28H56C56 17 47 8 36 8Z" fill={`url(#pie2_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VOUCHERS / EXPENSES / EXPENSE-CLAIMS  →  Pink wave receipt
  // ════════════════════════════════════════════════════════════════════════════
  if (['vouchers', 'expenses', 'expense-claims', 'payroll', 'calculators'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`vc_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FFB199"/>
          </linearGradient>
        </defs>
        <rect x="16" y="8" width="32" height="48" rx="6" fill="#1A0010"/>
        <rect x="16" y="8" width="32" height="8" rx="4" fill={`url(#vc_${uid})`}/>
        <path d="M16 56V52C20 52 20 56 24 56C28 56 28 52 32 52C36 52 36 56 40 56C44 56 44 52 48 52V56H16Z" fill={`url(#vc_${uid})`}/>
        <rect x="22" y="24" width="20" height="2.5" rx="1.25" fill={`url(#vc_${uid})`} fillOpacity="0.8"/>
        <rect x="22" y="30" width="14" height="2.5" rx="1.25" fill={`url(#vc_${uid})`} fillOpacity="0.6"/>
        <rect x="22" y="36" width="18" height="2.5" rx="1.25" fill={`url(#vc_${uid})`} fillOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VAT RETURNS / COMPLIANCE / ZATCA  →  Green shield with checkmark
  // ════════════════════════════════════════════════════════════════════════════
  if (['vat-returns', 'compliance', 'saudi-compliance', 'zatca', 'zatca-logs', 'government-integrations'].includes(last) || l.includes('زاتكا') || l.includes('امتثال') || l.includes('حكوم')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sh_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B"/><stop offset="100%" stopColor="#96C93D"/>
          </linearGradient>
        </defs>
        <path d="M32 6L54 16V34C54 46 44 56 32 58C20 56 10 46 10 34V16L32 6Z" fill={`url(#sh_${uid})`}/>
        <path d="M22 32L29 39L44 24" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EMPLOYEES / USERS / WORKERS / ATTENDANCE / BARBERS  →  Teal people
  // ════════════════════════════════════════════════════════════════════════════
  if (['employees', 'users', 'workers', 'barbers', 'manpower', 'hr-reports'].includes(last) || l.includes('موظف') || l.includes('مستخدم') || l.includes('عمال') || l.includes('حلاق')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`p1p_${uid}`} x1="12" y1="10" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/>
          </linearGradient>
          <linearGradient id={`p2p_${uid}`} x1="24" y1="18" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF"/><stop offset="100%" stopColor="#0D9488"/>
          </linearGradient>
        </defs>
        <circle cx="24" cy="20" r="8" fill={`url(#p1p_${uid})`}/>
        <path d="M10 44C10 36.268 16.268 30 24 30C31.732 30 38 36.268 38 44V49H10V44Z" fill={`url(#p1p_${uid})`}/>
        <circle cx="40" cy="24" r="7" fill={`url(#p2p_${uid})`}/>
        <path d="M28 47C28 40.373 33.373 35 40 35C46.627 35 52 40.373 52 47V51H28V47Z" fill={`url(#p2p_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ATTENDANCE / BIOMETRICS / FINGERPRINT  →  Cyan fingerprint arcs
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'attendance' || l.includes('حضور') || l.includes('بيومتري') || l.includes('biometrics')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fp_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="4" fill={`url(#fp_${uid})`}/>
        <path d="M32 22C37.52 22 42 26.48 42 32C42 37.52 37.52 42 32 42" stroke={`url(#fp_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M32 16C40.84 16 48 23.16 48 32C48 40.84 40.84 48 32 48" stroke={`url(#fp_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" strokeOpacity="0.7"/>
        <path d="M32 10C44.15 10 54 19.85 54 32C54 44.15 44.15 54 32 54" stroke={`url(#fp_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.45"/>
        <path d="M22 38C20 35.5 19 33.8 19 32C19 24.82 24.82 19 32 19" stroke={`url(#fp_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M14 42C11.5 38.5 10 35.4 10 32C10 20.95 19.4 12 32 12" stroke={`url(#fp_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.45"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMPLIANCE (HR) / HIRING / PERFORMANCE / LEAVES  →  Gold diamond
  // ════════════════════════════════════════════════════════════════════════════
  if (['compliance', 'hiring', 'performance', 'leaves', 'assignments', 'timesheets'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dm_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="18" fill="#4A00E0" fillOpacity="0.35"/>
        <rect x="32" y="12" width="26" height="26" rx="5" transform="rotate(45 32 12)" fill={`url(#dm_${uid})`}/>
        <ellipse cx="32" cy="21" rx="5" ry="3" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMMUNICATE / WHATSAPP / EMAIL / MAIL / NEWSLETTER  →  Paper airplane
  // ════════════════════════════════════════════════════════════════════════════
  if (['communicate', 'whatsapp', 'email', 'newsletter', 'mailbox'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pa_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C6FF"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
          <linearGradient id={`ps_${uid}`} x1="24" y1="24" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
        </defs>
        <path d="M10 30L52 12L34 54L26 38L10 30Z" fill={`url(#pa_${uid})`}/>
        <path d="M26 38L52 12L34 54L26 38Z" fill={`url(#ps_${uid})`}/>
        <circle cx="19" cy="30" r="3" fill="#FFFFFF" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROFILE / SETTINGS / COMPANY PROFILE  →  Cyan gear
  // ════════════════════════════════════════════════════════════════════════════
  if (['settings', 'profile', 'hidden-navbars', 'system-settings', 'backup', 'payment-settings'].includes(last) || l.includes('settings') || l.includes('إعدادات') || l.includes('ملف')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4facfe"/><stop offset="100%" stopColor="#00f2fe"/>
          </linearGradient>
          <linearGradient id={`gc_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#667eea"/><stop offset="100%" stopColor="#764ba2"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="18" fill={`url(#gg_${uid})`}/>
        <rect x="30" y="7" width="4" height="7" rx="2" fill={`url(#gg_${uid})`}/>
        <rect x="30" y="50" width="4" height="7" rx="2" fill={`url(#gg_${uid})`}/>
        <rect x="7" y="30" width="7" height="4" rx="2" fill={`url(#gg_${uid})`}/>
        <rect x="50" y="30" width="7" height="4" rx="2" fill={`url(#gg_${uid})`}/>
        <rect x="15" y="15" width="5" height="5" rx="1.5" transform="rotate(45 15 15)" fill={`url(#gg_${uid})`}/>
        <rect x="44" y="44" width="5" height="5" rx="1.5" transform="rotate(45 44 44)" fill={`url(#gg_${uid})`}/>
        <rect x="44" y="15" width="5" height="5" rx="1.5" transform="rotate(45 44 15)" fill={`url(#gg_${uid})`}/>
        <rect x="15" y="44" width="5" height="5" rx="1.5" transform="rotate(45 15 44)" fill={`url(#gg_${uid})`}/>
        <circle cx="32" cy="32" r="9" fill={`url(#gc_${uid})`}/>
        <circle cx="32" cy="32" r="4" fill="#121318"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CRM / LEADS / DEALS  →  3 overlapping spheres
  // ════════════════════════════════════════════════════════════════════════════
  if (['crm', 'leads', 'deals', 'activities', 'campaigns'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id={`sp1_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FF61D2"/><stop offset="100%" stopColor="#FE0979"/>
          </radialGradient>
          <radialGradient id={`sp2_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFE000"/><stop offset="100%" stopColor="#799F0C"/>
          </radialGradient>
          <radialGradient id={`sp3_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </radialGradient>
        </defs>
        <circle cx="25" cy="26" r="14" fill={`url(#sp1_${uid})`}/>
        <circle cx="41" cy="24" r="12" fill={`url(#sp2_${uid})`}/>
        <circle cx="32" cy="40" r="15" fill={`url(#sp3_${uid})`}/>
        <circle cx="46" cy="42" r="5" fill="#FF007F"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROJECTS / TASKS  →  Green checkmark diamond
  // ════════════════════════════════════════════════════════════════════════════
  if (['projects', 'tasks'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ck_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B"/><stop offset="100%" stopColor="#96C93D"/>
          </linearGradient>
        </defs>
        <rect x="32" y="7" width="32" height="32" rx="8" transform="rotate(45 32 7)" fill="#1B4D3E"/>
        <rect x="32" y="11" width="28" height="28" rx="6" transform="rotate(45 32 11)" fill={`url(#ck_${uid})`}/>
        <path d="M22 32L29 39L44 24" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WORKSHOP / JOB-CARDS / MAINTENANCE / SERVICE-HISTORY  →  Gold bolt hexagon
  // ════════════════════════════════════════════════════════════════════════════
  if (['workshop', 'job-cards', 'maintenance', 'maintenance-alerts', 'service-history', 'job-costing', 'damage-matrix'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lt_${uid}`} x1="16" y1="6" x2="48" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <path d="M32 6L54 22V42L32 58L10 42V22L32 6Z" fill="#3D2800"/>
        <path d="M36 10L18 32H32L26 54L46 32H32L36 10Z" fill={`url(#lt_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VEHICLES / FLEET / CAR / ACTIVE RENTALS  →  Speed gauge
  // ════════════════════════════════════════════════════════════════════════════
  if (['vehicles', 'fleet', 'active', 'all-cars'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ga_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
          <linearGradient id={`ne_${uid}`} x1="32" y1="32" x2="50" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FFB199"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill="#181A20" stroke={`url(#ga_${uid})`} strokeWidth="4"/>
        <circle cx="32" cy="32" r="18" fill="#3A1C71" fillOpacity="0.35"/>
        <circle cx="32" cy="32" r="6" fill="#FFFFFF"/>
        <path d="M32 32L46 18" stroke={`url(#ne_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <circle cx="32" cy="32" r="3" fill="#FF0844"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONTRACTS / DOCUMENTS / STITCHINGS  →  Fanned 3 colorful docs
  // ════════════════════════════════════════════════════════════════════════════
  if (['contracts', 'documents', 'stitchings', 'job-costing-form'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`doc1_${uid}`} x1="8" y1="14" x2="40" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
          <linearGradient id={`doc2_${uid}`} x1="14" y1="8" x2="50" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F9D423"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
          <linearGradient id={`doc3_${uid}`} x1="20" y1="12" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F"/><stop offset="100%" stopColor="#DD2476"/>
          </linearGradient>
        </defs>
        <rect x="14" y="20" width="28" height="36" rx="6" transform="rotate(-14 14 20)" fill={`url(#doc1_${uid})`}/>
        <rect x="22" y="14" width="28" height="36" rx="6" transform="rotate(11 22 14)" fill={`url(#doc2_${uid})`}/>
        <rect x="20" y="16" width="28" height="36" rx="6" fill={`url(#doc3_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IOT / SYSTEM  →  Teal network node
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'iot' || l.includes('iot') || l.includes('إنترنت الأشياء')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`nt_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE"/><stop offset="100%" stopColor="#4FACFE"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="7" fill={`url(#nt_${uid})`}/>
        <circle cx="14" cy="20" r="5" fill={`url(#nt_${uid})`} fillOpacity="0.7"/>
        <circle cx="50" cy="20" r="5" fill={`url(#nt_${uid})`} fillOpacity="0.7"/>
        <circle cx="14" cy="44" r="5" fill={`url(#nt_${uid})`} fillOpacity="0.7"/>
        <circle cx="50" cy="44" r="5" fill={`url(#nt_${uid})`} fillOpacity="0.7"/>
        <line x1="32" y1="32" x2="14" y2="20" stroke={`url(#nt_${uid})`} strokeWidth="2" strokeOpacity="0.6"/>
        <line x1="32" y1="32" x2="50" y2="20" stroke={`url(#nt_${uid})`} strokeWidth="2" strokeOpacity="0.6"/>
        <line x1="32" y1="32" x2="14" y2="44" stroke={`url(#nt_${uid})`} strokeWidth="2" strokeOpacity="0.6"/>
        <line x1="32" y1="32" x2="50" y2="44" stroke={`url(#nt_${uid})`} strokeWidth="2" strokeOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAUNDRY DELIVERY / NAVIGATION / ROUTES  →  Location pin arrow
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'delivery' && secondLast === 'laundry') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`loc_${uid}`} x1="20" y1="8" x2="44" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <path d="M32 8C22.06 8 14 16.06 14 26C14 39 32 58 32 58C32 58 50 39 50 26C50 16.06 41.94 8 32 8Z" fill={`url(#loc_${uid})`}/>
        <circle cx="32" cy="26" r="8" fill="#FFFFFF" fillOpacity="0.9"/>
        <circle cx="32" cy="26" r="4" fill="#FF0844"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MRP / MANUFACTURING / FACTORY  →  Green factory stacks
  // ════════════════════════════════════════════════════════════════════════════
  if (['mrp', 'manufacturing', 'factory'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`f1_${uid}`} x1="8" y1="24" x2="22" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B"/><stop offset="100%" stopColor="#96C93D"/>
          </linearGradient>
          <linearGradient id={`f2_${uid}`} x1="22" y1="14" x2="40" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/>
          </linearGradient>
          <linearGradient id={`f3_${uid}`} x1="40" y1="18" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF"/><stop offset="100%" stopColor="#0D9488"/>
          </linearGradient>
        </defs>
        <rect x="8" y="24" width="14" height="30" rx="3" fill={`url(#f1_${uid})`}/>
        <rect x="25" y="14" width="14" height="40" rx="3" fill={`url(#f2_${uid})`}/>
        <rect x="42" y="18" width="14" height="36" rx="3" fill={`url(#f3_${uid})`}/>
        <rect x="10" y="26" width="8" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
        <rect x="27" y="16" width="9" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
        <rect x="44" y="20" width="9" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ECOMMERCE / ONLINE STORE / WEBSITE / THEME  →  Eclipsed spheres
  // ════════════════════════════════════════════════════════════════════════════
  if (['ecommerce', 'storefront', 'theme', 'wordpress', 'domains', 'pixels', 'website'].includes(last) || secondLast === 'ecommerce') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id={`ec1_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FF416C"/><stop offset="100%" stopColor="#8A0000"/>
          </radialGradient>
          <radialGradient id={`ec2_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#FF4E50"/>
          </radialGradient>
        </defs>
        <circle cx="26" cy="32" r="18" fill={`url(#ec1_${uid})`}/>
        <circle cx="38" cy="32" r="18" fill={`url(#ec2_${uid})`} fillOpacity="0.85" style={{mixBlendMode:'screen'}}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BOOKSTORE / KNOWLEDGE / SUPPLY-LISTS  →  Purple bookmark book
  // ════════════════════════════════════════════════════════════════════════════
  if (['bookstore', 'knowledge', 'supply-lists', 'rentals', 'bestsellers', 'buyback', 'buy-back'].includes(last) || secondLast === 'bookstore') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bk_${uid}`} x1="14" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8A2387"/><stop offset="50%" stopColor="#E94057"/><stop offset="100%" stopColor="#F27121"/>
          </linearGradient>
          <linearGradient id={`rb_${uid}`} x1="32" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="28" height="44" rx="6" fill="#4A00E0" fillOpacity="0.7"/>
        <rect x="18" y="16" width="30" height="42" rx="6" fill={`url(#bk_${uid})`}/>
        <path d="M34 10V40L42 34L50 40V10H34Z" fill={`url(#rb_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KHAYYAT / TAILORING / STITCHING / FABRICS / EMBROIDERY / MEASUREMENTS
  // ════════════════════════════════════════════════════════════════════════════
  if (['khayyat', 'stitchings', 'fabrics', 'embroidery-designs', 'customizations', 'measurements'].includes(last) || secondLast === 'khayyat') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dr_${uid}`} x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <path d="M26 10L38 10L34 26L50 54H14L30 26L26 10Z" fill={`url(#dr_${uid})`}/>
        <ellipse cx="32" cy="10" rx="7" ry="2.5" fill="#FFE000"/>
        <path d="M22 42L42 42" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.5"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BAKALA / GROCERY / SUPERMARKET  →  Colorful produce basket
  // ════════════════════════════════════════════════════════════════════════════
  if (secondLast === 'bakala' || last === 'bakala') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bsk_${uid}`} x1="8" y1="20" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F09819"/><stop offset="100%" stopColor="#EDDE5D"/>
          </linearGradient>
        </defs>
        {/* Basket */}
        <path d="M14 32H50L46 52H18L14 32Z" fill={`url(#bsk_${uid})`}/>
        <rect x="14" y="28" width="36" height="6" rx="3" fill="#F09819"/>
        {/* Handle */}
        <path d="M22 32C22 22 42 22 42 32" stroke="#F09819" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        {/* Produce circles on top */}
        <circle cx="26" cy="30" r="4" fill="#10B981"/>
        <circle cx="32" cy="28" r="5" fill="#FF0844"/>
        <circle cx="38" cy="30" r="4" fill="#FFD200"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LABEL PRINTING / PRINTER  →  Printer icon
  // ════════════════════════════════════════════════════════════════════════════
  if (['label-printing', 'printer'].includes(last) || l.includes('طباعة')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pr_${uid}`} x1="8" y1="16" x2="56" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4facfe"/><stop offset="100%" stopColor="#00f2fe"/>
          </linearGradient>
        </defs>
        <rect x="16" y="10" width="32" height="20" rx="4" fill="#1A2040"/>
        <rect x="8" y="26" width="48" height="20" rx="6" fill={`url(#pr_${uid})`}/>
        <rect x="18" y="46" width="28" height="12" rx="3" fill="#1A2040"/>
        <rect x="22" y="50" width="20" height="4" rx="2" fill={`url(#pr_${uid})`} fillOpacity="0.6"/>
        <circle cx="46" cy="34" r="3" fill="#FFFFFF" fillOpacity="0.7"/>
        <rect x="18" y="30" width="16" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHIFT MANAGEMENT / PLANNING / LEAVES  →  Cyan-pink dual track
  // ════════════════════════════════════════════════════════════════════════════
  if (['shift', 'planning', 'leaves', 'worker-amounts'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sw1_${uid}`} x1="8" y1="20" x2="56" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF"/><stop offset="100%" stopColor="#0072FF"/>
          </linearGradient>
          <linearGradient id={`sw2_${uid}`} x1="8" y1="36" x2="56" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="22" r="6" fill="#00E5FF"/>
        <rect x="28" y="17" width="28" height="9" rx="4.5" fill={`url(#sw1_${uid})`}/>
        <circle cx="48" cy="40" r="6" fill="#FF0844"/>
        <rect x="8" y="35" width="28" height="9" rx="4.5" fill={`url(#sw2_${uid})`}/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STOCK ALERTS / ALERTS / EXPIRY / WASTE  →  Yellow warning triangle
  // ════════════════════════════════════════════════════════════════════════════
  if (['alerts', 'expiry-waste', 'weight-scale', 'produce'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`al_${uid}`} x1="8" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <path d="M32 8L56 52H8L32 8Z" fill={`url(#al_${uid})`}/>
        <rect x="30" y="26" width="4" height="14" rx="2" fill="#202228"/>
        <circle cx="32" cy="46" r="3" fill="#202228"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BOUTIQUE / DRESSES / FASHION  →  Pink dress silhouette
  // ════════════════════════════════════════════════════════════════════════════
  if (['boutique', 'dresses', 'pending-returns'].includes(last) || secondLast === 'boutique') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bt_${uid}`} x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        <path d="M26 10L38 10L34 26L50 56H14L30 26L26 10Z" fill={`url(#bt_${uid})`}/>
        <ellipse cx="32" cy="10" rx="7" ry="2.5" fill="#FFE000"/>
        {/* Sparkles */}
        <circle cx="46" cy="20" r="2.5" fill="#FFD200"/>
        <circle cx="44" cy="14" r="1.5" fill="#FFD200" fillOpacity="0.6"/>
        <circle cx="52" cy="18" r="1.5" fill="#FFD200" fillOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FURNITURE SHOP / FURNITURE POS  →  Blue isometric chair
  // ════════════════════════════════════════════════════════════════════════════
  if (['furniture', 'furniture-pos'].includes(last) || secondLast === 'furniture') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fr_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0052D4"/><stop offset="100%" stopColor="#6FB1FC"/>
          </linearGradient>
        </defs>
        {/* Back rest */}
        <rect x="14" y="14" width="36" height="14" rx="5" fill={`url(#fr_${uid})`}/>
        {/* Seat */}
        <rect x="14" y="32" width="36" height="10" rx="5" fill={`url(#fr_${uid})`} fillOpacity="0.8"/>
        {/* Legs */}
        <rect x="18" y="42" width="5" height="14" rx="2.5" fill={`url(#fr_${uid})`} fillOpacity="0.6"/>
        <rect x="41" y="42" width="5" height="14" rx="2.5" fill={`url(#fr_${uid})`} fillOpacity="0.6"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAUNDRY / LAUNDRY ORDERS / LAUNDRY POS  →  Blue washing bubble
  // ════════════════════════════════════════════════════════════════════════════
  if (secondLast === 'laundry' || last === 'laundry') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id={`ws_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#00C6FF"/><stop offset="100%" stopColor="#0072FF"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill={`url(#ws_${uid})`}/>
        <circle cx="32" cy="32" r="14" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.5"/>
        <circle cx="28" cy="28" r="5" fill="none" stroke="#FFFFFF" strokeWidth="2.5"/>
        {/* Bubbles */}
        <circle cx="44" cy="18" r="4" fill="#FFFFFF" fillOpacity="0.5"/>
        <circle cx="50" cy="28" r="3" fill="#FFFFFF" fillOpacity="0.35"/>
        <circle cx="40" cy="12" r="2.5" fill="#FFFFFF" fillOpacity="0.3"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SALOON / BARBER POS  →  Pink scissors
  // ════════════════════════════════════════════════════════════════════════════
  if (secondLast === 'saloon' || last === 'saloon' || l.includes('صالون') || l.includes('حلاقة')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sc_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844"/><stop offset="100%" stopColor="#FF4E50"/>
          </linearGradient>
        </defs>
        {/* Scissor blade 1 */}
        <path d="M20 16L44 40" stroke={`url(#sc_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <path d="M44 40L36 52C34 55 28 54 26 50C24 46 26 40 30 40L44 40Z" fill={`url(#sc_${uid})`}/>
        {/* Scissor blade 2 */}
        <path d="M44 16L20 40" stroke={`url(#sc_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <path d="M20 40L28 52C30 55 36 54 38 50C40 46 38 40 34 40L20 40Z" fill={`url(#sc_${uid})`}/>
        {/* Pivot */}
        <circle cx="32" cy="28" r="4" fill="#FFFFFF"/>
        <circle cx="32" cy="28" r="2" fill="#FF0844"/>
        {/* Handles circles */}
        <circle cx="18" cy="16" r="5" fill="none" stroke={`url(#sc_${uid})`} strokeWidth="3"/>
        <circle cx="46" cy="16" r="5" fill="none" stroke={`url(#sc_${uid})`} strokeWidth="3"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TRAVEL / BOOKINGS / PLANE  →  Purple paper plane
  // ════════════════════════════════════════════════════════════════════════════
  if (['travel-bookings', 'travel', 'bookings'].includes(last) || secondLast === 'travel') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pl_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF"/><stop offset="100%" stopColor="#E100FF"/>
          </linearGradient>
        </defs>
        {/* Airplane body */}
        <path d="M10 32L54 14L38 54L30 38L10 32Z" fill={`url(#pl_${uid})`}/>
        <path d="M30 38L54 14L38 54L30 38Z" fill="#E100FF" fillOpacity="0.5"/>
        {/* Vapor trail */}
        <path d="M10 32L22 36" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // USERS ADMIN / HIDDEN-NAVBARS / BACKUP  →  Gear (duplicated with settings — use different icon)
  // Purple stack rows for admin
  // ════════════════════════════════════════════════════════════════════════════
  if (['hidden-navbars', 'backup'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`hd_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#654EA3"/><stop offset="100%" stopColor="#EAAFC8"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="9" rx="4" fill={`url(#hd_${uid})`}/>
        <rect x="10" y="27" width="44" height="9" rx="4" fill={`url(#hd_${uid})`} fillOpacity="0.75"/>
        <rect x="10" y="40" width="44" height="9" rx="4" fill={`url(#hd_${uid})`} fillOpacity="0.5"/>
        <circle cx="50" cy="18.5" r="3" fill="#FFFFFF" fillOpacity="0.7"/>
        <circle cx="50" cy="31.5" r="3" fill="#FFFFFF" fillOpacity="0.5"/>
        <circle cx="50" cy="44.5" r="3" fill="#FFFFFF" fillOpacity="0.35"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CAR RENTAL CHECKOUT / NEW RENTAL  →  Keys icon
  // ════════════════════════════════════════════════════════════════════════════
  if (last === 'checkout' && secondLast === 'rental') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ky_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200"/><stop offset="100%" stopColor="#F7971E"/>
          </linearGradient>
        </defs>
        <circle cx="24" cy="28" r="14" fill="none" stroke={`url(#ky_${uid})`} strokeWidth="5"/>
        <circle cx="24" cy="28" r="5" fill={`url(#ky_${uid})`}/>
        <path d="M34 34L52 52" stroke={`url(#ky_${uid})`} strokeWidth="5" strokeLinecap="round"/>
        <path d="M46 46L50 42" stroke={`url(#ky_${uid})`} strokeWidth="4" strokeLinecap="round"/>
        <path d="M42 50L46 46" stroke={`url(#ky_${uid})`} strokeWidth="4" strokeLinecap="round"/>
      </svg>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FALLBACK — Geometric faceted gem (each gets its own random-but-consistent color from uid)
  // ════════════════════════════════════════════════════════════════════════════
  const hash = (path + label).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const fallbackPairs = [
    ['#FF0844', '#FFB199'],
    ['#00E5FF', '#7F00FF'],
    ['#FF8008', '#FFC837'],
    ['#10B981', '#0D9488'],
    ['#FF61D2', '#FE0979'],
    ['#4facfe', '#00f2fe'],
    ['#F9D423', '#FF4E50'],
    ['#654EA3', '#EAAFC8'],
    ['#00F2FE', '#4FACFE'],
    ['#FF512F', '#DD2476'],
  ]
  const [c1, c2] = fallbackPairs[hash % fallbackPairs.length]
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`fb1_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/>
        </linearGradient>
        <linearGradient id={`fb2_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c2}/><stop offset="100%" stopColor={c1}/>
        </linearGradient>
      </defs>
      <path d="M32 8L52 22V42L32 56L12 42V22L32 8Z" fill={`url(#fb1_${uid})`}/>
      <path d="M32 8L52 22L32 34L12 22L32 8Z" fill={`url(#fb2_${uid})`} fillOpacity="0.75"/>
      <circle cx="32" cy="32" r="5" fill="#FFFFFF" fillOpacity="0.75"/>
    </svg>
  )
}

export default App3DIcon
