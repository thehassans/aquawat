import React from 'react'
import { resolveAppStoreBrandIcon } from './AppStoreBrandIcons'

/**
 * Ultra-premium 3D Glowing SVG app icons.
 * Every single module, sub-page, and catalog app gets a 100% unique,
 * semantically correct, hand-crafted 3D icon with bespoke lighting and radiant glow.
 *
 * SPECIFIC SUB-ROUTES MATCH FIRST to guarantee visual distinction across all verticals!
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

  const brandIcon = resolveAppStoreBrandIcon({
    appId: cleanAppId,
    icon: cleanIcon,
    label: cleanLabel,
    uid,
    className,
  })
  if (brandIcon) return brandIcon

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 0. MARQUEE & EVENT HALL MANAGEMENT 3D GLOWING ICONS ──────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════

  // 1. Marquee Event Packages (3D Royal Gold Banquet / Cloche Platter with Sparkles)
  if (
    (last === 'packages' && second === 'marquee') ||
    cleanLabel.includes('event packages') ||
    cleanLabel.includes('باقات المناسبات') ||
    cleanAppId === 'marquee_management' ||
    cleanLabel === 'marquee'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`marq_pkg_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={`marq_pkg_gold_${uid}`} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id={`marq_pkg_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#marq_pkg_bg_${uid})`} filter={`url(#marq_pkg_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.6" />
        
        {/* Glow */}
        <circle cx="32" cy="30" r="14" fill="#FDE047" fillOpacity="0.3" />

        {/* 3D Cloche Dome / Banquet Cover */}
        <path d="M18 36 C18 24, 46 24, 46 36 Z" fill={`url(#marq_pkg_gold_${uid})`} stroke="#FFFFFF" strokeWidth="1" />
        {/* Handle */}
        <circle cx="32" cy="22" r="3" fill="#FFFBEB" stroke="#B45309" strokeWidth="1" />
        {/* Platter Base */}
        <rect x="14" y="36" width="36" height="5" rx="2.5" fill="#FFFBEB" stroke="#D97706" strokeWidth="0.8" />
        
        {/* Sparkles */}
        <circle cx="22" cy="18" r="1.5" fill="#FFFFFF" />
        <circle cx="44" cy="18" r="1.5" fill="#FFFFFF" />
        <circle cx="48" cy="28" r="1.2" fill="#FDE68A" />
      </svg>
    )
  }

  // 2. Marquee Bookings & Calendar / Appointments (3D Rose Gold Calendar with Diamond)
  if (
    (last === 'appointments' && second === 'marquee') ||
    cleanLabel.includes('bookings & calendar') ||
    cleanLabel.includes('حجوزات القاعات') ||
    cleanLabel.includes('marquee appointments')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`marq_apt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#831843" />
          </linearGradient>
          <linearGradient id={`marq_apt_card_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FCE7F3" />
          </linearGradient>
          <filter id={`marq_apt_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#marq_apt_bg_${uid})`} filter={`url(#marq_apt_flt_${uid})`} stroke="#FBCFE8" strokeWidth="1.2" strokeOpacity="0.6" />
        
        {/* Calendar Card */}
        <rect x="15" y="17" width="34" height="34" rx="7" fill={`url(#marq_apt_card_${uid})`} stroke="#F472B6" strokeWidth="0.8" />
        {/* Header Ribbon */}
        <path d="M15 24 C15 20.13, 18.13 17, 22 17 L42 17 C45.87 17, 49 20.13, 49 24 L15 24 Z" fill="#BE185D" />
        {/* Rings */}
        <circle cx="23" cy="16" r="2" fill="#FFFFFF" />
        <circle cx="41" cy="16" r="2" fill="#FFFFFF" />

        {/* Sparkling Diamond in Center */}
        <path d="M32 29 L38 35 L32 43 L26 35 Z" fill="#EC4899" stroke="#9D174D" strokeWidth="0.8" />
        <circle cx="32" cy="35" r="2.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // 3. Marquee Table QR Menu (3D Emerald Glowing QR Plate)
  if (
    (last === 'qr-menu' && second === 'marquee') ||
    cleanLabel.includes('table qr menu') ||
    cleanLabel.includes('قائمة الطاولات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`marq_qr_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>
          <filter id={`marq_qr_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#marq_qr_bg_${uid})`} filter={`url(#marq_qr_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.6" />
        
        {/* White QR Card */}
        <rect x="16" y="16" width="32" height="32" rx="8" fill="#FFFFFF" stroke="#A7F3D0" strokeWidth="1" />
        
        {/* QR Pattern */}
        <rect x="20" y="20" width="8" height="8" rx="2" fill="#047857" />
        <rect x="22" y="22" width="4" height="4" fill="#FFFFFF" />
        <rect x="36" y="20" width="8" height="8" rx="2" fill="#047857" />
        <rect x="38" y="22" width="4" height="4" fill="#FFFFFF" />
        <rect x="20" y="36" width="8" height="8" rx="2" fill="#047857" />
        <rect x="22" y="38" width="4" height="4" fill="#FFFFFF" />
        <rect x="34" y="34" width="4" height="4" rx="1" fill="#047857" />
        <rect x="40" y="40" width="4" height="4" rx="1" fill="#047857" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 0. GYM & FITNESS CLUB ULTRA-PREMIUM 3D GLOWING ICONS ─────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════

  // 1. Gym Dashboard (3D Metallic Hexagonal Dumbbell with Neon Aura)
  if (
    (last === 'dashboard' && second === 'gym') ||
    (last === 'gym' && second !== 'dashboard') ||
    cleanIcon === 'dumbbell' ||
    cleanLabel.includes('gym dashboard') ||
    cleanLabel.includes('لوحة تحكم النادي') ||
    cleanLabel.includes('لوحة تحكم الصالة') ||
    cleanLabel === 'gym & fitness' ||
    cleanLabel === 'الصالة الرياضية'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_db_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>
          <linearGradient id={`gym_db_metal_${uid}`} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="75%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id={`gym_db_glow_${uid}`} x1="10" y1="20" x2="54" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <filter id={`gym_db_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_db_bg_${uid})`} filter={`url(#gym_db_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.6" />
        
        {/* Glow Aura */}
        <circle cx="32" cy="32" r="18" fill={`url(#gym_db_glow_${uid})`} fillOpacity="0.25" />

        {/* 3D Dumbbell Bar */}
        <rect x="18" y="30" width="28" height="4" rx="2" fill="url(#gym_db_metal_uid)" stroke="#FFFFFF" strokeWidth="0.8" />
        {/* Knurling Grips */}
        <line x1="26" y1="29" x2="26" y2="35" stroke="#10B981" strokeWidth="1" />
        <line x1="32" y1="29" x2="32" y2="35" stroke="#10B981" strokeWidth="1" />
        <line x1="38" y1="29" x2="38" y2="35" stroke="#10B981" strokeWidth="1" />

        {/* Left Inner Weight Plate */}
        <rect x="16" y="22" width="4" height="20" rx="2" fill={`url(#gym_db_metal_${uid})`} stroke="#6EE7B7" strokeWidth="0.8" />
        {/* Left Outer Weight Plate */}
        <rect x="11" y="20" width="4" height="24" rx="2" fill={`url(#gym_db_metal_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />

        {/* Right Inner Weight Plate */}
        <rect x="44" y="22" width="4" height="20" rx="2" fill={`url(#gym_db_metal_${uid})`} stroke="#6EE7B7" strokeWidth="0.8" />
        {/* Right Outer Weight Plate */}
        <rect x="49" y="20" width="4" height="24" rx="2" fill={`url(#gym_db_metal_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />

        {/* Center Sparkle Accent */}
        <circle cx="32" cy="18" r="1.5" fill="#FDE047" />
        <circle cx="46" cy="16" r="2" fill="#6EE7B7" />
      </svg>
    )
  }

  // 2. Gym Members Directory (3D Holographic NFC Card & Smart Member Badge)
  if (
    (last === 'members' && second === 'gym') ||
    cleanLabel.includes('members directory') ||
    cleanLabel.includes('دليل الأعضاء')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_mem_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id={`gym_card_grad_${uid}`} x1="14" y1="16" x2="50" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E0E7FF" />
            <stop offset="100%" stopColor="#C7D2FE" />
          </linearGradient>
          <filter id={`gym_mem_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_mem_bg_${uid})`} filter={`url(#gym_mem_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Member Badge Body */}
        <rect x="14" y="16" width="36" height="34" rx="6" fill={`url(#gym_card_grad_${uid})`} stroke="#FFFFFF" strokeWidth="1" />
        
        {/* Lanyard Clip */}
        <rect x="28" y="12" width="8" height="6" rx="2" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="32" cy="15" r="1.5" fill="#475569" />

        {/* Avatar Silhouette */}
        <circle cx="24" cy="27" r="5" fill="#4F46E5" />
        <path d="M17 38C17 34 20 33 24 33C28 33 31 34 31 38" fill="#4F46E5" />

        {/* Info Lines */}
        <rect x="34" y="24" width="12" height="2.5" rx="1.2" fill="#312E81" />
        <rect x="34" y="29" width="8" height="2" rx="1" fill="#6366F1" />
        <rect x="34" y="34" width="10" height="2" rx="1" fill="#94A3B8" />

        {/* Active Badge Status Beacon */}
        <circle cx="43" cy="42" r="3" fill="#10B981" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    )
  }

  // 3. Gym Membership Plans & Pricing (3D Gold Tier Crown & Diamond Shield)
  if (
    (last === 'plans' && second === 'gym') ||
    cleanLabel.includes('membership plans') ||
    cleanLabel.includes('باقات الاشتراك')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_pln_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#9A3412" />
          </linearGradient>
          <linearGradient id={`gym_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="40%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>
          <filter id={`gym_pln_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_pln_bg_${uid})`} filter={`url(#gym_pln_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* VIP Shield */}
        <path d="M32 15L45 20V32C45 40 39 46 32 49C25 46 19 40 19 32V20L32 15Z" fill="#7C2D12" stroke={`url(#gym_gold_${uid})`} strokeWidth="1.5" />

        {/* 3D Crown */}
        <path d="M25 34L23 25L28 28L32 23L36 28L41 25L39 34H25Z" fill={`url(#gym_gold_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="23" cy="24" r="1.2" fill="#FFFFFF" />
        <circle cx="32" cy="22" r="1.5" fill="#FFFFFF" />
        <circle cx="41" cy="24" r="1.2" fill="#FFFFFF" />

        {/* 3 Rating Stars */}
        <circle cx="27" cy="40" r="1.5" fill="#FDE047" />
        <circle cx="32" cy="42" r="2" fill="#FDE047" />
        <circle cx="37" cy="40" r="1.5" fill="#FDE047" />
      </svg>
    )
  }

  // 4. Gym Subscriptions Lifecycle (3D Auto-Renew Infinite Calendar & Snowflake Freeze)
  if (
    (last === 'subscriptions' && second === 'gym') ||
    cleanLabel.includes('subscriptions') ||
    cleanLabel.includes('الاشتراكات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_sub_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id={`gym_sub_card_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`gym_sub_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_sub_bg_${uid})`} filter={`url(#gym_sub_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Glowing Credit Card */}
        <rect x="15" y="19" width="34" height="22" rx="4" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1.2" />
        <rect x="15" y="24" width="34" height="4" fill="#0369A1" />
        
        {/* Golden EMV Chip */}
        <rect x="20" y="30" width="6" height="5" rx="1" fill="#FACC15" stroke="#FFFFFF" strokeWidth="0.5" />

        {/* Sync / Renewal Rotating Ring */}
        <path d="M38 31C39.5 32.5 40 34.5 39 36.5L42 38" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
        <path d="M36 41C34.5 39.5 34 37.5 35 35.5L32 34" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
        
        {/* Active Pulse */}
        <circle cx="44" cy="22" r="3" fill="#34D399" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    )
  }

  // 5. Gym Check-In Kiosk (3D Laser Optical Scanner & Biometric Gate)
  if (
    (last === 'checkin' && second === 'gym') ||
    cleanLabel.includes('check-in kiosk') ||
    cleanLabel.includes('كشك الدخول')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_chk_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id={`gym_laser_${uid}`} x1="16" y1="32" x2="48" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="50%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <filter id={`gym_chk_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4338CA" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_chk_bg_${uid})`} filter={`url(#gym_chk_flt_${uid})`} stroke="#818CF8" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Viewfinder Corners */}
        <path d="M18 24V18H24" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M46 24V18H40" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M18 40V46H24" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M46 40V46H40" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />

        {/* QR Code Nodes */}
        <rect x="23" y="23" width="6" height="6" rx="1" fill="#FFFFFF" />
        <rect x="35" y="23" width="6" height="6" rx="1" fill="#FFFFFF" />
        <rect x="23" y="35" width="6" height="6" rx="1" fill="#FFFFFF" />
        <rect x="35" y="35" width="3" height="3" fill="#22D3EE" />
        <rect x="38" y="38" width="3" height="3" fill="#FFFFFF" />

        {/* Luminous Red/Cyan Laser Scan Bar */}
        <line x1="16" y1="32" x2="48" y2="32" stroke={`url(#gym_laser_${uid})`} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="32" x2="48" y2="32" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  }

  // 6. Gym Group Classes Timetable (3D Aerobic Fitness Waves & Stopwatch Calendar)
  if (
    (last === 'classes' && second === 'gym') ||
    cleanLabel.includes('class timetable') ||
    cleanLabel.includes('جدول الحصص')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_cls_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#9D174D" />
          </linearGradient>
          <filter id={`gym_cls_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_cls_bg_${uid})`} filter={`url(#gym_cls_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Calendar / Timetable Slate */}
        <rect x="15" y="16" width="34" height="32" rx="5" fill="#831843" stroke="#FBCFE8" strokeWidth="1.2" />
        <rect x="15" y="16" width="34" height="8" rx="5" fill="#F43F5E" />

        {/* Stopwatch Bezel */}
        <circle cx="32" cy="34" r="9" fill="#500724" stroke="#FDE047" strokeWidth="1.5" />
        <line x1="32" y1="34" x2="32" y2="29" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="34" x2="36" y2="34" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="34" r="1.5" fill="#FFFFFF" />

        {/* Top Binder Pins */}
        <rect x="22" y="13" width="3" height="6" rx="1.5" fill="#FFFFFF" />
        <rect x="39" y="13" width="3" height="6" rx="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // 7. Gym Coaches & Trainers (3D Gold Medal & Whistle of Excellence)
  if (
    (last === 'trainers' && second === 'gym') ||
    cleanLabel.includes('coaches & trainers') ||
    cleanLabel.includes('المدربون')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_trn_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={`gym_trn_gold_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id={`gym_trn_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_trn_bg_${uid})`} filter={`url(#gym_trn_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Award Ribbon */}
        <path d="M26 15L32 25L38 15" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Gold Medal Body */}
        <circle cx="32" cy="34" r="13" fill={`url(#gym_trn_gold_${uid})`} stroke="#FFFFFF" strokeWidth="1.2" />
        <circle cx="32" cy="34" r="10" stroke="#78350F" strokeWidth="0.8" strokeDasharray="2 1" />

        {/* Star in Center */}
        <path d="M32 28L34 32.5L38.5 33L35 36.5L36 41L32 38.5L28 41L29 36.5L25.5 33L30 32.5L32 28Z" fill="#78350F" stroke="#FFFFFF" strokeWidth="0.5" />
      </svg>
    )
  }

  // 8. Gym Personal Training (PT) Packages (3D Bullseye Target & Lightning Surge)
  if (
    (last === 'pt-packages' && second === 'gym') ||
    cleanLabel.includes('personal training') ||
    cleanLabel.includes('التدريب الشخصي')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_pt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </linearGradient>
          <filter id={`gym_pt_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#DC2626" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_pt_bg_${uid})`} filter={`url(#gym_pt_flt_${uid})`} stroke="#FCA5A5" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Target Outer Rings */}
        <circle cx="32" cy="32" r="16" fill="#450A0A" stroke="#FCA5A5" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="11" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.2" />
        <circle cx="32" cy="32" r="6" fill="#FACC15" />

        {/* 3D Lightning Energy Bolt */}
        <path d="M35 16L24 33H33L29 48L42 29H33L35 16Z" fill="#FFFFFF" stroke="#FEF08A" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    )
  }

  // 9. Gym InBody & Measurements (3D Bio-Impedance Smart Scale & Biometric Wave)
  if (
    (last === 'measurements' && second === 'gym') ||
    cleanLabel.includes('inbody') ||
    cleanLabel.includes('القياسات البدنية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_mes_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>
          <linearGradient id={`gym_scale_glass_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#DDD6FE" />
          </linearGradient>
          <filter id={`gym_mes_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_mes_bg_${uid})`} filter={`url(#gym_mes_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Smart Scale Glass Platform */}
        <rect x="14" y="15" width="36" height="34" rx="8" fill={`url(#gym_scale_glass_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" />

        {/* Digital OLED Display */}
        <rect x="22" y="19" width="20" height="8" rx="3" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.8" />
        <text x="32" y="25" fill="#38BDF8" fontSize="5" fontWeight="900" fontFamily="monospace" textAnchor="middle">72.5 kg</text>

        {/* 4 Corner Chrome Electrodes */}
        <circle cx="20" cy="32" r="3" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="44" cy="32" r="3" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="20" cy="42" r="3" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="44" cy="42" r="3" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="0.8" />

        {/* Biometric Pulse Wave */}
        <path d="M26 37L29 37L31 34L33 40L35 37L38 37" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // 10. Gym Locker Rooms (3D Smart Titanium Locker & Keyless Lock)
  if (
    (last === 'lockers' && second === 'gym') ||
    cleanLabel.includes('locker rooms') ||
    cleanLabel.includes('خزائن الملابس')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_lok_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id={`gym_door_metal_${uid}`} x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <filter id={`gym_lok_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#334155" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_lok_bg_${uid})`} filter={`url(#gym_lok_flt_${uid})`} stroke="#94A3B8" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Locker Door */}
        <rect x="18" y="14" width="28" height="36" rx="4" fill={`url(#gym_door_metal_${uid})`} stroke="#E2E8F0" strokeWidth="1.2" />

        {/* Ventilation Louvers */}
        <line x1="24" y1="20" x2="40" y2="20" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="24" y1="23" x2="40" y2="23" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="24" y1="26" x2="40" y2="26" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />

        {/* Digital Keypad Handle */}
        <rect x="36" y="32" width="6" height="10" rx="1.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.8" />
        <circle cx="39" cy="35" r="1" fill="#34D399" />
        <circle cx="39" cy="38" r="1" fill="#38BDF8" />

        {/* Locker Number Plate */}
        <rect x="24" y="34" width="8" height="5" rx="1" fill="#FEF08A" stroke="#0F172A" strokeWidth="0.5" />
        <text x="28" y="38" fill="#0F172A" fontSize="3.5" fontWeight="900" textAnchor="middle">01</text>
      </svg>
    )
  }

  // 11. Gym Analytics & Heatmap (3D 24/7 Peak Hours Spectrum & Rising Momentum)
  if (
    (last === 'analytics' && second === 'gym') ||
    cleanLabel.includes('analytics & heatmap') ||
    cleanLabel.includes('التحليلات والذروة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`gym_ana_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>
          <linearGradient id={`gym_bar1_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id={`gym_bar2_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id={`gym_bar3_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <filter id={`gym_ana_flt_${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0F766E" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="15" fill={`url(#gym_ana_bg_${uid})`} filter={`url(#gym_ana_flt_${uid})`} stroke="#5EEAD4" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* Rising 3D Bar Columns */}
        <rect x="16" y="34" width="6" height="14" rx="2" fill={`url(#gym_bar1_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <rect x="25" y="27" width="6" height="21" rx="2" fill={`url(#gym_bar2_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <rect x="34" y="20" width="6" height="28" rx="2" fill={`url(#gym_bar3_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <rect x="43" y="16" width="6" height="32" rx="2" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="0.8" />

        {/* Upward Momentum Trend Arrow */}
        <path d="M16 30L26 23L34 16L45 12" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41 12H45V16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (
    last === 'calendar' ||
    cleanIcon === 'calendar' ||
    cleanIcon === 'calendardays' ||
    cleanIcon === 'calendarrange' ||
    cleanLabel.includes('التقويم') ||
    cleanLabel === 'calendar'
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
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
          <radialGradient id={`cal_ring_${uid}`} cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.2" />
          </radialGradient>
          <filter id={`cal_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#FF2E5B" floodOpacity="0.35" />
          </filter>
        </defs>

        <rect x="7" y="9" width="50" height="48" rx="14" fill={`url(#cal_body_${uid})`} filter={`url(#cal_flt_${uid})`} stroke="#E2E8F0" strokeWidth="1" />
        <path d="M7 23C7 15.268 13.268 9 21 9H43C50.732 9 57 15.268 57 23V25H7V23Z" fill={`url(#cal_header_${uid})`} />
        
        {/* Binder Rings */}
        <rect x="18" y="5" width="4" height="8" rx="2" fill={`url(#cal_ring_${uid})`} stroke="#CBD5E1" strokeWidth="0.5" />
        <rect x="42" y="5" width="4" height="8" rx="2" fill={`url(#cal_ring_${uid})`} stroke="#CBD5E1" strokeWidth="0.5" />

        {/* Day Name */}
        <text x="32" y="19" fill="#FFFFFF" fontSize="8" fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle" letterSpacing="0.8">
          {dayName}
        </text>

        {/* Live Day Date */}
        <text x="32" y="47" fill="#0F172A" fontSize="23" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle">
          {todayDate}
        </text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 1. POS / CASH REGISTER / POINT OF SALE (RESTAURANT, BAKALA, BOUTIQUE, ETC.) ─
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'pos' ||
    cleanLabel.includes('point of sale') ||
    cleanLabel.includes('نقطة البيع') ||
    cleanLabel === 'pos' ||
    cleanLabel === 'tailor pos'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pos_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <linearGradient id={`pos_scrn_${uid}`} x1="12" y1="12" x2="44" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id={`pos_btn_${uid}`} x1="20" y1="46" x2="44" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id={`pos_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#06B6D4" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Outer Glowing Base */}
        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#pos_bg_${uid})`} filter={`url(#pos_flt_${uid})`} stroke="#67E8F9" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Terminal Screen Stand */}
        <rect x="14" y="14" width="36" height="26" rx="5" fill={`url(#pos_scrn_${uid})`} stroke="#38BDF8" strokeWidth="1.2" />
        
        {/* Screen Data Lines */}
        <rect x="18" y="18" width="16" height="3" rx="1.5" fill="#38BDF8" />
        <rect x="18" y="24" width="10" height="2" rx="1" fill="#94A3B8" />
        <rect x="18" y="28" width="14" height="2" rx="1" fill="#94A3B8" />
        
        {/* Live Total Pill */}
        <rect x="36" y="22" width="10" height="8" rx="2" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="1" />
        <path d="M38.5 26L40.5 28L44 24.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Card Reader / Receipt Slot */}
        <rect x="22" y="44" width="20" height="8" rx="3" fill={`url(#pos_btn_${uid})`} />
        <path d="M26 48H38" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Paper Receipt Ejecting */}
        <path d="M25 10H39V14H25V10Z" fill="#FFFFFF" fillOpacity="0.9" />
        <line x1="28" y1="12" x2="36" y2="12" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 2. MENU ITEMS / GOURMET RECIPE MENU (RESTAURANT) ─────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'menu-items' ||
    (last === 'menu' && second === 'restaurant') ||
    cleanLabel.includes('menu items') ||
    cleanLabel.includes('قائمة الطعام')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`menu_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#BE123C" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <linearGradient id={`menu_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`menu_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#BE123C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#menu_bg_${uid})`} filter={`url(#menu_flt_${uid})`} stroke="#FDA4AF" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Menu Book Cover */}
        <rect x="15" y="13" width="34" height="38" rx="4" fill="#4C0519" stroke={`url(#menu_gold_${uid})`} strokeWidth="1.5" />
        <line x1="21" y1="13" x2="21" y2="51" stroke={`url(#menu_gold_${uid})`} strokeWidth="1.5" strokeDasharray="2 2" />

        {/* Crossed Fork & Knife in Golden Medallion */}
        <circle cx="33" cy="27" r="10" fill={`url(#menu_gold_${uid})`} fillOpacity="0.2" stroke={`url(#menu_gold_${uid})`} strokeWidth="1" />
        
        {/* Fork */}
        <path d="M28 22V26C28 27.5 29 28.5 30.5 29V34M30 22V26M32 22V26" stroke={`url(#menu_gold_${uid})`} strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Knife */}
        <path d="M36 22C34.5 24 34.5 27 34.5 29V34" stroke={`url(#menu_gold_${uid})`} strokeWidth="1.5" strokeLinecap="round" />

        {/* Menu Page Lines */}
        <rect x="25" y="40" width="18" height="2" rx="1" fill="#FECDD3" />
        <rect x="25" y="44" width="12" height="2" rx="1" fill="#FECDD3" fillOpacity="0.7" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 3. TABLES / RESTAURANT FLOOR PLAN ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'tables' ||
    cleanLabel.includes('tables') ||
    cleanLabel.includes('طاولات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`tbl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id={`tbl_top_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`tbl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4338CA" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#tbl_bg_${uid})`} filter={`url(#tbl_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 4 Surrounding Modern Chairs */}
        <rect x="27" y="13" width="10" height="4" rx="2" fill="#818CF8" />
        <rect x="27" y="47" width="10" height="4" rx="2" fill="#818CF8" />
        <rect x="13" y="27" width="4" height="10" rx="2" fill="#818CF8" />
        <rect x="47" y="27" width="4" height="10" rx="2" fill="#818CF8" />

        {/* Center Round Dining Table */}
        <circle cx="32" cy="32" r="14" fill={`url(#tbl_top_${uid})`} stroke="#FEF3C7" strokeWidth="1.5" />
        
        {/* Table Glass Candle Glow */}
        <circle cx="32" cy="32" r="4" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="32" cy="32" r="7" fill="#FDE047" fillOpacity="0.3" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 4. INVENTORY / STOCK CRATES & BOXES (RESTAURANT, ECOM, TRADING) ─────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'inventory' ||
    cleanLabel.includes('inventory') ||
    cleanLabel.includes('المخزون') ||
    cleanLabel.includes('مخزون')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`inv_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id={`inv_box1_${uid}`} x1="16" y1="16" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="100%" stopColor="#FB923C" />
          </linearGradient>
          <linearGradient id={`inv_box2_${uid}`} x1="30" y1="24" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FED7AA" />
            <stop offset="100%" stopColor="#FDBA74" />
          </linearGradient>
          <filter id={`inv_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#inv_bg_${uid})`} filter={`url(#inv_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Isometric Shipping Boxes Stack */}
        {/* Bottom Left Box */}
        <path d="M14 34L26 27L38 34L26 41L14 34Z" fill={`url(#inv_box1_${uid})`} />
        <path d="M14 34L26 41V51L14 44V34Z" fill="#C2410C" />
        <path d="M26 41L38 34V44L26 51V41Z" fill="#9A3412" />

        {/* Top Right Box */}
        <path d="M26 22L38 15L50 22L38 29L26 22Z" fill={`url(#inv_box2_${uid})`} />
        <path d="M26 22L38 29V39L26 32V22Z" fill="#EA580C" />
        <path d="M38 29L50 22V32L38 39V29Z" fill="#C2410C" />

        {/* Barcode on Front */}
        <line x1="30" y1="25" x2="34" y2="27.5" stroke="#FFFFFF" strokeWidth="1" />
        <line x1="32" y1="23.5" x2="36" y2="26" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 5. ORDERS / TICKETS & ORDER BELL (RESTAURANT, ECOMMERCE, LAUNDRY) ────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'orders' ||
    last === 'ecommerce-orders' ||
    cleanLabel.includes('orders') ||
    cleanLabel.includes('الطلبات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ord_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>
          <linearGradient id={`ord_bell_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <filter id={`ord_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#ord_bg_${uid})`} filter={`url(#ord_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Service Order Bell */}
        {/* Top Button */}
        <rect x="30" y="16" width="4" height="4" rx="2" fill={`url(#ord_bell_${uid})`} />
        {/* Dome */}
        <path d="M18 36C18 26 24 20 32 20C40 20 46 26 46 36H18Z" fill={`url(#ord_bell_${uid})`} />
        {/* Dome Highlight */}
        <ellipse cx="32" cy="24" rx="8" ry="2.5" fill="#FFFFFF" fillOpacity="0.6" />
        {/* Base Plate */}
        <rect x="14" y="36" width="36" height="5" rx="2.5" fill="#4C1D95" stroke="#A78BFA" strokeWidth="1" />

        {/* Glowing Order Ticket */}
        <rect x="22" y="43" width="20" height="7" rx="2" fill="#FFFFFF" />
        <line x1="25" y1="46.5" x2="35" y2="46.5" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 6. CASHIER PANEL / TILL REGISTER ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'cashier' ||
    cleanAppId === 'restaurant_cashier' ||
    cleanLabel.includes('cashier') ||
    cleanLabel.includes('كاشير')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`csh_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`csh_gold_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`csh_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#csh_bg_${uid})`} filter={`url(#csh_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Cash Register Display Screen */}
        <rect x="22" y="14" width="20" height="12" rx="3" fill="#064E3B" stroke="#34D399" strokeWidth="1" />
        <text x="32" y="23" fill="#34D399" fontSize="8" fontWeight="800" fontFamily="monospace" textAnchor="middle">0.00</text>

        {/* Cash Drawer Base */}
        <rect x="14" y="28" width="36" height="22" rx="4" fill="#064E3B" stroke="#6EE7B7" strokeWidth="1" />
        
        {/* Drawer Key Slot & Buttons */}
        <circle cx="19" cy="34" r="2" fill="#34D399" />
        <circle cx="25" cy="34" r="2" fill="#34D399" />
        <circle cx="31" cy="34" r="2" fill="#34D399" />
        <circle cx="19" cy="40" r="2" fill="#34D399" />
        <circle cx="25" cy="40" r="2" fill="#34D399" />
        <circle cx="31" cy="40" r="2" fill="#34D399" />

        {/* Golden Coin Stack in Drawer */}
        <circle cx="41" cy="37" r="5" fill={`url(#csh_gold_${uid})`} stroke="#FFFFFF" strokeWidth="0.8" />
        <text x="41" y="40" fill="#78350F" fontSize="6" fontWeight="900" textAnchor="middle">﷼</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 7. KITCHEN / CHEF SAUTE PAN & SIZZLING FLAME ─────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'kitchen' ||
    cleanLabel.includes('kitchen') ||
    cleanLabel.includes('مطبخ')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ktc_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id={`ktc_flame_${uid}`} x1="20" y1="12" x2="44" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <filter id={`ktc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DC2626" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#ktc_bg_${uid})`} filter={`url(#ktc_flt_${uid})`} stroke="#FCA5A5" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Sizzling Flame */}
        <path d="M32 14C32 14 36 19 36 23C36 26 34 28 32 28C30 28 28 26 28 23C28 19 32 14 32 14Z" fill={`url(#ktc_flame_${uid})`} />
        <path d="M26 18C26 18 29 21 29 24C29 26 28 27 26.5 27C25 27 24 26 24 24C24 21 26 18 26 18Z" fill="#FDE047" />
        <path d="M38 18C38 18 41 21 41 24C41 26 40 27 38.5 27C37 27 36 26 36 24C36 21 38 18 38 18Z" fill="#FDE047" />

        {/* Heavy Chef Sauté Pan */}
        <path d="M16 30H44C44 38 38 43 30 43H30C22 43 16 38 16 30Z" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5" />
        
        {/* Ergonomic Stainless Steel Handle */}
        <path d="M43 32L53 38" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
        
        {/* Sauté Highlights */}
        <circle cx="26" cy="35" r="2" fill="#FBBF24" />
        <circle cx="34" cy="36" r="2.5" fill="#22C55E" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 8. KDS BOARD / KITCHEN DISPLAY SCREEN (RESTAURANT) ───────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'kds' ||
    cleanAppId === 'restaurant_kds' ||
    cleanLabel.includes('kds') ||
    cleanLabel.includes('شاشة المطبخ')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`kds_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id={`kds_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6366F1" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#kds_bg_${uid})`} filter={`url(#kds_flt_${uid})`} stroke="#818CF8" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* KDS Monitor Screen Frame */}
        <rect x="13" y="14" width="38" height="28" rx="4" fill="#030712" stroke="#6366F1" strokeWidth="1.5" />
        
        {/* 3 Live Ticket Cards (Green Ready, Yellow Prep, Red New) */}
        {/* Red Ticket */}
        <rect x="16" y="17" width="10" height="18" rx="2" fill="#EF4444" fillOpacity="0.25" stroke="#EF4444" strokeWidth="1" />
        <rect x="18" y="19" width="6" height="2" rx="1" fill="#EF4444" />
        <rect x="18" y="23" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
        <rect x="18" y="26" width="4" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.6" />

        {/* Yellow Ticket */}
        <rect x="27" y="17" width="10" height="18" rx="2" fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1" />
        <rect x="29" y="19" width="6" height="2" rx="1" fill="#F59E0B" />
        <rect x="29" y="23" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
        <rect x="29" y="26" width="5" height="1.5" rx="0.75" fill="#FFFFFF" fillOpacity="0.6" />

        {/* Green Ticket */}
        <rect x="38" y="17" width="10" height="18" rx="2" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="1" />
        <rect x="40" y="19" width="6" height="2" rx="1" fill="#10B981" />
        <rect x="40" y="23" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
        <path d="M42 27L43.5 28.5L46 26" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />

        {/* Monitor Base Stand */}
        <rect x="29" y="42" width="6" height="5" rx="1" fill="#475569" />
        <rect x="24" y="47" width="16" height="3" rx="1.5" fill="#64748B" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 9. BRANCHES / MULTI-LOCATION STOREFRONTS ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'branches' ||
    cleanAppId === 'restaurant_branches' ||
    cleanAppId === 'multi_branch' ||
    cleanLabel.includes('branches') ||
    cleanLabel.includes('الفروع')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`brn_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`brn_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#brn_bg_${uid})`} filter={`url(#brn_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Left Storefront */}
        <rect x="13" y="26" width="16" height="22" rx="3" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1" />
        <rect x="16" y="30" width="4" height="4" rx="1" fill="#BAE6FD" />
        <rect x="22" y="30" width="4" height="4" rx="1" fill="#BAE6FD" />
        <rect x="18" y="38" width="6" height="10" rx="1" fill="#38BDF8" />

        {/* Right Storefront (Taller Main Branch) */}
        <rect x="31" y="18" width="20" height="30" rx="3" fill="#082F49" stroke="#7DD3FC" strokeWidth="1.2" />
        <rect x="35" y="22" width="4" height="4" rx="1" fill="#E0F2FE" />
        <rect x="43" y="22" width="4" height="4" rx="1" fill="#E0F2FE" />
        <rect x="35" y="29" width="4" height="4" rx="1" fill="#E0F2FE" />
        <rect x="43" y="29" width="4" height="4" rx="1" fill="#E0F2FE" />
        <rect x="38" y="38" width="6" height="10" rx="1" fill="#38BDF8" />

        {/* Connected Location Map Pin */}
        <circle cx="21" cy="18" r="4" fill="#EF4444" />
        <circle cx="21" cy="18" r="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 10. QR MENU & CONTACTLESS CATALOG (RESTAURANT & SALOON) ──────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'qr-menu' ||
    last === 'qr' ||
    cleanLabel.includes('qr menu') ||
    cleanLabel.includes('رمز القائمة') ||
    cleanLabel.includes('كتالوج qr')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`qr_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9333EA" />
            <stop offset="100%" stopColor="#6B21A8" />
          </linearGradient>
          <filter id={`qr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#9333EA" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#qr_bg_${uid})`} filter={`url(#qr_flt_${uid})`} stroke="#D8B4FE" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Smartphone Scanner Silhouette */}
        <rect x="15" y="13" width="34" height="38" rx="6" fill="#FFFFFF" stroke="#E9D5FF" strokeWidth="1.5" />
        
        {/* 3D Glowing QR Grid */}
        <rect x="21" y="19" width="8" height="8" rx="1.5" fill="#581C87" />
        <rect x="23" y="21" width="4" height="4" rx="0.5" fill="#FFFFFF" />
        <rect x="35" y="19" width="8" height="8" rx="1.5" fill="#581C87" />
        <rect x="37" y="21" width="4" height="4" rx="0.5" fill="#FFFFFF" />
        <rect x="21" y="33" width="8" height="8" rx="1.5" fill="#581C87" />
        <rect x="23" y="35" width="4" height="4" rx="0.5" fill="#FFFFFF" />

        {/* Center Pixel Blocks */}
        <rect x="31" y="21" width="2" height="4" fill="#9333EA" />
        <rect x="31" y="29" width="4" height="2" fill="#9333EA" />
        <rect x="35" y="33" width="3" height="3" fill="#9333EA" />
        <rect x="40" y="37" width="3" height="3" fill="#9333EA" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 11. RESERVATIONS & APPOINTMENTS (RESTAURANT & SALOON) ───────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'reservations' ||
    last === 'appointments' ||
    last === 'rental-calendar' ||
    cleanAppId === 'restaurant_reservations' ||
    cleanLabel.includes('reservations') ||
    cleanLabel.includes('appointments') ||
    cleanLabel.includes('الحجوزات') ||
    cleanLabel.includes('المواعيد')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`res_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#9F1239" />
          </linearGradient>
          <linearGradient id={`res_clock_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`res_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#E11D48" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#res_bg_${uid})`} filter={`url(#res_flt_${uid})`} stroke="#FDA4AF" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* VIP Reserved Plate Stand */}
        <path d="M15 36L20 22H44L49 36H15Z" fill="#4C0519" stroke="#FECDD3" strokeWidth="1.2" />
        <rect x="18" y="25" width="28" height="8" rx="2" fill="#FFE4E6" />
        <text x="32" y="31" fill="#9F1239" fontSize="6.5" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.5">RESERVED</text>

        {/* 3D Golden Chrono Clock */}
        <circle cx="32" cy="42" r="10" fill={`url(#res_clock_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M32 36V42L36 44" stroke="#881337" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 12. COMBOS & DEALS (BURGER + DRINK COMBO PACK) ───────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'combos' ||
    last === 'deals' ||
    cleanLabel.includes('combos') ||
    cleanLabel.includes('عروض والباقات') ||
    cleanLabel.includes('الباقات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cmb_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={`cmb_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`cmb_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#cmb_bg_${uid})`} filter={`url(#cmb_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Fast Food Cold Soda Cup */}
        <path d="M37 20L39 46H49L51 20H37Z" fill="#DC2626" stroke="#FEF08A" strokeWidth="1" />
        <path d="M44 14L43 20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        
        {/* Gourmet Burger */}
        {/* Top Bun */}
        <path d="M14 34C14 26 34 26 34 34H14Z" fill={`url(#cmb_gold_${uid})`} stroke="#78350F" strokeWidth="1" />
        {/* Lettuce & Tomato */}
        <rect x="13" y="34" width="22" height="3" rx="1.5" fill="#22C55E" />
        <rect x="14" y="37" width="20" height="3" rx="1" fill="#DC2626" />
        {/* Patty */}
        <rect x="13" y="40" width="22" height="3" rx="1.5" fill="#451A03" />
        {/* Bottom Bun */}
        <rect x="14" y="43" width="20" height="4" rx="2" fill={`url(#cmb_gold_${uid})`} stroke="#78350F" strokeWidth="1" />

        {/* 3D Star Burst Deal Badge */}
        <circle cx="24" cy="18" r="6" fill="#FDE047" stroke="#EF4444" strokeWidth="1.5" />
        <text x="24" y="20.5" fill="#DC2626" fontSize="7" fontWeight="900" textAnchor="middle">%</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 13. ANALYTICS & SALES REPORTS ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'analytics' ||
    last === 'sales-report' ||
    cleanLabel.includes('analytics') ||
    cleanLabel.includes('تحليلات') ||
    cleanLabel.includes('تقرير المبيعات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`anl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id={`anl_line_${uid}`} x1="14" y1="46" x2="50" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#4ADE80" />
          </linearGradient>
          <filter id={`anl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0D9488" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#anl_bg_${uid})`} filter={`url(#anl_flt_${uid})`} stroke="#99F6E4" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Bar Columns */}
        <rect x="15" y="36" width="7" height="14" rx="2" fill="#14B8A6" fillOpacity="0.6" stroke="#99F6E4" strokeWidth="1" />
        <rect x="26" y="28" width="7" height="22" rx="2" fill="#14B8A6" fillOpacity="0.8" stroke="#99F6E4" strokeWidth="1" />
        <rect x="37" y="20" width="7" height="30" rx="2" fill="#2DD4BF" stroke="#FFFFFF" strokeWidth="1.2" />

        {/* Upward Growth Arrow Line */}
        <path d="M16 34L28 24L38 16L48 12" stroke={`url(#anl_line_${uid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M42 12H48V18" stroke={`url(#anl_line_${uid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Glowing Data Dots */}
        <circle cx="16" cy="34" r="2.5" fill="#FFFFFF" />
        <circle cx="28" cy="24" r="2.5" fill="#FFFFFF" />
        <circle cx="38" cy="16" r="2.5" fill="#FFFFFF" />
        <circle cx="48" cy="12" r="3" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 14. MESS / CAFETERIA MEAL TRAY ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'mess' ||
    cleanAppId === 'restaurant_mess' ||
    cleanLabel.includes('mess') ||
    cleanLabel.includes('cafeteria') ||
    cleanLabel.includes('مطعم جماعي')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`mss_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <filter id={`mss_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#334155" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#mss_bg_${uid})`} filter={`url(#mss_flt_${uid})`} stroke="#CBD5E1" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Stainless Steel Compartment Meal Tray */}
        <rect x="13" y="16" width="38" height="32" rx="4" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
        
        {/* Tray Compartments */}
        <rect x="16" y="19" width="16" height="12" rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
        <rect x="34" y="19" width="14" height="12" rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
        <rect x="16" y="33" width="10" height="12" rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
        <rect x="28" y="33" width="20" height="12" rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />

        {/* Nutritious Foods in Tray */}
        <circle cx="24" cy="25" r="4" fill="#F59E0B" />
        <circle cx="41" cy="25" r="3.5" fill="#22C55E" />
        <circle cx="21" cy="39" r="3" fill="#EF4444" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 15. DELIVERY & COURIER LOGISTICS ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'delivery' ||
    last === 'couriers' ||
    cleanLabel.includes('delivery') ||
    cleanLabel.includes('courier') ||
    cleanLabel.includes('توصيل') ||
    cleanLabel.includes('شحن')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dlv_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <filter id={`dlv_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#dlv_bg_${uid})`} filter={`url(#dlv_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* High Speed Delivery Motorbike / Van */}
        {/* Express Box on back */}
        <rect x="14" y="24" width="14" height="14" rx="2" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
        <path d="M14 30H28" stroke="#CA8A04" strokeWidth="1" />

        {/* Bike Frame */}
        <path d="M26 34L34 26H44L48 34H26Z" fill="#FFFFFF" />
        <path d="M44 26L48 20H42" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

        {/* Wheels */}
        <circle cx="21" cy="42" r="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="43" cy="42" r="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="21" cy="42" r="2" fill="#FDE047" />
        <circle cx="43" cy="42" r="2" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 16. PRODUCTS / RETAIL CATALOG (BAKALA, BOOKSTORE, ECOM, TRADING) ─────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'products' ||
    cleanLabel.includes('products') ||
    cleanLabel.includes('المنتجات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prd_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>
          <filter id={`prd_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prd_bg_${uid})`} filter={`url(#prd_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 4 Colorful Product Cubes */}
        <rect x="15" y="15" width="15" height="15" rx="4" fill="#EC4899" stroke="#FFFFFF" strokeWidth="1" />
        <rect x="34" y="15" width="15" height="15" rx="4" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="1" />
        <rect x="15" y="34" width="15" height="15" rx="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="1" />
        <rect x="34" y="34" width="15" height="15" rx="4" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1" />

        {/* Glossy top sheen */}
        <ellipse cx="22.5" cy="19" rx="4" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <ellipse cx="41.5" cy="19" rx="4" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <ellipse cx="22.5" cy="38" rx="4" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <ellipse cx="41.5" cy="38" rx="4" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 17. ADD PRODUCT / NEW ITEM ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'add-product' ||
    (last === 'new' && second === 'products') ||
    cleanLabel.includes('add product') ||
    cleanLabel.includes('إضافة منتج')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`add_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`add_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#10B981" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#add_bg_${uid})`} filter={`url(#add_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Product Box */}
        <path d="M18 26L32 18L46 26L32 34L18 26Z" fill="#A7F3D0" />
        <path d="M18 26L32 34V46L18 38V26Z" fill="#34D399" />
        <path d="M32 34L46 26V38L32 46V34Z" fill="#059669" />

        {/* 3D Glowing Neon Plus Badge */}
        <circle cx="44" cy="44" r="10" fill="#FFFFFF" stroke="#047857" strokeWidth="1.5" />
        <path d="M44 38V50M38 44H50" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 18. STOCK ALERTS / WARNING NOTIFICATIONS ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'alerts' ||
    cleanLabel.includes('stock alerts') ||
    cleanLabel.includes('تنبيهات المخزون') ||
    cleanLabel.includes('تنبيهات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`alt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id={`alt_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`alt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DC2626" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#alt_bg_${uid})`} filter={`url(#alt_flt_${uid})`} stroke="#FCA5A5" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Warning Triangle */}
        <path d="M32 14L48 42H16L32 14Z" fill={`url(#alt_gold_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" />
        
        {/* Exclamation Mark inside Triangle */}
        <path d="M32 24V32" stroke="#7F1D1D" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="37" r="1.8" fill="#7F1D1D" />

        {/* Glowing Bell Ring Badge */}
        <circle cx="45" cy="19" r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="45" cy="19" r="2" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 19. EXPIRY & WASTE MANAGEMENT ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'expiry-waste' ||
    cleanLabel.includes('expiry') ||
    cleanLabel.includes('الانتهاء والهدر')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`exp_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#BE185D" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <filter id={`exp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#BE185D" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#exp_bg_${uid})`} filter={`url(#exp_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Glowing Hourglass */}
        <path d="M22 16H42M22 48H42" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 16C24 28 40 28 40 16" fill="#FCE7F3" fillOpacity="0.3" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M24 48C24 36 40 36 40 48" fill="#FCE7F3" fillOpacity="0.3" stroke="#FFFFFF" strokeWidth="1.5" />
        
        {/* Falling Sand */}
        <path d="M27 46C27 40 37 40 37 46H27Z" fill="#FDE047" />
        <circle cx="32" cy="32" r="1.5" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 20. PROMOTIONS & DISCOUNTS ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'promotions' ||
    last === 'coupons' ||
    cleanLabel.includes('promotions') ||
    cleanLabel.includes('العروض') ||
    cleanLabel.includes('كوبونات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prm_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id={`prm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#F59E0B" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prm_bg_${uid})`} filter={`url(#prm_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Price Tag with Gold Eyelet */}
        <path d="M17 17H31L47 33C49 35 49 38 47 40L39 48C37 50 34 50 32 48L16 32V18C16 17.5 16.5 17 17 17Z" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.5" />
        
        {/* Eyelet & String */}
        <circle cx="23" cy="24" r="3" fill="#FFFFFF" />
        <path d="M23 24L17 12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

        {/* 50% Text Ribbon */}
        <text x="34" y="38" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">%</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 21. PROFIT MARGINS & TRENDING PROFITS ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'profit-margins' ||
    cleanLabel.includes('profit margins') ||
    cleanLabel.includes('هوامش الربح')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prf_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16A34A" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <filter id={`prf_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#16A34A" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prf_bg_${uid})`} filter={`url(#prf_flt_${uid})`} stroke="#86EFAC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Trending Profit Dial */}
        <circle cx="32" cy="34" r="16" fill="#052E16" stroke="#4ADE80" strokeWidth="1.5" />
        <path d="M22 34C22 28.5 26.5 24 32 24C37.5 24 42 28.5 42 34" stroke="#86EFAC" strokeWidth="3" strokeLinecap="round" strokeDasharray="16 4" />
        
        {/* Dial Needle */}
        <path d="M32 34L39 27" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="34" r="3" fill="#FDE047" />

        {/* Currency Sparkle */}
        <circle cx="44" cy="18" r="4" fill="#FDE047" />
        <text x="44" y="20.5" fill="#713F12" fontSize="5" fontWeight="900" textAnchor="middle">$</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 22. LABEL & BARCODE THERMAL PRINTING ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'label-printing' ||
    cleanLabel.includes('label printing') ||
    cleanLabel.includes('طباعة الملصقات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lbl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`lbl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#lbl_bg_${uid})`} filter={`url(#lbl_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Thermal Printer Unit */}
        <rect x="14" y="24" width="36" height="22" rx="4" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1.2" />
        <rect x="20" y="30" width="24" height="4" rx="1" fill="#0284C7" />

        {/* Ejected Printed Barcode Label */}
        <path d="M19 14H45V27H19V14Z" fill="#FFFFFF" stroke="#E0F2FE" strokeWidth="1" />
        
        {/* Barcode Lines */}
        <line x1="23" y1="17" x2="23" y2="24" stroke="#0F172A" strokeWidth="1.5" />
        <line x1="26" y1="17" x2="26" y2="24" stroke="#0F172A" strokeWidth="1" />
        <line x1="29" y1="17" x2="29" y2="24" stroke="#0F172A" strokeWidth="2" />
        <line x1="33" y1="17" x2="33" y2="24" stroke="#0F172A" strokeWidth="1" />
        <line x1="36" y1="17" x2="36" y2="24" stroke="#0F172A" strokeWidth="1.5" />
        <line x1="40" y1="17" x2="40" y2="24" stroke="#0F172A" strokeWidth="2" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 23. FRESH PRODUCE (FRUITS & VEGETABLES) ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'produce' ||
    cleanLabel.includes('produce') ||
    cleanLabel.includes('الفواكه والخضروات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prd_fruit_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <filter id={`prd_fruit_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#15803D" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prd_fruit_bg_${uid})`} filter={`url(#prd_fruit_flt_${uid})`} stroke="#86EFAC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Farm Wooden Basket */}
        <path d="M14 30H50L45 48H19L14 30Z" fill="#9A3412" stroke="#FED7AA" strokeWidth="1" />
        <line x1="23" y1="30" x2="25" y2="48" stroke="#7C2D12" strokeWidth="1.5" />
        <line x1="32" y1="30" x2="32" y2="48" stroke="#7C2D12" strokeWidth="1.5" />
        <line x1="41" y1="30" x2="39" y2="48" stroke="#7C2D12" strokeWidth="1.5" />

        {/* Fresh Red Apple */}
        <circle cx="26" cy="26" r="7" fill="#EF4444" stroke="#DC2626" strokeWidth="1" />
        <path d="M26 19C28 17 30 18 30 18" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />

        {/* Fresh Orange & Grapes */}
        <circle cx="38" cy="26" r="6.5" fill="#F97316" />
        <circle cx="33" cy="21" r="3.5" fill="#A855F7" />
        <circle cx="39" cy="18" r="3" fill="#A855F7" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 24. DIGITAL WEIGHT SCALE ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'weight-scale' ||
    cleanLabel.includes('weight scale') ||
    cleanLabel.includes('الميزان')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`scl_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <filter id={`scl_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0891B2" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#scl_bg_${uid})`} filter={`url(#scl_flt_${uid})`} stroke="#67E8F9" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Stainless Steel Platform Plate */}
        <rect x="14" y="18" width="36" height="8" rx="3" fill="#E2E8F0" stroke="#FFFFFF" strokeWidth="1.2" />
        
        {/* Scale Base */}
        <path d="M16 26H48L51 46H13L16 26Z" fill="#164E63" stroke="#67E8F9" strokeWidth="1" />
        
        {/* Cyan LED Digital Display */}
        <rect x="22" y="32" width="20" height="8" rx="2" fill="#083344" stroke="#22D3EE" strokeWidth="1" />
        <text x="32" y="38" fill="#22D3EE" fontSize="6.5" fontWeight="900" fontFamily="monospace" textAnchor="middle">1.250kg</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 25. SHIFT MANAGEMENT & TILL RECONCILIATION ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'shift' ||
    cleanLabel.includes('shift') ||
    cleanLabel.includes('وردية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`shf_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <filter id={`shf_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4338CA" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#shf_bg_${uid})`} filter={`url(#shf_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Shift Vault Lockbox */}
        <rect x="15" y="22" width="34" height="26" rx="5" fill="#1E1B4B" stroke="#818CF8" strokeWidth="1.2" />
        
        {/* Vault Handle */}
        <path d="M26 22V16C26 14 38 14 38 16V22" stroke="#818CF8" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* 24-Hour Shift Clock Face */}
        <circle cx="32" cy="35" r="7" fill="#312E81" stroke="#FDE047" strokeWidth="1.5" />
        <path d="M32 31V35L35 37" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 26. CUSTOMER KHATA / CREDIT NOTEBOOK (BAKALA & BOOKSTORE) ────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'khata' ||
    cleanLabel.includes('khata') ||
    cleanLabel.includes('خاتا')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`kht_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#92400E" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <filter id={`kht_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#92400E" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#kht_bg_${uid})`} filter={`url(#kht_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Leather Ledger Book */}
        <rect x="15" y="13" width="34" height="38" rx="4" fill="#FEF3C7" stroke="#B45309" strokeWidth="1.5" />
        <rect x="15" y="13" width="7" height="38" fill="#B45309" />

        {/* Ledger Arabic Ruled Rows */}
        <line x1="26" y1="20" x2="43" y2="20" stroke="#D97706" strokeWidth="1.2" />
        <line x1="26" y1="26" x2="43" y2="26" stroke="#D97706" strokeWidth="1.2" />
        <line x1="26" y1="32" x2="43" y2="32" stroke="#D97706" strokeWidth="1.2" />
        <line x1="26" y1="38" x2="43" y2="38" stroke="#D97706" strokeWidth="1.2" />

        {/* Fountain Pen Quill */}
        <path d="M48 10L36 28L34 32L38 30L50 12Z" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 27. BULK IMPORT / EXCEL CLOUD SYNC (BOOKSTORE & TRADING) ─────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'import' ||
    cleanLabel.includes('bulk import') ||
    cleanLabel.includes('استيراد')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`imp_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <filter id={`imp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#15803D" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#imp_bg_${uid})`} filter={`url(#imp_flt_${uid})`} stroke="#86EFAC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Spreadsheet Document Sheet */}
        <rect x="15" y="14" width="34" height="36" rx="4" fill="#FFFFFF" stroke="#BBF7D0" strokeWidth="1" />
        
        {/* Excel Green Grid Matrix */}
        <rect x="19" y="18" width="26" height="6" rx="1" fill="#22C55E" />
        <line x1="19" y1="28" x2="45" y2="28" stroke="#DCFCE7" strokeWidth="2" />
        <line x1="19" y1="34" x2="45" y2="34" stroke="#DCFCE7" strokeWidth="2" />
        <line x1="19" y1="40" x2="45" y2="40" stroke="#DCFCE7" strokeWidth="2" />
        <line x1="32" y1="24" x2="32" y2="44" stroke="#86EFAC" strokeWidth="1.5" />

        {/* Upload Green Arrow Badge */}
        <circle cx="43" cy="43" r="9" fill="#16A34A" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M43 38L39 42M43 38L47 42M43 38V48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 28. SCHOOL SUPPLY LISTS (BOOKSTORE) ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'supply-lists' ||
    cleanLabel.includes('supply lists') ||
    cleanLabel.includes('قوائم المدارس')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sup_lst_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <filter id={`sup_lst_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1D4ED8" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#sup_lst_bg_${uid})`} filter={`url(#sup_lst_flt_${uid})`} stroke="#93C5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* School Backpack */}
        <path d="M20 22C20 16 44 16 44 22V46H20V22Z" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.2" />
        <rect x="24" y="32" width="16" height="12" rx="3" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
        <path d="M28 16V12C28 10 36 10 36 12V16" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Ruler & Pencil sticking out */}
        <rect x="40" y="12" width="4" height="14" rx="1" fill="#F97316" stroke="#FFFFFF" strokeWidth="0.8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 29. BOOK BUYBACK & RECYCLING (BOOKSTORE) ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'buyback' ||
    cleanLabel.includes('buy-back') ||
    cleanLabel.includes('الكتب المستعملة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`byb_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`byb_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#byb_bg_${uid})`} filter={`url(#byb_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Textbook in Center */}
        <rect x="22" y="20" width="20" height="24" rx="3" fill="#FFFFFF" stroke="#047857" strokeWidth="1.2" />
        <rect x="22" y="20" width="4" height="24" fill="#047857" />

        {/* Circular Green Recycling Arrows */}
        <path d="M16 28C16 20 24 14 32 14" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 11L34 14L30 17" fill="#FDE047" />

        <path d="M48 36C48 44 40 50 32 50" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
        <path d="M34 53L30 50L34 47" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 30. THEME EDITOR / STORE DESIGN (ECOMMERCE) ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'theme' ||
    cleanLabel.includes('theme editor') ||
    cleanLabel.includes('تصميم المتجر')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`thm_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id={`thm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#thm_bg_${uid})`} filter={`url(#thm_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Artist Palette */}
        <path d="M16 32C16 22 24 16 34 16C44 16 50 22 50 30C50 36 44 40 40 40C38 40 37 39 36 38C35 37 34 36 32 36C28 36 28 42 22 42C18 42 16 38 16 32Z" fill="#FFFFFF" />
        
        {/* Paint Swatches */}
        <circle cx="26" cy="24" r="3" fill="#EF4444" />
        <circle cx="34" cy="22" r="3" fill="#F59E0B" />
        <circle cx="42" cy="26" r="3" fill="#10B981" />
        <circle cx="42" cy="34" r="3" fill="#06B6D4" />
        <circle cx="22" cy="34" r="3.5" fill="#7C3AED" />

        {/* Paintbrush Tip */}
        <path d="M48 10L36 22" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 31. DOMAINS & WEB URLS (ECOMMERCE) ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'domains' ||
    cleanLabel.includes('domains') ||
    cleanLabel.includes('النطاقات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dom_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`dom_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#dom_bg_${uid})`} filter={`url(#dom_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Global Web Sphere */}
        <circle cx="32" cy="32" r="16" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1.5" />
        <ellipse cx="32" cy="32" rx="7" ry="16" stroke="#38BDF8" strokeWidth="1.2" fill="none" />
        <line x1="16" y1="32" x2="48" y2="32" stroke="#38BDF8" strokeWidth="1.2" />
        <line x1="20" y1="24" x2="44" y2="24" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.7" />
        <line x1="20" y1="40" x2="44" y2="40" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.7" />

        {/* .COM Badge */}
        <rect x="34" y="38" width="16" height="8" rx="2" fill="#FDE047" stroke="#78350F" strokeWidth="0.8" />
        <text x="42" y="44" fill="#78350F" fontSize="5.5" fontWeight="900" textAnchor="middle">.COM</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 32. PAYMENT GATEWAYS & CARDS ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'payments' ||
    cleanLabel.includes('payments') ||
    cleanLabel.includes('بوابات الدفع')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pay_card_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>
          <filter id={`pay_card_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#pay_card_bg_${uid})`} filter={`url(#pay_card_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* 3D Contactless Credit Card */}
        <rect x="13" y="18" width="38" height="26" rx="4" fill="#1E1B4B" stroke="#818CF8" strokeWidth="1.2" />
        <rect x="13" y="24" width="38" height="5" fill="#4338CA" />

        {/* Golden EMV Chip */}
        <rect x="18" y="32" width="6" height="5" rx="1" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.5" />

        {/* Contactless Wave Signal */}
        <path d="M40 31C42 33 42 37 40 39" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M43 28C46 31 46 39 43 42" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 33. DRESSES / BOUTIQUE GOWNS ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'dresses' ||
    cleanLabel.includes('dresses') ||
    cleanLabel.includes('الفساتين')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`drs_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#9D174D" />
          </linearGradient>
          <filter id={`drs_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#drs_bg_${uid})`} filter={`url(#drs_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Haute Couture Evening Gown */}
        <path d="M26 16C28 20 36 20 38 16C38 21 34 24 34 28L46 48H18L30 28C30 24 26 21 26 16Z" fill="#FFFFFF" />
        <rect x="28" y="27" width="8" height="2.5" rx="1" fill="#FDE047" />
        
        {/* Sparkles */}
        <circle cx="20" cy="20" r="1.5" fill="#FDE047" />
        <circle cx="44" cy="24" r="2" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 34. TAILORING STITCHINGS / THOBE ORDERS ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'stitchings' ||
    cleanLabel.includes('stitchings') ||
    cleanLabel.includes('أوامر الخياطة') ||
    cleanLabel === 'orders' && second === 'khayyat'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`stc_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>
          <filter id={`stc_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#stc_bg_${uid})`} filter={`url(#stc_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Saudi Thobe Collar & Placket */}
        <path d="M22 14H42L44 48H20L22 14Z" fill="#FFFFFF" />
        <path d="M28 14V30H36V14" stroke="#C4B5FD" strokeWidth="1.5" fill="#EDE9FE" />
        
        {/* Golden Buttons */}
        <circle cx="32" cy="18" r="1.5" fill="#F59E0B" />
        <circle cx="32" cy="23" r="1.5" fill="#F59E0B" />
        <circle cx="32" cy="28" r="1.5" fill="#F59E0B" />

        {/* Tailor Measuring Tape across */}
        <path d="M16 38C24 44 40 44 48 38" stroke="#FDE047" strokeWidth="3" strokeDasharray="3 2" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 35. MEASUREMENTS & SIZING ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'measurements' ||
    cleanLabel.includes('measurements') ||
    cleanLabel.includes('القياسات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`msr_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id={`msr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#msr_bg_${uid})`} filter={`url(#msr_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Golden Ruler / Tape Measure Coil */}
        <rect x="14" y="24" width="36" height="16" rx="3" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1.5" />
        
        {/* Inch / CM Markings */}
        <line x1="18" y1="24" x2="18" y2="30" stroke="#713F12" strokeWidth="1.5" />
        <line x1="22" y1="24" x2="22" y2="28" stroke="#713F12" strokeWidth="1" />
        <line x1="26" y1="24" x2="26" y2="30" stroke="#713F12" strokeWidth="1.5" />
        <line x1="30" y1="24" x2="30" y2="28" stroke="#713F12" strokeWidth="1" />
        <line x1="34" y1="24" x2="34" y2="30" stroke="#713F12" strokeWidth="1.5" />
        <line x1="38" y1="24" x2="38" y2="28" stroke="#713F12" strokeWidth="1" />
        <line x1="42" y1="24" x2="42" y2="30" stroke="#713F12" strokeWidth="1.5" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 36. TEXTILE FABRICS & ROLLS ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'fabrics' ||
    cleanLabel.includes('fabrics') ||
    cleanLabel.includes('الأقمشة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fbr_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>
          <filter id={`fbr_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#fbr_bg_${uid})`} filter={`url(#fbr_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Rolled Textile Bolt */}
        <ellipse cx="22" cy="22" rx="6" ry="8" fill="#EC4899" stroke="#FFFFFF" strokeWidth="1.2" />
        <path d="M22 14L46 22V38L22 30V14Z" fill="#F43F5E" />
        <ellipse cx="46" cy="30" rx="6" ry="8" fill="#FB7185" stroke="#FFFFFF" strokeWidth="1.2" />

        {/* Second Fabric Roll */}
        <ellipse cx="20" cy="38" rx="6" ry="7" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="1.2" />
        <path d="M20 31L42 39V49L20 45V31Z" fill="#0891B2" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 37. FLEET & ALL VEHICLES (CAR RENTAL & WORKSHOP) ─────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'fleet' ||
    last === 'vehicles' ||
    last === 'all-cars' ||
    cleanLabel.includes('fleet') ||
    cleanLabel.includes('الأسطول') ||
    cleanLabel.includes('السيارات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`flt_car_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`flt_car_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#flt_car_bg_${uid})`} filter={`url(#flt_car_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Luxury Sedan Silhouette */}
        <path d="M14 34L20 22H44L50 34V42H14V34Z" fill="#FFFFFF" />
        <path d="M22 24L25 32H40L42 24H22Z" fill="#0284C7" />

        {/* Wheels */}
        <circle cx="21" cy="42" r="5" fill="#0F172A" stroke="#94A3B8" strokeWidth="1" />
        <circle cx="43" cy="42" r="5" fill="#0F172A" stroke="#94A3B8" strokeWidth="1" />
        <circle cx="21" cy="42" r="2" fill="#38BDF8" />
        <circle cx="43" cy="42" r="2" fill="#38BDF8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 38. WORKSHOP JOB CARDS & REPAIRS ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'job-cards' ||
    cleanLabel.includes('job cards') ||
    cleanLabel.includes('بطاقات الإصلاح')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`job_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <filter id={`job_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#334155" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#job_bg_${uid})`} filter={`url(#job_flt_${uid})`} stroke="#CBD5E1" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Metal Clipboard */}
        <rect x="15" y="14" width="34" height="38" rx="4" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
        <rect x="25" y="11" width="14" height="5" rx="2" fill="#94A3B8" />

        {/* Work Order Checklist */}
        <rect x="20" y="22" width="14" height="2" rx="1" fill="#475569" />
        <rect x="20" y="28" width="18" height="2" rx="1" fill="#475569" />
        <rect x="20" y="34" width="12" height="2" rx="1" fill="#475569" />

        {/* Chrome Wrench overlay */}
        <path d="M48 30L34 44L38 48L52 34C54 32 54 28 52 26C50 24 46 24 44 26L48 30Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 39. INVOICES & TAX BILLS (CORE ERP) ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'invoices' ||
    last === 'bills' ||
    cleanLabel.includes('invoice') ||
    cleanLabel.includes('فواتير') ||
    cleanLabel === 'invoices'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`inv_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>
          <filter id={`inv_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#inv_main_bg_${uid})`} filter={`url(#inv_main_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Folded Tax Invoice Document */}
        <path d="M16 14H40L48 22V50H16V14Z" fill="#FFFFFF" />
        <path d="M40 14V22H48L40 14Z" fill="#C7D2FE" />

        {/* Invoice Header Badge */}
        <rect x="20" y="18" width="14" height="3.5" rx="1.5" fill="#4F46E5" />

        {/* Data Rows */}
        <rect x="20" y="26" width="24" height="2" rx="1" fill="#94A3B8" />
        <rect x="20" y="31" width="18" height="2" rx="1" fill="#94A3B8" />
        <rect x="20" y="36" width="22" height="2" rx="1" fill="#94A3B8" />

        {/* Green ZATCA Compliant QR Stamp */}
        <rect x="34" y="40" width="8" height="8" rx="1.5" fill="#10B981" />
        <circle cx="38" cy="44" r="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 40. CUSTOMERS / CLIENT REGISTRY ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'customers' ||
    cleanLabel.includes('customers') ||
    cleanLabel.includes('العملاء')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cst_card_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <filter id={`cst_card_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#cst_card_bg_${uid})`} filter={`url(#cst_card_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* VIP Customer ID Badge */}
        <rect x="13" y="16" width="38" height="32" rx="5" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1" />
        
        {/* Avatar Silhouette */}
        <circle cx="23" cy="27" r="5" fill="#EA580C" />
        <path d="M16 41C16 36 19 34 23 34C27 34 30 36 30 41H16Z" fill="#EA580C" />

        {/* Profile Card Lines */}
        <rect x="33" y="23" width="13" height="3" rx="1" fill="#0F172A" />
        <rect x="33" y="29" width="10" height="2" rx="1" fill="#94A3B8" />
        <rect x="33" y="34" width="12" height="2" rx="1" fill="#94A3B8" />

        {/* Golden VIP Star */}
        <circle cx="43" cy="41" r="4.5" fill="#FDE047" />
        <path d="M43 38L44 40.5L46.5 41L44.5 42.5L45 45L43 43.5L41 45L41.5 42.5L39.5 41L42 40.5L43 38Z" fill="#B45309" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 41. CUSTOMER STATEMENT / ACCOUNT LEDGER ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'statement' ||
    cleanLabel.includes('statement') ||
    cleanLabel.includes('كشف حساب')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`stm_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <filter id={`stm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0891B2" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#stm_bg_${uid})`} filter={`url(#stm_flt_${uid})`} stroke="#67E8F9" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Ledger Sheet with Dual Debit/Credit Columns */}
        <rect x="15" y="13" width="34" height="38" rx="4" fill="#FFFFFF" />
        <rect x="15" y="13" width="34" height="8" fill="#0891B2" />
        
        {/* Statement Rows */}
        <line x1="32" y1="21" x2="32" y2="51" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="18" y="26" width="10" height="2" rx="1" fill="#0E7490" />
        <rect x="36" y="26" width="9" height="2" rx="1" fill="#10B981" />
        <rect x="18" y="32" width="12" height="2" rx="1" fill="#0E7490" />
        <rect x="36" y="32" width="7" height="2" rx="1" fill="#EF4444" />
        <rect x="18" y="38" width="8" height="2" rx="1" fill="#0E7490" />
        <rect x="36" y="38" width="10" height="2" rx="1" fill="#10B981" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 42. QUOTATIONS / PRICE PROPOSALS ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'quotations' ||
    cleanLabel.includes('quotation') ||
    cleanLabel.includes('عروض الأسعار')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`quo_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`quo_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#quo_bg_${uid})`} filter={`url(#quo_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Proposal Document Scroll */}
        <path d="M18 14H46V46C46 48 44 50 42 50H18C16 50 14 48 14 46V18C14 16 16 14 18 14Z" fill="#FFFFFF" />
        
        {/* Gold Ribbon Seal */}
        <circle cx="38" cy="40" r="6" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
        <path d="M38 43L36 49L38 47L40 49L38 43Z" fill="#CA8A04" />

        {/* Text lines */}
        <rect x="20" y="20" width="16" height="3" rx="1.5" fill="#0284C7" />
        <rect x="20" y="26" width="20" height="2" rx="1" fill="#94A3B8" />
        <rect x="20" y="31" width="14" height="2" rx="1" fill="#94A3B8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 43. DELIVERY NOTES / DISPATCH RECEIPTS ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'delivery-notes' ||
    cleanLabel.includes('delivery notes') ||
    cleanLabel.includes('سندات التسليم')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dln_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <filter id={`dln_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#dln_bg_${uid})`} filter={`url(#dln_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Isometric Shipping Crate with Outgoing Arrow */}
        <path d="M14 26L32 16L50 26L32 36L14 26Z" fill="#FDBA74" />
        <path d="M14 26L32 36V48L14 38V26Z" fill="#EA580C" />
        <path d="M32 36L50 26V38L32 48V36Z" fill="#C2410C" />

        {/* Green Verified Stamp */}
        <circle cx="32" cy="26" r="6" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.2" />
        <path d="M29.5 26L31.5 28L34.5 24.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 44. CONTACTS / ADDRESS DIRECTORY ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'contacts' ||
    cleanLabel.includes('contacts') ||
    cleanLabel.includes('جهات الاتصال')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`cnt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id={`cnt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#2563EB" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#cnt_bg_${uid})`} filter={`url(#cnt_flt_${uid})`} stroke="#93C5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Rolodex Address Book */}
        <rect x="15" y="14" width="34" height="38" rx="4" fill="#FFFFFF" />
        <rect x="15" y="14" width="6" height="38" fill="#1D4ED8" />

        {/* Tab Badges on Right */}
        <rect x="49" y="18" width="3" height="4" rx="1" fill="#EF4444" />
        <rect x="49" y="25" width="3" height="4" rx="1" fill="#F59E0B" />
        <rect x="49" y="32" width="3" height="4" rx="1" fill="#10B981" />
        <rect x="49" y="39" width="3" height="4" rx="1" fill="#3B82F6" />

        {/* Profile Avatar inside */}
        <circle cx="32" cy="27" r="5" fill="#2563EB" />
        <path d="M24 41C24 37 27 35 32 35C37 35 40 37 40 41H24Z" fill="#2563EB" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 45. LETTERHEAD / OFFICIAL CORRESPONDENCE ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'letterhead' ||
    cleanLabel.includes('letterhead') ||
    cleanLabel.includes('منشئ الخطابات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`lth_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
          <filter id={`lth_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0891B2" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#lth_bg_${uid})`} filter={`url(#lth_flt_${uid})`} stroke="#67E8F9" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Formal Parchment Sheet */}
        <rect x="15" y="13" width="34" height="38" rx="3" fill="#FFFFFF" />
        
        {/* Corporate Header Ribbon */}
        <rect x="19" y="17" width="26" height="4" rx="1" fill="#0891B2" />
        
        {/* Letter Text Lines */}
        <line x1="19" y1="26" x2="45" y2="26" stroke="#94A3B8" strokeWidth="1.5" />
        <line x1="19" y1="31" x2="45" y2="31" stroke="#94A3B8" strokeWidth="1.5" />
        <line x1="19" y1="36" x2="38" y2="36" stroke="#94A3B8" strokeWidth="1.5" />

        {/* Crimson Red Wax Seal */}
        <circle cx="39" cy="42" r="5" fill="#DC2626" stroke="#991B1B" strokeWidth="1" />
        <path d="M39 40L40 43L37 42L41 42L38 43L39 40Z" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 46. PURCHASE ORDERS / PROCUREMENT ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'purchases' ||
    last === 'purchase-orders' ||
    cleanLabel.includes('purchases') ||
    cleanLabel.includes('المشتريات') ||
    cleanLabel.includes('purchase orders') ||
    cleanLabel.includes('طلبات الشراء')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`po_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`po_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#po_bg_${uid})`} filter={`url(#po_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Shopping Cart Procurement */}
        <path d="M14 18H20L25 38H45L50 24H22" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="46" r="4" fill="#FDE047" />
        <circle cx="42" cy="46" r="4" fill="#FDE047" />

        {/* Incoming Items in Cart */}
        <rect x="27" y="24" width="7" height="8" rx="1.5" fill="#6EE7B7" />
        <rect x="36" y="22" width="7" height="10" rx="1.5" fill="#34D399" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 47. SUPPLIERS / VENDOR NETWORK ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'suppliers' ||
    cleanLabel.includes('suppliers') ||
    cleanLabel.includes('الموردين')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sup_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <filter id={`sup_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0D9488" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#sup_bg_${uid})`} filter={`url(#sup_flt_${uid})`} stroke="#99F6E4" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Global Handshake / Corporate Vendor Building */}
        <rect x="14" y="20" width="16" height="28" rx="2" fill="#134E4A" stroke="#2DD4BF" strokeWidth="1" />
        <rect x="34" y="14" width="16" height="34" rx="2" fill="#115E59" stroke="#2DD4BF" strokeWidth="1" />
        
        {/* Glowing Windows */}
        <rect x="18" y="24" width="3" height="4" rx="0.5" fill="#CCFBF1" />
        <rect x="23" y="24" width="3" height="4" rx="0.5" fill="#CCFBF1" />
        <rect x="38" y="18" width="3" height="4" rx="0.5" fill="#CCFBF1" />
        <rect x="43" y="18" width="3" height="4" rx="0.5" fill="#CCFBF1" />
        <rect x="38" y="26" width="3" height="4" rx="0.5" fill="#CCFBF1" />
        <rect x="43" y="26" width="3" height="4" rx="0.5" fill="#CCFBF1" />

        {/* Global Connection Badge */}
        <circle cx="32" cy="34" r="8" fill="#FDE047" stroke="#0F766E" strokeWidth="1.5" />
        <path d="M28 34L31 37L36 32" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 48. GOODS RECEIPT (GRN) ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'grn' ||
    cleanLabel.includes('goods receipt') ||
    cleanLabel.includes('استلام البضائع')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`grn_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16A34A" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <filter id={`grn_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#16A34A" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#grn_bg_${uid})`} filter={`url(#grn_flt_${uid})`} stroke="#86EFAC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Receiving Dock with Verified Green Parcel */}
        <rect x="16" y="24" width="32" height="24" rx="4" fill="#FFFFFF" stroke="#86EFAC" strokeWidth="1.2" />
        <path d="M16 32H48" stroke="#16A34A" strokeWidth="1.5" />
        <path d="M32 24V48" stroke="#16A34A" strokeWidth="1.5" />

        {/* Green Verified Shield */}
        <circle cx="32" cy="20" r="8" fill="#22C55E" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M29 20L31 22L35 18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 49. PURCHASE RETURNS ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'purchase-returns' ||
    cleanLabel.includes('purchase returns') ||
    cleanLabel.includes('مرتجعات المشتريات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prt_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <filter id={`prt_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DC2626" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prt_bg_${uid})`} filter={`url(#prt_flt_${uid})`} stroke="#FCA5A5" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Rejected Return Package */}
        <rect x="16" y="24" width="32" height="24" rx="4" fill="#FFFFFF" stroke="#F87171" strokeWidth="1.5" />
        
        {/* Red Return Arrow */}
        <path d="M42 16C34 14 24 18 20 26" stroke="#FDE047" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M18 20L20 26L26 24" fill="#FDE047" />

        {/* Reject Cross Mark */}
        <path d="M26 31L38 41M38 31L26 41" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 50. SHIPMENTS & FREIGHT LOGISTICS ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'shipments' ||
    last === 'shipment' ||
    cleanLabel.includes('shipments') ||
    cleanLabel.includes('الشحنات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`shp_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <filter id={`shp_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#shp_bg_${uid})`} filter={`url(#shp_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Heavy Commercial Freight Truck */}
        <rect x="12" y="20" width="28" height="22" rx="3" fill="#FFFFFF" stroke="#FDBA74" strokeWidth="1.2" />
        <path d="M40 28H48L53 35V42H40V28Z" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
        <path d="M42 30H47L50 35H42V30Z" fill="#0C4A6E" />

        {/* Wheels */}
        <circle cx="20" cy="44" r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="34" cy="44" r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="47" cy="44" r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 51. WAREHOUSES & DISTRIBUTION CENTERS ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'warehouses' ||
    last === 'warehouse' ||
    cleanLabel.includes('warehouses') ||
    cleanLabel.includes('مستودعات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`wrh_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <filter id={`wrh_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4338CA" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#wrh_bg_${uid})`} filter={`url(#wrh_flt_${uid})`} stroke="#A5B4FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Master Warehouse Facility */}
        <path d="M12 28L32 14L52 28V48H12V28Z" fill="#1E1B4B" stroke="#818CF8" strokeWidth="1.5" />
        
        {/* Large Rolling Shutter Bay Door */}
        <rect x="24" y="32" width="16" height="16" fill="#312E81" stroke="#A5B4FC" strokeWidth="1" />
        <line x1="24" y1="36" x2="40" y2="36" stroke="#818CF8" strokeWidth="1" />
        <line x1="24" y1="40" x2="40" y2="40" stroke="#818CF8" strokeWidth="1" />
        <line x1="24" y1="44" x2="40" y2="44" stroke="#818CF8" strokeWidth="1" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 52. FINANCE & GENERAL LEDGER (CORE ERP) ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'finance' ||
    cleanLabel.includes('finance') ||
    cleanLabel.includes('المالية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`fin_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={`fin_gold_coin_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`fin_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#fin_main_bg_${uid})`} filter={`url(#fin_main_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* High Security Titanium Vault */}
        <circle cx="32" cy="32" r="16" fill="#78350F" stroke="#FDE047" strokeWidth="2" />
        <circle cx="32" cy="32" r="9" fill={`url(#fin_gold_coin_${uid})`} stroke="#FFFFFF" strokeWidth="1.2" />
        
        {/* Saudi Riyal Emblem */}
        <text x="32" y="36" fill="#78350F" fontSize="10" fontWeight="900" textAnchor="middle">﷼</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 53. VOUCHERS & FINANCIAL RECEIPTS ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'vouchers' ||
    cleanLabel.includes('vouchers') ||
    cleanLabel.includes('السندات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`vch_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#9D174D" />
          </linearGradient>
          <filter id={`vch_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#vch_main_bg_${uid})`} filter={`url(#vch_main_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Dual Perforated Voucher Tickets */}
        <path d="M14 20C14 18 16 16 18 16H46C48 16 50 18 50 20V27C48 27 46 29 46 32C46 35 48 37 50 37V44C50 46 48 48 46 48H18C16 48 14 46 14 44V37C16 37 18 35 18 32C18 29 16 27 14 27V20Z" fill="#FFFFFF" stroke="#FBCFE8" strokeWidth="1.2" />
        
        {/* Perforated Center Line */}
        <line x1="36" y1="16" x2="36" y2="48" stroke="#DB2777" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Voucher Text details */}
        <rect x="20" y="24" width="10" height="3" rx="1" fill="#DB2777" />
        <rect x="20" y="30" width="12" height="2" rx="1" fill="#94A3B8" />
        <rect x="20" y="35" width="8" height="2" rx="1" fill="#94A3B8" />
        <circle cx="43" cy="32" r="4" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 54. EXPENSES & CLAIMS ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'expenses' ||
    last === 'expense-claims' ||
    cleanLabel.includes('expenses') ||
    cleanLabel.includes('المصروفات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`exp_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#9A3412" />
          </linearGradient>
          <filter id={`exp_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#exp_main_bg_${uid})`} filter={`url(#exp_main_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Leather Expense Wallet */}
        <rect x="14" y="20" width="36" height="26" rx="5" fill="#431407" stroke="#FED7AA" strokeWidth="1.2" />
        
        {/* Currency Bills popping out */}
        <path d="M18 20V15C18 14 20 13 21 13H41C42 13 44 14 44 15V20" fill="#22C55E" stroke="#15803D" strokeWidth="1" />
        <circle cx="31" cy="16.5" r="2" fill="#FFFFFF" fillOpacity="0.8" />

        {/* Wallet Brass Snap Lock */}
        <circle cx="43" cy="33" r="3.5" fill="#FDE047" stroke="#B45309" strokeWidth="1" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 55. VAT RETURNS & TAX DECLARATIONS ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'vat-returns' ||
    cleanLabel.includes('vat returns') ||
    cleanLabel.includes('إقرارات القيمة المضافة') ||
    cleanLabel.includes('ضريبة')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`vat_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`vat_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#vat_main_bg_${uid})`} filter={`url(#vat_main_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* ZATCA VAT 15% Document */}
        <rect x="15" y="13" width="34" height="38" rx="4" fill="#FFFFFF" />
        <rect x="15" y="13" width="34" height="8" fill="#047857" />

        {/* 15% Official Tax Stamp */}
        <circle cx="32" cy="33" r="10" fill="#ECFDF5" stroke="#059669" strokeWidth="1.5" />
        <text x="32" y="37" fill="#047857" fontSize="8" fontWeight="900" textAnchor="middle">15%</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 56. REPORTS & EXECUTIVE AUDIT ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'reports' ||
    last === 'hr-reports' ||
    cleanLabel.includes('reports') ||
    cleanLabel.includes('التقارير')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`rpt_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id={`rpt_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#2563EB" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#rpt_main_bg_${uid})`} filter={`url(#rpt_main_flt_${uid})`} stroke="#93C5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Executive 3D Folder */}
        <path d="M14 20C14 18 16 16 18 16H28L33 21H46C48 21 50 23 50 25V46C50 48 48 50 46 50H18C16 50 14 48 14 46V20Z" fill="#FFFFFF" />
        <path d="M14 26H50V46C50 48 48 50 46 50H18C16 50 14 48 14 46V26Z" fill="#3B82F6" />

        {/* 3D Bar Graph popping out */}
        <rect x="20" y="36" width="5" height="9" rx="1" fill="#FDE047" />
        <rect x="28" y="31" width="5" height="14" rx="1" fill="#34D399" />
        <rect x="36" y="25" width="5" height="20" rx="1" fill="#F43F5E" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 57. COMMUNICATE / INTERNAL CHAT & MESSAGING ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'communicate' ||
    cleanLabel.includes('communicate') ||
    cleanLabel.includes('الرسائل')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`com_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <filter id={`com_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#com_bg_${uid})`} filter={`url(#com_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Dual 3D Glowing Chat Bubbles */}
        {/* Back Purple Bubble */}
        <path d="M22 18H44C47 18 50 21 50 24V34C50 37 47 40 44 40H38L30 46V40H22C19 40 16 37 16 34V24C16 21 19 18 22 18Z" fill="#FFFFFF" />
        
        {/* Front Cyan Bubble */}
        <path d="M14 26H34C37 26 39 28 39 31V39C39 42 37 44 34 44H29L23 49V44H14C11 44 9 42 9 39V31C9 28 11 26 14 26Z" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="1.2" />

        {/* Typing Pulse Dots */}
        <circle cx="18" cy="35" r="2" fill="#FFFFFF" />
        <circle cx="24" cy="35" r="2" fill="#FFFFFF" />
        <circle cx="30" cy="35" r="2" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 58. WHATSAPP CLOUD ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'whatsapp' ||
    cleanAppId === 'whatsapp_cloud_auto' ||
    cleanLabel.includes('whatsapp')
  ) {
    return (
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
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 59. APP STORE & ECOSYSTEM EXTENSIONS ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'app-store' ||
    cleanLabel.includes('app store') ||
    cleanLabel.includes('متجر التطبيقات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`aps_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id={`aps_cube_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#7000FF" />
          </linearGradient>
          <filter id={`aps_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6366F1" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#aps_bg_${uid})`} filter={`url(#aps_flt_${uid})`} stroke="#C7D2FE" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Holographic 3D Prism Cube */}
        <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" fill={`url(#aps_cube_${uid})`} />
        <path d="M32 14L48 23L32 32L16 23L32 14Z" fill="#FFFFFF" fillOpacity="0.4" />
        <path d="M16 23L32 32V50L16 41V23Z" fill="#000000" fillOpacity="0.2" />
        <path d="M32 32L48 23V41L32 50V32Z" fill="#FFFFFF" fillOpacity="0.15" />

        {/* Center Sparkle */}
        <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 60. COMPANY PROFILE & HEADQUARTERS ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'profile' ||
    cleanLabel.includes('profile') ||
    cleanLabel.includes('ملف المنشأة') ||
    cleanLabel.includes('الملف التعريفي')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`prf_co_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id={`prf_co_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0284C7" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#prf_co_bg_${uid})`} filter={`url(#prf_co_flt_${uid})`} stroke="#7DD3FC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Modern Glass Corporate Headquarters */}
        <rect x="18" y="16" width="28" height="34" rx="4" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1.5" />
        
        {/* Glass Windows Grid */}
        <rect x="22" y="21" width="5" height="5" rx="1" fill="#BAE6FD" />
        <rect x="29" y="21" width="5" height="5" rx="1" fill="#BAE6FD" />
        <rect x="36" y="21" width="5" height="5" rx="1" fill="#BAE6FD" />
        
        <rect x="22" y="29" width="5" height="5" rx="1" fill="#BAE6FD" />
        <rect x="29" y="29" width="5" height="5" rx="1" fill="#BAE6FD" />
        <rect x="36" y="29" width="5" height="5" rx="1" fill="#BAE6FD" />

        <rect x="28" y="38" width="8" height="12" rx="1" fill="#38BDF8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 61. USERS & ACCESS SECURITY ROLES ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'users' ||
    cleanLabel.includes('users') ||
    cleanLabel.includes('مستخدمين')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`usr_role_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>
          <filter id={`usr_role_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#usr_role_bg_${uid})`} filter={`url(#usr_role_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Multi-User Avatars */}
        <circle cx="24" cy="24" r="6" fill="#C4B5FD" />
        <path d="M14 42C14 36 18 33 24 33C30 33 34 36 34 42H14Z" fill="#C4B5FD" />

        <circle cx="38" cy="24" r="6" fill="#FFFFFF" />
        <path d="M28 42C28 36 32 33 38 33C44 33 48 36 48 42H28Z" fill="#FFFFFF" />

        {/* Security Shield Badge */}
        <path d="M44 38L52 41V47C52 52 48 55 44 56C40 55 36 52 36 47V41L44 38Z" fill="#FDE047" stroke="#B45309" strokeWidth="1" />
        <path d="M42 47L43.5 48.5L46.5 45" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 62. SYSTEM SETTINGS ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'settings' ||
    cleanLabel.includes('settings') ||
    cleanLabel.includes('إعدادات')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`stg_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id={`stg_gear_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <filter id={`stg_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#334155" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#stg_bg_${uid})`} filter={`url(#stg_flt_${uid})`} stroke="#CBD5E1" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Dual Interlocking Mechanical Gears */}
        <circle cx="30" cy="30" r="14" fill={`url(#stg_gear_${uid})`} />
        <circle cx="30" cy="30" r="6" fill="#334155" />
        
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const x = 30 + 15 * Math.sin(rad) - 2.5
          const y = 30 - 15 * Math.cos(rad) - 2.5
          return <rect key={i} x={x} y={y} width="5" height="5" rx="1.5" fill="#E2E8F0" transform={`rotate(${deg} ${x + 2.5} ${y + 2.5})`} />
        })}

        {/* Small Golden Accent Gear */}
        <circle cx="44" cy="44" r="8" fill="#FDE047" stroke="#D97706" strokeWidth="1" />
        <circle cx="44" cy="44" r="3" fill="#78350F" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 63. EXECUTIVE DASHBOARD / ROOT KPI COMMAND CENTER ────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    last === 'dashboard' ||
    path === '/app/dashboard' ||
    cleanLabel.includes('dashboard') ||
    cleanLabel.includes('لوحة التحكم')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`dsh_main_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id={`dsh_main_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6366F1" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#dsh_main_bg_${uid})`} filter={`url(#dsh_main_flt_${uid})`} stroke="#818CF8" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Multi-Widget 3D Analytics Tiles */}
        <rect x="14" y="14" width="16" height="14" rx="3" fill="#EF4444" stroke="#FCA5A5" strokeWidth="0.8" />
        <rect x="34" y="14" width="16" height="14" rx="3" fill="#3B82F6" stroke="#93C5FD" strokeWidth="0.8" />
        <rect x="14" y="32" width="16" height="18" rx="3" fill="#10B981" stroke="#6EE7B7" strokeWidth="0.8" />
        <rect x="34" y="32" width="16" height="18" rx="3" fill="#F59E0B" stroke="#FDE68A" strokeWidth="0.8" />

        {/* Live Sparkline Waves inside widgets */}
        <path d="M16 23L20 20L24 24L28 17" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="28" cy="17" r="1.5" fill="#FFFFFF" />

        <path d="M36 43L40 37L44 41L48 35" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="48" cy="35" r="1.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 64. APP STORE CATALOG: RESTAURANT & CAFE VERTICAL ROOT ───────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'restaurant_cafe' ||
    (last === 'restaurant' && path === '/app/dashboard/restaurant') ||
    cleanLabel === 'restaurant & cafe' ||
    cleanLabel === 'المطاعم والكافيهات'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`res_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id={`res_cat_gold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id={`res_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#res_cat_bg_${uid})`} filter={`url(#res_cat_flt_${uid})`} stroke="#FDBA74" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Gourmet Cloche Dome */}
        <path d="M16 38C16 26 23 20 32 20C41 20 48 26 48 38H16Z" fill={`url(#res_cat_gold_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="32" cy="18" r="3.5" fill="#FFFFFF" stroke="#CA8A04" strokeWidth="1" />
        <rect x="12" y="38" width="40" height="5" rx="2.5" fill="#78350F" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── APP STORE CATALOG: PHARMACY VERTICAL ROOT ────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'pharmacy' ||
    last === 'pharmacy' ||
    cleanIcon === 'pill' ||
    cleanLabel === 'pharmacy' ||
    cleanLabel.includes('صيدلية')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`pharm_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>
          <filter id={`pharm_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F766E" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#pharm_bg_${uid})`} filter={`url(#pharm_flt_${uid})`} stroke="#5EEAD4" strokeWidth="1.2" strokeOpacity="0.5" />
        <rect x="29" y="16" width="6" height="32" rx="3" fill="#FFFFFF" />
        <rect x="16" y="29" width="32" height="6" rx="3" fill="#FFFFFF" />
        <circle cx="44" cy="20" r="5" fill="#F43F5E" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 65. APP STORE CATALOG: BAKALA & SUPERMARKET VERTICAL ROOT ────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'bakala_supermarket' ||
    (last === 'bakala' && path === '/app/dashboard/bakala') ||
    cleanLabel === 'bakala & grocery' ||
    cleanLabel === 'البقالة والسوبرماركت'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bkl_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id={`bkl_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#bkl_cat_bg_${uid})`} filter={`url(#bkl_cat_flt_${uid})`} stroke="#6EE7B7" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Supermarket Shopping Basket */}
        <path d="M16 28H48L44 46H20L16 28Z" fill="#FFFFFF" />
        <path d="M22 28L32 16L42 28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="27" cy="35" r="3.5" fill="#EF4444" />
        <rect x="33" y="30" width="5" height="10" rx="1" fill="#38BDF8" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 66. APP STORE CATALOG: BOOKSTORE VERTICAL ROOT ───────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'bookstore_stationery' ||
    (last === 'bookstore' && path === '/app/dashboard/bookstore') ||
    cleanLabel === 'bookstore' ||
    cleanLabel === 'المكتبة والقرطاسية'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`bks_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id={`bks_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#D97706" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#bks_cat_bg_${uid})`} filter={`url(#bks_cat_flt_${uid})`} stroke="#FDE68A" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Open Hardcover Book */}
        <path d="M16 22C22 20 28 22 32 24C36 22 42 20 48 22V44C42 42 36 44 32 46C28 44 22 42 16 44V22Z" fill="#FFFFFF" />
        <path d="M32 24V46" stroke="#D97706" strokeWidth="2" />
        <path d="M30 20V32L32 30L34 32V20H30Z" fill="#EF4444" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 67. APP STORE CATALOG: E-COMMERCE VERTICAL ROOT ──────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'ecommerce_store' ||
    (last === 'ecommerce' && path === '/app/dashboard/ecommerce') ||
    cleanLabel === 'e-commerce' ||
    cleanLabel === 'المتجر الإلكتروني'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`ecm_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id={`ecm_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4F46E5" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#ecm_cat_bg_${uid})`} filter={`url(#ecm_cat_flt_${uid})`} stroke="#C7D2FE" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Shopping Cart & Package */}
        <path d="M16 18H21L26 36H42L47 22H24" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="44" r="3.5" fill="#38BDF8" />
        <circle cx="40" cy="44" r="3.5" fill="#38BDF8" />
        <rect x="29" y="22" width="10" height="9" rx="2" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 68. APP STORE CATALOG: BOUTIQUE VERTICAL ROOT ────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'boutique_rental' ||
    (last === 'boutique' && path === '/app/dashboard/boutique') ||
    cleanLabel === 'boutique' ||
    cleanLabel === 'بوتيك وفساتين'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`btq_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C026D3" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
          <filter id={`btq_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#C026D3" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#btq_cat_bg_${uid})`} filter={`url(#btq_cat_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Designer Dress Silhouette */}
        <path d="M26 18C28 22 36 22 38 18C38 23 34 26 34 30L44 48H20L30 30C30 26 26 23 26 18Z" fill="#FFFFFF" />
        <rect x="28" y="28" width="8" height="2.5" rx="1" fill="#FDE047" />
        <path d="M29 15L32 12L35 15L37 13L32 18L27 13L29 15Z" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 69. APP STORE CATALOG: CAR WORKSHOP VERTICAL ROOT ────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'car_workshop' ||
    (last === 'workshop' && path === '/app/workshop') ||
    cleanLabel === 'car workshop' ||
    cleanLabel === 'مركز الصيانة'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`wks_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <filter id={`wks_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.5" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#wks_cat_bg_${uid})`} filter={`url(#wks_cat_flt_${uid})`} stroke="#94A3B8" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Heavy Wrench & Wheel */}
        <circle cx="32" cy="32" r="14" stroke="#94A3B8" strokeWidth="3" opacity="0.4" />
        <path d="M37 23L20 40C18 42 18 45 20 47C22 49 25 49 27 47L44 30" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 70. APP STORE CATALOG: SALOON VERTICAL ROOT ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'saloon_barber' ||
    (last === 'saloon' && path === '/app/saloon/dashboard') ||
    cleanLabel === 'saloon & spa' ||
    cleanLabel === 'الصالون والحلاقة'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`sal_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DB2777" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id={`sal_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#DB2777" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#sal_cat_bg_${uid})`} filter={`url(#sal_cat_flt_${uid})`} stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Crossed Stylist Scissors */}
        <circle cx="22" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
        <circle cx="42" cy="44" r="4" stroke="#FFFFFF" strokeWidth="2.5" />
        <path d="M24 41L42 19M40 41L22 19" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="30" r="2" fill="#FDE047" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 71. APP STORE CATALOG: TAILOR KHAYYAT VERTICAL ROOT ──────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'tailor_khayyat' ||
    (last === 'khayyat' && path === '/app/dashboard/khayyat') ||
    cleanLabel === 'tailoring & khayyat' ||
    cleanLabel === 'الخياطة والتفصيل'
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`khy_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id={`khy_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#khy_cat_bg_${uid})`} filter={`url(#khy_cat_flt_${uid})`} stroke="#C4B5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Thread Spool & Golden Needle */}
        <rect x="22" y="20" width="20" height="24" rx="4" fill="#C4B5FD" />
        <path d="M22 26H42M22 32H42M22 38H42" stroke="#6D28D9" strokeWidth="2" />
        <path d="M48 14L34 28" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="46" cy="16" r="1" fill="#7C3AED" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 72. APP STORE CATALOG: SAUDI ZATCA PHASE 2 ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
  if (
    cleanAppId === 'zatca_phase2' ||
    cleanAppId === 'zatca' ||
    cleanLabel.includes('zatca') ||
    cleanLabel.includes('زاتكا')
  ) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`zat_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id={`zat_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#047857" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#zat_cat_bg_${uid})`} filter={`url(#zat_cat_flt_${uid})`} stroke="#86EFAC" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Saudi Palm & Official ZATCA QR Stamp */}
        <rect x="20" y="18" width="24" height="28" rx="3" fill="#FFFFFF" />
        <rect x="24" y="22" width="6" height="6" fill="#047857" />
        <rect x="34" y="22" width="6" height="6" fill="#047857" />
        <rect x="24" y="32" width="6" height="6" fill="#047857" />
        <path d="M34 32H40V38H34V32Z" fill="#10B981" />
        <circle cx="44" cy="42" r="6" fill="#059669" />
        <path d="M41 42L43 44L47 40" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── 73. APP STORE CATALOG: QIWA & MUQEEM ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════════
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
          <linearGradient id={`qiw_cat_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <filter id={`qiw_cat_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1E3A8A" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#qiw_cat_bg_${uid})`} filter={`url(#qiw_cat_flt_${uid})`} stroke="#93C5FD" strokeWidth="1.2" strokeOpacity="0.5" />
        
        {/* Passport / Iqama Emblem */}
        <rect x="20" y="16" width="24" height="32" rx="3" fill="#FFFFFF" />
        <circle cx="32" cy="26" r="4" fill="#2563EB" />
        <path d="M26 36C26 33 28 32 32 32C36 32 38 33 38 36H26Z" fill="#2563EB" />
        <path d="M24 42H40" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ─── FALLBACK: DYNAMIC COLORFUL 3D GEOMETRIC PRISM (NEVER LOOKS GENERIC) ─────
  // ═══════════════════════════════════════════════════════════════════════════════
  const hash = (path + label + appId).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const palettes = [
    ['#3B82F6', '#1D4ED8'],
    ['#10B981', '#047857'],
    ['#F59E0B', '#D97706'],
    ['#EC4899', '#BE185D'],
    ['#8B5CF6', '#6D28D9'],
    ['#06B6D4', '#0E7490'],
    ['#F97316', '#C2410C'],
    ['#6366F1', '#4338CA']
  ]
  const [c1, c2] = palettes[hash % palettes.length]

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`fb_bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <filter id={`fb_flt_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor={c1} floodOpacity="0.45" />
        </filter>
      </defs>
      
      <rect x="7" y="7" width="50" height="50" rx="14" fill={`url(#fb_bg_${uid})`} filter={`url(#fb_flt_${uid})`} stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.4" />
      
      {/* 3D Geometric Crystal Core */}
      <path d="M32 18L44 26L32 34L20 26L32 18Z" fill="#FFFFFF" fillOpacity="0.9" />
      <path d="M20 26L32 34V46L20 38V26Z" fill="#FFFFFF" fillOpacity="0.5" />
      <path d="M32 34L44 26V38L32 46V34Z" fill="#FFFFFF" fillOpacity="0.7" />
    </svg>
  )
}

export default App3DIcon
