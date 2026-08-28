import {
  LayoutDashboard,
  FileText,
  Users,
  Wallet,
  Package,
  Warehouse,
  Settings,
  Key,
  Calculator,
  Truck,
  FolderKanban,
  ClipboardList,
  BarChart3,
  ShoppingCart,
  ShieldCheck,
  Building,
  MessageCircle,
  MessageSquare,
  Mail,
  Cpu,
  Landmark,
  Briefcase,
  Factory,
  Receipt,
  Plane,
  UtensilsCrossed,
  Fingerprint,
  Shield,
  FileSignature,
  AlertCircle,
  ShoppingBag,
  ChefHat,
  Globe,
  ListOrdered,
  Shirt,
  Car,
  PlusCircle,
  Wrench,
  TrendingUp,
  QrCode,
  MonitorPlay,
  Database,
  Monitor,
  Scale,
  Leaf,
  AlertTriangle,
  CalendarDays,
  Target,
  Sparkles,
  Printer,
  CalendarClock,
  Tag,
  Calendar,
  Clock,
  Navigation,
  History,
  Ruler,
  Bike,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Recycle,
  BookMarked,
  Pill,
  ShieldAlert,
  Palette,
  Boxes,
  RotateCcw,
  Gift,
  HelpCircle,
  Globe2,
  Store,
  Smartphone, 
  CalendarRange,
  Dumbbell,
  Activity,
  ScanLine,
  Crown,
  UserCircle,
  Award,
  KeyRound,
  Lock
} from 'lucide-react'
import { getGovSectionTitle } from './saudiTenant'

/**
 * Build the full sidebar navigation sections for the current tenant context.
 * This is shared between Sidebar.jsx and Settings.jsx so menu visibility
 * settings can list exactly the same items that appear in the sidebar.
 */
export function getNavSections({ language = 'en', t = (k) => k, tenant = {}, businessTypes = [], govChildren = [] } = {}) {
  const safeT = typeof t === 'function' ? t : (k) => k;
  const si = tenant?.settings?.saudiIntegrations || {};
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR';
  const isPkrCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'PKR';
  const isBdtCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'BDT';
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1;
  const business = tenant?.business || {};
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country);
  const hasZatca = isSarCurrencyTenant && (si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready);
  const hasElm = isSarCurrencyTenant && si.elmConnectionStatus === 'connected';
  const hasQiwa = isSarCurrencyTenant && si.qiwaConnectionStatus === 'connected';
  const hasGosi = isSarCurrencyTenant && si.gosiConnectionStatus === 'connected';

  const govChildrenResolved = Array.isArray(govChildren) ? govChildren : [];

  return [
    {
      title: language === 'ar' ? 'البقالة' : 'Bakala',
      grantBusinessTypes: ['bakala'],
      requireAnyApp: ['bakala_supermarket', 'bakala_pos'],
      items: [
        { path: '/app/dashboard/bakala/pos', icon: ShoppingCart, label: language === 'ar' ? 'نقطة البيع' : 'POS Checkout' },
        { path: '/app/dashboard/bakala/products', icon: Package, label: language === 'ar' ? 'المنتجات' : 'Products' },
        { path: '/app/dashboard/bakala/add-product', icon: PlusCircle, label: language === 'ar' ? 'إضافة منتج' : 'Add Product' },
        { path: '/app/dashboard/bakala/alerts', icon: AlertTriangle, label: language === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts' },
        { path: '/app/dashboard/bakala/expiry-waste', icon: CalendarClock, label: language === 'ar' ? 'الانتهاء والهدر' : 'Expiry & Waste' },
        { path: '/app/dashboard/bakala/promotions', icon: Tag, label: language === 'ar' ? 'العروض' : 'Promotions' },
        { path: '/app/dashboard/bakala/profit-margins', icon: TrendingUp, label: language === 'ar' ? 'هوامش الربح' : 'Profit Margins' },
        { path: '/app/dashboard/bakala/auto-reorder', icon: ShoppingCart, label: language === 'ar' ? 'إعادة الطلب' : 'Auto-Reorder' },
        { path: '/app/dashboard/bakala/label-printing', icon: Printer, label: language === 'ar' ? 'طباعة الملصقات' : 'Label Printing' },
        { path: '/app/dashboard/bakala/pnl', icon: BarChart3, label: language === 'ar' ? 'الأرباح اليومية' : 'Daily P&L' },
        { path: '/app/dashboard/bakala/produce', icon: Leaf, label: language === 'ar' ? 'الفواكه والخضروات' : 'Fruits & Vegetables', requireAddon: 'hasWeightScaleAddon' },
        { path: '/app/dashboard/bakala/weight-scale', icon: Scale, label: language === 'ar' ? 'الميزان' : 'Weight Scale', requireAddon: 'hasWeightScaleAddon' },
        { path: '/app/dashboard/bakala/shift', icon: Wallet, label: language === 'ar' ? 'إدارة الوردية' : 'Shift Management' },
        { path: '/app/dashboard/bakala/returns', icon: FileText, label: language === 'ar' ? 'المرتجعات' : 'Returns' },
        { path: '/app/dashboard/khata', icon: Users, label: language === 'ar' ? 'العملاء (خاتا)' : 'Khata', perm: { module: 'finance', action: 'read' } },
        { path: '/app/dashboard/bakala/dashboard', icon: ShieldCheck, label: language === 'ar' ? 'لوحة التحكم' : 'Administration' },
      ]
    },
    {
      title: language === 'ar' ? 'الصيدلية' : 'Pharmacy',
      grantBusinessTypes: ['pharmacy'],
      requireAnyApp: ['pharmacy_management', 'pharmacy'],
      items: [
        { path: '/app/dashboard/pharmacy/pos', icon: ShoppingCart, label: language === 'ar' ? 'نقطة البيع' : 'POS Checkout' },
        { path: '/app/dashboard/pharmacy/products', icon: Package, label: language === 'ar' ? 'الأدوية' : 'Medicines' },
        { path: '/app/dashboard/pharmacy/add-product', icon: PlusCircle, label: language === 'ar' ? 'إضافة دواء' : 'Add medicine' },
        { path: '/app/dashboard/pharmacy/alerts', icon: AlertTriangle, label: language === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts' },
        { path: '/app/dashboard/pharmacy/expiry-waste', icon: CalendarClock, label: language === 'ar' ? 'الصلاحية والهدر' : 'Expiry & Waste' },
        { path: '/app/dashboard/pharmacy/prescriptions', icon: Pill, label: language === 'ar' ? 'الوصفات' : 'Prescriptions' },
        { path: '/app/dashboard/pharmacy/controlled', icon: ShieldAlert, label: language === 'ar' ? 'الأدوية الخاضعة للرقابة' : 'Controlled log' },
        { path: '/app/dashboard/pharmacy/label-printing', icon: Printer, label: language === 'ar' ? 'طباعة الملصقات' : 'Label Printing' },
        { path: '/app/dashboard/pharmacy/shift', icon: Wallet, label: language === 'ar' ? 'إدارة الوردية' : 'Shift Management' },
        { path: '/app/dashboard/pharmacy/returns', icon: FileText, label: language === 'ar' ? 'المرتجعات' : 'Returns' },
        { path: '/app/dashboard/khata', icon: Users, label: language === 'ar' ? 'العملاء (خاتا)' : 'Khata', perm: { module: 'finance', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'المكتبة' : 'Bookstore',
      grantBusinessTypes: ['bookstore'],
      requireAnyApp: ['bookstore_stationery', 'bookstore'],
      items: [
        { path: '/app/dashboard/bookstore/pos', icon: ShoppingCart, label: language === 'ar' ? 'نقطة البيع' : 'POS Checkout' },
        { path: '/app/dashboard/bookstore/products', icon: Package, label: language === 'ar' ? 'المنتجات' : 'Products' },
        { path: '/app/dashboard/bookstore/add-product', icon: PlusCircle, label: language === 'ar' ? 'إضافة منتج' : 'Add Product' },
        { path: '/app/dashboard/bookstore/import', icon: FileSpreadsheet, label: language === 'ar' ? 'استيراد' : 'Bulk Import' },
        { path: '/app/dashboard/bookstore/supply-lists', icon: GraduationCap, label: language === 'ar' ? 'قوائم المدارس' : 'Supply Lists' },
        { path: '/app/dashboard/bookstore/buyback', icon: Recycle, label: language === 'ar' ? 'الكتب المستعملة' : 'Buy-Back' },
        { path: '/app/dashboard/bookstore/rentals', icon: BookMarked, label: language === 'ar' ? 'الإعارة' : 'Rentals' },
        { path: '/app/dashboard/bookstore/bestsellers', icon: TrendingUp, label: language === 'ar' ? 'الأكثر مبيعاً' : 'Bestsellers' },
        { path: '/app/dashboard/bookstore/reports', icon: BarChart3, label: language === 'ar' ? 'التقارير' : 'Reports' },
        { path: '/app/dashboard/bookstore/shift', icon: Wallet, label: language === 'ar' ? 'إدارة الوردية' : 'Shift Management' },
        { path: '/app/dashboard/khata', icon: Users, label: language === 'ar' ? 'العملاء (خاتا)' : 'Khata', perm: { module: 'finance', action: 'read' } },
        { path: '/app/dashboard/bookstore/dashboard', icon: ShieldCheck, label: language === 'ar' ? 'لوحة التحكم' : 'Administration' },
      ]
    },
    {
      title: language === 'ar' ? 'المطعم' : 'Restaurant',
      grantBusinessTypes: ['restaurant'],
      requireAnyApp: ['restaurant_cafe', 'restaurant_pos', 'restaurant_mess'],
      items: [
        { path: '/app/dashboard/restaurant/pos', icon: ShoppingBag, label: language === 'ar' ? 'نقطة البيع' : 'POS', perm: { module: 'restaurant', action: 'create' } },
        { path: '/app/dashboard/restaurant/menu-items', icon: UtensilsCrossed, label: language === 'ar' ? 'قائمة الطعام' : 'Menu Items', perm: { module: 'restaurant', action: 'read' } },
        { path: '/app/dashboard/restaurant/tables', icon: Users, label: language === 'ar' ? 'الطاولات' : 'Tables', perm: { module: 'restaurant', action: 'read' } },
        { path: '/app/dashboard/restaurant/inventory', icon: Package, label: language === 'ar' ? 'مخزون المطبخ' : 'Kitchen Stock', perm: { module: 'restaurant', action: 'read' } },
        { path: '/app/dashboard/restaurant/orders', icon: Receipt, label: language === 'ar' ? 'الطلبات' : 'Orders', perm: { module: 'restaurant', action: 'read' } },
        { path: '/app/dashboard/restaurant/cashier', icon: MonitorPlay, label: language === 'ar' ? 'لوحة الكاشير' : 'Cashier Panel', perm: { module: 'restaurant', action: 'update' }, requireAnyApp: ['restaurant_cashier', 'cashier_panel'] },
        { path: '/app/dashboard/restaurant/kitchen', icon: ChefHat, label: language === 'ar' ? 'شاشة المطبخ (KDS)' : 'Kitchen & KDS', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['restaurant_kds', 'restaurant_kitchen', 'kds_board'] },
        { path: '/app/dashboard/restaurant/branches', icon: Building, label: language === 'ar' ? 'الفروع' : 'Branches', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['restaurant_branches', 'multi_branch'] },
        { path: '/app/dashboard/restaurant/qr-menu', icon: QrCode, label: language === 'ar' ? 'رمز القائمة (QR)' : 'QR Menu', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['qr_menu_ordering', 'hasQrOrderingAddon'] },
        { path: '/app/dashboard/restaurant/reservations', icon: Calendar, label: language === 'ar' ? 'الحجوزات' : 'Reservations', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['restaurant_reservations', 'table_reservations'] },
        { path: '/app/dashboard/restaurant/combos', icon: Tag, label: language === 'ar' ? 'العروض والباقات' : 'Combos & Deals', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['restaurant_combos', 'restaurant_deals'] },
        { path: '/app/dashboard/restaurant/analytics', icon: TrendingUp, label: language === 'ar' ? 'تحليلات المبيعات' : 'Analytics', perm: { module: 'restaurant', action: 'read' } },
        { path: '/app/dashboard/restaurant/mess', icon: UtensilsCrossed, label: language === 'ar' ? 'المطعم الجماعي' : 'Mess / Cafeteria', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['restaurant_mess', 'mess_cafeteria'] },
        { path: '/app/dashboard/restaurant/delivery', icon: Bike, label: language === 'ar' ? 'منصات التوصيل' : 'Delivery Platforms', perm: { module: 'restaurant', action: 'read' }, requireAnyApp: ['delivery_platforms', 'hungerstation_delivery', 'jahez_delivery', 'keeta_delivery', 'mrsool_delivery', 'ninja_delivery', 'toyou_delivery', 'jumlaty_delivery'] },
      ]
    },
    {
      title: language === 'ar' ? 'بوتيك وإيجار فساتين' : 'Boutique & Rentals',
      grantBusinessTypes: ['boutique'],
      requireAnyApp: ['boutique_rental', 'boutique'],
      items: [
        { path: '/app/dashboard/boutique/pos', icon: Sparkles, label: language === 'ar' ? 'نقطة البيع' : 'POS', perm: { module: 'boutique', action: 'create' } },
        { path: '/app/dashboard/boutique/dresses', icon: Shirt, label: language === 'ar' ? 'الفساتين' : 'Dresses', perm: { module: 'boutique', action: 'read' } },
        { path: '/app/dashboard/boutique/pending-returns', icon: Package, label: language === 'ar' ? 'الإرجاعات المعلقة' : 'Pending Returns', perm: { module: 'boutique', action: 'read' } },
        { path: '/app/dashboard/boutique/rental-calendar', icon: Calendar, label: language === 'ar' ? 'تقويم الإيجار' : 'Rental Calendar', perm: { module: 'boutique', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'معرض الأثاث' : 'Furniture Shop',
      grantBusinessTypes: ['furniture_shop'],
      requireAnyApp: ['furniture_shop'],
      items: [
        { path: '/app/dashboard/furniture/pos', icon: Sparkles, label: language === 'ar' ? 'نقطة البيع' : 'POS', perm: { module: 'boutique', action: 'create' } },
        { path: '/app/dashboard/furniture/products', icon: Package, label: language === 'ar' ? 'المنتجات' : 'Products', perm: { module: 'boutique', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الصالة الرياضية' : 'Gym & Fitness',
      grantBusinessTypes: ['gym'],
      requireAnyApp: ['gym_fitness_club', 'gym'],
      items: [
        { path: '/app/dashboard/gym/dashboard', icon: Dumbbell, label: language === 'ar' ? 'لوحة تحكم النادي' : 'Gym Dashboard', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/members', icon: Users, label: language === 'ar' ? 'الأعضاء' : 'Members Directory', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/plans', icon: Sparkles, label: language === 'ar' ? 'باقات الاشتراك' : 'Membership Plans', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/subscriptions', icon: CreditCard, label: language === 'ar' ? 'الاشتراكات' : 'Subscriptions', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/checkin', icon: ScanLine, label: language === 'ar' ? 'كشك الدخول' : 'Check-In Kiosk', perm: { module: 'gym', action: 'create' } },
        { path: '/app/dashboard/gym/classes', icon: CalendarDays, label: language === 'ar' ? 'جدول الحصص' : 'Class Timetable', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/trainers', icon: Award, label: language === 'ar' ? 'المدربون' : 'Coaches & Trainers', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/pt-packages', icon: Target, label: language === 'ar' ? 'التدريب الشخصي' : 'Personal Training (PT)', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/measurements', icon: Scale, label: language === 'ar' ? 'القياسات البدنية' : 'InBody & Metrics', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/lockers', icon: KeyRound, label: language === 'ar' ? 'خزائن الملابس' : 'Locker Rooms', perm: { module: 'gym', action: 'read' } },
        { path: '/app/dashboard/gym/analytics', icon: BarChart3, label: language === 'ar' ? 'التحليلات والذروة' : 'Analytics & Heatmap', perm: { module: 'gym', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'إدارة القاعات والمناسبات' : 'Marquee Management',
      grantBusinessTypes: ['marquee'],
      requireAnyApp: ['marquee_management', 'marquee'],
      items: [
        { path: '/app/dashboard/marquee/packages', icon: Boxes, label: language === 'ar' ? 'باقات المناسبات والوجبات' : 'Event Packages', perm: { module: 'invoicing', action: 'read' } },
        { path: '/app/dashboard/marquee/appointments', icon: CalendarDays, label: language === 'ar' ? 'حجوزات القاعات والمواعيد' : 'Bookings & Calendar', perm: { module: 'invoicing', action: 'read' } },
        { path: '/app/dashboard/marquee/qr-menu', icon: QrCode, label: language === 'ar' ? 'قائمة الطاولات (QR)' : 'Table QR Menu', perm: { module: 'invoicing', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الرئيسية' : 'Main',
      excludeBusinessTypes: ['khayyat', 'gym'],
      items: [
        { path: '/app/dashboard', icon: LayoutDashboard, label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', end: true, excludeBusinessTypes: ['khayyat', 'gym'] },
        {
          path: '/app/dashboard/invoices',
          icon: FileText,
          label: language === 'ar' ? 'المبيعات' : 'Sales',
          perm: { module: 'invoicing', action: 'read' },
          excludeBusinessTypes: ['khayyat'],
          activePrefixes: ['/app/dashboard/invoices', '/app/dashboard/quotations', '/app/dashboard/sales/configuration', '/app/dashboard/sales/reporting'],
          children: [
            { path: '/app/dashboard/invoices', label: language === 'ar' ? 'الفواتير' : 'Invoices', perm: { module: 'invoicing', action: 'read' } },
            { path: '/app/dashboard/quotations', label: language === 'ar' ? 'عروض الأسعار' : 'Quotations', perm: { module: 'sales', action: 'read' }, excludeBusinessTypes: ['bakala'] },
            { path: '/app/dashboard/sales/configuration', label: language === 'ar' ? 'إعدادات المبيعات' : 'Configuration', perm: { module: 'sales', action: 'read' } },
            { path: '/app/dashboard/sales/reporting', label: language === 'ar' ? 'تقارير المبيعات' : 'Reporting', perm: { module: 'sales', action: 'read' } },
          ],
        },
        { path: '/app/dashboard/letterhead', icon: FileText, label: language === 'ar' ? 'منشئ الخطابات' : 'Letterhead', perm: { module: 'invoicing', action: 'read' } },
        {
          path: '/app/dashboard/contacts',
          icon: Users,
          label: language === 'ar' ? 'جهات الاتصال' : 'Contacts',
          perm: { module: 'invoicing', action: 'read' },
          excludeBusinessTypes: ['bakala'],
          children: [
            { path: '/app/dashboard/contacts?types=customer,supplier', label: language === 'ar' ? 'دليل الشركاء' : 'Partner directory' },
            { path: '/app/dashboard/customers/statement', label: language === 'ar' ? 'كشوف الحساب' : 'Statements', perm: { module: 'sales', action: 'read' } },
          ],
        },
        // Bakala keeps a direct Customers entry (Contacts hub is excluded for bakala)
        {
          path: '/app/dashboard/customers',
          icon: Users,
          label: language === 'ar' ? 'العملاء' : 'Customers',
          perm: { module: 'sales', action: 'read' },
          businessTypes: ['bakala'],
          children: [
            { path: '/app/dashboard/customers', label: language === 'ar' ? 'قائمة العملاء' : 'Customer list' },
            { path: '/app/dashboard/customers/statement', label: language === 'ar' ? 'كشوف الحساب' : 'Statements' },
          ],
        },
        { path: '/app/dashboard/suppliers', icon: Building, label: language === 'ar' ? 'الموردين' : 'Suppliers', perm: { module: 'supply_chain', action: 'read' }, businessTypes: ['bakala'] },
        { path: '/app/dashboard/delivery-notes', icon: FileText, label: language === 'ar' ? 'سندات التسليم' : 'Delivery Notes', perm: { module: 'supply_chain', action: 'read' }, businessTypes: ['trading', 'furniture_shop'] },
        { path: '/app/dashboard/calendar', icon: Calendar, label: language === 'ar' ? 'التقويم والمواعيد' : 'Calendar', perm: { module: 'invoicing', action: 'read' }, excludeBusinessTypes: ['bakala'] },
        {
          path: '/app/dashboard/purchases',
          icon: ShoppingCart,
          label: language === 'ar' ? 'المشتريات' : 'Purchases',
          perm: { module: 'supply_chain', action: 'read' },
          children: [
            { path: '/app/dashboard/purchases/orders', label: language === 'ar' ? 'طلبات الشراء' : 'Purchase Orders' },
            { path: '/app/dashboard/purchases/suppliers', label: language === 'ar' ? 'الموردون وطلباتهم' : 'Suppliers & POs' },
            { path: '/app/dashboard/purchases/reports', label: language === 'ar' ? 'تقارير المشتريات' : 'Purchases Reports' },
            { path: '/app/dashboard/purchases/returns', label: language === 'ar' ? 'مرتجع المشتريات' : 'Purchase Return' },
            { path: '/app/dashboard/purchases/landed-costs', label: language === 'ar' ? 'التكلفة المرسية' : 'Landed Cost' },
          ],
        },
      ]
    },
    {
      title: language === 'ar' ? 'الخياطة' : 'Tailoring',
      grantBusinessTypes: ['khayyat'],
      requireAnyApp: ['tailor_khayyat', 'khayyat'],
      items: [
        { path: '/app/dashboard/khayyat/analytics', icon: LayoutDashboard, label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard' },
        { path: '/app/dashboard/khayyat', icon: ShoppingCart, label: language === 'ar' ? 'نقطة البيع (الخياط)' : 'Tailor POS', end: true },
        { path: '/app/dashboard/khayyat/stitchings', icon: FileSignature, label: safeT('orders') },
        { path: '/app/dashboard/khayyat/workers', icon: Users, label: safeT('workers') },
        { path: '/app/dashboard/khayyat/worker-amounts', icon: Wallet, label: language === 'ar' ? 'أرباح العمال' : 'Worker Amounts' },
        { path: '/app/dashboard/khayyat/customizations', icon: Package, label: language === 'ar' ? 'تخصيص الخيارات' : 'Customizations' },
        { path: '/app/dashboard/khayyat/embroidery-designs', icon: Package, label: language === 'ar' ? 'التطريز' : 'Embroidery Designs' },
        { path: '/app/dashboard/khayyat/fabrics', icon: Package, label: language === 'ar' ? 'الأقمشة' : 'Fabrics' },
        { path: '/app/dashboard/khayyat/laundry', icon: ShoppingBag, label: language === 'ar' ? 'المغسلة' : 'Laundry' },
        { path: '/app/dashboard/khayyat/loyalty', icon: Landmark, label: language === 'ar' ? 'نقاط الولاء' : 'Loyalty' },
        { path: '/app/dashboard/khayyat/measurements', icon: Ruler, label: language === 'ar' ? 'القياسات والتوصيل' : 'Measurements & Delivery' },
      ]
    },
    {
      title: language === 'ar' ? 'صالون / حلاقة' : 'Saloon & POS',
      grantBusinessTypes: ['saloon'],
      requireAnyApp: ['saloon_barber', 'saloon'],
      items: [
        { path: '/app/saloon/dashboard', icon: LayoutDashboard, label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', perm: { module: 'saloon', action: 'read' } },
        { path: '/app/saloon/pos', icon: ShoppingCart, label: language === 'ar' ? 'نقطة البيع (صالون)' : 'Saloon POS', perm: { module: 'saloon', action: 'create' } },
        { path: '/app/saloon/queue', icon: Monitor, label: language === 'ar' ? 'شاشة الانتظار' : 'Queue TV', perm: { module: 'saloon', action: 'read' } },
        { path: '/app/saloon/services', icon: Package, label: language === 'ar' ? 'قائمة الخدمات' : 'Services Catalog', perm: { module: 'saloon', action: 'read' } },
        { path: '/app/saloon/barbers', icon: Users, label: language === 'ar' ? 'الحلاقين' : 'Barbers', perm: { module: 'saloon', action: 'read' } },
        { path: '/app/saloon/qr', icon: QrCode, label: language === 'ar' ? 'كتالوج QR' : 'QR Catalog', perm: { module: 'saloon', action: 'read' } },
        { path: '/app/dashboard/saloon/appointments', icon: Clock, label: language === 'ar' ? 'المواعيد والعمولات' : 'Appointments & Commissions', perm: { module: 'saloon', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'سلسلة التوريد' : 'Supply Chain',
      grantBusinessTypes: ['trading', 'bakala', 'pharmacy', 'furniture_shop'],
      requireAnyApp: ['purchases', 'shipments', 'supply_chain'],
      items: [
        { 
          path: '/app/dashboard/shipments', 
          icon: Truck, 
          label: language === 'ar' ? 'الشحنات' : 'Shipments', 
          perm: { module: 'supply_chain', action: 'read' },
          requireAnyApp: ['shipments']
        },
      ]
    },
    {
      title: language === 'ar' ? 'نقطة البيع (مغسلة)' : 'Point of sale',
      grantBusinessTypes: ['laundry'],
      requireAnyApp: ['laundry_cleaning', 'laundry_suite', 'laundry'],
      items: [
        { path: '/app/laundry/pos', icon: ShoppingCart, label: language === 'ar' ? 'طلب جديد (نقطة البيع)' : 'New Order (POS)', perm: { module: 'laundry', action: 'create' } },
        { path: '/app/laundry/orders', icon: ListOrdered, label: language === 'ar' ? 'الطلبات النشطة' : 'Active Orders', perm: { module: 'laundry', action: 'read' } },
        { path: '/app/laundry/customers', icon: Users, label: language === 'ar' ? 'العملاء' : 'Customers', perm: { module: 'laundry', action: 'read' } },
        { path: '/app/laundry/inventory', icon: Package, label: language === 'ar' ? 'مخزون المستلزمات' : 'Supplies Inventory', perm: { module: 'laundry', action: 'read' } },
        { path: '/app/laundry/catalog', icon: Shirt, label: language === 'ar' ? 'قائمة الخدمات' : 'Service Catalog', perm: { module: 'laundry', action: 'read' } },
        { path: '/app/dashboard/laundry/delivery', icon: Navigation, label: language === 'ar' ? 'التوصيل والمسارات' : 'Delivery & Routes', perm: { module: 'laundry', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'تأجير السيارات' : 'Car Rental',
      grantBusinessTypes: ['car_rental'],
      requireAnyApp: ['car_rental'],
      items: [
        { path: '/app/rental/checkout', icon: PlusCircle, label: language === 'ar' ? 'تأجير جديد' : 'New Rental', perm: { module: 'car_rental', action: 'create' } },
        { path: '/app/rental/active', icon: Car, label: language === 'ar' ? 'تأجيرات نشطة' : 'Active Rentals', perm: { module: 'car_rental', action: 'read' } },
        { path: '/app/rental/fleet', icon: Car, label: language === 'ar' ? 'الأسطول' : 'All Cars', perm: { module: 'car_rental', action: 'read' } },
        { path: '/app/rental/customers', icon: Users, label: language === 'ar' ? 'العملاء' : 'Customer Registry', perm: { module: 'car_rental', action: 'read' } },
        { path: '/app/rental/contracts', icon: FileText, label: language === 'ar' ? 'العقود' : 'All Contracts', perm: { module: 'car_rental', action: 'read' } },
        { path: '/app/dashboard/rental/maintenance', icon: Wrench, label: language === 'ar' ? 'الصيانة والأسطول' : 'Maintenance & Fleet', perm: { module: 'car_rental', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'مركز الصيانة' : 'Car Workshop',
      grantBusinessTypes: ['car_workshop'],
      requireAnyApp: ['car_workshop'],
      items: [
        { path: '/app/workshop', icon: Wrench, label: language === 'ar' ? 'ورشة العمل' : 'Workshop', perm: { module: 'workshop', action: 'read' } },
        { path: '/app/workshop/job-cards', icon: ClipboardList, label: language === 'ar' ? 'بطاقات الإصلاح' : 'Job Cards', perm: { module: 'workshop', action: 'read' } },
        { path: '/app/workshop/vehicles', icon: Car, label: language === 'ar' ? 'السيارات' : 'Vehicles', perm: { module: 'workshop', action: 'read' } },
        { path: '/app/workshop/inventory', icon: Package, label: language === 'ar' ? 'قطع الغيار' : 'Spare Parts', perm: { module: 'workshop', action: 'read' } },
        { path: '/app/dashboard/workshop/service-history', icon: History, label: language === 'ar' ? 'سجل الخدمة' : 'Service History', perm: { module: 'workshop', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'المخزون' : 'Inventory',
      items: [
        { path: '/app/dashboard/inventory', icon: Package, label: language === 'ar' ? 'المخزون' : 'Inventory', perm: { module: 'inventory', action: 'read' }, businessTypes: ['trading', 'furniture_shop'] },
        {
          path: '/app/dashboard/projects',
          icon: FolderKanban,
          label: language === 'ar' ? 'المشاريع' : 'Projects',
          grantBusinessTypes: ['construction'],
          requireAnyApp: ['projects', 'construction_projects'],
        },
      ]
    },
    {
      title: language === 'ar' ? 'المالية' : 'Finance',
      items: [
        { path: '/app/dashboard/finance', icon: Landmark, label: language === 'ar' ? 'المالية' : 'Finance', perm: { module: 'finance', action: 'read' } },
        { path: '/app/dashboard/accounting', icon: Calculator, label: language === 'ar' ? 'المحاسبة' : 'Accounting', perm: { module: 'finance', action: 'read' }, end: true, children: [
          { path: '/app/dashboard/accounting/chart-of-accounts', label: language === 'ar' ? 'دليل الحسابات' : 'Chart of Accounts' },
          { path: '/app/dashboard/accounting/daily-restriction', label: language === 'ar' ? 'القيود اليومية' : 'Daily Restriction' },
          { path: '/app/dashboard/accounting/general-voucher', label: language === 'ar' ? 'سند قيد عام' : 'General Voucher' },
          { path: '/app/dashboard/accounting/receipt-voucher', label: language === 'ar' ? 'سند قبض' : 'Receipt Voucher' },
          { path: '/app/dashboard/accounting/payment-voucher', label: language === 'ar' ? 'سند صرف' : 'Payment Voucher' },
          { path: '/app/dashboard/accounting/account-report', label: language === 'ar' ? 'تقرير الحساب' : 'Account of Report' },
          { path: '/app/dashboard/accounting/balance-sheet', label: language === 'ar' ? 'الميزانية العمومية' : 'Account Balance Sheet' },
          { path: '/app/dashboard/accounting/customer-account', label: language === 'ar' ? 'كشف حساب العميل' : 'Customer Account Report' },
          { path: '/app/dashboard/accounting/customer-summary', label: language === 'ar' ? 'ملخص العملاء' : 'Customer Summary Report' },
          { path: '/app/dashboard/accounting/supplier-account', label: language === 'ar' ? 'كشف حساب المورد' : 'Supplier Account' },
          { path: '/app/dashboard/accounting/supplier-summary', label: language === 'ar' ? 'ملخص الموردين' : 'Supplier Summary Report' },
          { path: '/app/dashboard/accounting/ledger-search', label: language === 'ar' ? 'بحث الدفتر' : 'Ledger search' },
        ] },
        { path: '/app/dashboard/expenses', icon: Receipt, label: language === 'ar' ? 'المصروفات' : 'Expenses', perm: { module: 'finance', action: 'read' } },
        ...(isSarCurrencyTenant ? [{ path: '/app/dashboard/vat-returns', icon: Calculator, label: language === 'ar' ? 'إقرارات القيمة المضافة (زاتكا)' : 'VAT Returns (ZATCA)', perm: { module: 'finance', action: 'read' } }] : []),
        ...(isSarCurrencyTenant && tenant?.zatca?.phase !== 1 ? [{ path: '/app/dashboard/finance/zatca-logs', icon: Shield, label: language === 'ar' ? 'سجل زاتكا' : 'ZATCA Logs', perm: { module: 'finance', action: 'read' } }] : []),
        { path: '/app/dashboard/reports', icon: BarChart3, label: language === 'ar' ? 'التقارير' : 'Reports', perm: { module: 'invoicing', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الموارد البشرية والعمالة' : 'Manpower & Labor Supply',
      grantBusinessTypes: ['manpower'],
      requireAnyApp: ['manpower_outsourcing', 'manpower'],
      items: [
        { path: '/app/dashboard/manpower/workers', icon: Users, label: language === 'ar' ? 'العمالة' : 'Workers' },
        { path: '/app/dashboard/manpower/assignments', icon: Briefcase, label: language === 'ar' ? 'تعيينات العمالة' : 'Assignments' },
        { path: '/app/dashboard/contracts', icon: FileSignature, label: language === 'ar' ? 'العقود' : 'Contracts' },
        { path: '/app/dashboard/tasks', icon: ClipboardList, label: language === 'ar' ? 'المهام' : 'Tasks' },
        { path: '/app/dashboard/manpower/timesheets', icon: Clock, label: language === 'ar' ? 'سجلات الوقت' : 'Timesheets', perm: { module: 'hr', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'السفر' : 'Travel',
      grantBusinessTypes: ['travel_agency'],
      requireAnyApp: ['travel_agency'],
      items: [
        { path: '/app/dashboard/travel-bookings', icon: Plane, label: language === 'ar' ? 'الحجوزات' : 'Bookings', perm: { module: 'travel', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الموارد البشرية' : 'Human Resources',
      requireApp: 'hr_payroll_pro',
      items: [
        { path: '/app/dashboard/employees', icon: Users, label: safeT('employees'), perm: { module: 'hr', action: 'read' } },
        { path: '/app/dashboard/hr/attendance', icon: Fingerprint, label: language === 'ar' ? 'الحضور والبيومتري' : 'Attendance & Biometrics', perm: { module: 'hr', action: 'read' } },
        ...(isSarCurrencyTenant ? [{ path: '/app/dashboard/hr/compliance', icon: ShieldCheck, label: language === 'ar' ? 'الامتثال (بلدي وإقامة)' : 'Compliance (Balady/Iqama)', perm: { module: 'hr', action: 'read' }, excludeBusinessTypes: ['bakala'] }] : []),
        { path: '/app/dashboard/hr/hiring', icon: Briefcase, label: language === 'ar' ? 'التوظيف' : 'Hiring', perm: { module: 'hr', action: 'read' } },
        { path: '/app/dashboard/hr/leaves', icon: CalendarDays, label: language === 'ar' ? 'الإجازات' : 'Leaves', perm: { module: 'hr', action: 'read' } },
        { path: '/app/dashboard/hr/performance', icon: Target, label: language === 'ar' ? 'الأداء' : 'Performance', perm: { module: 'hr', action: 'read' } },
        { path: '/app/dashboard/payroll', icon: Wallet, label: safeT('payroll'), perm: { module: 'payroll', action: 'read' }, excludeBusinessTypes: ['bakala'] },
        ...(isSarCurrencyTenant ? [{ path: '/app/dashboard/payroll/calculators', icon: Calculator, label: 'GOSI/EOSB', perm: { module: 'payroll', action: 'read' }, excludeBusinessTypes: ['bakala'] }] : []),
        { path: '/app/dashboard/hr/reports', icon: BarChart3, label: language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports', perm: { module: 'hr', action: 'read' } },
        { path: '/app/dashboard/hr/expense-claims', icon: Wallet, label: language === 'ar' ? 'مطالبات المصروفات' : 'Expense Claims', perm: { module: 'hr', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'إدارة العملاء (CRM)' : 'CRM',
      requireApp: 'crm_sales_pipeline',
      items: [
        { path: '/app/dashboard/crm', icon: Target, label: language === 'ar' ? 'لوحة CRM' : 'CRM Dashboard', perm: { module: 'crm', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'التواصل' : 'Communication',
      items: [
        { path: '/app/dashboard/communicate', icon: MessageSquare, label: language === 'ar' ? 'الرسائل' : 'Communicate', perm: { module: 'settings', action: 'read' } },
        { path: '/app/dashboard/whatsapp', icon: MessageCircle, label: 'WhatsApp', perm: { module: 'settings', action: 'read' }, requireApp: 'whatsapp_cloud_auto' },
        { path: '/app/dashboard/email', icon: Mail, label: language === 'ar' ? 'التسويق عبر البريد' : 'Email Marketing', perm: { module: 'settings', action: 'read' }, requireApp: 'email_suite' },
        { path: '/app/dashboard/sms', icon: Smartphone, label: language === 'ar' ? 'التسويق عبر الرسائل' : 'SMS Marketing', perm: { module: 'settings', action: 'read' }, requireApp: 'sms_marketing' },
      ]
    },
    {
      title: language === 'ar' ? 'إنترنت الأشياء' : 'Internet of Things',
      requireApp: 'iot_devices',
      items: [
        { path: '/app/dashboard/iot', icon: Cpu, label: language === 'ar' ? 'إنترنت الأشياء' : 'IoT', perm: { module: 'iot', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'التصنيع والإنتاج' : 'Manufacturing & MES',
      requireApp: 'manufacturing_mes',
      items: [
        { path: '/app/dashboard/manufacturing', icon: Factory, label: language === 'ar' ? 'نظام التصنيع والإنتاج (MES)' : 'Manufacturing MES', perm: { module: 'mrp', action: 'read' } },
        { path: '/app/dashboard/mrp', icon: Cpu, label: language === 'ar' ? 'تخطيط الاحتياجات (MRP)' : 'MRP II Planning', perm: { module: 'mrp', action: 'read' } },
        { path: '/app/dashboard/job-costing', icon: Briefcase, label: language === 'ar' ? 'تكلفة الأعمال' : 'Job Costing', perm: { module: 'job_costing', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الشحن واللوجستيات' : 'Shipping & Logistics',
      requireAnyApp: ['multicourier_shipping', 'smsa_express', 'aramex_shipping', 'jnt_express', 'naqel_express', 'imile_courier', 'spl_saudi_post', 'fedex_shipping', 'dhl_express', 'ups_shipping', 'tnt_express'],
      items: [
        { path: '/app/dashboard/app-store?category=logistics', icon: Truck, label: language === 'ar' ? 'شركات الشحن' : 'Couriers & Labels', perm: { module: 'settings', action: 'read' } },
      ]
    },
    ...(govChildrenResolved.length > 0
      ? [
          {
            title: getGovSectionTitle(tenant, language),
            items: govChildrenResolved.map((child) => ({
              path: child.path,
              icon: ShieldCheck,
              label: child.label,
              perm: { module: 'settings', action: 'read' },
            })),
          },
        ]
      : []),
    {
      title: language === 'ar' ? 'متجر التطبيقات' : 'App Store',
      items: [
        { path: '/app/dashboard/app-store', icon: Store, label: language === 'ar' ? 'متجر التطبيقات' : 'App Store' },
      ]
    },
    {
      title: language === 'ar' ? 'الإعدادات' : 'Settings',
      items: [
        { path: '/app/dashboard/users', icon: Users, label: safeT('users'), perm: { module: 'settings', action: 'read' } },
        { path: '/app/dashboard/settings', icon: Settings, label: safeT('settings'), perm: { module: 'settings', action: 'read' } },
      ]
    },
    {
      title: language === 'ar' ? 'الأسطول والمعدات' : 'Fleet & Machinery',
      requireApp: 'fleet_machinery',
      items: [
        { path: '/app/dashboard/fleet', icon: Truck, label: language === 'ar' ? 'الأصول' : 'Assets', perm: { module: 'fleet', action: 'read' } },
        { path: '/app/dashboard/fleet/maintenance-alerts', icon: AlertCircle, label: language === 'ar' ? 'تنبيهات الصيانة' : 'Maintenance Alerts', perm: { module: 'fleet', action: 'read' } },
      ]
    },
  ]
}
