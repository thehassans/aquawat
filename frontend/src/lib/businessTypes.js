export const BUSINESS_TYPES = ['trading', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'boutique', 'manpower', 'bakala', 'pharmacy', 'car_workshop', 'bookstore', 'furniture_shop', 'manufacturing', 'gym', 'marquee']

export const getBusinessTypeOptions = (language = 'en') => [
  {
    id: 'trading',
    label: language === 'ar' ? 'التجارة' : 'Trading',
    description: language === 'ar' ? 'المخزون والمستودعات والمشتريات' : 'Inventory, warehouses, and purchasing',
  },
  {
    id: 'marquee',
    label: language === 'ar' ? 'قاعات الأفراح والمناسبات' : 'Marquee & Event Hall',
    description: language === 'ar' ? 'باقات المناسبات، تسعير للشخص، تقويم الحجوزات وقائمة طعام QR' : 'Event packages, per-head pricing, booking appointments, and table QR menus',
  },
  {
    id: 'gym',
    label: language === 'ar' ? 'الصالة الرياضية واللياقة' : 'Gym & Fitness Center',
    description: language === 'ar' ? 'إدارة الأعضاء، الاشتراكات، الحصص، التدريب الشخصي، قياسات الجسم والخزائن' : 'Members, subscriptions, group classes, personal training, InBody tracking & lockers',
  },
  {
    id: 'manufacturing',
    label: language === 'ar' ? 'التصنيع والإنتاج' : 'Manufacturing & MES',
    description: language === 'ar' ? 'شجرة المواد BOM، تخطيط الإنتاج MRP، أوامر الشغل، الجودة والتكاليف' : 'Multi-level BOM, MRP II, Work Orders, Shop Floor Control & QA/QC',
  },
  {
    id: 'construction',
    label: language === 'ar' ? 'المقاولات' : 'Construction',
    description: language === 'ar' ? 'فواتير المشاريع والخدمات والمقاولات' : 'Project, service, and construction billing',
  },
  {
    id: 'travel_agency',
    label: language === 'ar' ? 'وكالة سفر' : 'Travel Agency',
    description: language === 'ar' ? 'حجوزات السفر وفواتير التذاكر' : 'Travel bookings and ticket invoices',
  },
  {
    id: 'restaurant',
    label: language === 'ar' ? 'مطعم' : 'Restaurant',
    description: language === 'ar' ? 'الطلبات ونقاط البيع والمطبخ' : 'Orders, POS, and kitchen flows',
  },
  {
    id: 'car_rental',
    label: language === 'ar' ? 'تأجير سيارات' : 'Car Rental',
    description: language === 'ar' ? 'إدارة الأسطول والعقود ونقطة البيع للتأجير' : 'Fleet management, rental contracts, and POS',
  },
  {
    id: 'laundry',
    label: language === 'ar' ? 'مغسلة' : 'Laundry',
    description: language === 'ar' ? 'نظام إدارة المغاسل، الفواتير، ونقطة البيع' : 'Laundry management, billing, and POS',
  },
  {
    id: 'saloon',
    label: language === 'ar' ? 'صالون / حلاقة' : 'Saloon / Barber',
    description: language === 'ar' ? 'نظام إدارة الصالونات ونقاط البيع' : 'Saloon management and POS',
  },
  {
    id: 'khayyat',
    label: language === 'ar' ? 'خياط / مشغل' : 'Tailor / Workshop',
    description: language === 'ar' ? 'إدارة الخياطين والمقاسات ونقاط البيع' : 'Tailor management, measurements and POS',
  },
  {
    id: 'boutique',
    label: language === 'ar' ? 'بوتيك وإيجار فساتين' : 'Boutique & Dress Rental',
    description: language === 'ar' ? 'إدارة الفساتين، التقويم، والإيجار' : 'Dress inventory, rental calendar, and POS',
  },
  {
    id: 'manpower',
    label: language === 'ar' ? 'الموارد البشرية والعمالة' : 'Manpower & Labor Supply',
    description: language === 'ar' ? 'إدارة عقود العمالة والمشاريع والفواتير' : 'Labor contracts, assignments, and billing',
  },
  {
    id: 'bakala',
    label: language === 'ar' ? 'البقالة والسوبر ماركت' : 'Bakala / Supermarket',
    description: language === 'ar' ? 'نقطة بيع سريعة للمواد الغذائية الاستهلاكية والتجزئة' : 'Fast-paced POS for grocery and retail',
  },
  {
    id: 'pharmacy',
    label: language === 'ar' ? 'صيدلية' : 'Pharmacy',
    description: language === 'ar' ? 'نقطة بيع للأدوية مع الصلاحية، الوصفات، والأدوية الخاضعة للرقابة' : 'Pharmacy POS with expiry, prescriptions, and controlled-drug logs',
  },
  {
    id: 'car_workshop',
    label: language === 'ar' ? 'مركز صيانة سيارات' : 'Car Workshop',
    description: language === 'ar' ? 'بطاقات إصلاح، التقدير، والتكامل مع الزكاة والمرور' : 'Job cards, Taqdeer, ZATCA & Absher integration',
  },
  {
    id: 'bookstore',
    label: language === 'ar' ? 'مكتبة' : 'Bookstore',
    description: language === 'ar' ? 'نقطة بيع للمكتبات، الكتب، والقرطاسية مع طابعة حرارية' : 'Bookstore POS with ISBN scanning, inventory, and thermal printer',
  },
  {
    id: 'furniture_shop',
    label: language === 'ar' ? 'معرض أثاث' : 'Furniture Shop',
    description: language === 'ar' ? 'نقطة بيع وإدارة مخزون لمعارض الأثاث والمفروشات' : 'POS and inventory management for furniture and carpet shops',
  },
]

export const normalizeBusinessTypes = (input, fallback = 'trading') => {
  const values = Array.isArray(input) ? input : [input]
  const normalized = values
    .map((value) => {
      const val = String(value || '').trim().toLowerCase();
      if (val === 'tailoring') return 'khayyat';
      if (val === 'supermarket' || val === 'super market') return 'bakala';
      if (val === 'صيدلية' || val === 'pharmacies') return 'pharmacy';
      return val;
    })
    .filter((value) => BUSINESS_TYPES.includes(value))

  if (normalized.length === 0) {
    return BUSINESS_TYPES.includes(fallback) ? [fallback] : ['trading']
  }

  return [...new Set(normalized)]
}

export const getTenantBusinessTypes = (tenant) => {
  if (Array.isArray(tenant?.businessTypes) && tenant.businessTypes.length > 0) {
    return normalizeBusinessTypes(tenant.businessTypes)
  }

  return normalizeBusinessTypes(tenant?.businessType)
}

export const getPrimaryBusinessType = (tenant) => getTenantBusinessTypes(tenant)[0] || 'trading'

export const hasBusinessType = (tenant, businessType) => getTenantBusinessTypes(tenant).includes(businessType)
