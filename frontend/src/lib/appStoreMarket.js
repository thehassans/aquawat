import {
  isSaudiTenant,
  isUaeTenant,
  isOmanTenant,
  isBahrainTenant,
  isKuwaitTenant,
  isQatarTenant,
  isBangladeshTenant,
  isPakistanTenant,
  getTenantCurrency,
} from './saudiTenant';

/** Market profile for App Store personalization. */
export function getAppStoreMarket(tenant) {
  if (isSaudiTenant(tenant)) return 'saudi';
  if (isUaeTenant(tenant)) return 'uae';
  if (isOmanTenant(tenant)) return 'oman';
  if (isBahrainTenant(tenant)) return 'bahrain';
  if (isKuwaitTenant(tenant)) return 'kuwait';
  if (isQatarTenant(tenant)) return 'qatar';
  if (isBangladeshTenant(tenant)) return 'bangladesh';
  if (isPakistanTenant(tenant)) return 'pakistan';
  return 'global';
}

/**
 * Preferred / recommended app order by tenant market.
 */
export function getPreferredAppIds(tenant) {
  const market = getAppStoreMarket(tenant);

  if (market === 'saudi') {
    return [
      'zatca_phase2_pro',
      'gosi_mudad_compliance',
      'elm_identity_pro',
      'qiwa_hr_integration',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'pharmacy',
      'tabby_bnpl',
      'tamara_bnpl',
      'crm_sales_pipeline',
      'hr_payroll_pro',
      'gym_fitness_club',
    ];
  }

  if (market === 'uae') {
    return [
      'uae_fta_compliance',
      'tabby_bnpl',
      'tamara_bnpl',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
      'gym_fitness_club',
    ];
  }

  if (market === 'oman') {
    return [
      'oman_ota_compliance',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'bakala_supermarket',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
    ];
  }

  if (market === 'bahrain') {
    return [
      'bahrain_nbr_compliance',
      'tabby_bnpl',
      'tamara_bnpl',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
    ];
  }

  if (market === 'kuwait') {
    return [
      'kuwait_mof_compliance',
      'tabby_bnpl',
      'tamara_bnpl',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
    ];
  }

  if (market === 'qatar') {
    return [
      'qatar_dhareeba_compliance',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
    ];
  }

  if (market === 'bangladesh') {
    return [
      'bangladesh_nbr_einvoicing',
      'nbr_mushak_registers',
      'bkash_payment_gateway',
      'nagad_payment_gateway',
      'sslcommerz_bd_gateway',
      'pathao_courier_logistics',
      'steadfast_courier_api',
      'redx_logistics_bd',
      'bangladesh_sms_gateway',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'bakala_supermarket',
      'restaurant_cafe',
      'crm_sales_pipeline',
      'hr_payroll_pro',
      'gym_fitness_club',
    ];
  }

  if (market === 'pakistan') {
    return [
      'marquee_management',
      'restaurant_cafe',
      'pakistan_fbr_einvoicing',
      'invoice_template_2',
      'whatsapp_cloud_auto',
      'email_suite',
      'sms_marketing',
      'thermal_printer_driver',
      'bakala_supermarket',
      'crm_sales_pipeline',
      'hr_payroll_pro',
      'gym_fitness_club',
    ];
  }

  return [
    'marquee_management',
    'restaurant_cafe',
    'invoice_template_2',
    'invoice_template_3',
    'whatsapp_cloud_auto',
    'email_suite',
    'sms_marketing',
    'thermal_printer_driver',
    'crm_sales_pipeline',
    'hr_payroll_pro',
    'gym_fitness_club',
  ];
}

export function getAppStoreMarketCopy(tenant, language = 'en') {
  const market = getAppStoreMarket(tenant);
  const currency = getTenantCurrency(tenant);
  const isAr = language === 'ar';

  if (market === 'saudi') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'امتثال زاتكا والسعودية أولاً' : 'ZATCA & Saudi compliance first',
      subtitle: isAr
        ? 'التطبيقات الأهم لمنشأتك في المملكة — الفوترة الإلكترونية والتكاملات الحكومية.'
        : 'The highest-priority apps for KSA businesses — e-invoicing and government suites.',
      badge: 'SAR · KSA',
    };
  }

  if (market === 'uae') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'الامتثال الضريبي الإماراتي (FTA)' : 'UAE FTA & EmaraTax compliance first',
      subtitle: isAr
        ? 'الرقم الضريبي TRN، ضريبة 5%، والفوترة الإلكترونية المتوافقة مع الهيئة الاتحادية للضرائب.'
        : 'TRN verification, 5% UAE VAT, Corporate Tax, and FTA-compliant e-invoicing.',
      badge: 'AED · UAE',
    };
  }

  if (market === 'oman') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'جهاز الضرائب العماني (OTA)' : 'Oman OTA Tax & Invoicing first',
      subtitle: isAr
        ? 'رقم التعريف الضريبي TIN، ضريبة 5%، والفوترة الإلكترونية بالريال العماني.'
        : 'TIN tax identification, 5% Oman VAT, and OTA-ready e-invoicing in OMR.',
      badge: 'OMR · Oman',
    };
  }

  if (market === 'bahrain') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'الجهاز الوطني للإيرادات (NBR)' : 'Bahrain NBR 10% VAT compliance first',
      subtitle: isAr
        ? 'رقم الحساب الضريبي، ضريبة 10%، والتحقق المعتمد في البحرين.'
        : '15-digit VAT account, 10% Bahrain VAT, and NBR verification in BHD.',
      badge: 'BHD · Bahrain',
    };
  }

  if (market === 'kuwait') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'الامتثال المالي والتجاري (الكويت)' : 'Kuwait MOF & Commercial compliance first',
      subtitle: isAr
        ? 'الرقم المدني والتجاري الموحد والبطاقة الضريبية لوزارة المالية الكويتية.'
        : 'Civil ID, unified commercial ID, and Kuwait MOF tax card integration.',
      badge: 'KWD · Kuwait',
    };
  }

  if (market === 'qatar') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'الهيئة العامة للضرائب ونظام ضريبة' : 'Qatar GTA Dhareeba compliance first',
      subtitle: isAr
        ? 'الرقم الضريبي TIN، نظام ضريبة، والفوترة الإلكترونية بالريال القطري.'
        : 'Dhareeba TIN, GTA tax invoicing, and Qatar verification QR codes in QAR.',
      badge: 'QAR · Qatar',
    };
  }

  if (market === 'bangladesh') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'NBR و Mushak أولاً' : 'NBR & Mushak first',
      subtitle: isAr
        ? 'امتثال هيئة الإيرادات الوطنية البنغلاديشية — رقم BIN ونموذج Mushak 6.3.'
        : 'Bangladesh NBR tax suite — BIN management and Mushak 6.3 VAT invoices.',
      badge: 'BDT · Bangladesh',
    };
  }

  if (market === 'pakistan') {
    return {
      eyebrow: isAr ? 'موصى به لسوقك' : 'Recommended for your market',
      title: isAr ? 'FBR أولاً لمنشأتك في باكستان' : 'FBR first for Pakistan businesses',
      subtitle: isAr
        ? 'الفوترة الرقمية لهيئة الإيرادات الفيدرالية — NTN وSTRN ورمز QR على كل فاتورة.'
        : 'Federal Board of Revenue digital invoicing — NTN, STRN, and FBR QR on every sale.',
      badge: 'PKR · Pakistan',
    };
  }

  return {
    eyebrow: isAr ? 'موصى به لك' : 'Recommended for you',
    title: isAr ? 'ابدأ بالأساسيات' : 'Start with essentials',
    subtitle: isAr
      ? `عملتك ${currency} — تطبيقات جاهزة للفوترة والتواصل والمبيعات.`
      : `Currency ${currency} — invoicing, messaging, and sales apps first.`,
    badge: currency,
  };
}

/** Lower score = higher in preferred / featured ranking. */
export function scoreAppForMarket(app, tenant) {
  if (!app) return 9999;
  const preferred = getPreferredAppIds(tenant);
  const idx = preferred.indexOf(app.appId);
  let score = idx >= 0 ? idx : 800 + String(app.nameEn || app.appId).length;

  const market = getAppStoreMarket(tenant);
  const isSaudiApp =
    app.category === 'saudi_compliance' ||
    app.appType === 'saudi_compliance' ||
    String(app.appId || '').includes('zatca') ||
    String(app.appId || '').includes('gosi') ||
    String(app.appId || '').includes('qiwa') ||
    String(app.appId || '').includes('elm') ||
    String(app.appId || '').includes('balady') ||
    String(app.appId || '').includes('saber') ||
    String(app.appId || '').includes('etimad');

  if (market !== 'saudi' && isSaudiApp) score += 5000;
  if (market === 'uae' && app.appId === 'uae_fta_compliance') score = Math.min(score, 0);
  if (market === 'oman' && app.appId === 'oman_ota_compliance') score = Math.min(score, 0);
  if (market === 'bahrain' && app.appId === 'bahrain_nbr_compliance') score = Math.min(score, 0);
  if (market === 'kuwait' && app.appId === 'kuwait_mof_compliance') score = Math.min(score, 0);
  if (market === 'qatar' && app.appId === 'qatar_dhareeba_compliance') score = Math.min(score, 0);
  if (market === 'bangladesh' && (app.appId === 'bangladesh_nbr_einvoicing' || app.category === 'bangladesh_compliance')) {
    score = Math.min(score, 0);
  }
  if (market === 'pakistan' && (app.appId === 'pakistan_fbr_einvoicing' || app.category === 'pakistan_compliance')) {
    score = Math.min(score, 0);
  }
  if (app.isInstalled) score -= 0.25;
  if (app.pricingTier === 'free' || app.includedInCurrentPlan) score -= 0.1;

  return score;
}

export function sortAppsForMarket(apps, tenant, mode = 'featured') {
  const list = Array.isArray(apps) ? [...apps] : [];
  if (mode === 'rating') {
    return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  if (mode === 'name') {
    return list.sort((a, b) => String(a.nameEn || '').localeCompare(String(b.nameEn || '')));
  }
  return list.sort((a, b) => scoreAppForMarket(a, tenant) - scoreAppForMarket(b, tenant));
}

export function pickRecommendedApps(apps, tenant, limit = 6) {
  return sortAppsForMarket(apps, tenant, 'featured')
    .filter((app) => scoreAppForMarket(app, tenant) < 800)
    .slice(0, limit);
}
