import React from 'react'

/**
 * Ultra-premium 3D Glowing SVG app icons.
 * Every module gets a completely unique, semantically correct, hand-crafted 3D icon with luminous glow.
 * Matching is based on path SEGMENTS (last / secondLast) so /app/dashboard/X → "X".
 */
export function App3DIcon({
  path = '',
  label = '',
  icon = '',
  appId = '',
  className = 'w-11 h-11 sm:w-12 sm:h-12'
}) {
  const uid = React.useId().replace(/:/g, '')
  const cleanAppId = (appId || '').toLowerCase().trim()
  const cleanIcon = (icon || '').toLowerCase().trim()
  const cleanLabel = (label || '').toLowerCase().trim()
  const segments = (path || '').toLowerCase().split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  const second = segments[segments.length - 2] || ''
  const third = segments[segments.length - 3] || ''

  // Common glow filter component
  const GlowDef = ({ id, color = '#3B82F6', stdDev = '3', opacity = '0.6' }) => (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={stdDev} result="blur" />
      <feFlood floodColor={color} floodOpacity={opacity} result="glowColor" />
      <feComposite in="glowColor" in2="blur" operator="in" result="coloredGlow" />
      <feMerge>
        <feMergeNode in="coloredGlow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )

  // ─── 0.0. ULTRA-PREMIUM DYNAMIC LIVE 3D CALENDAR (APPLE / MAQDER DYNAMIC DATE) ──
  if (
    cleanAppId === 'calendar' ||
    last === 'calendar' ||
    cleanIcon === 'calendar' ||
    cleanIcon === 'calendardays' ||
    cleanLabel.includes('calendar') ||
    cleanLabel.includes('تقويم')
  ) {
    const today = new Date()
    const todayDate = today.getDate()
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayName = dayNames[today.getDay()]

    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cal_body_${uid}`} x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#EEF2F6" />
          </linearGradient>
          <linearGradient id={`cal_header_${uid}`} x1="6" y1="8" x2="58" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF2E5B" />
            <stop offset="50%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>
          <linearGradient id={`cal_chrome_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <filter id={`cal_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#0F172A" floodOpacity="0.16" />
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#E11D48" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* 3D Base Card Shadow & Glossy Rounded Body */}
        <rect x="6.5" y="8.5" width="51" height="49" rx="13" fill={`url(#cal_body_${uid})`} filter={`url(#cal_flt_${uid})`} />
        <rect x="7" y="9" width="50" height="48" rx="12.5" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.9" fill="none" />

        {/* Top Crimson Header Banner */}
        <path d="M6.5 21.5C6.5 14.32 12.32 8.5 19.5 8.5H44.5C51.68 8.5 57.5 14.32 57.5 21.5V23.5H6.5V21.5Z" fill={`url(#cal_header_${uid})`} />
        
        {/* Subtle glossy highlight line on top header */}
        <path d="M12 10.5H52C54.5 10.5 55.5 11.5 55.5 13" stroke="#FFA4B6" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.85" />

        {/* Realistic Chrome Binder Rings */}
        <rect x="16" y="5" width="4.5" height="8" rx="2.25" fill={`url(#cal_chrome_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="18.25" cy="9" r="0.9" fill="#FFFFFF" />
        
        <rect x="43.5" y="5" width="4.5" height="8" rx="2.25" fill={`url(#cal_chrome_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="45.75" cy="9" r="0.9" fill="#FFFFFF" />

        {/* Day Name in Crimson Header */}
        <text
          x="32"
          y="18.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontSize="7.5"
          fontWeight="900"
          letterSpacing="1.2"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          {dayName}
        </text>

        {/* Bold Glowing Big Date Number in Center */}
        <text
          x="32"
          y="38.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0F172A"
          fontSize={todayDate > 9 ? "22" : "24"}
          fontWeight="900"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="-0.8"
        >
          {todayDate}
        </text>

        {/* Micro Event Activity Dots at Bottom */}
        <circle cx="23" cy="50" r="1.8" fill="#10B981" />
        <circle cx="32" cy="50" r="1.8" fill="#3B82F6" />
        <circle cx="41" cy="50" r="1.8" fill="#F59E0B" />
      </svg>
    )
  }

  // ─── 0.1. LANDED COSTS / MARITIME IMPORT & DUTIES (3D NAUTICAL ANCHOR & CARGO) ──
  if (
    cleanAppId === 'landed_costs' ||
    cleanIcon === 'anchor' ||
    last === 'landed-costs' ||
    cleanLabel.includes('landed') ||
    cleanLabel.includes('مرسية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lc_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id={`lc_gold_${uid}`} x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`lc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="26" fill={`url(#lc_bg_${uid})`} filter={`url(#lc_flt_${uid})`} />
        <circle cx="32" cy="32" r="25" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
        <path d="M12 40C20 36 28 44 36 40C44 36 52 44 56 40" stroke="#7DD3FC" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
        {/* 3D Anchor */}
        <circle cx="32" cy="18" r="5" stroke={`url(#lc_gold_${uid})`} strokeWidth="3" fill="none" />
        <path d="M32 23V46" stroke={`url(#lc_gold_${uid})`} strokeWidth="4" strokeLinecap="round" />
        <path d="M22 28H42" stroke={`url(#lc_gold_${uid})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M18 36C18 45 24 50 32 50C40 50 46 45 46 36" stroke={`url(#lc_gold_${uid})`} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M14 36L18 33L22 36" stroke={`url(#lc_gold_${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M42 36L46 33L50 36" stroke={`url(#lc_gold_${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="18" r="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 0.2. PAYMENT TERMINAL / SMART POS INTEGRATION (3D POS & NFC CHIP) ──────
  if (
    cleanAppId === 'payment_terminal_integration' ||
    (cleanIcon === 'credit-card' && (cleanAppId.includes('terminal') || cleanLabel.includes('terminal') || cleanLabel.includes('دفع'))) ||
    last === 'payment-terminal' ||
    last === 'payments'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pt_body_${uid}`} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id={`pt_screen_${uid}`} x1="16" y1="14" x2="48" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`pt_glow_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id={`pt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* Terminal Body */}
        <rect x="14" y="8" width="36" height="48" rx="8" fill={`url(#pt_body_${uid})`} filter={`url(#pt_flt_${uid})`} stroke="#334155" strokeWidth="1.5" />
        {/* Screen */}
        <rect x="18" y="12" width="28" height="18" rx="4" fill={`url(#pt_screen_${uid})`} />
        <rect x="22" y="16" width="12" height="2" rx="1" fill="#A7F3D0" />
        <rect x="22" y="21" width="20" height="3" rx="1.5" fill="#34D399" />
        <path d="M38 15L42 19L40 21" stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round" />
        {/* Keypad */}
        <circle cx="23" cy="36" r="2.5" fill="#334155" />
        <circle cx="32" cy="36" r="2.5" fill="#334155" />
        <circle cx="41" cy="36" r="2.5" fill="#334155" />
        <circle cx="23" cy="43" r="2.5" fill="#334155" />
        <circle cx="32" cy="43" r="2.5" fill="#334155" />
        <circle cx="41" cy="43" r="2.5" fill="#334155" />
        <rect x="20" y="48" width="24" height="3" rx="1.5" fill="#10B981" />
        {/* Contactless Wave */}
        <path d="M44 6C47 9 47 13 44 16" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M47 3C51 7 51 15 47 19" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      </svg>
    )
  }

  // ─── 0.3. WEIGHT SCALE DRIVER (3D DIGITAL HIGH-PRECISION SCALE) ──────────────
  if (
    cleanAppId === 'weight_scale_driver' ||
    cleanIcon === 'scale' ||
    last === 'weight-scale' ||
    cleanLabel.includes('scale') ||
    cleanLabel.includes('ميزان')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sc_plate_${uid}`} x1="8" y1="16" x2="56" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
          <linearGradient id={`sc_base_${uid}`} x1="12" y1="36" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id={`sc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#06B6D4" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* Scale Base */}
        <rect x="12" y="32" width="40" height="24" rx="6" fill={`url(#sc_base_${uid})`} filter={`url(#sc_flt_${uid})`} stroke="#334155" strokeWidth="1.5" />
        {/* Stainless Steel Platform */}
        <ellipse cx="32" cy="24" rx="22" ry="8" fill={`url(#sc_plate_${uid})`} />
        <ellipse cx="32" cy="22" rx="20" ry="7" fill="#F8FAFC" fillOpacity="0.8" />
        {/* Digital LED Screen */}
        <rect x="20" y="38" width="24" height="12" rx="3" fill="#0A0F1D" stroke="#0EA5E9" strokeWidth="1" />
        <rect x="23" y="42" width="12" height="4" rx="1" fill="#06B6D4" />
        <text x="37" y="46" fill="#22C55E" fontSize="5" fontWeight="bold" fontFamily="monospace">kg</text>
        {/* Feet */}
        <rect x="16" y="54" width="6" height="3" rx="1.5" fill="#475569" />
        <rect x="42" y="54" width="6" height="3" rx="1.5" fill="#475569" />
      </svg>
    )
  }

  // ─── 0.4. AI COPILOT & INSIGHTS (3D HOLOGRAPHIC NEURAL SPARKLE) ─────────────
  if (
    cleanAppId === 'ai_copilot_insights' ||
    cleanIcon === 'sparkles' ||
    cleanAppId.includes('copilot') ||
    cleanAppId.includes('ai') ||
    cleanLabel.includes('copilot') ||
    cleanLabel.includes('ai') ||
    cleanLabel.includes('ذكاء')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ai_core_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
          <radialGradient id={`ai_glow_${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
          <filter id={`ai_flt_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#EC4899" floodOpacity="0.5" />
          </filter>
        </defs>
        {/* Central Core Glow */}
        <circle cx="32" cy="32" r="24" fill={`url(#ai_glow_${uid})`} filter={`url(#ai_flt_${uid})`} />
        {/* 3D Primary Neural Diamond */}
        <path
          d="M32 6L38 24L56 30L38 36L32 54L26 36L8 30L26 24L32 6Z"
          fill={`url(#ai_core_${uid})`}
        />
        <path
          d="M32 12L36 26L50 30L36 34L32 48L28 34L14 30L28 26L32 12Z"
          fill="#FFFFFF"
          fillOpacity="0.3"
        />
        {/* Floating Sparkles */}
        <circle cx="48" cy="14" r="3.5" fill="#FDE047" />
        <path d="M48 10V18M44 14H52" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="16" cy="48" r="2.5" fill="#38BDF8" />
        <circle cx="32" cy="30" r="3" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 0.5. GOSI & MUDAD COMPLIANCE (3D REGULATORY GOLD & EMERALD SHIELD) ──────
  if (
    cleanAppId === 'gosi_mudad_compliance' ||
    (cleanIcon === 'shield' && (cleanAppId.includes('gosi') || cleanLabel.includes('gosi') || cleanLabel.includes('مؤسسية') || cleanLabel.includes('امتثال'))) ||
    cleanLabel.includes('gosi') ||
    cleanLabel.includes('mudad') ||
    cleanLabel.includes('تأمينات') ||
    cleanLabel.includes('مدد')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gs_shield_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>
          <linearGradient id={`gs_gold_${uid}`} x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`gs_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>
        {/* Shield */}
        <path
          d="M32 8L50 16V32C50 44 42 52 32 56C22 52 14 44 14 32V16L32 8Z"
          fill={`url(#gs_shield_${uid})`}
          filter={`url(#gs_flt_${uid})`}
          stroke={`url(#gs_gold_${uid})`}
          strokeWidth="2"
        />
        {/* Inner Gold Crest */}
        <path
          d="M32 14L44 20V32C44 40 38 46 32 49C26 46 20 40 20 32V20L32 14Z"
          stroke={`url(#gs_gold_${uid})`}
          strokeWidth="1.5"
          fill="none"
          strokeOpacity="0.7"
        />
        {/* Verified Checkmark */}
        <path
          d="M26 32L30 36L38 26"
          stroke={`url(#gs_gold_${uid})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="20" r="2" fill="#FDE047" />
      </svg>
    )
  }

  // ─── 0.6. MULTICOURIER SHIPPING (3D EXPRESS LOGISTICS PARCEL & ARROWS) ──────
  if (
    cleanAppId === 'multicourier_shipping' ||
    (cleanIcon === 'package' && (cleanAppId.includes('shipping') || cleanLabel.includes('shipping') || cleanLabel.includes('شحن'))) ||
    last === 'couriers' ||
    last === 'shipping'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`shp_box_${uid}`} x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="50%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={`shp_neon_${uid}`} x1="12" y1="8" x2="52" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`shp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* 3D Box */}
        <path d="M32 10L52 20V42L32 52L12 42V20L32 10Z" fill={`url(#shp_box_${uid})`} filter={`url(#shp_flt_${uid})`} />
        <path d="M32 10L52 20L32 30L12 20L32 10Z" fill="#F59E0B" fillOpacity="0.7" />
        <path d="M32 30V52" stroke="#78350F" strokeWidth="2" />
        <path d="M12 20L32 30L52 20" stroke="#78350F" strokeWidth="1.5" fill="none" />
        {/* Neon Express Tape & Speed Wings */}
        <rect x="29" y="15" width="6" height="30" fill={`url(#shp_neon_${uid})`} rx="1.5" />
        <path d="M42 28L54 24M44 34L56 30M46 40L54 38" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 0.7. FLEET & MACHINERY MANAGEMENT (3D HEAVY TRANSPORTER & CRANE) ───────
  if (
    cleanAppId === 'fleet_machinery' ||
    (cleanIcon === 'truck' && !cleanAppId.includes('shipping')) ||
    last === 'fleet' ||
    cleanLabel.includes('fleet') ||
    cleanLabel.includes('أسطول')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`flt_hd_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id={`flt_neon_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id={`flt_flt_main_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#2563EB" floodOpacity="0.45" />
          </filter>
        </defs>
        {/* Transporter Body */}
        <rect x="10" y="22" width="28" height="22" rx="4" fill={`url(#flt_hd_${uid})`} filter={`url(#flt_flt_main_${uid})`} />
        <path d="M38 28L46 28L54 36V44H38V28Z" fill={`url(#flt_hd_${uid})`} />
        {/* Cab Window */}
        <path d="M40 30H46L51 36H40V30Z" fill={`url(#flt_neon_${uid})`} fillOpacity="0.85" />
        {/* Cargo Grill Lines */}
        <line x1="16" y1="26" x2="16" y2="40" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="22" y1="26" x2="22" y2="40" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="28" y1="26" x2="28" y2="40" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.3" />
        {/* Wheels with 3D Chrome Rims */}
        <circle cx="18" cy="46" r="7" fill="#0A0F1D" stroke="#3B82F6" strokeWidth="1.5" />
        <circle cx="18" cy="46" r="3.5" fill="#60A5FA" />
        <circle cx="18" cy="46" r="1.5" fill="#FFFFFF" />
        <circle cx="46" cy="46" r="7" fill="#0A0F1D" stroke="#3B82F6" strokeWidth="1.5" />
        <circle cx="46" cy="46" r="3.5" fill="#60A5FA" />
        <circle cx="46" cy="46" r="1.5" fill="#FFFFFF" />
        {/* Headlight Ray */}
        <path d="M54 39L60 38L60 43L54 42Z" fill="#FDE047" fillOpacity="0.8" />
      </svg>
    )
  }

  // ─── 0.8. CRM & SALES PIPELINE (3D RADAR TARGET & BULLSEYE) ─────────────────
  if (
    cleanAppId === 'crm_sales_pipeline' ||
    cleanIcon === 'target' ||
    last === 'crm' ||
    cleanLabel.includes('crm') ||
    cleanLabel.includes('pipeline')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`crm_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>
          <linearGradient id={`crm_arrow_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`crm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#E11D48" floodOpacity="0.45" />
          </filter>
        </defs>
        {/* Target Rings */}
        <circle cx="32" cy="32" r="26" fill={`url(#crm_bg_${uid})`} filter={`url(#crm_flt_${uid})`} />
        <circle cx="32" cy="32" r="20" fill="#FFFFFF" fillOpacity="0.2" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4" />
        <circle cx="32" cy="32" r="14" fill={`url(#crm_bg_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="32" cy="32" r="7" fill="#FDE047" />
        {/* 3D Arrow Striking Bullseye */}
        <path d="M46 14L32 28" stroke={`url(#crm_arrow_${uid})`} strokeWidth="4" strokeLinecap="round" />
        <path d="M42 12L48 12L48 18" stroke={`url(#crm_arrow_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 0.9. HR & WORKFORCE SUITE (3D TEAM AVATARS & ID BADGE) ─────────────────
  if (
    cleanAppId === 'hr_payroll_pro' ||
    (cleanIcon === 'users' && cleanAppId.includes('hr')) ||
    last === 'employees' ||
    cleanLabel.includes('payroll') ||
    cleanLabel.includes('موارد بشرية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`hr_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>
          <linearGradient id={`hr_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`hr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="26" fill={`url(#hr_bg_${uid})`} filter={`url(#hr_flt_${uid})`} />
        {/* Background Avatars */}
        <circle cx="20" cy="24" r="6" fill="#A78BFA" fillOpacity="0.7" />
        <path d="M12 40C12 34 16 31 20 31C24 31 28 34 28 40" fill="#A78BFA" fillOpacity="0.7" />
        <circle cx="44" cy="24" r="6" fill="#A78BFA" fillOpacity="0.7" />
        <path d="M36 40C36 34 40 31 44 31C48 31 52 34 52 40" fill="#A78BFA" fillOpacity="0.7" />
        {/* Center Primary Leader Avatar */}
        <circle cx="32" cy="22" r="8" fill="#FFFFFF" />
        <circle cx="32" cy="22" r="6" fill={`url(#hr_gold_${uid})`} />
        <path d="M20 44C20 36 25 33 32 33C39 33 44 36 44 44V48H20V44Z" fill="#FFFFFF" />
        {/* Gold Verified Star */}
        <circle cx="39" cy="27" r="3.5" fill="#FDE047" stroke="#5B21B6" strokeWidth="1" />
      </svg>
    )
  }

  // ─── 0.10. DELIVERY PLATFORMS (3D HIGH-SPEED SCOOTER & FOOD BOX) ────────────
  if (
    cleanAppId === 'delivery_platforms' ||
    cleanIcon === 'bike' ||
    last === 'delivery' ||
    cleanLabel.includes('delivery') ||
    cleanLabel.includes('توصيل')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`dl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="26" fill={`url(#dl_bg_${uid})`} filter={`url(#dl_flt_${uid})`} />
        {/* Scooter Chassis & Wheels */}
        <circle cx="20" cy="44" r="7" fill="#0A1815" stroke="#34D399" strokeWidth="2" />
        <circle cx="20" cy="44" r="3" fill="#FFFFFF" />
        <circle cx="44" cy="44" r="7" fill="#0A1815" stroke="#34D399" strokeWidth="2" />
        <circle cx="44" cy="44" r="3" fill="#FFFFFF" />
        <path d="M20 44L28 32H38L44 44" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M38 32L42 20H46" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        {/* Insulated Delivery Hotbox */}
        <rect x="14" y="20" width="14" height="14" rx="3" fill="#F59E0B" stroke="#FDE047" strokeWidth="1.5" />
        <path d="M17 25H25M17 29H25" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
        {/* Speed Trails */}
        <line x1="8" y1="24" x2="12" y2="24" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="30" x2="11" y2="30" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 1. WHATSAPP (OFFICIAL 3D GLOWING ICON) ──────────────────────────────────
  if (cleanAppId === 'whatsapp_cloud_auto' || cleanIcon === 'whatsapp' || last === 'whatsapp' || cleanLabel.includes('whatsapp')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`wa_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#25D366" />
            <stop offset="100%" stopColor="#128C7E" />
          </linearGradient>
          <linearGradient id={`wa_glow_${uid}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#25D366" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#075E54" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id={`wa_highlight_${uid}`} cx="35%" cy="25%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <filter id={`wa_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#25D366" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <circle cx="32" cy="32" r="26" fill={`url(#wa_glow_${uid})`} filter={`url(#wa_flt_${uid})`} />

        {/* Main WhatsApp Chat Bubble Badge with Tail */}
        <path
          d="M32 8C18.75 8 8 18.75 8 32C8 36.6 9.3 40.9 11.6 44.5L8.5 55.5L19.9 52.5C23.4 54.6 27.5 55.8 32 55.8C45.25 55.8 56 45.05 56 31.8C56 18.55 45.25 8 32 8Z"
          fill={`url(#wa_bg_${uid})`}
        />

        {/* 3D Glass Specular Top Highlight */}
        <path
          d="M32 8C18.75 8 8 18.75 8 32C8 36.6 9.3 40.9 11.6 44.5L8.5 55.5L19.9 52.5C23.4 54.6 27.5 55.8 32 55.8C45.25 55.8 56 45.05 56 31.8C56 18.55 45.25 8 32 8Z"
          fill={`url(#wa_highlight_${uid})`}
        />

        {/* Inner Subtle Ring */}
        <circle cx="32" cy="31.9" r="21" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.25" fill="none" />

        {/* Authentic White WhatsApp Handset */}
        <path
          d="M44.2 38.3C43.5 38.1 40 36.4 39.4 36.2C38.7 35.9 38.3 35.8 37.8 36.5C37.3 37.2 36 38.8 35.6 39.3C35.2 39.7 34.7 39.8 34 39.4C33.3 39.1 31.1 38.4 28.5 36.1C26.5 34.3 25.1 32.1 24.7 31.4C24.3 30.7 24.7 30.3 25 30C25.3 29.7 25.7 29.2 26.1 28.8C26.4 28.3 26.6 28 26.8 27.5C27.1 27 27 26.5 26.8 26.1C26.6 25.7 25.3 22.5 24.7 21.2C24.2 19.9 23.6 20.1 23.2 20.1C22.8 20.1 22.3 20.1 21.8 20.1C21.3 20.1 20.6 20.3 20 20.9C19.4 21.6 17.6 23.3 17.6 26.8C17.6 30.3 20.2 33.7 20.5 34.1C20.9 34.6 25.5 41.7 32.6 44.7C34.3 45.4 35.6 45.9 36.7 46.2C38.4 46.8 40 46.7 41.2 46.5C42.6 46.3 45.4 44.8 46 43.1C46.6 41.4 46.6 39.9 46.4 39.6C46.3 39.3 45.8 39.1 44.2 38.3Z"
          fill="#FFFFFF"
        />

        {/* Small White Center Bubble Reflection */}
        <circle cx="43" cy="19" r="2" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 2. INVOICES (3D ULTRA-PREMIUM TAX INVOICE WITH GLOW) ────────────────────
  if (last === 'invoices' || last === 'bills' || (label || '').toLowerCase().includes('invoice') || (label || '').includes('فواتير')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`inv_card_${uid}`} x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id={`inv_hdr_${uid}`} x1="12" y1="8" x2="44" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id={`inv_accent_${uid}`} x1="20" y1="46" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id={`inv_glow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6366F1" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Back Ambient Glow */}
        <rect x="14" y="8" width="36" height="48" rx="8" fill="#6366F1" fillOpacity="0.2" filter={`url(#inv_glow_${uid})`} />

        {/* 3D Invoice Card Base */}
        <path
          d="M14 12C14 8.7 16.7 6 20 6H38L50 18V52C50 55.3 47.3 58 44 58H20C16.7 58 14 55.3 14 52V12Z"
          fill={`url(#inv_card_${uid})`}
          stroke="#6366F1"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* Folded Corner (3D origami effect) */}
        <path d="M38 6V16C38 17.1 38.9 18 40 18H50L38 6Z" fill="#818CF8" />
        <path d="M38 6L50 18H40C38.9 18 38 17.1 38 16V6Z" fill="#C7D2FE" fillOpacity="0.4" />

        {/* Top Header Badge */}
        <rect x="18" y="12" width="16" height="5" rx="2.5" fill={`url(#inv_hdr_${uid})`} />

        {/* Invoice Rows (Glowing Data Bars) */}
        {/* Row 1 */}
        <circle cx="20" cy="24" r="2" fill="#818CF8" />
        <rect x="25" y="22.5" width="14" height="3" rx="1.5" fill="#E0E7FF" fillOpacity="0.9" />
        <rect x="42" y="22.5" width="4" height="3" rx="1.5" fill="#38BDF8" />

        {/* Row 2 */}
        <circle cx="20" cy="31" r="2" fill="#818CF8" fillOpacity="0.7" />
        <rect x="25" y="29.5" width="10" height="3" rx="1.5" fill="#A5B4FC" fillOpacity="0.7" />
        <rect x="40" y="29.5" width="6" height="3" rx="1.5" fill="#38BDF8" fillOpacity="0.8" />

        {/* Row 3 */}
        <circle cx="20" cy="38" r="2" fill="#818CF8" fillOpacity="0.7" />
        <rect x="25" y="36.5" width="12" height="3" rx="1.5" fill="#A5B4FC" fillOpacity="0.7" />
        <rect x="41" y="36.5" width="5" height="3" rx="1.5" fill="#38BDF8" fillOpacity="0.8" />

        {/* Divider line */}
        <line x1="18" y1="43" x2="46" y2="43" stroke="#4338CA" strokeWidth="1.2" strokeDasharray="2 2" />

        {/* Total Highlight Bar with $ badge */}
        <rect x="18" y="47" width="28" height="6" rx="3" fill={`url(#inv_accent_${uid})`} />
        <rect x="21" y="49" width="10" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="41" cy="50" r="2" fill="#FFFFFF" />

        {/* Floating Paid / Approved Check Stamp */}
        <circle cx="43" cy="38" r="7" fill="#10B981" filter={`url(#inv_glow_${uid})`} />
        <path d="M40 38L42 40L46 36" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ─── 3. LEAVES / TIME OFF (3D GLOWING BOTANICAL LEAF & SUN) ─────────────────
  if (last === 'leaves' || (label || '').toLowerCase().includes('leave') || (label || '').includes('إجازات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lf_main_${uid}`} x1="16" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="45%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <linearGradient id={`lf_sec_${uid}`} x1="8" y1="28" x2="36" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A3E635" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <linearGradient id={`lf_sun_${uid}`} x1="38" y1="8" x2="54" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`lf_glow_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#22C55E" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <circle cx="34" cy="32" r="22" fill="#22C55E" fillOpacity="0.2" filter={`url(#lf_glow_${uid})`} />

        {/* Glowing Vacation Sun in top-right */}
        <circle cx="46" cy="16" r="8" fill={`url(#lf_sun_${uid})`} />
        {/* Sun rays */}
        <path d="M46 5V7M46 25V27M35 16H37M55 16H57M38 8L40 10M52 22L54 24M38 24L40 22M52 10L54 8" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />

        {/* Secondary Left Leaf */}
        <path
          d="M10 46C10 32 24 24 34 24C34 38 24 52 10 52V46Z"
          fill={`url(#lf_sec_${uid})`}
          fillOpacity="0.85"
        />
        <path d="M10 50C18 44 26 36 34 24" stroke="#BBF7D0" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" fill="none" />

        {/* Main 3D Glowing Tropical Monstera / Palm Leaf */}
        <path
          d="M18 56C18 36 28 14 48 10C50 30 40 52 22 56H18Z"
          fill={`url(#lf_main_${uid})`}
          filter={`url(#lf_glow_${uid})`}
        />

        {/* Leaf Center Spine Stem with Golden Accent */}
        <path
          d="M16 58C24 48 34 34 48 10"
          stroke="#DCFCE7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Glowing Neon Side Veins */}
        <path d="M26 44C32 42 38 43 41 47" stroke="#DCFCE7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
        <path d="M31 36C37 34 43 35 46 39" stroke="#DCFCE7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
        <path d="M36 28C41 26 46 26 48 30" stroke="#DCFCE7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
        <path d="M23 48C20 44 18 38 18 34" stroke="#DCFCE7" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />
        <path d="M29 39C25 36 23 30 24 26" stroke="#DCFCE7" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />

        {/* Dew Drop with Glass Reflection */}
        <circle cx="38" cy="22" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="37" cy="21" r="1.2" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 3.1. MANUFACTURING & PRODUCTION (3D SMART FACTORY & GEAR MES) ────────
  if (
    last === 'manufacturing' ||
    last === 'mrp' ||
    last === 'job-costing' ||
    (label || '').toLowerCase().includes('manufacturing') ||
    (label || '').toLowerCase().includes('production') ||
    (label || '').includes('تصنيع') ||
    (label || '').includes('إنتاج')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mf_base_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id={`mf_gear_${uid}`} x1="20" y1="12" x2="48" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id={`mf_metal_${uid}`} x1="12" y1="28" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id={`mf_glow_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#F97316" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Ambient Industrial Heat Glow */}
        <rect x="10" y="14" width="44" height="42" rx="10" fill="#F97316" fillOpacity="0.25" filter={`url(#mf_glow_${uid})`} />

        {/* 3D Modern Factory Isometric Base */}
        <path
          d="M12 28L24 16V26L36 14V24L48 12V50C48 53.3 45.3 56 42 56H18C14.7 56 12 53.3 12 50V28Z"
          fill={`url(#mf_metal_${uid})`}
          stroke="#F97316"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* Factory Glowing Windows Grid */}
        <rect x="18" y="34" width="6" height="6" rx="1.5" fill="#FDE047" fillOpacity="0.9" />
        <rect x="28" y="34" width="6" height="6" rx="1.5" fill="#FDE047" fillOpacity="0.9" />
        <rect x="38" y="34" width="6" height="6" rx="1.5" fill="#FDE047" fillOpacity="0.9" />
        <rect x="18" y="44" width="6" height="6" rx="1.5" fill="#FB923C" fillOpacity="0.8" />
        <rect x="28" y="44" width="6" height="6" rx="1.5" fill="#FB923C" fillOpacity="0.8" />
        <rect x="38" y="44" width="6" height="6" rx="1.5" fill="#FB923C" fillOpacity="0.8" />

        {/* 3D Glowing Central Precision Gear */}
        <g filter={`url(#mf_glow_${uid})`}>
          <circle cx="36" cy="24" r="11" fill={`url(#mf_gear_${uid})`} />
          <circle cx="36" cy="24" r="4.5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" />
          {/* Gear Teeth */}
          <rect x="34" y="10" width="4" height="4" rx="1" fill="#FDE047" />
          <rect x="34" y="34" width="4" height="4" rx="1" fill="#FDE047" />
          <rect x="22" y="22" width="4" height="4" rx="1" fill="#FDE047" />
          <rect x="46" y="22" width="4" height="4" rx="1" fill="#FDE047" />
          <rect x="26" y="14" width="4" height="4" rx="1" transform="rotate(45 28 16)" fill="#FDE047" />
          <rect x="42" y="30" width="4" height="4" rx="1" transform="rotate(45 44 32)" fill="#FDE047" />
          <rect x="26" y="30" width="4" height="4" rx="1" transform="rotate(-45 28 32)" fill="#FDE047" />
          <rect x="42" y="14" width="4" height="4" rx="1" transform="rotate(-45 44 16)" fill="#FDE047" />
        </g>

        {/* Assembly Robot Laser / Spark Beam */}
        <circle cx="48" cy="18" r="2.5" fill="#38BDF8" />
        <path d="M48 18L38 24" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="38" cy="24" r="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 3.2. APP STORE & ADD-ONS (3D HOLOGRAPHIC CUBE / STORE PRISM) ────────────
  if (
    last === 'app-store' ||
    last === 'addons' ||
    last === 'appstore' ||
    last === 'features' ||
    (label || '').toLowerCase().includes('app store') ||
    (label || '').toLowerCase().includes('addons') ||
    (label || '').includes('متجر التطبيقات') ||
    (label || '').includes('الإضافات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`as_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id={`as_accent_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <radialGradient id={`as_glow_${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
          <filter id={`as_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#8B5CF6" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Ambient Nebula Glow */}
        <circle cx="32" cy="32" r="26" fill={`url(#as_glow_${uid})`} />

        {/* 3D Floating Diamond Base Plate */}
        <path
          d="M32 6L54 18V46L32 58L10 46V18L32 6Z"
          fill={`url(#as_bg_${uid})`}
          filter={`url(#as_flt_${uid})`}
        />

        {/* Top Facet Specular Highlight */}
        <path
          d="M32 6L54 18L32 30L10 18L32 6Z"
          fill="#FFFFFF"
          fillOpacity="0.25"
        />

        {/* Right Facet */}
        <path
          d="M32 30L54 18V46L32 58V30Z"
          fill="#4338CA"
          fillOpacity="0.6"
        />

        {/* Left Facet */}
        <path
          d="M32 30L10 18V46L32 58V30Z"
          fill="#312E81"
          fillOpacity="0.4"
        />

        {/* 3D Floating App Grid Tiles (Center Isometric Matrix) */}
        {/* Top App Tile */}
        <path d="M32 14L40 19L32 24L24 19L32 14Z" fill="#F43F5E" />
        {/* Left App Tile */}
        <path d="M21 26L29 31L21 36L13 31L21 26Z" fill="#06B6D4" />
        {/* Right App Tile */}
        <path d="M43 26L51 31L43 36L35 31L43 26Z" fill="#10B981" />
        {/* Center App Tile (Glowing Golden Core) */}
        <path d="M32 26L40 31L32 36L24 31L32 26Z" fill="#FBBF24" />

        {/* Shiny Plus/Download Star in Front */}
        <circle cx="32" cy="46" r="6" fill="#FFFFFF" filter={`url(#as_flt_${uid})`} />
        <path d="M32 43V49M29 46H35" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />

        {/* Corner Neon Sparkles */}
        <circle cx="48" cy="12" r="1.5" fill="#FDE047" />
        <circle cx="14" cy="40" r="1.2" fill="#67E8F9" />
      </svg>
    )
  }

  // ─── 4. COMMUNICATE (3D DUAL GLOWING CHAT BUBBLES) ──────────────────────────
  if (last === 'communicate') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cm_bg1_${uid}`} x1="8" y1="8" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id={`cm_bg2_${uid}`} x1="24" y1="20" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id={`cm_glow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Back Bubble */}
        <path
          d="M12 12C12 7.6 15.6 4 20 4H36C40.4 4 44 7.6 44 12V24C44 28.4 40.4 32 36 32H22L12 40V12Z"
          fill={`url(#cm_bg1_${uid})`}
        />
        {/* Back Bubble Dots */}
        <circle cx="22" cy="18" r="2.5" fill="#FFFFFF" fillOpacity="0.85" />
        <circle cx="28" cy="18" r="2.5" fill="#FFFFFF" fillOpacity="0.85" />
        <circle cx="34" cy="18" r="2.5" fill="#FFFFFF" fillOpacity="0.85" />

        {/* Front Bubble with Glow */}
        <path
          d="M24 26C24 21.6 27.6 18 32 18H48C52.4 18 56 21.6 56 26V38C56 42.4 52.4 46 48 46H44L34 54V46H32C27.6 46 24 42.4 24 38V26Z"
          fill={`url(#cm_bg2_${uid})`}
          filter={`url(#cm_glow_${uid})`}
        />

        {/* Front Bubble Dots */}
        <circle cx="34" cy="32" r="2.5" fill="#FFFFFF" />
        <circle cx="40" cy="32" r="2.5" fill="#FFFFFF" />
        <circle cx="46" cy="32" r="2.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 5. POS / CHECKOUT ──────────────────────────────────────────────────────
  if (last === 'pos' || (last === 'checkout' && second !== 'rental')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pos_g_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF416C" /><stop offset="100%" stopColor="#FF4B2B" />
          </linearGradient>
          <filter id={`pos_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FF416C" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="12" y="8" width="40" height="28" rx="6" fill="#1A0010" />
        <rect x="16" y="12" width="32" height="20" rx="4" fill={`url(#pos_g_${uid})`} filter={`url(#pos_flt_${uid})`} />
        <rect x="20" y="16" width="24" height="5" rx="2" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="20" y="24" width="14" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="18" y="36" width="28" height="16" rx="5" fill={`url(#pos_g_${uid})`} />
        <rect x="22" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="29" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="36" y="40" width="5" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="22" y="47" width="20" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.5" />
      </svg>
    )
  }

  // ─── 6. MENU ITEMS ──────────────────────────────────────────────────────────
  if (last === 'menu-items' || (last === 'menu' && second === 'restaurant')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`menu_g_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C00" /><stop offset="100%" stopColor="#FF4500" />
          </linearGradient>
          <filter id={`menu_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FF8C00" floodOpacity="0.45" />
          </filter>
        </defs>
        <line x1="18" y1="10" x2="18" y2="30" stroke={`url(#menu_g_${uid})`} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="14" y1="10" x2="14" y2="20" stroke={`url(#menu_g_${uid})`} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="22" y1="10" x2="22" y2="20" stroke={`url(#menu_g_${uid})`} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 20C14 22 18 24 22 20" stroke={`url(#menu_g_${uid})`} strokeWidth="2" fill="none" strokeLinecap="round" />
        <line x1="18" y1="30" x2="18" y2="54" stroke={`url(#menu_g_${uid})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M46 10C46 10 50 18 50 26C50 30 48 32 46 32V54" stroke={`url(#menu_g_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <ellipse cx="32" cy="44" rx="18" ry="6" fill={`url(#menu_g_${uid})`} fillOpacity="0.25" filter={`url(#menu_flt_${uid})`} />
        <ellipse cx="32" cy="44" rx="18" ry="6" fill="none" stroke={`url(#menu_g_${uid})`} strokeWidth="2.5" />
      </svg>
    )
  }

  // ─── 7. TABLES ──────────────────────────────────────────────────────────────
  if (last === 'tables') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`tbl_g_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C6FF" /><stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <filter id={`tbl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#00C6FF" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M32 10L54 22L32 34L10 22L32 10Z" fill={`url(#tbl_g_${uid})`} filter={`url(#tbl_flt_${uid})`} />
        <path d="M10 22V38L32 50V34L10 22Z" fill="#0052D4" />
        <path d="M54 22V38L32 50V34L54 22Z" fill="#003DAB" />
        <circle cx="16" cy="46" r="5" fill={`url(#tbl_g_${uid})`} fillOpacity="0.8" />
        <circle cx="48" cy="46" r="5" fill={`url(#tbl_g_${uid})`} fillOpacity="0.8" />
        <ellipse cx="32" cy="16" rx="8" ry="3" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 8. INVENTORY ───────────────────────────────────────────────────────────
  if (['inventory'].includes(last) && !['ecommerce', 'restaurant', 'bakala', 'bookstore'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`inv_d_${uid}`} x1="8" y1="8" x2="56" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008" /><stop offset="100%" stopColor="#FFC837" />
          </linearGradient>
          <linearGradient id={`inv_dl_${uid}`} x1="8" y1="24" x2="32" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF5722" /><stop offset="100%" stopColor="#BF360C" />
          </linearGradient>
          <linearGradient id={`inv_dr_${uid}`} x1="32" y1="24" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF9800" /><stop offset="100%" stopColor="#E65100" />
          </linearGradient>
          <filter id={`inv_box_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FF8008" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M32 10L52 21L32 32L12 21L32 10Z" fill={`url(#inv_d_${uid})`} filter={`url(#inv_box_flt_${uid})`} />
        <path d="M12 21L32 32V50L12 39V21Z" fill={`url(#inv_dl_${uid})`} />
        <path d="M32 32L52 21V39L32 50V32Z" fill={`url(#inv_dr_${uid})`} />
        <path d="M24 15L44 26" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.5" />
        <ellipse cx="32" cy="14" rx="5" ry="2" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 9. ORDERS ──────────────────────────────────────────────────────────────
  if (last === 'orders' && !['ecommerce'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ord_e_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#C026D3" />
          </linearGradient>
          <filter id={`ord_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="16" y="10" width="32" height="44" rx="6" fill="#1A0030" />
        <rect x="16" y="10" width="32" height="8" rx="4" fill={`url(#ord_e_${uid})`} filter={`url(#ord_flt_${uid})`} />
        <path d="M16 54V50C20 50 20 54 24 54C28 54 28 50 32 50C36 50 36 54 40 54C44 54 44 50 48 50V54H16Z" fill={`url(#ord_e_${uid})`} />
        <rect x="22" y="24" width="20" height="3" rx="1.5" fill={`url(#ord_e_${uid})`} fillOpacity="0.85" />
        <rect x="22" y="31" width="14" height="2.5" rx="1.25" fill={`url(#ord_e_${uid})`} fillOpacity="0.6" />
        <rect x="22" y="37" width="18" height="2.5" rx="1.25" fill={`url(#ord_e_${uid})`} fillOpacity="0.6" />
        <rect x="32" y="43" width="12" height="3" rx="1.5" fill={`url(#ord_e_${uid})`} fillOpacity="0.95" />
      </svg>
    )
  }

  // ─── 10. CASHIER PANEL ──────────────────────────────────────────────────────
  if (last === 'cashier') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`csh_f_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <filter id={`csh_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="10" width="48" height="32" rx="6" fill="#0C1428" />
        <rect x="12" y="14" width="40" height="24" rx="4" fill={`url(#csh_f_${uid})`} fillOpacity="0.9" filter={`url(#csh_flt_${uid})`} />
        <rect x="16" y="18" width="16" height="8" rx="2" fill="#FFFFFF" fillOpacity="0.35" />
        <rect x="36" y="18" width="12" height="3.5" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="36" y="24" width="8" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
        <rect x="16" y="30" width="32" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.3" />
        <rect x="28" y="42" width="8" height="8" rx="2" fill="#0C1428" />
        <rect x="20" y="50" width="24" height="5" rx="2.5" fill="#0C1428" />
      </svg>
    )
  }

  // ─── 11. KITCHEN ────────────────────────────────────────────────────────────
  if (last === 'kitchen') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ktc_g_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFC107" /><stop offset="100%" stopColor="#FF8F00" />
          </linearGradient>
          <filter id={`ktc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FFC107" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="24" cy="22" r="10" fill={`url(#ktc_g_${uid})`} filter={`url(#ktc_flt_${uid})`} />
        <circle cx="32" cy="18" r="12" fill={`url(#ktc_g_${uid})`} />
        <circle cx="40" cy="22" r="10" fill={`url(#ktc_g_${uid})`} />
        <rect x="18" y="28" width="28" height="7" rx="0" fill={`url(#ktc_g_${uid})`} />
        <rect x="16" y="34" width="32" height="8" rx="4" fill={`url(#ktc_g_${uid})`} />
        <rect x="16" y="35" width="32" height="2" rx="1" fill="#0072FF" fillOpacity="0.5" />
        <ellipse cx="29" cy="18" rx="6" ry="3.5" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 12. KDS BOARD ──────────────────────────────────────────────────────────
  if (last === 'kds') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`kds_h_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <filter id={`kds_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7C3AED" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="6" y="14" width="52" height="36" rx="6" fill="#0A0720" />
        <rect x="10" y="18" width="44" height="28" rx="4" fill={`url(#kds_h_${uid})`} fillOpacity="0.85" filter={`url(#kds_flt_${uid})`} />
        <rect x="14" y="22" width="12" height="16" rx="3" fill="#FFFFFF" fillOpacity="0.2" />
        <rect x="28" y="22" width="12" height="16" rx="3" fill="#10B981" fillOpacity="0.6" />
        <rect x="42" y="22" width="8" height="16" rx="3" fill="#F59E0B" fillOpacity="0.6" />
        <rect x="16" y="24" width="8" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="30" y="24" width="8" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="44" y="24" width="4" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="28" y="50" width="8" height="6" rx="2" fill="#0A0720" />
        <rect x="22" y="56" width="20" height="4" rx="2" fill="#0A0720" />
      </svg>
    )
  }

  // ─── 13. BRANCHES ───────────────────────────────────────────────────────────
  if (last === 'branches') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`br_i_${uid}`} x1="8" y1="8" x2="28" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`br_i2_${uid}`} x1="24" y1="4" x2="40" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <linearGradient id={`br_i3_${uid}`} x1="38" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <filter id={`br_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="6" y="30" width="14" height="26" rx="3" fill={`url(#br_i_${uid})`} filter={`url(#br_flt_${uid})`} />
        <rect x="6" y="22" width="14" height="10" rx="2" fill={`url(#br_i_${uid})`} fillOpacity="0.75" />
        <rect x="22" y="18" width="16" height="38" rx="3" fill={`url(#br_i2_${uid})`} />
        <rect x="22" y="8" width="16" height="12" rx="2" fill={`url(#br_i2_${uid})`} fillOpacity="0.75" />
        <rect x="40" y="24" width="14" height="32" rx="3" fill={`url(#br_i3_${uid})`} />
        <rect x="40" y="16" width="14" height="10" rx="2" fill={`url(#br_i3_${uid})`} fillOpacity="0.75" />
        <rect x="9" y="34" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="9" y="42" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="26" y="22" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="34" y="22" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="43" y="28" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="43" y="36" width="4" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 14. QR MENU ────────────────────────────────────────────────────────────
  if (last === 'qr-menu' || last === 'qr') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`qr_j_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <filter id={`qr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="10" y="10" width="18" height="18" rx="4" fill={`url(#qr_j_${uid})`} filter={`url(#qr_flt_${uid})`} />
        <rect x="14" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="36" y="10" width="18" height="18" rx="4" fill={`url(#qr_j_${uid})`} />
        <rect x="40" y="14" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="10" y="36" width="18" height="18" rx="4" fill={`url(#qr_j_${uid})`} />
        <rect x="14" y="40" width="10" height="10" rx="2" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="36" y="36" width="7" height="7" rx="2" fill={`url(#qr_j_${uid})`} />
        <rect x="47" y="36" width="7" height="7" rx="2" fill={`url(#qr_j_${uid})`} />
        <rect x="36" y="47" width="7" height="7" rx="2" fill={`url(#qr_j_${uid})`} />
        <rect x="47" y="47" width="7" height="7" rx="2" fill={`url(#qr_j_${uid})`} />
      </svg>
    )
  }

  // ─── 15. RESERVATIONS / CALENDAR ────────────────────────────────────────────
  if (['reservations', 'reservation', 'appointments', 'rental-calendar'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`res_k_${uid}`} x1="8" y1="8" x2="56" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <linearGradient id={`res_kg_${uid}`} x1="8" y1="30" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FCD34D" /><stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`res_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="10" y="14" width="44" height="42" rx="10" fill="#1A0808" />
        <rect x="10" y="14" width="44" height="16" rx="8" fill={`url(#res_k_${uid})`} filter={`url(#res_flt_${uid})`} />
        <rect x="18" y="8" width="5" height="12" rx="2.5" fill="#EF4444" />
        <rect x="41" y="8" width="5" height="12" rx="2.5" fill="#EF4444" />
        <rect x="18" y="8" width="5" height="6" rx="2.5" fill="#FFFFFF" />
        <rect x="41" y="8" width="5" height="6" rx="2.5" fill="#FFFFFF" />
        <rect x="15" y="34" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} />
        <rect x="24" y="34" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} fillOpacity="0.7" />
        <rect x="33" y="34" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} fillOpacity="0.7" />
        <rect x="42" y="34" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} fillOpacity="0.4" />
        <rect x="15" y="44" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} fillOpacity="0.7" />
        <rect x="24" y="44" width="6" height="6" rx="2" fill="#10B981" fillOpacity="0.9" />
        <rect x="33" y="44" width="6" height="6" rx="2" fill={`url(#res_kg_${uid})`} fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 16. COMBOS & DEALS ─────────────────────────────────────────────────────
  if (['combos', 'deals'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`deal_l_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`deal_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M12 12H38C39.7 12 41.3 12.8 42.5 14.2L54 30L42.5 45.8C41.3 47.2 39.7 48 38 48H12C9.8 48 8 46.2 8 44V16C8 13.8 9.8 12 12 12Z" fill={`url(#deal_l_${uid})`} filter={`url(#deal_flt_${uid})`} />
        <circle cx="20" cy="24" r="5" fill="#1A0808" />
        <circle cx="20" cy="24" r="3" fill={`url(#deal_l_${uid})`} />
        <circle cx="28" cy="34" r="4" fill="#FFFFFF" fillOpacity="0.95" />
        <circle cx="40" cy="24" r="4" fill="#FFFFFF" fillOpacity="0.95" />
        <path d="M24 38L44 20" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <rect x="50" y="20" width="6" height="20" rx="3" fill="#EF4444" />
      </svg>
    )
  }

  // ─── 17. ANALYTICS / REPORTS ────────────────────────────────────────────────
  if (['analytics', 'reports', 'hr-reports', 'report', 'sales-report'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`rep_m_${uid}`} x1="10" y1="42" x2="22" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <linearGradient id={`rep_m2_${uid}`} x1="24" y1="28" x2="40" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id={`rep_m3_${uid}`} x1="40" y1="14" x2="54" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`rep_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="10" y="38" width="12" height="18" rx="6" fill={`url(#rep_m_${uid})`} />
        <rect x="26" y="24" width="12" height="32" rx="6" fill={`url(#rep_m2_${uid})`} />
        <rect x="42" y="12" width="12" height="44" rx="6" fill={`url(#rep_m3_${uid})`} filter={`url(#rep_flt_${uid})`} />
        <path d="M16 36L32 22L48 10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.9" fill="none" />
        <circle cx="16" cy="36" r="3.5" fill="#FFFFFF" />
        <circle cx="32" cy="22" r="3.5" fill="#FFFFFF" />
        <circle cx="48" cy="10" r="3.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ─── 18. MESS / CAFETERIA ───────────────────────────────────────────────────
  if (last === 'mess') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mss_n_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <filter id={`mss_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F97316" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="40" width="48" height="8" rx="4" fill={`url(#mss_n_${uid})`} filter={`url(#mss_flt_${uid})`} />
        <ellipse cx="24" cy="36" rx="12" ry="8" fill="#F97316" fillOpacity="0.7" />
        <ellipse cx="24" cy="36" rx="10" ry="6" fill="#FFFFFF" fillOpacity="0.2" />
        <rect x="40" y="30" width="12" height="14" rx="4" fill={`url(#mss_n_${uid})`} fillOpacity="0.9" />
        <path d="M26 24C26 24 28 20 26 16" stroke={`url(#mss_n_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M32 26C32 26 34 22 32 18" stroke={`url(#mss_n_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M20 22C20 22 22 18 20 14" stroke={`url(#mss_n_${uid})`} strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.7" />
      </svg>
    )
  }

  // ─── 19. DELIVERY PLATFORMS ─────────────────────────────────────────────────
  if (last === 'delivery' && (second === 'restaurant' || third === 'restaurant')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`del_o_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <filter id={`del_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M12 38H44L46 30H34C32 30 30 32 30 34V38H12Z" fill={`url(#del_o_${uid})`} filter={`url(#del_flt_${uid})`} />
        <path d="M44 38L48 30H52L50 38H44Z" fill={`url(#del_o_${uid})`} fillOpacity="0.8" />
        <rect x="8" y="28" width="14" height="12" rx="4" fill="#F97316" />
        <path d="M10 30L8 24" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 30L22 24" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="18" cy="42" r="7" fill="#1A0808" />
        <circle cx="18" cy="42" r="4" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="18" cy="42" r="2" fill={`url(#del_o_${uid})`} />
        <circle cx="48" cy="42" r="7" fill="#1A0808" />
        <circle cx="48" cy="42" r="4" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="48" cy="42" r="2" fill={`url(#del_o_${uid})`} />
        <path d="M46 28L52 24" stroke={`url(#del_o_${uid})`} strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 20. DASHBOARD (ROOT) ───────────────────────────────────────────────────
  if (last === 'dashboard' || path === '/app/dashboard') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dsh_p_${uid}`} x1="10" y1="10" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <linearGradient id={`dsh_p2_${uid}`} x1="34" y1="10" x2="54" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <linearGradient id={`dsh_p3_${uid}`} x1="10" y1="34" x2="28" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#BE185D" />
          </linearGradient>
          <linearGradient id={`dsh_p4_${uid}`} x1="34" y1="28" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`dsh_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.3" />
          </filter>
        </defs>
        <rect x="10" y="10" width="17" height="17" rx="6" fill={`url(#dsh_p_${uid})`} />
        <rect x="34" y="10" width="20" height="12" rx="5" fill={`url(#dsh_p2_${uid})`} />
        <rect x="10" y="34" width="17" height="20" rx="6" fill={`url(#dsh_p3_${uid})`} filter={`url(#dsh_flt_${uid})`} />
        <rect x="34" y="28" width="20" height="26" rx="6" fill={`url(#dsh_p4_${uid})`} />
        <rect x="38" y="40" width="4" height="8" rx="2" fill="#FFFFFF" fillOpacity="0.7" />
        <rect x="44" y="36" width="4" height="12" rx="2" fill="#FFFFFF" fillOpacity="0.7" />
        <rect x="50" y="32" width="2" height="16" rx="1" fill="#FFFFFF" fillOpacity="0.7" />
      </svg>
    )
  }

  // ─── 21. CUSTOMERS ──────────────────────────────────────────────────────────
  if (last === 'customers' && second !== 'ecommerce') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cst_r_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <filter id={`cst_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F97316" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="14" width="48" height="36" rx="8" fill={`url(#cst_r_${uid})`} filter={`url(#cst_flt_${uid})`} />
        <circle cx="24" cy="28" r="10" fill="#FFFFFF" fillOpacity="0.25" />
        <circle cx="24" cy="25" r="5" fill="#FFFFFF" fillOpacity="0.9" />
        <path d="M14 38C14 33 18.5 30 24 30C29.5 30 34 33 34 38H14Z" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="38" y="20" width="14" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="38" y="27" width="10" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="38" y="33" width="12" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="38" y="39" width="8" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 22. CUSTOMER STATEMENT ─────────────────────────────────────────────────
  if (last === 'statement') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`stm_s_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <filter id={`stm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="16" y="8" width="32" height="48" rx="6" fill="#0A1828" />
        <rect x="10" y="8" width="12" height="48" rx="6" fill={`url(#stm_s_${uid})`} filter={`url(#stm_flt_${uid})`} />
        <rect x="42" y="8" width="12" height="48" rx="6" fill={`url(#stm_s_${uid})`} />
        <rect x="20" y="18" width="24" height="3" rx="1.5" fill={`url(#stm_s_${uid})`} fillOpacity="0.85" />
        <rect x="20" y="25" width="18" height="2.5" rx="1.25" fill={`url(#stm_s_${uid})`} fillOpacity="0.65" />
        <rect x="20" y="32" width="22" height="2.5" rx="1.25" fill={`url(#stm_s_${uid})`} fillOpacity="0.65" />
        <rect x="20" y="39" width="14" height="2.5" rx="1.25" fill={`url(#stm_s_${uid})`} fillOpacity="0.45" />
        <rect x="20" y="46" width="24" height="3" rx="1.5" fill={`url(#stm_s_${uid})`} />
      </svg>
    )
  }

  // ─── 23. QUOTATIONS ─────────────────────────────────────────────────────────
  if (last === 'quotations') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`quo_t_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" /><stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id={`quo_tp_${uid}`} x1="28" y1="34" x2="56" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#FCA5A5" />
          </linearGradient>
          <filter id={`quo_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0EA5E9" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M12 12C12 9.8 13.8 8 16 8H38L50 20V50C50 52.2 48.2 54 46 54H16C13.8 54 12 52.2 12 50V12Z" fill={`url(#quo_t_${uid})`} fillOpacity="0.2" filter={`url(#quo_flt_${uid})`} />
        <path d="M12 12C12 9.8 13.8 8 16 8H38L50 20V50C50 52.2 48.2 54 46 54H16C13.8 54 12 52.2 12 50V12Z" fill="none" stroke={`url(#quo_t_${uid})`} strokeWidth="2.5" />
        <path d="M38 8V18C38 19.1 38.9 20 40 20H50L38 8Z" fill={`url(#quo_t_${uid})`} />
        <rect x="18" y="28" width="20" height="2.5" rx="1.25" fill={`url(#quo_t_${uid})`} fillOpacity="0.8" />
        <rect x="18" y="35" width="16" height="2.5" rx="1.25" fill={`url(#quo_t_${uid})`} fillOpacity="0.6" />
        <rect x="18" y="42" width="22" height="2.5" rx="1.25" fill={`url(#quo_t_${uid})`} fillOpacity="0.6" />
        <path d="M36 46L40 38L50 48L42 52L36 46Z" fill={`url(#quo_tp_${uid})`} />
        <circle cx="51" cy="37" r="4" fill="#EF4444" />
        <path d="M36 46L39 48L38 52L36 46Z" fill="#2A2C34" />
      </svg>
    )
  }

  // ─── 24. DELIVERY NOTES ─────────────────────────────────────────────────────
  if (last === 'delivery-notes') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dln_u_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`dln_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M12 24L32 14L52 24V44L32 54L12 44V24Z" fill={`url(#dln_u_${uid})`} fillOpacity="0.25" filter={`url(#dln_flt_${uid})`} />
        <path d="M12 24L32 34L52 24" stroke={`url(#dln_u_${uid})`} strokeWidth="2.5" fill="none" />
        <path d="M32 34V54" stroke={`url(#dln_u_${uid})`} strokeWidth="2.5" />
        <path d="M12 24L32 14L52 24V44L32 54L12 44V24Z" stroke={`url(#dln_u_${uid})`} strokeWidth="2.5" fill="none" />
        <circle cx="32" cy="34" r="10" fill={`url(#dln_u_${uid})`} />
        <path d="M32 30V38M28 34L32 30L36 34" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ─── 25. CONTACTS ───────────────────────────────────────────────────────────
  if (last === 'contacts' && second !== 'crm') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cnt_v_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id={`cnt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="10" y="8" width="36" height="48" rx="6" fill={`url(#cnt_v_${uid})`} filter={`url(#cnt_flt_${uid})`} />
        <rect x="6" y="10" width="8" height="44" rx="4" fill={`url(#cnt_v_${uid})`} fillOpacity="0.65" />
        <rect x="42" y="14" width="8" height="6" rx="3" fill="#60A5FA" />
        <rect x="42" y="24" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.75" />
        <rect x="42" y="34" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.55" />
        <rect x="42" y="44" width="8" height="6" rx="3" fill="#60A5FA" fillOpacity="0.35" />
        <circle cx="28" cy="26" r="7" fill="#FFFFFF" fillOpacity="0.95" />
        <path d="M16 42C16 36 21 32 28 32C35 32 40 36 40 42H16Z" fill="#FFFFFF" fillOpacity="0.95" />
      </svg>
    )
  }

  // ─── 26. LETTERHEAD ─────────────────────────────────────────────────────────
  if (last === 'letterhead') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lth_w_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`lth_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="16" width="48" height="36" rx="6" fill="#0A1828" />
        <path d="M8 20L32 38L56 20" stroke={`url(#lth_w_${uid})`} strokeWidth="3" fill="none" strokeLinecap="round" filter={`url(#lth_flt_${uid})`} />
        <rect x="8" y="16" width="48" height="6" rx="3" fill={`url(#lth_w_${uid})`} fillOpacity="0.35" />
        <rect x="18" y="26" width="28" height="20" rx="3" fill={`url(#lth_w_${uid})`} fillOpacity="0.25" />
        <circle cx="32" cy="32" r="6" fill={`url(#lth_w_${uid})`} fillOpacity="0.6" />
        <rect x="20" y="40" width="24" height="2" rx="1" fill={`url(#lth_w_${uid})`} fillOpacity="0.45" />
        <rect x="24" y="44" width="16" height="2" rx="1" fill={`url(#lth_w_${uid})`} fillOpacity="0.35" />
      </svg>
    )
  }

  // ─── 27. PURCHASE ORDERS ────────────────────────────────────────────────────
  if (last === 'purchase-orders' || last === 'auto-reorder') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`po_x_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`po_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M8 12H14L20 38H50L56 20H18" stroke={`url(#po_x_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#po_flt_${uid})`} />
        <rect x="22" y="22" width="8" height="10" rx="2" fill={`url(#po_x_${uid})`} fillOpacity="0.45" />
        <rect x="32" y="22" width="8" height="10" rx="2" fill={`url(#po_x_${uid})`} fillOpacity="0.65" />
        <rect x="42" y="22" width="7" height="10" rx="2" fill={`url(#po_x_${uid})`} fillOpacity="0.85" />
        <circle cx="24" cy="46" r="5" fill={`url(#po_x_${uid})`} />
        <circle cx="44" cy="46" r="5" fill={`url(#po_x_${uid})`} />
        <circle cx="24" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.7" />
        <circle cx="44" cy="46" r="2.5" fill="#FFFFFF" fillOpacity="0.7" />
      </svg>
    )
  }

  // ─── 28. SUPPLIERS ──────────────────────────────────────────────────────────
  if (last === 'suppliers') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sup_y_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" /><stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <filter id={`sup_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#14B8A6" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M10 38C10 38 12 28 20 26C28 24 28 28 28 28V44C28 44 28 48 24 48H10V38Z" fill={`url(#sup_y_${uid})`} filter={`url(#sup_flt_${uid})`} />
        <path d="M54 38C54 38 52 28 44 26C36 24 36 28 36 28V44C36 44 36 48 40 48H54V38Z" fill={`url(#sup_y_${uid})`} fillOpacity="0.85" />
        <rect x="26" y="28" width="12" height="14" rx="4" fill={`url(#sup_y_${uid})`} fillOpacity="0.95" />
        <rect x="8" y="44" width="20" height="6" rx="3" fill="#0F766E" />
        <rect x="36" y="44" width="20" height="6" rx="3" fill="#0F766E" />
        <circle cx="32" cy="34" r="4" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 29. SUPPLIER PERFORMANCE ───────────────────────────────────────────────
  if (last === 'supplier-performance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sp_z_${uid}`} x1="8" y1="48" x2="56" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" /><stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`sp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#14B8A6" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="6" fill="#0A1018" />
        <path d="M14 52V14" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.3" />
        <path d="M14 52H52" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.3" />
        <path d="M18 46L28 36L38 28L50 14" stroke={`url(#sp_z_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#sp_flt_${uid})`} />
        <path d="M46 12L52 14L50 20" stroke={`url(#sp_z_${uid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="18" cy="46" r="3.5" fill={`url(#sp_z_${uid})`} />
        <circle cx="28" cy="36" r="3.5" fill={`url(#sp_z_${uid})`} />
        <circle cx="38" cy="28" r="3.5" fill={`url(#sp_z_${uid})`} />
        <circle cx="50" cy="14" r="3.5" fill={`url(#sp_z_${uid})`} />
      </svg>
    )
  }

  // ─── 30. GRN / GOODS RECEIPT ────────────────────────────────────────────────
  if (last === 'grn') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`grn_aa_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E" /><stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <filter id={`grn_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#22C55E" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="22" width="48" height="36" rx="4" fill="#0A1808" />
        <path d="M6 26L32 10L58 26" stroke={`url(#grn_aa_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="8" y="22" width="48" height="6" fill={`url(#grn_aa_${uid})`} />
        <rect x="22" y="36" width="10" height="22" rx="2" fill={`url(#grn_aa_${uid})`} fillOpacity="0.45" />
        <rect x="34" y="36" width="10" height="22" rx="2" fill={`url(#grn_aa_${uid})`} fillOpacity="0.45" />
        <circle cx="48" cy="20" r="10" fill={`url(#grn_aa_${uid})`} filter={`url(#grn_flt_${uid})`} />
        <path d="M43 20L47 24L54 16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ─── 31. PURCHASE RETURNS ───────────────────────────────────────────────────
  if (last === 'purchase-returns' || (last === 'returns' && second === 'ecommerce')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ret_ab_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F43F5E" /><stop offset="100%" stopColor="#BE123C" />
          </linearGradient>
          <filter id={`ret_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F43F5E" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="14" y="24" width="36" height="30" rx="5" fill={`url(#ret_ab_${uid})`} fillOpacity="0.2" filter={`url(#ret_flt_${uid})`} />
        <rect x="14" y="24" width="36" height="30" rx="5" fill="none" stroke={`url(#ret_ab_${uid})`} strokeWidth="2.5" />
        <path d="M14 24L32 14L50 24" stroke={`url(#ret_ab_${uid})`} strokeWidth="2.5" fill="none" />
        <path d="M26 10C20 10 14 16 14 22" stroke={`url(#ret_ab_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M20 6L26 10L20 14" fill={`url(#ret_ab_${uid})`} />
        <path d="M24 34L40 48M40 34L24 48" stroke={`url(#ret_ab_${uid})`} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 32. SHIPMENTS ──────────────────────────────────────────────────────────
  if (last === 'shipments' || last === 'shipment') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`shp_ac_${uid}`} x1="8" y1="18" x2="56" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id={`shp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="6" y="22" width="34" height="24" rx="4" fill={`url(#shp_ac_${uid})`} filter={`url(#shp_flt_${uid})`} />
        <path d="M40 28V46H56V36L50 28H40Z" fill={`url(#shp_ac_${uid})`} fillOpacity="0.85" />
        <path d="M42 30V36H54L50 30H42Z" fill="#00E5FF" fillOpacity="0.75" />
        <rect x="10" y="26" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.35" />
        <rect x="10" y="32" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.35" />
        <rect x="10" y="38" width="26" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="16" cy="48" r="6" fill="#1A0808" />
        <circle cx="16" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="30" cy="48" r="6" fill="#1A0808" />
        <circle cx="30" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="48" cy="48" r="6" fill="#1A0808" />
        <circle cx="48" cy="48" r="3" fill="#FFFFFF" fillOpacity="0.35" />
      </svg>
    )
  }

  // ─── 33. PRODUCTS ───────────────────────────────────────────────────────────
  if (last === 'products' && !['ecommerce', 'bakala', 'bookstore'].includes(second)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prd_ad_${uid}`} x1="8" y1="8" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <linearGradient id={`prd_ad2_${uid}`} x1="30" y1="8" x2="56" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={`prd_ad3_${uid}`} x1="8" y1="30" x2="30" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`prd_ad4_${uid}`} x1="30" y1="30" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="22" height="22" rx="5" fill={`url(#prd_ad_${uid})`} />
        <rect x="34" y="8" width="22" height="22" rx="5" fill={`url(#prd_ad2_${uid})`} />
        <rect x="8" y="34" width="22" height="22" rx="5" fill={`url(#prd_ad3_${uid})`} />
        <rect x="34" y="34" width="22" height="22" rx="5" fill={`url(#prd_ad4_${uid})`} />
        <ellipse cx="17" cy="13" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.4" />
        <ellipse cx="43" cy="13" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.4" />
        <ellipse cx="17" cy="39" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.4" />
        <ellipse cx="43" cy="39" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 34. WAREHOUSES ─────────────────────────────────────────────────────────
  if (last === 'warehouses' || last === 'warehouse') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`war_ae_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <filter id={`war_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="6" y="28" width="52" height="30" rx="4" fill="#080A20" />
        <path d="M4 30L32 8L60 30" fill={`url(#war_ae_${uid})`} filter={`url(#war_flt_${uid})`} />
        <rect x="24" y="40" width="16" height="18" rx="3" fill={`url(#war_ae_${uid})`} fillOpacity="0.5" />
        <line x1="32" y1="40" x2="32" y2="58" stroke={`url(#war_ae_${uid})`} strokeWidth="1.5" />
        <rect x="10" y="34" width="10" height="8" rx="2" fill={`url(#war_ae_${uid})`} fillOpacity="0.5" />
        <rect x="44" y="34" width="10" height="8" rx="2" fill={`url(#war_ae_${uid})`} fillOpacity="0.5" />
        <path d="M32 10L58 28" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.25" />
      </svg>
    )
  }

  // ─── 35. FINANCE / ACCOUNTING ───────────────────────────────────────────────
  if (last === 'finance' || (last === 'dashboard' && second === 'finance')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fin_af_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EAB308" /><stop offset="100%" stopColor="#A16207" />
          </linearGradient>
          <filter id={`fin_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EAB308" floodOpacity="0.45" />
          </filter>
        </defs>
        <ellipse cx="32" cy="50" rx="22" ry="7" fill={`url(#fin_af_${uid})`} fillOpacity="0.6" />
        <rect x="10" y="42" width="44" height="8" rx="4" fill={`url(#fin_af_${uid})`} />
        <ellipse cx="32" cy="42" rx="22" ry="7" fill={`url(#fin_af_${uid})`} />
        <rect x="10" y="34" width="44" height="8" rx="4" fill={`url(#fin_af_${uid})`} fillOpacity="0.85" />
        <ellipse cx="32" cy="34" rx="22" ry="7" fill={`url(#fin_af_${uid})`} fillOpacity="0.85" />
        <rect x="10" y="26" width="44" height="8" rx="4" fill={`url(#fin_af_${uid})`} fillOpacity="0.7" />
        <ellipse cx="32" cy="26" rx="22" ry="7" fill={`url(#fin_af_${uid})`} fillOpacity="0.7" />
        <ellipse cx="32" cy="18" rx="22" ry="7" fill={`url(#fin_af_${uid})`} filter={`url(#fin_flt_${uid})`} />
        <rect x="10" y="11" width="44" height="7" rx="3" fill={`url(#fin_af_${uid})`} />
        <ellipse cx="32" cy="11" rx="22" ry="7" fill={`url(#fin_af_${uid})`} />
        <text x="32" y="15" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle" fillOpacity="0.9">$$$</text>
      </svg>
    )
  }

  // ─── 36. VOUCHERS ───────────────────────────────────────────────────────────
  if (last === 'vouchers') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`vch_ag_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#BE185D" />
          </linearGradient>
          <filter id={`vch_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M8 18C8 15.8 9.8 14 12 14H52C54.2 14 56 15.8 56 18V26C54 26 52 28 52 30C52 32 54 34 56 34V42C56 44.2 54.2 46 52 46H12C9.8 46 8 44.2 8 42V34C10 34 12 32 12 30C12 28 10 26 8 26V18Z" fill={`url(#vch_ag_${uid})`} filter={`url(#vch_flt_${uid})`} />
        <line x1="8" y1="30" x2="56" y2="30" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.6" />
        <rect x="16" y="18" width="20" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="16" y="23" width="14" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <text x="46" y="25" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle" fillOpacity="0.95">%</text>
        <rect x="16" y="35" width="24" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="16" y="40" width="16" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.5" />
      </svg>
    )
  }

  // ─── 37. EXPENSES ───────────────────────────────────────────────────────────
  if (last === 'expenses' || last === 'expense-claims') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`exp_ah_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <filter id={`exp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F97316" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="16" width="48" height="36" rx="8" fill="#200E00" />
        <rect x="8" y="16" width="48" height="8" rx="4" fill={`url(#exp_ah_${uid})`} filter={`url(#exp_flt_${uid})`} />
        <rect x="32" y="26" width="20" height="20" rx="4" fill={`url(#exp_ah_${uid})`} fillOpacity="0.35" />
        <rect x="32" y="26" width="20" height="6" rx="3" fill={`url(#exp_ah_${uid})`} fillOpacity="0.7" />
        <rect x="12" y="30" width="16" height="3" rx="1.5" fill={`url(#exp_ah_${uid})`} fillOpacity="0.8" />
        <rect x="12" y="36" width="12" height="2.5" rx="1.25" fill={`url(#exp_ah_${uid})`} fillOpacity="0.6" />
        <rect x="12" y="42" width="14" height="2.5" rx="1.25" fill={`url(#exp_ah_${uid})`} fillOpacity="0.6" />
        <circle cx="44" cy="38" r="6" fill={`url(#exp_ah_${uid})`} />
        <text x="44" y="42" fill="#FFFFFF" fontSize="9" fontWeight="900" fontFamily="system-ui,sans-serif" textAnchor="middle">$</text>
      </svg>
    )
  }

  // ─── 38. VAT RETURNS ────────────────────────────────────────────────────────
  if (last === 'vat-returns') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`vat_ai_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <filter id={`vat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="12" y="8" width="40" height="48" rx="6" fill="#0A0820" />
        <rect x="12" y="8" width="40" height="10" rx="5" fill={`url(#vat_ai_${uid})`} filter={`url(#vat_flt_${uid})`} />
        <circle cx="26" cy="32" r="7" fill={`url(#vat_ai_${uid})`} fillOpacity="0.75" />
        <circle cx="38" cy="44" r="7" fill={`url(#vat_ai_${uid})`} fillOpacity="0.75" />
        <path d="M22 46L42 26" stroke={`url(#vat_ai_${uid})`} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="26" cy="32" r="3" fill="#FFFFFF" fillOpacity="0.7" />
        <circle cx="38" cy="44" r="3" fill="#FFFFFF" fillOpacity="0.7" />
        <rect x="18" y="14" width="12" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.7" />
      </svg>
    )
  }

  // ─── 39. EMPLOYEES ──────────────────────────────────────────────────────────
  if (last === 'employees') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`emp_aj_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`emp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>
        <circle cx="16" cy="22" r="7" fill={`url(#emp_aj_${uid})`} fillOpacity="0.7" />
        <path d="M6 42C6 36 10.5 32 16 32C18.5 32 20.8 33 22.5 34.7" stroke={`url(#emp_aj_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="48" cy="22" r="7" fill={`url(#emp_aj_${uid})`} fillOpacity="0.7" />
        <path d="M58 42C58 36 53.5 32 48 32C45.5 32 43.2 33 41.5 34.7" stroke={`url(#emp_aj_${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="20" r="9" fill={`url(#emp_aj_${uid})`} filter={`url(#emp_flt_${uid})`} />
        <path d="M18 46C18 38 24.3 32 32 32C39.7 32 46 38 46 46V52H18V46Z" fill={`url(#emp_aj_${uid})`} />
        <path d="M26 32L32 38L38 32" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.7" />
      </svg>
    )
  }

  // ─── 40. ATTENDANCE / BIOMETRICS ────────────────────────────────────────────
  if (last === 'attendance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`att_ak_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <filter id={`att_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="5" fill={`url(#att_ak_${uid})`} filter={`url(#att_flt_${uid})`} />
        <circle cx="32" cy="32" r="11" fill="none" stroke={`url(#att_ak_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="34 10" />
        <circle cx="32" cy="32" r="17" fill="none" stroke={`url(#att_ak_${uid})`} strokeWidth="3" strokeLinecap="round" strokeDasharray="54 16" />
        <circle cx="32" cy="32" r="23" fill="none" stroke={`url(#att_ak_${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="72 22" strokeOpacity="0.75" />
        <path d="M8 32H56" stroke="#00F0FF" strokeWidth="1.8" strokeOpacity="0.4" strokeDasharray="4 4" />
      </svg>
    )
  }

  // ─── 41. COMPLIANCE (HR / GENERAL) ──────────────────────────────────────────
  if (last === 'compliance' || last === 'saudi-compliance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cmp_al_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E" /><stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <filter id={`cmp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#22C55E" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="30" y="10" width="4" height="44" rx="2" fill={`url(#cmp_al_${uid})`} filter={`url(#cmp_flt_${uid})`} />
        <rect x="16" y="54" width="32" height="4" rx="2" fill={`url(#cmp_al_${uid})`} />
        <rect x="10" y="20" width="44" height="4" rx="2" fill={`url(#cmp_al_${uid})`} />
        <path d="M14 24L10 40H22L18 24" stroke={`url(#cmp_al_${uid})`} strokeWidth="2" fill="none" />
        <ellipse cx="16" cy="40" rx="8" ry="3" fill={`url(#cmp_al_${uid})`} fillOpacity="0.7" />
        <path d="M50 24L46 40H58L54 24" stroke={`url(#cmp_al_${uid})`} strokeWidth="2" fill="none" />
        <ellipse cx="52" cy="40" rx="8" ry="3" fill={`url(#cmp_al_${uid})`} fillOpacity="0.7" />
      </svg>
    )
  }

  // ─── 42. HIRING ─────────────────────────────────────────────────────────────
  if (last === 'hiring') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`hir_am_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <filter id={`hir_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="28" cy="22" r="10" fill={`url(#hir_am_${uid})`} filter={`url(#hir_flt_${uid})`} />
        <path d="M10 50C10 40.6 18.1 33 28 33C33 33 37.5 35 40.5 38.4" stroke={`url(#hir_am_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="48" cy="44" r="12" fill="#1A0830" />
        <circle cx="48" cy="44" r="10" fill={`url(#hir_am_${uid})`} />
        <path d="M48 38V50M42 44H54" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 43. PERFORMANCE ────────────────────────────────────────────────────────
  if (last === 'performance') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prf_ao_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F43F5E" /><stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
          <filter id={`prf_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F43F5E" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="24" fill="none" stroke={`url(#prf_ao_${uid})`} strokeWidth="3" filter={`url(#prf_flt_${uid})`} />
        <circle cx="32" cy="32" r="16" fill="none" stroke={`url(#prf_ao_${uid})`} strokeWidth="3" strokeOpacity="0.75" />
        <circle cx="32" cy="32" r="8" fill="none" stroke={`url(#prf_ao_${uid})`} strokeWidth="3" strokeOpacity="0.55" />
        <circle cx="32" cy="32" r="4" fill={`url(#prf_ao_${uid})`} />
        <path d="M52 12L36 28" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M44 10L54 10L54 20" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    )
  }

  // ─── 44. PAYROLL ────────────────────────────────────────────────────────────
  if (last === 'payroll') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pay_ap_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16A34A" /><stop offset="100%" stopColor="#14532D" />
          </linearGradient>
          <filter id={`pay_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#16A34A" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="8" y="30" width="48" height="26" rx="3" fill="#080A20" />
        <rect x="12" y="30" width="6" height="24" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.75" />
        <rect x="22" y="30" width="6" height="24" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.75" />
        <rect x="32" y="30" width="6" height="24" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.75" />
        <rect x="42" y="30" width="6" height="24" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.75" />
        <rect x="50" y="30" width="6" height="24" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.75" />
        <rect x="6" y="26" width="52" height="6" rx="2" fill={`url(#pay_ap_${uid})`} />
        <path d="M8 26L32 8L56 26" fill={`url(#pay_ap_${uid})`} fillOpacity="0.9" filter={`url(#pay_flt_${uid})`} />
        <rect x="4" y="54" width="56" height="4" rx="2" fill={`url(#pay_ap_${uid})`} fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 45. PAYROLL CALCULATORS ────────────────────────────────────────────────
  if (last === 'calculators') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`calc_aq_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <filter id={`calc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="12" y="8" width="40" height="48" rx="8" fill={`url(#calc_aq_${uid})`} filter={`url(#calc_flt_${uid})`} />
        <rect x="18" y="14" width="28" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="38" y="18" width="6" height="4" rx="1" fill={`url(#calc_aq_${uid})`} />
        <rect x="18" y="32" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="28" y="32" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="38" y="32" width="7" height="6" rx="2" fill="#EF4444" fillOpacity="0.9" />
        <rect x="18" y="42" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.5" />
        <rect x="28" y="42" width="7" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.5" />
        <rect x="38" y="42" width="7" height="6" rx="2" fill="#22C55E" fillOpacity="0.9" />
      </svg>
    )
  }

  // ─── 46. CRM / PIPELINE ─────────────────────────────────────────────────────
  if (last === 'crm' || (last === 'dashboard' && second === 'crm')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`crm_ar_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id={`crm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M8 12H56L44 30H20L8 12Z" fill={`url(#crm_ar_${uid})`} filter={`url(#crm_flt_${uid})`} />
        <rect x="22" y="30" width="20" height="14" rx="2" fill={`url(#crm_ar_${uid})`} fillOpacity="0.75" />
        <path d="M28 44H36V54C36 55.1 34.7 55.7 33.8 55L30.2 52.4C29.5 51.9 28 52.3 28 53V44Z" fill={`url(#crm_ar_${uid})`} fillOpacity="0.65" />
        <line x1="22" y1="20" x2="42" y2="20" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
    )
  }

  // ─── 47. LEADS ──────────────────────────────────────────────────────────────
  if (last === 'leads') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lds_as_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <filter id={`lds_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M16 10C16 10 10 10 10 22C10 34 22 38 28 38" stroke={`url(#lds_as_${uid})`} strokeWidth="6" strokeLinecap="round" fill="none" filter={`url(#lds_flt_${uid})`} />
        <path d="M48 10C48 10 54 10 54 22C54 34 42 38 36 38" stroke={`url(#lds_as_${uid})`} strokeWidth="6" strokeLinecap="round" fill="none" />
        <rect x="12" y="10" width="8" height="8" rx="4" fill={`url(#lds_as_${uid})`} />
        <rect x="44" y="10" width="8" height="8" rx="4" fill={`url(#lds_as_${uid})`} />
        <rect x="28" y="34" width="8" height="10" rx="4" fill={`url(#lds_as_${uid})`} />
        <circle cx="32" cy="50" r="4" fill={`url(#lds_as_${uid})`} />
        <circle cx="22" cy="48" r="3" fill={`url(#lds_as_${uid})`} fillOpacity="0.8" />
        <circle cx="42" cy="48" r="3" fill={`url(#lds_as_${uid})`} fillOpacity="0.8" />
      </svg>
    )
  }

  // ─── 48. CAMPAIGNS ──────────────────────────────────────────────────────────
  if (last === 'campaigns') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cmp_av_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#DB2777" />
          </linearGradient>
          <filter id={`cmp_flt2_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M10 26H24L48 12V52L24 38H10V26Z" fill={`url(#cmp_av_${uid})`} filter={`url(#cmp_flt2_${uid})`} />
        <path d="M52 22C56 26 56 38 52 42" stroke={`url(#cmp_av_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
        <path d="M56 16C64 24 64 40 56 48" stroke={`url(#cmp_av_${uid})`} strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.6" />
        <rect x="10" y="38" width="6" height="14" rx="3" fill={`url(#cmp_av_${uid})`} fillOpacity="0.7" />
      </svg>
    )
  }

  // ─── 49. EMAIL ──────────────────────────────────────────────────────────────
  if (last === 'email' || last === 'newsletter' || last === 'mailbox') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`eml_ax_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <filter id={`eml_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M8 30L56 12L36 54L26 38L8 30Z" fill={`url(#eml_ax_${uid})`} filter={`url(#eml_flt_${uid})`} />
        <path d="M26 38L56 12L36 54L26 38Z" fill="#6D28D9" fillOpacity="0.65" />
        <path d="M26 38L30 30L38 36L26 38Z" fill="#FFFFFF" fillOpacity="0.5" />
      </svg>
    )
  }

  // ─── 50. PROFILE / COMPANY PROFILE ─────────────────────────────────────────
  if (last === 'profile') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prf_ay_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id={`prf_flt2_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="14" y="20" width="36" height="40" rx="4" fill={`url(#prf_ay_${uid})`} filter={`url(#prf_flt2_${uid})`} />
        <path d="M10 22L32 8L54 22" fill={`url(#prf_ay_${uid})`} />
        <rect x="18" y="26" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="30" y="26" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="42" y="26" width="6" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="18" y="36" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="30" y="36" width="8" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="42" y="36" width="6" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="26" y="46" width="12" height="14" rx="2" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 51. SETTINGS ───────────────────────────────────────────────────────────
  if (last === 'settings') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`stg_az_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#64748B" /><stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id={`stg_az2_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94A3B8" /><stop offset="100%" stopColor="#64748B" />
          </linearGradient>
          <filter id={`stg_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#94A3B8" floodOpacity="0.4" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="20" fill={`url(#stg_az_${uid})`} filter={`url(#stg_flt_${uid})`} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const x = 32 + 22 * Math.sin(rad) - 3
          const y = 32 - 22 * Math.cos(rad) - 3
          return <rect key={i} x={x} y={y} width="6" height="6" rx="2" fill={`url(#stg_az2_${uid})`} transform={`rotate(${deg} ${x + 3} ${y + 3})`} />
        })}
        <circle cx="32" cy="32" r="10" fill={`url(#stg_az2_${uid})`} />
        <circle cx="32" cy="32" r="5" fill="#0A1018" />
      </svg>
    )
  }

  // ─── 52. USERS ──────────────────────────────────────────────────────────────
  if (last === 'users') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`usr_ba_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>
          <filter id={`usr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="26" cy="22" r="10" fill={`url(#usr_ba_${uid})`} filter={`url(#usr_flt_${uid})`} />
        <path d="M8 50C8 40 16.1 32 26 32C30 32 33.7 33.4 36.6 35.8" stroke={`url(#usr_ba_${uid})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="46" cy="44" r="14" fill="#1A0030" />
        <path d="M46 32L56 36V44C56 50.6 51.5 55.6 46 57C40.5 55.6 36 50.6 36 44V36L46 32Z" fill={`url(#usr_ba_${uid})`} />
        <path d="M46 39L47.5 43H52L48.5 45.5L50 49.5L46 47L42 49.5L43.5 45.5L40 43H44.5L46 39Z" fill="#FFFFFF" fillOpacity="0.95" />
      </svg>
    )
  }

  // ─── 53. BACKUP ─────────────────────────────────────────────────────────────
  if (last === 'backup') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bak_bb_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`bak_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M44 32C44 32 48 32 50 28C52 24 50 18 44 18C44 18 42 12 36 12C28 12 24 18 24 18C24 18 16 18 16 26C16 32 22 34 26 34H44C44 34 44 34 44 32Z" fill={`url(#bak_bb_${uid})`} filter={`url(#bak_flt_${uid})`} />
        <path d="M32 38V54" stroke={`url(#bak_bb_${uid})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M24 46L32 54L40 46" stroke={`url(#bak_bb_${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="16" y="56" width="32" height="4" rx="2" fill={`url(#bak_bb_${uid})`} fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 54. IOT ────────────────────────────────────────────────────────────────
  if (last === 'iot') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`iot_bd_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id={`iot_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="8" fill={`url(#iot_bd_${uid})`} filter={`url(#iot_flt_${uid})`} />
        <circle cx="12" cy="18" r="5" fill={`url(#iot_bd_${uid})`} fillOpacity="0.8" />
        <circle cx="52" cy="18" r="5" fill={`url(#iot_bd_${uid})`} fillOpacity="0.8" />
        <circle cx="12" cy="46" r="5" fill={`url(#iot_bd_${uid})`} fillOpacity="0.8" />
        <circle cx="52" cy="46" r="5" fill={`url(#iot_bd_${uid})`} fillOpacity="0.8" />
        <circle cx="32" cy="8" r="4" fill={`url(#iot_bd_${uid})`} fillOpacity="0.6" />
        <circle cx="32" cy="56" r="4" fill={`url(#iot_bd_${uid})`} fillOpacity="0.6" />
        <path d="M32 32L12 18M32 32L52 18M32 32L12 46M32 32L52 46M32 32L32 8M32 32L32 56" stroke={`url(#iot_bd_${uid})`} strokeWidth="2" strokeOpacity="0.6" />
      </svg>
    )
  }

  // ─── 55. TAILORING (KHAYYAT) ────────────────────────────────────────────────
  if (second === 'khayyat' || last === 'khayyat' || last === 'stitchings') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`kh_bk_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#9D174D" />
          </linearGradient>
          <filter id={`kh_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M42 10L42 36" stroke={`url(#kh_bk_${uid})`} strokeWidth="4" strokeLinecap="round" filter={`url(#kh_flt_${uid})`} />
        <ellipse cx="42" cy="38" rx="3" ry="5" fill={`url(#kh_bk_${uid})`} />
        <rect x="8" y="28" width="24" height="16" rx="5" fill={`url(#kh_bk_${uid})`} fillOpacity="0.85" />
        <rect x="10" y="32" width="20" height="8" rx="3" fill={`url(#kh_bk_${uid})`} fillOpacity="0.55" />
        <path d="M32 36C36 36 38 36 42 36" stroke={`url(#kh_bk_${uid})`} strokeWidth="2" strokeDasharray="3 2" />
        <ellipse cx="42" cy="36" rx="1.5" ry="2.5" fill="#1A0020" />
        <path d="M8 50H56" stroke={`url(#kh_bk_${uid})`} strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round" />
        <path d="M8 56H56" stroke={`url(#kh_bk_${uid})`} strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeOpacity="0.7" />
      </svg>
    )
  }

  // ─── 56. LAUNDRY ────────────────────────────────────────────────────────────
  if (second === 'laundry' || last === 'laundry') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lnd_bl_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" /><stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`lnd_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#38BDF8" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="10" width="48" height="50" rx="8" fill="#0A1828" />
        <rect x="8" y="10" width="48" height="12" rx="6" fill={`url(#lnd_bl_${uid})`} filter={`url(#lnd_flt_${uid})`} />
        <circle cx="18" cy="16" r="3" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="27" cy="16" r="3" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="36" y="13" width="14" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="32" cy="38" r="18" fill="none" stroke={`url(#lnd_bl_${uid})`} strokeWidth="3" />
        <circle cx="32" cy="38" r="12" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.2" />
        <circle cx="32" cy="38" r="6" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.35" />
        <circle cx="26" cy="32" r="2" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.6" />
        <circle cx="38" cy="32" r="2" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.6" />
        <circle cx="26" cy="44" r="2" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.6" />
        <circle cx="38" cy="44" r="2" fill={`url(#lnd_bl_${uid})`} fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 57. SALOON / BARBERSHOP ────────────────────────────────────────────────
  if (second === 'saloon' || last === 'saloon') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sal_bm_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id={`sal_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="26" y="6" width="12" height="52" rx="6" fill="#0A0820" />
        <path d="M26 12L38 18L26 24L38 30L26 36L38 42L26 48L38 54" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" filter={`url(#sal_flt_${uid})`} />
        <path d="M38 12L26 18L38 24L26 30L38 36L26 42L38 48" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="32" cy="6" rx="7" ry="3" fill={`url(#sal_bm_${uid})`} />
        <ellipse cx="32" cy="58" rx="7" ry="3" fill={`url(#sal_bm_${uid})`} />
      </svg>
    )
  }

  // ─── 58. BOUTIQUE / DRESSES ─────────────────────────────────────────────────
  if (second === 'boutique' || last === 'boutique' || last === 'dresses') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`btq_bn_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#BE185D" />
          </linearGradient>
          <filter id={`btq_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M26 8H38L44 20C44 20 40 24 40 28L52 56H12L24 28C24 24 20 20 20 20L26 8Z" fill={`url(#btq_bn_${uid})`} filter={`url(#btq_flt_${uid})`} />
        <path d="M26 8C28 12 36 12 38 8" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.6" />
        <path d="M22 32C26 30 38 30 42 32" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeOpacity="0.6" />
        <circle cx="46" cy="14" r="2.5" fill="#FFD700" />
        <circle cx="50" cy="8" r="1.5" fill="#FFD700" fillOpacity="0.8" />
        <circle cx="52" cy="18" r="1.5" fill="#FFD700" fillOpacity="0.6" />
      </svg>
    )
  }

  // ─── 59. BOOKSTORE ──────────────────────────────────────────────────────────
  if (second === 'bookstore' || last === 'bookstore') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bks_bo_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="50%" stopColor="#EC4899" /><stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <filter id={`bks_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="10" y="38" width="44" height="14" rx="4" fill={`url(#bks_bo_${uid})`} filter={`url(#bks_flt_${uid})`} />
        <rect x="8" y="38" width="6" height="14" rx="3" fill="#6D28D9" />
        <rect x="14" y="26" width="38" height="14" rx="4" fill={`url(#bks_bo_${uid})`} fillOpacity="0.85" />
        <rect x="12" y="26" width="6" height="14" rx="3" fill="#EC4899" />
        <rect x="16" y="14" width="34" height="14" rx="4" fill={`url(#bks_bo_${uid})`} fillOpacity="0.65" />
        <rect x="14" y="14" width="6" height="14" rx="3" fill="#F97316" />
        <rect x="26" y="40" width="24" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="26" y="44" width="18" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // ─── 60. BAKALA / GROCERY ───────────────────────────────────────────────────
  if (second === 'bakala' || last === 'bakala') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bak_bp_${uid}`} x1="8" y1="24" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`bak_flt2_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M14 34H50L46 54H18L14 34Z" fill={`url(#bak_bp_${uid})`} filter={`url(#bak_flt2_${uid})`} />
        <rect x="12" y="30" width="40" height="6" rx="3" fill={`url(#bak_bp_${uid})`} />
        <path d="M22 30C22 22 42 22 42 30" stroke={`url(#bak_bp_${uid})`} strokeWidth="4" strokeLinecap="round" fill="none" />
        <line x1="28" y1="34" x2="28" y2="54" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.35" />
        <line x1="36" y1="34" x2="36" y2="54" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.35" />
        <line x1="14" y1="44" x2="50" y2="44" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.35" />
        <circle cx="24" cy="28" r="5" fill="#EF4444" />
        <circle cx="32" cy="26" r="5" fill="#22C55E" />
        <circle cx="40" cy="28" r="5" fill="#F59E0B" />
      </svg>
    )
  }

  // ─── 61. ECOMMERCE / ONLINE STORE ───────────────────────────────────────────
  if (last === 'ecommerce' || second === 'ecommerce') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ecom_bi_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <filter id={`ecom_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F97316" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M14 22H50L46 54H18L14 22Z" fill={`url(#ecom_bi_${uid})`} filter={`url(#ecom_flt_${uid})`} />
        <path d="M24 22C24 16 28 12 32 12C36 12 40 16 40 22" stroke={`url(#ecom_bi_${uid})`} strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="38" r="8" fill="#FFFFFF" fillOpacity="0.25" />
        <path d="M28 38L31 41L36 35" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="30" width="36" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.25" />
      </svg>
    )
  }

  // ─── 62. FLEET / VEHICLES / CARS ────────────────────────────────────────────
  if (['fleet', 'vehicles', 'all-cars', 'active'].includes(last)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`flt_bh_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id={`flt_flt2_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4" />
          </filter>
        </defs>
        <path d="M10 36L16 24H48L54 36V44H10V36Z" fill={`url(#flt_bh_${uid})`} filter={`url(#flt_flt2_${uid})`} />
        <path d="M20 24L26 14H38L44 24" fill={`url(#flt_bh_${uid})`} fillOpacity="0.75" />
        <path d="M22 24L26 16H38L42 24" fill="#00E5FF" fillOpacity="0.75" />
        <circle cx="20" cy="46" r="8" fill="#0A1018" />
        <circle cx="20" cy="46" r="5" fill="#1E40AF" />
        <circle cx="20" cy="46" r="2" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="44" cy="46" r="8" fill="#0A1018" />
        <circle cx="44" cy="46" r="5" fill="#1E40AF" />
        <circle cx="44" cy="46" r="2" fill="#FFFFFF" fillOpacity="0.6" />
        <line x1="32" y1="24" x2="32" y2="44" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.35" />
      </svg>
    )
  }

  // ─── 63. CAR RENTAL ─────────────────────────────────────────────────────────
  if (second === 'rental' || (last === 'checkout' && second === 'rental')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`rnt_br_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`rnt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx="22" cy="26" r="14" fill="none" stroke={`url(#rnt_br_${uid})`} strokeWidth="5" filter={`url(#rnt_flt_${uid})`} />
        <circle cx="22" cy="26" r="6" fill={`url(#rnt_br_${uid})`} fillOpacity="0.55" />
        <path d="M32 32L52 52" stroke={`url(#rnt_br_${uid})`} strokeWidth="5" strokeLinecap="round" />
        <path d="M44 44L48 40" stroke={`url(#rnt_br_${uid})`} strokeWidth="4" strokeLinecap="round" />
        <path d="M50 50L54 46" stroke={`url(#rnt_br_${uid})`} strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 64. FURNITURE ──────────────────────────────────────────────────────────
  if (second === 'furniture' || last === 'furniture') {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fur_bs_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" /><stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`fur_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0EA5E9" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect x="16" y="28" width="32" height="18" rx="8" fill={`url(#fur_bs_${uid})`} filter={`url(#fur_flt_${uid})`} />
        <rect x="8" y="28" width="10" height="18" rx="5" fill={`url(#fur_bs_${uid})`} fillOpacity="0.85" />
        <rect x="46" y="28" width="10" height="18" rx="5" fill={`url(#fur_bs_${uid})`} fillOpacity="0.85" />
        <rect x="10" y="18" width="44" height="14" rx="6" fill={`url(#fur_bs_${uid})`} fillOpacity="0.75" />
        <rect x="30" y="28" width="3" height="18" rx="1.5" fill="#FFFFFF" fillOpacity="0.25" />
        <rect x="14" y="46" width="6" height="10" rx="3" fill="#0369A1" />
        <rect x="44" y="46" width="6" height="10" rx="3" fill="#0369A1" />
      </svg>
    )
  }

  // ─── 65. TRAVEL ─────────────────────────────────────────────────────────────
  if (cleanAppId === 'travel_agency' || second === 'travel' || last === 'travel-bookings' || cleanLabel.includes('travel') || cleanLabel.includes('سفر')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`trv_bq_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" /><stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          <filter id={`trv_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>
        <path d="M32 8C32 8 26 14 14 24L20 26L10 38L18 36L20 42L36 30C40 36 44 44 44 52C50 46 54 38 54 30C54 18 44 8 32 8Z" fill={`url(#trv_bq_${uid})`} filter={`url(#trv_flt_${uid})`} />
        <path d="M20 26L36 30" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.8" />
        <circle cx="32" cy="32" r="18" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
        <path d="M10 38L6 50" stroke={`url(#trv_bq_${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.6" />
        <path d="M18 36L14 48" stroke={`url(#trv_bq_${uid})`} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.45" />
      </svg>
    )
  }

  // ─── 66. MANUFACTURING & MES ───────────────────────────────────────────────
  if (
    cleanAppId === 'manufacturing' ||
    cleanAppId === 'manufacturing_mes' ||
    cleanIcon === 'factory' ||
    last === 'manufacturing' ||
    second === 'manufacturing' ||
    cleanLabel.includes('manufacturing') ||
    cleanLabel.includes('تصنيع') ||
    cleanLabel.includes('إنتاج')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mfg_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id={`mfg_gear_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#CFFAFE" />
          </linearGradient>
          <filter id={`mfg_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0891B2" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#mfg_bg_${uid})`} filter={`url(#mfg_flt_${uid})`} />
        {/* Factory Roof & Chimneys */}
        <path d="M16 46V30L26 36V30L36 36V22H48V46H16Z" fill="#164E63" fillOpacity="0.4" />
        {/* High-tech Gear */}
        <circle cx="38" cy="28" r="8" fill={`url(#mfg_gear_${uid})`} />
        <circle cx="38" cy="28" r="4" fill="#0891B2" />
        <path d="M38 18V22M38 34V38M28 28H32M44 28H48" stroke={`url(#mfg_gear_${uid})`} strokeWidth="2.5" strokeLinecap="round" />
        {/* Assembly Beam */}
        <rect x="14" y="44" width="36" height="4" rx="2" fill="#ECFEFF" fillOpacity="0.8" />
        <circle cx="20" cy="46" r="1.5" fill="#0891B2" />
        <circle cx="32" cy="46" r="1.5" fill="#0891B2" />
        <circle cx="44" cy="46" r="1.5" fill="#0891B2" />
      </svg>
    )
  }

  // ─── 67. BOUTIQUE & DRESS RENTAL ───────────────────────────────────────────
  if (
    cleanAppId === 'boutique' ||
    cleanAppId === 'boutique_rental' ||
    last === 'boutique-rentals' ||
    second === 'boutique-rentals' ||
    cleanLabel.includes('boutique') ||
    cleanLabel.includes('فساتين') ||
    cleanLabel.includes('أزياء')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`btq_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C026D3" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
          <filter id={`btq_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#C026D3" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#btq_bg_${uid})`} filter={`url(#btq_flt_${uid})`} />
        {/* Designer Dress Silhouette */}
        <path d="M26 18C28 22 36 22 38 18C38 23 34 26 34 30L44 48H20L30 30C30 26 26 23 26 18Z" fill="#FFFFFF" fillOpacity="0.95" />
        {/* Gold Belt */}
        <rect x="28" y="28" width="8" height="2.5" rx="1" fill="#FDE047" />
        {/* Crown Accent */}
        <path d="M29 15L32 12L35 15L37 13L32 18L27 13L29 15Z" fill="#FDE047" />
        {/* Sparkles */}
        <circle cx="18" cy="22" r="1.5" fill="#FFFFFF" opacity="0.8" />
        <circle cx="46" cy="26" r="2" fill="#FDE047" opacity="0.9" />
      </svg>
    )
  }

  // ─── 68. CAR WORKSHOP & SERVICE GARAGE ─────────────────────────────────────
  if (
    cleanAppId === 'car_workshop' ||
    cleanAppId === 'workshop' ||
    cleanIcon === 'wrench' ||
    last === 'car-workshop' ||
    second === 'car-workshop' ||
    cleanLabel.includes('workshop') ||
    cleanLabel.includes('ورشة') ||
    cleanLabel.includes('صيانة سيارات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`wks_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id={`wks_wrench_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
          <filter id={`wks_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.5" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#wks_bg_${uid})`} filter={`url(#wks_flt_${uid})`} />
        {/* Brake Disc / Wheel */}
        <circle cx="32" cy="32" r="14" stroke="#94A3B8" strokeWidth="3" opacity="0.4" />
        <circle cx="32" cy="32" r="6" stroke="#94A3B8" strokeWidth="2" opacity="0.6" />
        {/* Crossed Heavy Wrench */}
        <path d="M42 16L36 22L42 28L44 26L48 26L48 20L44 20L42 16Z" fill={`url(#wks_wrench_${uid})`} />
        <path d="M37 23L20 40C18 42 18 45 20 47C22 49 25 49 27 47L44 30" stroke={`url(#wks_wrench_${uid})`} strokeWidth="4" strokeLinecap="round" />
        {/* Screwdriver */}
        <path d="M22 18L44 44" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.8" />
      </svg>
    )
  }

  // ─── 69. BOOKSTORE & STATIONERY ───────────────────────────────────────────
  if (
    cleanAppId === 'bookstore' ||
    cleanAppId === 'bookstore_stationery' ||
    cleanIcon === 'book' ||
    last === 'book-rentals' ||
    second === 'book-rentals' ||
    cleanLabel.includes('bookstore') ||
    cleanLabel.includes('مكتبة') ||
    cleanLabel.includes('قرطاسية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bks_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`bks_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#bks_bg_${uid})`} filter={`url(#bks_flt_${uid})`} />
        {/* Open Hardcover Book */}
        <path d="M16 22C22 20 28 22 32 24C36 22 42 20 48 22V44C42 42 36 44 32 46C28 44 22 42 16 44V22Z" fill="#FFFFFF" />
        <path d="M32 24V46" stroke="#D97706" strokeWidth="2" />
        {/* Text Lines */}
        <path d="M20 28H28M20 33H26M20 38H28" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M36 28H44M36 33H42M36 38H44" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bookmark Ribbon */}
        <path d="M30 20V32L32 30L34 32V20H30Z" fill="#EF4444" />
      </svg>
    )
  }

  // ─── 70. E-COMMERCE ONLINE STORE ──────────────────────────────────────────
  if (
    cleanAppId === 'ecommerce' ||
    cleanAppId === 'ecommerce_store' ||
    cleanIcon === 'shoppingbag' ||
    last === 'ecommerce-orders' ||
    second === 'ecommerce-orders' ||
    cleanLabel.includes('ecommerce') ||
    cleanLabel.includes('متجر إلكتروني')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ecom_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id={`ecom_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#ecom_bg_${uid})`} filter={`url(#ecom_flt_${uid})`} />
        {/* Shopping Cart */}
        <path d="M16 18H21L26 36H42L47 22H24" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="44" r="3.5" fill="#38BDF8" />
        <circle cx="40" cy="44" r="3.5" fill="#38BDF8" />
        {/* Glowing Package inside */}
        <rect x="29" y="22" width="10" height="9" rx="2" fill="#FDE047" />
        <path d="M34 22V31" stroke="#CA8A04" strokeWidth="1" />
      </svg>
    )
  }

  // ─── 71. FURNITURE SHOWROOM & ASSEMBLY ─────────────────────────────────────
  if (
    cleanAppId === 'furniture_shop' ||
    cleanAppId === 'furniture' ||
    cleanIcon === 'armchair' ||
    last === 'furniture-orders' ||
    second === 'furniture-orders' ||
    cleanLabel.includes('furniture') ||
    cleanLabel.includes('أثاث') ||
    cleanLabel.includes('مفروشات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fur_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#78716C" />
            <stop offset="100%" stopColor="#A8A29E" />
          </linearGradient>
          <linearGradient id={`fur_chair_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`fur_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#44403C" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#fur_bg_${uid})`} filter={`url(#fur_flt_${uid})`} />
        {/* Modern Armchair */}
        <path d="M22 22C22 18 26 16 32 16C38 16 42 18 42 22V36H22V22Z" fill={`url(#fur_chair_${uid})`} />
        <rect x="18" y="28" width="6" height="12" rx="3" fill="#B45309" />
        <rect x="40" y="28" width="6" height="12" rx="3" fill="#B45309" />
        <rect x="20" y="36" width="24" height="6" rx="2" fill="#FDE68A" />
        {/* Wooden Legs */}
        <path d="M23 42L20 50M41 42L44 50" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 72. CONSTRUCTION & PROJECTS ───────────────────────────────────────────
  if (
    cleanAppId === 'construction' ||
    cleanAppId === 'construction_projects' ||
    cleanIcon === 'building' ||
    last === 'construction' ||
    cleanLabel.includes('construction') ||
    cleanLabel.includes('مقاولات') ||
    cleanLabel.includes('مشاريع')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cst_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <filter id={`cst_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#cst_bg_${uid})`} filter={`url(#cst_flt_${uid})`} />
        {/* Construction Crane & Building */}
        <rect x="30" y="22" width="18" height="26" rx="2" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="34" y="26" width="3" height="3" fill="#EA580C" />
        <rect x="41" y="26" width="3" height="3" fill="#EA580C" />
        <rect x="34" y="32" width="3" height="3" fill="#EA580C" />
        <rect x="41" y="32" width="3" height="3" fill="#EA580C" />
        {/* Crane Tower */}
        <path d="M18 48V16H22V48" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 16H36L30 22" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M30 22V32" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    )
  }

  // ─── 73. CAR RENTAL & FLEET ────────────────────────────────────────────────
  if (
    cleanAppId === 'car_rental' ||
    cleanIcon === 'car' ||
    last === 'car-rental' ||
    cleanLabel.includes('car rental') ||
    cleanLabel.includes('تأجير سيارات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`crnt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id={`crnt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1D4ED8" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#crnt_bg_${uid})`} filter={`url(#crnt_flt_${uid})`} />
        {/* Car Silhouette */}
        <path d="M16 34L22 22H42L48 34V42H16V34Z" fill="#FFFFFF" />
        <circle cx="23" cy="42" r="4.5" fill="#0F172A" />
        <circle cx="23" cy="42" r="2" fill="#60A5FA" />
        <circle cx="41" cy="42" r="4.5" fill="#0F172A" />
        <circle cx="41" cy="42" r="2" fill="#60A5FA" />
        {/* Windshield */}
        <path d="M24 25L20 33H44L40 25H24Z" fill="#93C5FD" />
        {/* Key Fob Glow */}
        <circle cx="48" cy="18" r="3" fill="#FDE047" />
      </svg>
    )
  }

  // ─── 74. LAUNDRY & DRY CLEANING ───────────────────────────────────────────
  if (
    cleanAppId === 'laundry' ||
    cleanAppId === 'laundry_cleaning' ||
    cleanIcon === 'shirt' ||
    last === 'laundry' ||
    cleanLabel.includes('laundry') ||
    cleanLabel.includes('مغسلة') ||
    cleanLabel.includes('تنظيف')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lnd_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <filter id={`lnd_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0891B2" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#lnd_bg_${uid})`} filter={`url(#lnd_flt_${uid})`} />
        {/* Washing Machine Body */}
        <rect x="18" y="16" width="28" height="34" rx="4" fill="#FFFFFF" />
        {/* Door Glass & Bubbles */}
        <circle cx="32" cy="35" r="10" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.5" />
        <circle cx="30" cy="33" r="3" fill="#38BDF8" opacity="0.8" />
        <circle cx="34" cy="37" r="2" fill="#38BDF8" opacity="0.6" />
        {/* Knobs */}
        <circle cx="24" cy="22" r="2" fill="#0284C7" />
        <line x1="30" y1="22" x2="40" y2="22" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── 75. SALOON & BARBER SPA ───────────────────────────────────────────────
  if (
    cleanAppId === 'saloon' ||
    cleanAppId === 'saloon_barber' ||
    cleanIcon === 'scissors' ||
    last === 'saloon' ||
    cleanLabel.includes('saloon') ||
    cleanLabel.includes('صالون') ||
    cleanLabel.includes('حلاقة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sal_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id={`sal_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#sal_bg_${uid})`} filter={`url(#sal_flt_${uid})`} />
        {/* Crossed Stylist Scissors */}
        <circle cx="22" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
        <circle cx="42" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
        <path d="M24 41L42 19M40 41L22 19" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="30" r="2" fill="#FDE047" />
      </svg>
    )
  }

  // ─── 76. TAILOR & KHAYYAT ──────────────────────────────────────────────────
  if (
    cleanAppId === 'khayyat' ||
    cleanAppId === 'tailor_khayyat' ||
    last === 'khayyat' ||
    cleanLabel.includes('khayyat') ||
    cleanLabel.includes('خياط') ||
    cleanLabel.includes('تفصيل')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`khy_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id={`khy_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#khy_bg_${uid})`} filter={`url(#khy_flt_${uid})`} />
        {/* Thread Spool */}
        <rect x="22" y="20" width="20" height="24" rx="4" fill="#C4B5FD" />
        <path d="M22 26H42M22 32H42M22 38H42" stroke="#6D28D9" strokeWidth="2" />
        {/* Needle */}
        <path d="M48 14L34 28" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="46" cy="16" r="1" fill="#7C3AED" />
      </svg>
    )
  }

  // ─── 77. MANPOWER & LABOR SUPPLY ───────────────────────────────────────────
  if (
    cleanAppId === 'manpower' ||
    cleanAppId === 'manpower_supply' ||
    last === 'manpower' ||
    cleanLabel.includes('manpower') ||
    cleanLabel.includes('عمالة') ||
    cleanLabel.includes('كوادر')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mnp_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
          <filter id={`mnp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0D9488" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#mnp_bg_${uid})`} filter={`url(#mnp_flt_${uid})`} />
        {/* Multi-Worker Badges & Safety Helmets */}
        <circle cx="32" cy="22" r="5" fill="#FFFFFF" />
        <path d="M20 44C20 36 24 32 32 32C40 32 44 36 44 44H20Z" fill="#FFFFFF" />
        <circle cx="20" cy="26" r="3.5" fill="#CCFBF1" />
        <circle cx="44" cy="26" r="3.5" fill="#CCFBF1" />
        {/* Yellow Hardhats */}
        <path d="M27 20C27 17 29 16 32 16C35 16 37 17 37 20H27Z" fill="#FDE047" />
      </svg>
    )
  }

  // ─── 78. BAKALA & SUPERMARKET ──────────────────────────────────────────────
  if (
    cleanAppId === 'bakala' ||
    cleanAppId === 'bakala_supermarket' ||
    last === 'bakala' ||
    cleanLabel.includes('bakala') ||
    cleanLabel.includes('بقالة') ||
    cleanLabel.includes('سوبرماركت')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bkl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id={`bkl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#bkl_bg_${uid})`} filter={`url(#bkl_flt_${uid})`} />
        {/* Grocery Basket */}
        <path d="M18 28H46L42 46H22L18 28Z" fill="#FFFFFF" />
        <path d="M24 28L32 16L40 28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Produce: Apple & Milk */}
        <circle cx="28" cy="35" r="3.5" fill="#EF4444" />
        <rect x="34" y="30" width="5" height="10" rx="1" fill="#38BDF8" />
      </svg>
    )
  }

  // ─── 79. SAUDI GOV: ZATCA PHASE 2 ───────────────────────────────────────────
  if (
    cleanAppId === 'zatca' ||
    cleanAppId === 'zatca_phase2' ||
    cleanIcon === 'zatca' ||
    cleanLabel.includes('zatca') ||
    cleanLabel.includes('زاتكا') ||
    cleanLabel.includes('فاتورة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`zat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id={`zat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#047857" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#zat_bg_${uid})`} filter={`url(#zat_flt_${uid})`} />
        {/* Official Saudi Palm & QR Code */}
        <rect x="20" y="18" width="24" height="28" rx="3" fill="#FFFFFF" />
        <rect x="24" y="22" width="6" height="6" fill="#047857" />
        <rect x="34" y="22" width="6" height="6" fill="#047857" />
        <rect x="24" y="32" width="6" height="6" fill="#047857" />
        <path d="M34 32H40V38H34V32Z" fill="#10B981" />
        {/* Green Verification Check */}
        <circle cx="44" cy="42" r="6" fill="#059669" />
        <path d="M41 42L43 44L47 40" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ─── 80. SAUDI GOV: QIWA & MUQEEM ──────────────────────────────────────────
  if (
    cleanAppId === 'qiwa' ||
    cleanAppId === 'muqeem' ||
    cleanLabel.includes('qiwa') ||
    cleanLabel.includes('muqeem') ||
    cleanLabel.includes('قوى') ||
    cleanLabel.includes('مقيم')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`qiw_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <filter id={`qiw_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1E3A8A" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#qiw_bg_${uid})`} filter={`url(#qiw_flt_${uid})`} />
        {/* Passport / Iqama Emblem */}
        <rect x="20" y="16" width="24" height="32" rx="3" fill="#FFFFFF" />
        <circle cx="32" cy="26" r="4" fill="#2563EB" />
        <path d="M26 36C26 33 28 32 32 32C36 32 38 33 38 36H26Z" fill="#2563EB" />
        <path d="M24 42H40" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // ─── FALLBACK: Unique-per-path Colored Glowing Crystal ───────────────────────
  const hash = (path + label).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const shapes = [
    ([c1, c2]) => <path d="M32 8L54 24L46 50H18L10 24L32 8Z" fill={`url(#fc_${uid})`} />,
    ([c1, c2]) => <path d="M22 8H42L56 22V42L42 56H22L8 42V22L22 8Z" fill={`url(#fc_${uid})`} />,
    ([c1, c2]) => <path d="M32 6L37 22H54L40 32L45 48L32 38L19 48L24 32L10 22H27L32 6Z" fill={`url(#fc_${uid})`} />,
    ([c1, c2]) => <path d="M32 6L56 32L32 58L8 32L32 6Z" fill={`url(#fc_${uid})`} />,
    ([c1, c2]) => <circle cx="32" cy="32" r="24" fill={`url(#fc_${uid})`} />,
  ]
  const palettes = [
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
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'],
    ['#a1c4fd', '#c2e9fb'],
  ]
  const [c1, c2] = palettes[hash % palettes.length]
  const ShapeComp = shapes[hash % shapes.length]

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`fc_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <filter id={`fc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor={c1} floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#fc_flt_${uid})`}>
        {ShapeComp([c1, c2])}
      </g>
      <circle cx="32" cy="32" r="6" fill="#FFFFFF" fillOpacity="0.7" />
      <circle cx="22" cy="22" r="4" fill="#FFFFFF" fillOpacity="0.3" />
    </svg>
  )
}

export default App3DIcon
