import React from 'react'

/**
 * Ultra-professional 3D Geometric Vector Icons matching modern Odoo 17/18 enterprise design.
 * Features vibrant gradients, layered translucent shapes, 3D isometric perspectives, and rich lighting.
 */

export function App3DIcon({ path = '', label = '', className = 'w-11 h-11 sm:w-12 sm:h-12' }) {
  const p = (path || '').toLowerCase()
  const l = (label || '').toLowerCase()
  const uid = React.useId().replace(/:/g, '')

  // 1. Discuss / Chat / WhatsApp / Communicate / Messages
  if (p.includes('whatsapp') || p.includes('communicate') || l.includes('chat') || l.includes('رسائل') || l.includes('واتساب') || l.includes('تواصل')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`cyan_${uid}`} x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`purple_${uid}`} x1="16" y1="18" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="50%" stopColor="#9B51E0" />
            <stop offset="100%" stopColor="#6C05FF" />
          </linearGradient>
        </defs>
        {/* Cyan Circle */}
        <circle cx="26" cy="26" r="17" fill={`url(#cyan_${uid})`} />
        {/* Magenta/Purple Overlapping Speech Bubble with tail */}
        <path
          d="M26 22C26 14.82 31.82 9 39 9C46.18 9 52 14.82 52 22C52 29.18 46.18 35 39 35C37.3 35 35.7 34.6 34.3 33.9L24 38L27 30.2C26.4 28.8 26 27.2 26 25.5V22Z"
          fill={`url(#purple_${uid})`}
        />
        <circle cx="39" cy="22" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    )
  }

  // 2. Calendar / Reservations / Rental Calendar / Appointments
  if (p.includes('calendar') || p.includes('reservation') || p.includes('appointment') || l.includes('تقويم') || l.includes('حجوزات') || l.includes('مواعيد')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`calRed_${uid}`} x1="8" y1="12" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF416C" />
            <stop offset="100%" stopColor="#FF4B2B" />
          </linearGradient>
          <linearGradient id={`calGold_${uid}`} x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="44" height="40" rx="10" fill="#202228" />
        <rect x="10" y="14" width="44" height="13" rx="8" fill={`url(#calRed_${uid})`} />
        <rect x="18" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF" />
        <rect x="41" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF" />
        <text x="32" y="44" fill={`url(#calGold_${uid})`} fontSize="21" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle">
          31
        </text>
      </svg>
    )
  }

  // 3. Notes / Quotations / Letterhead / Contracts
  if (p.includes('notes') || p.includes('letterhead') || p.includes('quotation') || p.includes('contract') || l.includes('خطاب') || l.includes('عروض') || l.includes('عقود')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`pad_${uid}`} x1="10" y1="10" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#4FACFE" />
          </linearGradient>
          <linearGradient id={`pen_${uid}`} x1="22" y1="44" x2="52" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FFB199" />
          </linearGradient>
        </defs>
        <path d="M12 14C12 10.686 14.686 8 18 8H36L48 20V46C48 49.314 45.314 52 42 52H18C14.686 52 12 49.314 12 46V14Z" fill={`url(#pad_${uid})`} />
        <path d="M36 8V18C36 19.1 36.9 20 38 20H48L36 8Z" fill="#0072FF" fillOpacity="0.4" />
        <path d="M22 46L24 38L44 18L50 24L30 44L22 46Z" fill={`url(#pen_${uid})`} />
        <circle cx="51" cy="17" r="4" fill="#FF2E93" />
        <path d="M22 46L26 44L24 42L22 46Z" fill="#202228" />
      </svg>
    )
  }

  // 4. Members / Employees / Users / Workers / Barbers / Manpower
  if (p.includes('employee') || p.includes('user') || p.includes('worker') || p.includes('member') || p.includes('barber') || p.includes('manpower') || l.includes('موظف') || l.includes('مستخدم') || l.includes('عمال') || l.includes('أعضاء') || l.includes('حلاق')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`green1_${uid}`} x1="12" y1="12" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id={`teal_${uid}`} x1="24" y1="20" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="20" r="8" fill={`url(#green1_${uid})`} />
        <path d="M10 44C10 36.268 16.268 30 24 30C31.732 30 38 36.268 38 44V48H10V44Z" fill={`url(#green1_${uid})`} />
        <circle cx="40" cy="25" r="7" fill={`url(#teal_${uid})`} />
        <path d="M28 47C28 40.373 33.373 35 40 35C46.627 35 52 40.373 52 47V51H28V47Z" fill={`url(#teal_${uid})`} />
      </svg>
    )
  }

  // 5. Knowledge / BookMarked / Categories / Documents / Wiki / Bookstore
  if (p.includes('knowledge') || p.includes('supply-list') || p.includes('bookstore') || l.includes('معرفة') || l.includes('مكتبة') || l.includes('قوائم')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`purpleBook_${uid}`} x1="14" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8A2387" />
            <stop offset="50%" stopColor="#E94057" />
            <stop offset="100%" stopColor="#F27121" />
          </linearGradient>
          <linearGradient id={`ribbon_${uid}`} x1="30" y1="8" x2="46" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
        </defs>
        <rect x="14" y="12" width="28" height="42" rx="6" fill="#4A00E0" fillOpacity="0.8" />
        <rect x="18" y="16" width="30" height="40" rx="6" fill={`url(#purpleBook_${uid})`} />
        <path d="M34 10V38L42 32L50 38V10H34Z" fill={`url(#ribbon_${uid})`} />
        <path d="M42 32L50 38V30L42 24L34 30V38L42 32Z" fill="#FFE600" fillOpacity="0.3" />
      </svg>
    )
  }

  // 6. Contacts / Customers / Khata / Registry
  if (p.includes('contact') || p.includes('customer') || p.includes('khata') || l.includes('عملاء') || l.includes('اتصال') || l.includes('خاتا')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`cardBg_${uid}`} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008" />
            <stop offset="100%" stopColor="#FFC837" />
          </linearGradient>
          <linearGradient id={`blueBorder_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0052D4" />
            <stop offset="50%" stopColor="#4364F7" />
            <stop offset="100%" stopColor="#6FB1FC" />
          </linearGradient>
        </defs>
        <rect x="12" y="10" width="40" height="44" rx="12" fill="none" stroke={`url(#blueBorder_${uid})`} strokeWidth="4" />
        <rect x="16" y="14" width="32" height="36" rx="8" fill={`url(#cardBg_${uid})`} />
        <circle cx="32" cy="27" r="6" fill="#FFFFFF" />
        <path d="M22 43C22 38 26.5 35 32 35C37.5 35 42 38 42 43H22Z" fill="#FFFFFF" />
      </svg>
    )
  }

  // 7. CRM / Leads / Deals / Activities / Campaigns
  if (p.includes('crm') || p.includes('lead') || p.includes('deal') || p.includes('campaign') || l.includes('صفقات') || l.includes('crm') || l.includes('حملات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`pinkSphere_${uid}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FF61D2" />
            <stop offset="100%" stopColor="#FE0979" />
          </radialGradient>
          <radialGradient id={`blueSphere_${uid}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#4FACFE" />
          </radialGradient>
          <radialGradient id={`goldSphere_${uid}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFE000" />
            <stop offset="100%" stopColor="#799F0C" />
          </radialGradient>
        </defs>
        <circle cx="25" cy="26" r="14" fill={`url(#pinkSphere_${uid})`} />
        <circle cx="41" cy="24" r="12" fill={`url(#goldSphere_${uid})`} />
        <circle cx="32" cy="40" r="15" fill={`url(#blueSphere_${uid})`} fillOpacity="0.95" />
        <circle cx="46" cy="42" r="5" fill="#FF007F" />
      </svg>
    )
  }

  // 8. Sales / Analytics / Reports / Daily P&L / Bestsellers
  if (p.includes('sales') || p.includes('analytic') || p.includes('report') || p.includes('pnl') || p.includes('bestseller') || l.includes('مبيعات') || l.includes('أرباح') || l.includes('تقارير')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`bar1_${uid}`} x1="12" y1="36" x2="22" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F" />
            <stop offset="100%" stopColor="#DD2476" />
          </linearGradient>
          <linearGradient id={`bar2_${uid}`} x1="26" y1="22" x2="38" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F09819" />
            <stop offset="100%" stopColor="#EDDE5D" />
          </linearGradient>
          <linearGradient id={`bar3_${uid}`} x1="42" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF416C" />
            <stop offset="100%" stopColor="#FF4B2B" />
          </linearGradient>
        </defs>
        <rect x="12" y="32" width="10" height="22" rx="5" fill={`url(#bar1_${uid})`} />
        <rect x="27" y="20" width="10" height="34" rx="5" fill={`url(#bar2_${uid})`} />
        <rect x="42" y="10" width="10" height="44" rx="5" fill={`url(#bar3_${uid})`} />
        <ellipse cx="17" cy="35" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <ellipse cx="32" cy="23" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <ellipse cx="47" cy="13" rx="3" ry="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
    )
  }

  // 9. Dashboards / Insights / Administration / Main
  if (p === '/app/dashboard' || p.includes('dashboard') || l.includes('لوحة التحكم') || l.includes('الرئيسية')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`pinkTile_${uid}`} x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`cyanTile_${uid}`} x1="34" y1="12" x2="52" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`orangeTile_${uid}`} x1="12" y1="34" x2="28" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F857A6" />
            <stop offset="100%" stopColor="#FF5858" />
          </linearGradient>
          <linearGradient id={`goldTile_${uid}`} x1="34" y1="30" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#F77737" />
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="16" height="16" rx="6" fill={`url(#pinkTile_${uid})`} />
        <rect x="34" y="12" width="18" height="12" rx="5" fill={`url(#cyanTile_${uid})`} />
        <rect x="12" y="34" width="16" height="18" rx="6" fill={`url(#orangeTile_${uid})`} />
        <rect x="34" y="29" width="18" height="23" rx="7" fill={`url(#goldTile_${uid})`} />
      </svg>
    )
  }

  // 10. Subscriptions / Calculators / Bundles / Combos
  if (p.includes('subscription') || p.includes('calculator') || p.includes('combo') || l.includes('اشتراك') || l.includes('باقات') || l.includes('حزم')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`subBlue1_${uid}`} x1="12" y1="10" x2="36" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C6FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`subBlue2_${uid}`} x1="28" y1="16" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2193B0" />
            <stop offset="100%" stopColor="#6DD5ED" />
          </linearGradient>
        </defs>
        <rect x="12" y="14" width="24" height="38" rx="7" fill={`url(#subBlue1_${uid})`} />
        <rect x="28" y="20" width="24" height="34" rx="7" fill={`url(#subBlue2_${uid})`} />
        <rect x="33" y="26" width="14" height="5" rx="2.5" fill="#FFFFFF" />
      </svg>
    )
  }

  // 11. Rental / Car Rental / Fleet / Active / Maintenance
  if (p.includes('rental') || p.includes('fleet') || p.includes('vehicle') || p.includes('car') || l.includes('تأجير') || l.includes('سيارات') || l.includes('أسطول')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`trackGold_${uid}`} x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F9D423" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`trackCyan_${uid}`} x1="12" y1="28" x2="52" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#4FACFE" />
          </linearGradient>
          <linearGradient id={`trackOrange_${uid}`} x1="12" y1="40" x2="52" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F" />
            <stop offset="100%" stopColor="#F09819" />
          </linearGradient>
        </defs>
        <rect x="12" y="16" width="40" height="9" rx="4.5" fill={`url(#trackGold_${uid})`} />
        <rect x="12" y="28" width="40" height="9" rx="4.5" fill={`url(#trackCyan_${uid})`} />
        <rect x="12" y="40" width="40" height="9" rx="4.5" fill={`url(#trackOrange_${uid})`} />
        <circle cx="22" cy="20.5" r="3" fill="#FFFFFF" />
        <circle cx="40" cy="32.5" r="3" fill="#FFFFFF" />
        <circle cx="30" cy="44.5" r="3" fill="#FFFFFF" />
      </svg>
    )
  }

  // 12. Point of Sale (POS) / Restaurant POS / Bakala POS / Laundry POS / Bookstore POS / Tailor POS / Boutique POS / Furniture POS / Saloon POS / Checkout
  if (p.includes('pos') || p.includes('checkout') || l.includes('نقطة البيع') || l.includes('كاشير')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`awningRed_${uid}`} x1="8" y1="14" x2="56" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`awningWhite_${uid}`} x1="8" y1="14" x2="56" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F0F0F0" />
          </linearGradient>
        </defs>
        <path d="M10 16H54L50 36C50 40 46 42 43 38C40 42 36 42 33 38C30 42 26 42 23 38C20 42 16 42 14 36L10 16Z" fill="#3A0007" />
        <path d="M10 16L14 36C15.5 39.5 19 39.5 20.5 36L19 16H10Z" fill={`url(#awningRed_${uid})`} />
        <path d="M19 16L20.5 36C22 39.5 25.5 39.5 27 36L26.5 16H19Z" fill={`url(#awningWhite_${uid})`} />
        <path d="M26.5 16L27 36C28.5 39.5 32 39.5 33.5 36L34 16H26.5Z" fill={`url(#awningRed_${uid})`} />
        <path d="M34 16L33.5 36C35 39.5 38.5 39.5 40 36L41.5 16H34Z" fill={`url(#awningWhite_${uid})`} />
        <path d="M41.5 16L40 36C41.5 39.5 45 39.5 46.5 36L54 16H41.5Z" fill={`url(#awningRed_${uid})`} />
        <rect x="14" y="42" width="36" height="8" rx="4" fill="#2A2C34" />
        <rect x="22" y="44" width="20" height="4" rx="2" fill="#00E5FF" />
      </svg>
    )
  }

  // 13. Accounting / Invoices / Financials / VAT / Vouchers
  if (p.includes('invoices') || p.includes('finance') || p.includes('vat') || p.includes('voucher') || p.includes('expense') || l.includes('فاتورة') || l.includes('مالية') || l.includes('ضريبة') || l.includes('سندات') || l.includes('مصروفات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`piePurple_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#654EA3" />
            <stop offset="100%" stopColor="#EAAFC8" />
          </linearGradient>
          <linearGradient id={`piePink_${uid}`} x1="28" y1="10" x2="54" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FFB199" />
          </linearGradient>
        </defs>
        <path d="M30 34V12C17.85 12 8 21.85 8 34C8 46.15 17.85 56 30 56C42.15 56 52 46.15 52 34H30Z" fill={`url(#piePurple_${uid})`} />
        <path d="M36 10V28H54C54 18.059 45.941 10 36 10Z" fill={`url(#piePink_${uid})`} />
      </svg>
    )
  }

  // 14. Documents / Delivery Notes / Job Cards / Backup
  if (p.includes('document') || p.includes('delivery-note') || p.includes('job-card') || p.includes('backup') || l.includes('مستندات') || l.includes('سندات') || l.includes('بطاقات') || l.includes('نسخ')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`docGold_${uid}`} x1="12" y1="16" x2="40" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F9D423" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`docPurple_${uid}`} x1="16" y1="14" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF" />
            <stop offset="100%" stopColor="#E100FF" />
          </linearGradient>
          <linearGradient id={`docOrange_${uid}`} x1="22" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF512F" />
            <stop offset="100%" stopColor="#DD2476" />
          </linearGradient>
        </defs>
        <rect x="14" y="20" width="28" height="34" rx="6" transform="rotate(-15 14 20)" fill={`url(#docPurple_${uid})`} />
        <rect x="22" y="14" width="28" height="34" rx="6" transform="rotate(12 22 14)" fill={`url(#docGold_${uid})`} />
        <rect x="20" y="16" width="28" height="34" rx="6" fill={`url(#docOrange_${uid})`} />
      </svg>
    )
  }

  // 15. Projects / Tasks / Assignments
  if (p.includes('project') || p.includes('task') || p.includes('assignment') || l.includes('مشاريع') || l.includes('مهام') || l.includes('تعيين')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`greenCheck_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B" />
            <stop offset="100%" stopColor="#96C93D" />
          </linearGradient>
        </defs>
        <rect x="32" y="8" width="30" height="30" rx="8" transform="rotate(45 32 8)" fill="#1B4D3E" />
        <rect x="32" y="12" width="26" height="26" rx="6" transform="rotate(45 32 12)" fill={`url(#greenCheck_${uid})`} />
        <path d="M22 32L29 39L44 24" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // 16. Timesheets / Attendance / Clock / Queue
  if (p.includes('timesheet') || p.includes('attendance') || p.includes('clock') || p.includes('queue') || l.includes('حضور') || l.includes('وقت') || l.includes('ساعات') || l.includes('انتظار')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`gaugeCyan_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#4FACFE" />
          </linearGradient>
          <linearGradient id={`needlePink_${uid}`} x1="32" y1="32" x2="48" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FFB199" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill="#181A20" stroke={`url(#gaugeCyan_${uid})`} strokeWidth="4" />
        <circle cx="32" cy="32" r="18" fill="#3A1C71" fillOpacity="0.4" />
        <circle cx="32" cy="32" r="6" fill="#FFFFFF" />
        <path d="M32 32L45 19" stroke={`url(#needlePink_${uid})`} strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="32" r="3" fill="#FF0844" />
      </svg>
    )
  }

  // 17. Field Service / Workshop / Repair / Maintenance / Wrench / Lightning
  if (p.includes('workshop') || p.includes('maintenance') || p.includes('repair') || l.includes('ورشة') || l.includes('صيانة') || l.includes('إصلاح')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`boltGold_${uid}`} x1="20" y1="8" x2="44" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
        </defs>
        <path d="M32 6L54 22V42L32 58L10 42V22L32 6Z" fill="#3D2800" />
        <path d="M36 10L18 32H32L26 54L46 30H32L36 10Z" fill={`url(#boltGold_${uid})`} />
      </svg>
    )
  }

  // 18. Planning / Shifts / Leaves / Roadmap
  if (p.includes('planning') || p.includes('shift') || p.includes('leave') || l.includes('تخطيط') || l.includes('وردية') || l.includes('إجازات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`planCyan_${uid}`} x1="10" y1="20" x2="54" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`planPink_${uid}`} x1="10" y1="36" x2="54" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="22" r="5" fill="#00E5FF" />
        <rect x="26" y="18" width="26" height="8" rx="4" fill={`url(#planCyan_${uid})`} />
        <circle cx="16" cy="40" r="5" fill="#FF0844" />
        <rect x="26" y="36" width="26" height="8" rx="4" fill={`url(#planPink_${uid})`} />
      </svg>
    )
  }

  // 19. Helpdesk / Compliance / Saudi Compliance / Support
  if (p.includes('helpdesk') || p.includes('compliance') || l.includes('دعم') || l.includes('امتثال') || l.includes('تنظيمي')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`buoyPink_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`buoyGold_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill={`url(#buoyPink_${uid})`} />
        <path d="M32 10C35 10 38 10.5 41 11.5L37 20C35.5 19.5 33.8 19 32 19V10Z" fill={`url(#buoyGold_${uid})`} />
        <path d="M32 54C29 54 26 53.5 23 52.5L27 44C28.5 44.5 30.2 45 32 45V54Z" fill={`url(#buoyGold_${uid})`} />
        <path d="M10 32C10 29 10.5 26 11.5 23L20 27C19.5 28.5 19 30.2 19 32H10Z" fill={`url(#buoyGold_${uid})`} />
        <path d="M54 32C54 35 53.5 38 52.5 41L44 37C44.5 35.5 45 33.8 45 32H54Z" fill={`url(#buoyGold_${uid})`} />
        <circle cx="32" cy="32" r="10" fill="#121318" />
      </svg>
    )
  }

  // 20. Website / Storefront / Theme / Domains / WordPress
  if (p.includes('theme') || p.includes('domain') || p.includes('wordpress') || p.includes('website') || l.includes('تصميم المتجر') || l.includes('نطاقات') || l.includes('ووردبريس')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`sunRed_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FF416C" />
            <stop offset="100%" stopColor="#8A0000" />
          </radialGradient>
          <radialGradient id={`sunGold_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#FF4E50" />
          </radialGradient>
        </defs>
        <circle cx="28" cy="32" r="18" fill={`url(#sunRed_${uid})`} />
        <circle cx="36" cy="32" r="18" fill={`url(#sunGold_${uid})`} fillOpacity="0.85" style={{ mixBlendMode: 'screen' }} />
      </svg>
    )
  }

  // 21. eLearning / Education / Training / School Supply
  if (p.includes('elearning') || p.includes('training') || l.includes('تعليم') || l.includes('مدارس')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`gradSphere_${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#00F5A0" />
            <stop offset="100%" stopColor="#00D9E1" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="38" r="14" fill={`url(#gradSphere_${uid})`} />
        <path d="M32 14L14 23L32 32L50 23L32 14Z" fill="#1B4D3E" />
        <path d="M32 16L18 23L32 30L46 23L32 16Z" fill="#00D9E1" />
        <path d="M46 23V34" stroke="#00F5A0" strokeWidth="2.5" />
      </svg>
    )
  }

  // 22. Social Marketing / Loyalty / Reviews / Promotions / Coupons
  if (p.includes('social') || p.includes('loyalty') || p.includes('review') || p.includes('promotion') || p.includes('coupon') || l.includes('ولاء') || l.includes('تقييمات') || l.includes('عروض') || l.includes('كوبونات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`heartTopL_${uid}`} x1="16" y1="12" x2="32" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
          <linearGradient id={`heartTopR_${uid}`} x1="32" y1="12" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#F77737" />
          </linearGradient>
          <linearGradient id={`heartBottom_${uid}`} x1="16" y1="28" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#C3073F" />
          </linearGradient>
        </defs>
        <path d="M16 22C16 16 21 12 27 14L32 24L20 28L16 22Z" fill={`url(#heartTopL_${uid})`} />
        <path d="M48 22C48 16 43 12 37 14L32 24L44 28L48 22Z" fill={`url(#heartTopR_${uid})`} />
        <path d="M16 22L32 24L48 22L32 50L16 22Z" fill={`url(#heartBottom_${uid})`} />
      </svg>
    )
  }

  // 23. Marketing Automation / Integrations / Government Integrations / Gov / ZATCA / Elm / Qiwa / Gosi
  if (p.includes('marketing-automation') || p.includes('integration') || p.includes('gov') || p.includes('zatca') || p.includes('qiwa') || p.includes('gosi') || p.includes('elm') || l.includes('تكامل') || l.includes('زاتكا') || l.includes('حكومية')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`ribbonPurple_${uid}`} x1="12" y1="20" x2="52" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF" />
            <stop offset="100%" stopColor="#E100FF" />
          </linearGradient>
          <linearGradient id={`ribbonGold_${uid}`} x1="12" y1="34" x2="52" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F9D423" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
        </defs>
        <path d="M12 24H28L36 32H52" stroke={`url(#ribbonPurple_${uid})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 40H36L28 32H12" stroke={`url(#ribbonGold_${uid})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // 24. Email Marketing / Mail / Newsletter / SuperAdmin Mailbox
  if (p.includes('email') || p.includes('mail') || p.includes('newsletter') || l.includes('بريد') || l.includes('نشرة')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`planeBlue_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C6FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`planePurple_${uid}`} x1="18" y1="20" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF" />
            <stop offset="100%" stopColor="#E100FF" />
          </linearGradient>
        </defs>
        <path d="M12 30L52 14L34 52L26 38L12 30Z" fill={`url(#planeBlue_${uid})`} />
        <path d="M26 38L52 14L34 52L26 38Z" fill={`url(#planePurple_${uid})`} />
      </svg>
    )
  }

  // 25. SMS Marketing / Alerts / Notifications / Fast Alert
  if (p.includes('sms') || p.includes('alert') || l.includes('تنبيه') || l.includes('رسائل قصيرة')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`smsGold_${uid}`} x1="16" y1="12" x2="38" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
          <linearGradient id={`smsPink_${uid}`} x1="26" y1="20" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
        </defs>
        <rect x="16" y="14" width="22" height="36" rx="11" fill={`url(#smsGold_${uid})`} />
        <rect x="26" y="22" width="22" height="30" rx="11" fill={`url(#smsPink_${uid})`} fillOpacity="0.9" />
      </svg>
    )
  }

  // 26. Events / Bookings / Travel / Buy-Back
  if (p.includes('event') || p.includes('booking') || p.includes('travel') || p.includes('buyback') || l.includes('فعاليات') || l.includes('إعارة') || l.includes('مستعملة') || l.includes('سفر')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`loopGold_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE000" />
            <stop offset="100%" stopColor="#799F0C" />
          </linearGradient>
          <linearGradient id={`loopPink_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF007F" />
            <stop offset="100%" stopColor="#7F00FF" />
          </linearGradient>
        </defs>
        <path d="M16 46L32 28L48 46H16Z" fill={`url(#loopGold_${uid})`} />
        <path d="M16 18L32 36L48 18H16Z" fill={`url(#loopPink_${uid})`} fillOpacity="0.9" style={{ mixBlendMode: 'screen' }} />
      </svg>
    )
  }

  // 27. Surveys / Feedback / Questions / Q&A / Performance / Hiring
  if (p.includes('survey') || p.includes('question') || p.includes('performance') || p.includes('hiring') || l.includes('استبيان') || l.includes('أسئلة') || l.includes('أداء') || l.includes('توظيف')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`diamondGold_${uid}`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="18" fill="#4A00E0" fillOpacity="0.4" />
        <rect x="32" y="14" width="25" height="25" rx="5" transform="rotate(45 32 14)" fill={`url(#diamondGold_${uid})`} />
      </svg>
    )
  }

  // 28. Purchase / Purchase Orders / Suppliers / GRN / Landed Costs
  if (p.includes('purchase') || p.includes('supplier') || p.includes('grn') || p.includes('landed') || l.includes('شراء') || l.includes('موردين') || l.includes('استلام')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`purchCyan_${uid}`} x1="10" y1="14" x2="54" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id={`purchPurple_${uid}`} x1="10" y1="28" x2="54" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7F00FF" />
            <stop offset="100%" stopColor="#E100FF" />
          </linearGradient>
          <linearGradient id={`purchGreen_${uid}`} x1="10" y1="42" x2="54" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <rect x="12" y="16" width="40" height="10" rx="4" fill={`url(#purchCyan_${uid})`} />
        <rect x="12" y="28" width="40" height="12" rx="4" fill={`url(#purchPurple_${uid})`} />
        <rect x="12" y="42" width="40" height="8" rx="4" fill={`url(#purchGreen_${uid})`} />
      </svg>
    )
  }

  // 29. Inventory / Products / Warehouses / Stock / Items / Bundles / Abandoned Carts / Returns
  if (p.includes('inventory') || p.includes('product') || p.includes('warehouse') || p.includes('stock') || p.includes('item') || p.includes('bundle') || p.includes('cart') || p.includes('return') || l.includes('مخزون') || l.includes('منتج') || l.includes('مستودع') || l.includes('سلات') || l.includes('مرتجعات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`cubeTop_${uid}`} x1="16" y1="12" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8008" />
            <stop offset="100%" stopColor="#FFC837" />
          </linearGradient>
          <linearGradient id={`cubeLeft_${uid}`} x1="14" y1="24" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#C3073F" />
          </linearGradient>
          <linearGradient id={`cubeRight_${uid}`} x1="32" y1="24" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF4E50" />
            <stop offset="100%" stopColor="#F9D423" />
          </linearGradient>
        </defs>
        <path d="M32 12L48 21L32 30L16 21L32 12Z" fill={`url(#cubeTop_${uid})`} />
        <path d="M16 21L32 30V48L16 39V21Z" fill={`url(#cubeLeft_${uid})`} />
        <path d="M32 30L48 21V39L32 48V30Z" fill={`url(#cubeRight_${uid})`} />
      </svg>
    )
  }

  // 30. Manufacturing / MRP / Workshop / Tailoring / Kitchen / KDS / Stitchings / Fabrics / Customizations
  if (p.includes('mrp') || p.includes('manufacturing') || p.includes('khayyat') || p.includes('stitching') || p.includes('fabric') || p.includes('customization') || p.includes('embroidery') || p.includes('kitchen') || p.includes('kds') || l.includes('تصنيع') || l.includes('خياطة') || l.includes('أقمشة') || l.includes('مطبخ')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`mfgBlock1_${uid}`} x1="12" y1="24" x2="24" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00B09B" />
            <stop offset="100%" stopColor="#96C93D" />
          </linearGradient>
          <linearGradient id={`mfgBlock2_${uid}`} x1="24" y1="16" x2="38" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id={`mfgBlock3_${uid}`} x1="38" y1="20" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <rect x="12" y="24" width="12" height="28" rx="3" fill={`url(#mfgBlock1_${uid})`} />
        <rect x="25" y="16" width="13" height="36" rx="3" fill={`url(#mfgBlock2_${uid})`} />
        <rect x="39" y="20" width="13" height="32" rx="3" fill={`url(#mfgBlock3_${uid})`} />
        <rect x="14" y="26" width="8" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
        <rect x="27" y="18" width="9" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
        <rect x="41" y="22" width="9" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    )
  }

  // 31. Settings / System / Profile / Hidden Navbars
  if (p.includes('setting') || p.includes('profile') || p.includes('hidden') || l.includes('إعدادات') || l.includes('ملف')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`gearGrad_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4facfe" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>
          <linearGradient id={`gearCenter_${uid}`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="18" fill={`url(#gearGrad_${uid})`} />
        <rect x="30" y="8" width="4" height="6" rx="2" fill={`url(#gearGrad_${uid})`} />
        <rect x="30" y="50" width="4" height="6" rx="2" fill={`url(#gearGrad_${uid})`} />
        <rect x="8" y="30" width="6" height="4" rx="2" fill={`url(#gearGrad_${uid})`} />
        <rect x="50" y="30" width="6" height="4" rx="2" fill={`url(#gearGrad_${uid})`} />
        <rect x="15" y="15" width="5" height="5" rx="1.5" transform="rotate(45 15 15)" fill={`url(#gearGrad_${uid})`} />
        <rect x="44" y="44" width="5" height="5" rx="1.5" transform="rotate(45 44 44)" fill={`url(#gearGrad_${uid})`} />
        <rect x="44" y="15" width="5" height="5" rx="1.5" transform="rotate(45 44 15)" fill={`url(#gearGrad_${uid})`} />
        <rect x="15" y="44" width="5" height="5" rx="1.5" transform="rotate(45 15 44)" fill={`url(#gearGrad_${uid})`} />
        <circle cx="32" cy="32" r="9" fill={`url(#gearCenter_${uid})`} />
        <circle cx="32" cy="32" r="4" fill="#121318" />
      </svg>
    )
  }

  // 32. Produce / Fresh Produce / Leaf / Fruits & Veggies
  if (p.includes('produce') || l.includes('فواكه') || l.includes('خضروات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`leafGrad_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F5A0" />
            <stop offset="100%" stopColor="#00D9E1" />
          </linearGradient>
        </defs>
        <path d="M14 50C14 50 18 20 48 14C48 14 52 44 22 50L14 50Z" fill={`url(#leafGrad_${uid})`} />
        <path d="M14 50L48 14" stroke="#1B4D3E" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // 33. Food & Restaurant Menu Items / Mess / Buffet
  if (p.includes('menu-item') || p.includes('mess') || l.includes('طعام') || l.includes('وجبات')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`platterGold_${uid}`} x1="12" y1="14" x2="52" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#F7971E" />
          </linearGradient>
        </defs>
        {/* 3D Cloche / Serving Platter */}
        <circle cx="32" cy="18" r="4" fill={`url(#platterGold_${uid})`} />
        <path d="M14 38C14 26 22 21 32 21C42 21 50 26 50 38H14Z" fill={`url(#platterGold_${uid})`} />
        <rect x="10" y="40" width="44" height="6" rx="3" fill="#202228" />
        <rect x="12" y="40" width="40" height="3" rx="1.5" fill="#FF4E50" />
      </svg>
    )
  }

  // 34. Dresses / Fashion / Boutique / Tailor / Laundry Catalog
  if (p.includes('dress') || p.includes('catalog') || l.includes('فساتين') || l.includes('أزياء')) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`dressPink_${uid}`} x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF0844" />
            <stop offset="100%" stopColor="#FF4E50" />
          </linearGradient>
        </defs>
        <path d="M26 12L38 12L34 26L48 52H16L30 26L26 12Z" fill={`url(#dressPink_${uid})`} />
        <ellipse cx="32" cy="12" rx="6" ry="2" fill="#FFE000" />
      </svg>
    )
  }

  // Fallback: Ultra-sleek 3D Geometric Faceted Gem
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`gemGrad1_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF0844" />
          <stop offset="100%" stopColor="#FFB199" />
        </linearGradient>
        <linearGradient id={`gemGrad2_${uid}`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#7F00FF" />
        </linearGradient>
      </defs>
      <path d="M32 10L50 22V42L32 54L14 42V22L32 10Z" fill={`url(#gemGrad2_${uid})`} />
      <path d="M32 10L50 22L32 34L14 22L32 10Z" fill={`url(#gemGrad1_${uid})`} fillOpacity="0.8" />
      <circle cx="32" cy="32" r="5" fill="#FFFFFF" fillOpacity="0.8" />
    </svg>
  )
}

export default App3DIcon
