import React from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { 
  ArrowUpRight, 
  ArrowRight,
  TrendingUp, 
  Package, 
  Users, 
  ShoppingCart, 
  Receipt, 
  Wallet, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart3,
  Scale,
  Calendar,
  Truck,
  Car,
  Wrench,
  Shirt,
  Scissors,
  Factory,
  Boxes,
  Globe,
  Tag,
  FileText,
  ShieldCheck,
  Plane,
  Building,
  Hammer,
  UtensilsCrossed,
  Printer,
  CalendarClock
} from 'lucide-react'
import { App3DIcon } from '../ui/App3DIcon'
import Money from '../ui/Money'

export function AppVerticalView({
  verticalKey = 'trading',
  appsOverview = {},
  language = 'en',
  tenant
}) {
  const navigate = useNavigate()
  const isAr = language === 'ar'
  const data = appsOverview[verticalKey] || {}

  // App Vertical Config Definitions
  const VERTICAL_CONFIGS = {
    bakala: {
      nameEn: 'Bakala & Supermarket POS',
      nameAr: 'البقالة والسوبر ماركت ونقاط البيع',
      category: 'Retail & Grocery',
      icon: 'shopping-cart',
      defaultRoute: '/app/dashboard/bakala/pos',
      color: 'from-emerald-500 to-teal-600',
      kpis: [
        { label: isAr ? 'إجمالي المنتجات' : 'Total Products', value: data.totals?.[0]?.total || 0, icon: Package },
        { label: isAr ? 'تنبيهات انخفاض المخزون' : 'Low Stock Alerts', value: data.totals?.[0]?.lowStock || 0, icon: AlertTriangle, alert: (data.totals?.[0]?.lowStock || 0) > 0 },
        { label: isAr ? 'إجمالي وحدات المخزون' : 'Total Units on Shelf', value: (data.totals?.[0]?.totalStock || 0).toLocaleString(), icon: Boxes },
        { label: isAr ? 'حالة ميزان الباركود' : 'Weight Scale POS', value: isAr ? 'متصل وجاهز' : 'Connected & Active', icon: Scale, success: true },
      ],
      quickActions: [
        { label: isAr ? 'نقطة البيع السريعة' : 'Launch POS', route: '/app/dashboard/bakala/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'إضافة منتج جديد' : 'Add Product', route: '/app/dashboard/bakala/add-product', icon: PlusCircle },
        { label: isAr ? 'تنبيهات المخزون' : 'Stock Alerts', route: '/app/dashboard/bakala/alerts', icon: AlertTriangle },
        { label: isAr ? 'الانتهاء والهدر' : 'Expiry & Waste', route: '/app/dashboard/bakala/expiry-waste', icon: CalendarClock },
        { label: isAr ? 'العروض الترويجية' : 'Promotions', route: '/app/dashboard/bakala/promotions', icon: Tag },
        { label: isAr ? 'طباعة الباركود والملصقات' : 'Print Labels', route: '/app/dashboard/bakala/label-printing', icon: Printer },
      ]
    },
    restaurant: {
      nameEn: 'Restaurant, Cafe & Kitchen Management',
      nameAr: 'إدارة المطاعم والمقاهي والمطبخ',
      category: 'Food & Beverage',
      icon: 'utensilscrossed',
      defaultRoute: '/app/dashboard/restaurant/pos',
      color: 'from-amber-500 to-orange-600',
      kpis: [
        { label: isAr ? 'إيرادات اليوم' : "Today's Revenue", value: data.totals?.[0]?.todayRevenue || data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'طلبات مفتوحة' : 'Open Orders', value: data.totals?.[0]?.open || 0, icon: Receipt },
        { label: isAr ? 'قيد التحضير بالمطبخ' : 'In Kitchen Queue', value: data.totals?.[0]?.preparing || 0, icon: Clock },
        { label: isAr ? 'إجمالي الطلبات' : 'Total Orders', value: data.totals?.[0]?.total || 0, icon: BarChart3 },
      ],
      quickActions: [
        { label: isAr ? 'كاشير ونقطة البيع' : 'Restaurant POS', route: '/app/dashboard/restaurant/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'شاشة المطبخ KDS' : 'KDS Kitchen Screen', route: '/app/dashboard/restaurant/kds', icon: Clock },
        { label: isAr ? 'إدارة الطاولات' : 'Table Map', route: '/app/dashboard/restaurant/tables', icon: Users },
        { label: isAr ? 'قائمة الطعام والوجبات' : 'Menu Items', route: '/app/dashboard/restaurant/menu-items', icon: UtensilsCrossed },
        { label: isAr ? 'مخزون ومكونات المطبخ' : 'Food Inventory', route: '/app/dashboard/restaurant/inventory', icon: Package },
      ],
      recentList: {
        title: isAr ? 'أحدث طلبات المطعم' : 'Recent Dining Orders',
        items: data.recent || [],
        renderItem: (item) => ({
          title: `${isAr ? 'طلب' : 'Order'} #${item.orderNumber || ''}`,
          subtitle: item.tableNumber ? `${isAr ? 'طاولة' : 'Table'} ${item.tableNumber}` : (isAr ? 'طلب خارجي' : 'Takeaway'),
          badge: item.status,
          amount: item.grandTotal,
          date: item.createdAt
        })
      }
    },
    car_rental: {
      nameEn: 'Car Rental & Fleet Management',
      nameAr: 'تأجير السيارات وإدارة الأسطول',
      category: 'Automotive & Fleet',
      icon: 'car',
      defaultRoute: '/app/dashboard/car-rental/contracts',
      color: 'from-blue-600 to-indigo-700',
      kpis: [
        { label: isAr ? 'عقود تأجير نشطة' : 'Active Leases', value: data.totals?.[0]?.activeCount || 0, icon: Car },
        { label: isAr ? 'عقود مكتملة' : 'Completed Returns', value: data.totals?.[0]?.completedCount || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي إيرادات التأجير' : 'Rental Revenue', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'إجمالي العقود' : 'Total Contracts', value: data.totals?.[0]?.total || 0, icon: FileText },
      ],
      quickActions: [
        { label: isAr ? 'إنشاء عقد تأجير جديد' : 'New Rental Contract', route: '/app/dashboard/car-rental/contracts/new', icon: PlusCircle, primary: true },
        { label: isAr ? 'قائمة العقود' : 'All Contracts', route: '/app/dashboard/car-rental/contracts', icon: FileText },
        { label: isAr ? 'إدارة الأسطول والسيارات' : 'Fleet Vehicles', route: '/app/dashboard/car-rental/cars', icon: Car },
        { label: isAr ? 'فحص واستلام المركبة' : 'Vehicle Inspections', route: '/app/dashboard/car-rental/inspections', icon: ShieldCheck },
      ],
      recentList: {
        title: isAr ? 'أحدث عقود التأجير' : 'Recent Rental Contracts',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.contractNumber || (isAr ? 'عقد تأجير' : 'Rental Contract'),
          subtitle: item.customerName || '',
          badge: item.status,
          amount: item.totalAmount,
          date: item.createdAt
        })
      }
    },
    laundry: {
      nameEn: 'Laundry & Dry Cleaning Operations',
      nameAr: 'إدارة المغاسل والتنظيف الجاف',
      category: 'Services & POS',
      icon: 'shirt',
      defaultRoute: '/app/laundry/pos',
      color: 'from-cyan-500 to-blue-600',
      kpis: [
        { label: isAr ? 'طلبات مستلمة جديدة' : 'Received Orders', value: data.totals?.[0]?.received || 0, icon: Package },
        { label: isAr ? 'قيد الغسيل والكي' : 'In Washing / Ironing', value: data.totals?.[0]?.inWash || 0, icon: Clock },
        { label: isAr ? 'جاهزة للاستلام' : 'Ready for Pickup', value: data.totals?.[0]?.ready || 0, icon: CheckCircle, success: (data.totals?.[0]?.ready || 0) > 0 },
        { label: isAr ? 'إجمالي الإيرادات' : 'Laundry Revenue', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
      ],
      quickActions: [
        { label: isAr ? 'نقطة بيع المغسلة السريعة' : 'Laundry POS', route: '/app/laundry/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'سجل الطلبات والفواتير' : 'Orders List', route: '/app/dashboard/laundry/orders', icon: Receipt },
        { label: isAr ? 'الخدمات والتسعير' : 'Services & Pricing', route: '/app/dashboard/laundry/services', icon: Tag },
        { label: isAr ? 'مسارات التوصيل' : 'Delivery Routes', route: '/app/dashboard/laundry/routes', icon: Truck },
      ],
      recentList: {
        title: isAr ? 'أحدث طلبات المغسلة' : 'Recent Laundry Orders',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.orderNumber ? `#${item.orderNumber}` : (isAr ? 'طلب غسيل' : 'Laundry Order'),
          subtitle: item.customerName || '',
          badge: item.status,
          amount: item.grandTotal,
          date: item.createdAt
        })
      }
    },
    saloon: {
      nameEn: 'Saloon, Barber & Spa Management',
      nameAr: 'إدارة الصالونات ومراكز الحلاقة والتجميل',
      category: 'Personal Care & Beauty',
      icon: 'scissors',
      defaultRoute: '/app/saloon/pos',
      color: 'from-pink-500 to-rose-600',
      kpis: [
        { label: isAr ? 'طلبات وخدمات اليوم' : "Today's Services", value: data.totals?.[0]?.todayOrders || 0, icon: Calendar },
        { label: isAr ? 'إجمالي الإيرادات' : 'Total Revenue', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'إجمالي الحجوزات' : 'Total Orders', value: data.totals?.[0]?.total || 0, icon: Receipt },
        { label: isAr ? 'جاهزية نقاط البيع' : 'POS Terminals', value: isAr ? 'متصل' : 'Online', icon: ShieldCheck, success: true },
      ],
      quickActions: [
        { label: isAr ? 'كاشير الصالون ونقطة البيع' : 'Saloon POS', route: '/app/saloon/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'المواعيد والحجوزات' : 'Appointments', route: '/app/dashboard/saloon/appointments', icon: Calendar },
        { label: isAr ? 'قائمة الخدمات والأسعار' : 'Services Catalog', route: '/app/dashboard/saloon/services', icon: Tag },
        { label: isAr ? 'فريق العمل والحلاقين' : 'Stylists & Staff', route: '/app/dashboard/saloon/staff', icon: Users },
      ],
      recentList: {
        title: isAr ? 'أحدث طلبات الصالون' : 'Recent Saloon Bookings',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.orderNumber ? `#${item.orderNumber}` : (isAr ? 'جلسة صالون' : 'Saloon Order'),
          subtitle: item.customerName || '',
          badge: item.status || 'completed',
          amount: item.grandTotal,
          date: item.createdAt
        })
      }
    },
    khayyat: {
      nameEn: 'Tailor, Sewing & Garment Atelier',
      nameAr: 'المشاغل والخياطة وتفصيل الثياب',
      category: 'Apparel & Custom Craft',
      icon: 'shirt',
      defaultRoute: '/app/dashboard/khayyat/analytics',
      color: 'from-purple-600 to-indigo-600',
      kpis: [
        { label: isAr ? 'قيد القص والخياطة' : 'In Stitching', value: data.totals?.[0]?.inProgress || 0, icon: Clock },
        { label: isAr ? 'جاهز للبروفة والتجربة' : 'Ready for Trial', value: data.totals?.[0]?.readyForFitting || 0, icon: CheckCircle, success: (data.totals?.[0]?.readyForFitting || 0) > 0 },
        { label: isAr ? 'تم التسليم للعميل' : 'Delivered Orders', value: data.totals?.[0]?.completed || 0, icon: ShieldCheck },
        { label: isAr ? 'إجمالي الطلبات' : 'Total Orders', value: data.totals?.[0]?.total || 0, icon: FileText },
      ],
      quickActions: [
        { label: isAr ? 'لوحة تحليلات الخياط' : 'Tailor Command Center', route: '/app/dashboard/khayyat/analytics', icon: BarChart3, primary: true },
        { label: isAr ? 'أمر خياطة جديد' : 'New Stitching Order', route: '/app/dashboard/khayyat/orders/new', icon: PlusCircle },
        { label: isAr ? 'ملفات مقاسات العملاء' : 'Measurement Profiles', route: '/app/dashboard/khayyat/measurements', icon: FileText },
        { label: isAr ? 'مخزون الأقمشة والبطانات' : 'Fabrics Inventory', route: '/app/dashboard/khayyat/fabrics', icon: Boxes },
        { label: isAr ? 'تصاميم وتطريزات' : 'Embroidery Designs', route: '/app/dashboard/khayyat/embroidery', icon: Sparkles },
      ],
      recentList: {
        title: isAr ? 'أحدث أوامر الخياطة والتفصيل' : 'Recent Tailoring Jobs',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.orderNumber ? `#${item.orderNumber}` : (isAr ? 'أمر خياطة' : 'Stitching Order'),
          subtitle: item.customerName || '',
          badge: item.status,
          date: item.createdAt
        })
      }
    },
    manufacturing: {
      nameEn: 'Manufacturing & MES Production',
      nameAr: 'التصنيع وتخطيط وإدارة خطوط الإنتاج',
      category: 'Industrial & Manufacturing',
      icon: 'factory',
      defaultRoute: '/app/dashboard/manufacturing',
      color: 'from-amber-600 to-orange-700',
      kpis: [
        { label: isAr ? 'أوامر إنتاج نشطة' : 'Active Work Orders', value: data.totals?.[0]?.active || 0, icon: Factory },
        { label: isAr ? 'أوامر مكتملة' : 'Completed Orders', value: data.totals?.[0]?.completed || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي أوامر التشغيل' : 'Total Work Orders', value: data.totals?.[0]?.total || 0, icon: FileText },
        { label: isAr ? 'جاهزية مراكز العمل' : 'Work Centers OEE', value: '94.2%', icon: BarChart3, success: true },
      ],
      quickActions: [
        { label: isAr ? 'مركز عمليات التصنيع' : 'Manufacturing Hub', route: '/app/dashboard/manufacturing', icon: Factory, primary: true },
        { label: isAr ? 'أمر إنتاج جديد' : 'New Work Order', route: '/app/dashboard/manufacturing/work-orders/new', icon: PlusCircle },
        { label: isAr ? 'شجرة المواد BOM' : 'Bills of Materials', route: '/app/dashboard/manufacturing/bom', icon: Boxes },
        { label: isAr ? 'تخطيط الاحتياجات MRP' : 'MRP Material Planning', route: '/app/dashboard/mrp', icon: TrendingUp },
        { label: isAr ? 'مراقبة الجودة والتفتيش' : 'QA/QC Inspections', route: '/app/dashboard/manufacturing/quality', icon: ShieldCheck },
      ],
      recentList: {
        title: isAr ? 'أحدث أوامر الإنتاج' : 'Recent Manufacturing Work Orders',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.workOrderNumber || (isAr ? 'أمر إنتاج' : 'Work Order'),
          subtitle: `${isAr ? 'مخطط' : 'Planned'}: ${item.plannedQty || 0} | ${isAr ? 'منجز' : 'Done'}: ${item.completedQty || 0}`,
          badge: item.status,
          date: item.createdAt
        })
      }
    },
    car_workshop: {
      nameEn: 'Car Workshop & Garage Management',
      nameAr: 'مركز صيانة السيارات وورش الإصلاح',
      category: 'Automotive & Repairs',
      icon: 'wrench',
      defaultRoute: '/app/dashboard/car-workshop/job-cards',
      color: 'from-slate-700 to-zinc-900',
      kpis: [
        { label: isAr ? 'بطاقات إصلاح مفتوحة' : 'Open Job Cards', value: data.totals?.[0]?.openCards || 0, icon: Wrench },
        { label: isAr ? 'سيارات تم إصلاحها' : 'Completed Repairs', value: data.totals?.[0]?.completed || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي إيرادات الورشة' : 'Workshop Revenue', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'تكامل تقدير وأبشر' : 'Taqdeer & Absher', value: isAr ? 'جاهز' : 'Connected', icon: ShieldCheck, success: true },
      ],
      quickActions: [
        { label: isAr ? 'بطاقة إصلاح جديدة (استقبال)' : 'New Job Card Check-In', route: '/app/dashboard/car-workshop/job-cards/new', icon: PlusCircle, primary: true },
        { label: isAr ? 'سجل بطاقات الإصلاح' : 'All Job Cards', route: '/app/dashboard/car-workshop/job-cards', icon: Wrench },
        { label: isAr ? 'تقدير الحوادث والتكاليف' : 'Estimates & Quotes', route: '/app/dashboard/car-workshop/estimates', icon: Receipt },
        { label: isAr ? 'قطع الغيار والمخزون' : 'Spare Parts Inventory', route: '/app/dashboard/car-workshop/inventory', icon: Package },
      ],
      recentList: {
        title: isAr ? 'أحدث بطاقات الإصلاح' : 'Recent Repair Job Cards',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.jobCardNumber || (isAr ? 'بطاقة إصلاح' : 'Job Card'),
          subtitle: item.status,
          badge: item.status,
          amount: item.grandTotal,
          date: item.createdAt
        })
      }
    },
    ecommerce: {
      nameEn: 'E-Commerce & Multi-Tenant Web Store',
      nameAr: 'المتجر الإلكتروني والتجارة الرقمية',
      category: 'Online Commerce',
      icon: 'globe',
      defaultRoute: '/app/dashboard/ecommerce',
      color: 'from-violet-600 to-purple-800',
      kpis: [
        { label: isAr ? 'طلبات جديدة معلقة' : 'Pending Orders', value: data.totals?.[0]?.pending || 0, icon: ShoppingCart, alert: (data.totals?.[0]?.pending || 0) > 0 },
        { label: isAr ? 'قيد التجهيز' : 'Processing', value: data.totals?.[0]?.processing || 0, icon: Clock },
        { label: isAr ? 'تم الشحن والتوصيل' : 'Shipped & Delivered', value: (data.totals?.[0]?.shipped || 0) + (data.totals?.[0]?.delivered || 0), icon: Truck },
        { label: isAr ? 'إجمالي المبيعات الرقمية' : 'Online Store Sales', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
      ],
      quickActions: [
        { label: isAr ? 'لوحة تحكم المتجر' : 'Store Insights', route: '/app/dashboard/ecommerce', icon: BarChart3, primary: true },
        { label: isAr ? 'إدارة الطلبات والشحن' : 'Manage Orders', route: '/app/dashboard/ecommerce/orders', icon: ListOrderedIconWrapper },
        { label: isAr ? 'إضافة منتج للمتجر' : 'Add Online Product', route: '/app/dashboard/ecommerce/products/new', icon: PlusCircle },
        { label: isAr ? 'تخصيص القالب والتصميم' : 'Theme Editor', route: '/app/dashboard/ecommerce/theme', icon: Sparkles },
        { label: isAr ? 'كوبونات الخصم' : 'Coupons & Promos', route: '/app/dashboard/ecommerce/coupons', icon: Tag },
      ],
      recentList: {
        title: isAr ? 'أحدث طلبات المتجر الإلكتروني' : 'Recent Online Orders',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.orderNumber ? `#${item.orderNumber}` : (isAr ? 'طلب متجر' : 'Online Order'),
          subtitle: item.customer?.name || '',
          badge: item.status,
          amount: item.totalAmount,
          date: item.createdAt
        })
      }
    },
    manpower: {
      nameEn: 'Manpower Supply & Labor Contract Management',
      nameAr: 'إدارة العمالة وتوريد الكوادر والمشاريع',
      category: 'HR & Workforce',
      icon: 'users',
      defaultRoute: '/app/dashboard/workers',
      color: 'from-amber-600 to-yellow-600',
      kpis: [
        { label: isAr ? 'إجمالي القوى العاملة' : 'Total Workers', value: data.totals?.[0]?.total || 0, icon: Users },
        { label: isAr ? 'عمالة مسندة للمواقع' : 'Deployed on Site', value: data.totals?.[0]?.deployed || 0, icon: CheckCircle },
        { label: isAr ? 'عمالة متاحة للإسناد' : 'Available for Supply', value: data.totals?.[0]?.available || 0, icon: Clock },
        { label: isAr ? 'التوافق مع قوى ومنصة مدد' : 'Qiwa & Mudad', value: isAr ? 'متوافق' : 'Compliant', icon: ShieldCheck, success: true },
      ],
      quickActions: [
        { label: isAr ? 'سجل العمالة' : 'Workers Directory', route: '/app/dashboard/workers', icon: Users, primary: true },
        { label: isAr ? 'إسناد عمالة لمشروع' : 'Assign to Client Site', route: '/app/dashboard/assignments', icon: Building },
        { label: isAr ? 'عقود الإسناد والتوريد' : 'Labor Contracts', route: '/app/dashboard/contracts', icon: FileText },
        { label: isAr ? 'ساعات العمل والحضور' : 'Timesheets', route: '/app/dashboard/timesheets', icon: Clock },
      ]
    },
    bookstore: {
      nameEn: 'Bookstore, Stationery & Rental POS',
      nameAr: 'المكتبات والقرطاسية والإعارة',
      category: 'Books & Stationery',
      icon: 'book',
      defaultRoute: '/app/dashboard/bookstore/pos',
      color: 'from-emerald-600 to-teal-700',
      kpis: [
        { label: isAr ? 'إجمالي عناوين الكتب' : 'Catalog Titles', value: data.totals?.[0]?.total || 0, icon: Package },
        { label: isAr ? 'كتب منخفضة المخزون' : 'Low Stock Titles', value: data.totals?.[0]?.lowStock || 0, icon: AlertTriangle, alert: (data.totals?.[0]?.lowStock || 0) > 0 },
        { label: isAr ? 'ماسح الباركود ISBN' : 'ISBN Scanner', value: isAr ? 'نشط' : 'Active', icon: Tag, success: true },
        { label: isAr ? 'طابعة الفواتير الحرارية' : 'Receipt Printer', value: isAr ? 'متصل' : 'Connected', icon: Printer, success: true },
      ],
      quickActions: [
        { label: isAr ? 'نقطة بيع المكتبة' : 'Bookstore POS', route: '/app/dashboard/bookstore/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'إضافة كتاب / قرطاسية' : 'Add Book Item', route: '/app/dashboard/bookstore/add-product', icon: PlusCircle },
        { label: isAr ? 'قوائم المدارس' : 'School Supply Lists', route: '/app/dashboard/bookstore/supply-lists', icon: FileText },
        { label: isAr ? 'إعارة واسترجاع الكتب' : 'Book Rentals', route: '/app/dashboard/bookstore/rentals', icon: Clock },
      ]
    },
    boutique: {
      nameEn: 'Boutique, Fashion & Dress Rental',
      nameAr: 'البوتيك والأزياء وتأجير الفساتين',
      category: 'Fashion & Bridal',
      icon: 'shirt',
      defaultRoute: '/app/dashboard/boutique/pos',
      color: 'from-rose-500 to-pink-700',
      kpis: [
        { label: isAr ? 'فساتين مستأجرة حالياً' : 'Active Rentals', value: data.totals?.[0]?.activeRentals || 0, icon: Calendar },
        { label: isAr ? 'فساتين تم إرجاعها' : 'Returned Dresses', value: data.totals?.[0]?.completed || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي الفساتين' : 'Total Inventory', value: data.totals?.[0]?.total || 0, icon: Package },
        { label: isAr ? 'تقويم المناسبات' : 'Event Calendar', value: isAr ? 'نشط' : 'Active', icon: Calendar, success: true },
      ],
      quickActions: [
        { label: isAr ? 'نقطة بيع البوتيك' : 'Boutique POS', route: '/app/dashboard/boutique/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'تقويم الحجوزات والمناسبات' : 'Rental Calendar', route: '/app/dashboard/boutique/calendar', icon: Calendar },
        { label: isAr ? 'مخزون الفساتين والأزياء' : 'Dress Inventory', route: '/app/dashboard/boutique/products', icon: Package },
        { label: isAr ? 'خدمات التعديل والبروفة' : 'Alterations & Fitting', route: '/app/dashboard/boutique/alterations', icon: Scissors },
      ]
    },
    furniture_shop: {
      nameEn: 'Furniture Showroom & Custom Orders',
      nameAr: 'معارض الأثاث والمفروشات والتفصيل',
      category: 'Home & Furniture',
      icon: 'building',
      defaultRoute: '/app/dashboard/furniture/pos',
      color: 'from-amber-700 to-stone-800',
      kpis: [
        { label: isAr ? 'طلبات قيد التفصيل والتصنيع' : 'In Production', value: data.totals?.[0]?.inProduction || 0, icon: Hammer },
        { label: isAr ? 'طلبات تم تسليمها وتركيبها' : 'Delivered & Assembled', value: data.totals?.[0]?.delivered || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي المبيعات' : 'Total Revenue', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'إجمالي الطلبات' : 'Total Orders', value: data.totals?.[0]?.total || 0, icon: FileText },
      ],
      quickActions: [
        { label: isAr ? 'نقطة بيع معرض الأثاث' : 'Furniture POS', route: '/app/dashboard/furniture/pos', icon: ShoppingCart, primary: true },
        { label: isAr ? 'سجل الطلبات والتفصيل' : 'Custom Orders', route: '/app/dashboard/furniture/orders', icon: Receipt },
        { label: isAr ? 'كتالوج الأثاث والمخزون' : 'Furniture Catalog', route: '/app/dashboard/furniture/products', icon: Package },
      ]
    },
    construction: {
      nameEn: 'Construction, Contracting & BOQ Billing',
      nameAr: 'المقاولات والمشاريع والمستخلصات',
      category: 'Contracting & Engineering',
      icon: 'building',
      defaultRoute: '/app/dashboard/projects',
      color: 'from-amber-600 to-stone-800',
      kpis: [
        { label: isAr ? 'مشاريع إنشائية نشطة' : 'Active Projects', value: data.totals?.[0]?.active || 0, icon: Building },
        { label: isAr ? 'مشاريع تم تسليمها' : 'Completed Sites', value: data.totals?.[0]?.completed || 0, icon: CheckCircle },
        { label: isAr ? 'متوسط نسبة الإنجاز' : 'Avg Project Progress', value: `${Math.round(data.totals?.[0]?.avgProgress || 0)}%`, icon: BarChart3 },
        { label: isAr ? 'إجمالي ميزانيات المشاريع' : 'Total Project Budgets', value: data.totals?.[0]?.totalBudget || 0, isCurrency: true, icon: TrendingUp },
      ],
      quickActions: [
        { label: isAr ? 'لوحة المشاريع الإنشائية' : 'Projects Hub', route: '/app/dashboard/projects', icon: Building, primary: true },
        { label: isAr ? 'مشروع جديد' : 'New Project', route: '/app/dashboard/projects/new', icon: PlusCircle },
        { label: isAr ? 'فواتير ومستخلصات المقاولات' : 'Contracting Invoices', route: '/app/dashboard/invoices', icon: Receipt },
        { label: isAr ? 'عروض الأسعار وجداول الكميات' : 'Quotations & BOQ', route: '/app/dashboard/quotations', icon: FileText },
      ],
      recentList: {
        title: isAr ? 'أحدث المشاريع الإنشائية' : 'Recent Construction Projects',
        items: data.recent || [],
        renderItem: (item) => ({
          title: isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr,
          subtitle: `${isAr ? 'كود' : 'Code'}: ${item.code || ''} | ${isAr ? 'الإنجاز' : 'Progress'}: ${item.progress || 0}%`,
          badge: item.status,
          amount: item.budget,
          date: item.createdAt
        })
      }
    },
    travel_agency: {
      nameEn: 'Travel Agency & Ticket Margin Invoicing',
      nameAr: 'وكالات السفر وفواتير هامش التذاكر',
      category: 'Travel & Tourism',
      icon: 'plane',
      defaultRoute: '/app/dashboard/travel/bookings',
      color: 'from-sky-500 to-blue-700',
      kpis: [
        { label: isAr ? 'حجوزات طيران وفنادق مفتوحة' : 'Open Bookings', value: data.totals?.[0]?.open || 0, icon: Plane },
        { label: isAr ? 'تذاكر تم إصدارها' : 'Ticketed Bookings', value: data.totals?.[0]?.ticketed || 0, icon: CheckCircle },
        { label: isAr ? 'إجمالي مبيعات التذاكر' : 'Travel Booking Volume', value: data.totals?.[0]?.revenue || 0, isCurrency: true, icon: TrendingUp },
        { label: isAr ? 'تطبيق هامش ضريبة هيئة الزكاة' : 'ZATCA Margin Tax Rule', value: isAr ? 'مطبّق بنجاح' : 'Rule Active', icon: ShieldCheck, success: true },
      ],
      quickActions: [
        { label: isAr ? 'حجز سفر جديد' : 'New Travel Booking', route: '/app/dashboard/travel/bookings/new', icon: PlusCircle, primary: true },
        { label: isAr ? 'سجل الحجوزات والتذاكر' : 'All Bookings', route: '/app/dashboard/travel/bookings', icon: Plane },
        { label: isAr ? 'فواتير هامش الربح' : 'Margin Invoices', route: '/app/dashboard/invoices', icon: Receipt },
      ],
      recentList: {
        title: isAr ? 'أحدث حجوزات السفر' : 'Recent Travel Bookings',
        items: data.recent || [],
        renderItem: (item) => ({
          title: item.bookingNumber || (isAr ? 'حجز سفر' : 'Travel Booking'),
          subtitle: item.customerName || '',
          badge: item.status,
          amount: item.grandTotal,
          date: item.createdAt
        })
      }
    },
    saudi_compliance: {
      nameEn: 'Saudi Government Compliance & ZATCA Phase 2',
      nameAr: 'الامتثال الحكومي السعودي وهيئة الزكاة المرحلة الثانية',
      category: 'Compliance & Integration',
      icon: 'landmark',
      defaultRoute: '/app/dashboard/tenant-settings/government-integrations',
      color: 'from-emerald-700 to-green-900',
      kpis: [
        { label: isAr ? 'ربط هيئة الزكاة المرحلة 2' : 'ZATCA Phase 2 Status', value: data.isPhase2Ready ? (isAr ? 'مكتمل وموثّق' : 'Fully Integrated') : (isAr ? 'المرحلة 1 جاهز' : 'Phase 1 Active'), icon: ShieldCheck, success: true },
        { label: isAr ? 'وثائق إقامة وسجلات تنتهي قريباً' : 'Expiring Docs & Iqamas', value: data.expiringDocumentsCount || 0, icon: AlertTriangle, alert: (data.expiringDocumentsCount || 0) > 0 },
        { label: isAr ? 'الامتثال لمتطلبات الفاتورة الإلكترونية' : 'E-Invoicing Standard', value: '100%', icon: CheckCircle, success: true },
        { label: isAr ? 'الربط الحكومي الموحد' : 'Unified Gov Suite', value: isAr ? 'منصة قوى، مدد، بلدي' : 'Qiwa, Mudad, Balady', icon: Building, success: true },
      ],
      quickActions: [
        { label: isAr ? 'بوابة الربط الحكومي' : 'Gov Integrations Portal', route: '/app/dashboard/tenant-settings/government-integrations', icon: ShieldCheck, primary: true },
        { label: isAr ? 'إعدادات هيئة الزكاة FATOORA' : 'ZATCA Settings', route: '/app/dashboard/tenant-settings/government-integrations/zatca', icon: ShieldCheck },
        { label: isAr ? 'إقرارات ضريبة القيمة المضافة' : 'VAT Returns', route: '/app/dashboard/vat-returns', icon: Receipt },
        { label: isAr ? 'تأهيل العمالة وإقامات موظفين' : 'Compliance & Iqamas', route: '/app/dashboard/employees', icon: Users },
      ]
    }
  }

  const config = VERTICAL_CONFIGS[verticalKey] || VERTICAL_CONFIGS.trading || {
    nameEn: 'App Workspace',
    nameAr: 'مساحة عمل التطبيق',
    category: 'Application',
    color: 'from-primary-600 to-primary-700',
    kpis: [],
    quickActions: []
  }

  const appName = isAr ? config.nameAr : config.nameEn

  return (
    <div className="space-y-6">
      {/* Hero Banner for this vertical */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${config.color} p-6 sm:p-8 text-white shadow-lg`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md p-2 flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <App3DIcon 
                appId={verticalKey} 
                icon={config.icon}
                path={config.defaultRoute}
                className="w-12 h-12 sm:w-14 sm:h-14" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white border border-white/30">
                  {config.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  {isAr ? 'مفعّل ونشط' : 'Live & Active'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {appName}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-xl">
                {isAr ? 'مركز العمليات والمؤشرات التشغيلية الفورية ولوحة التحكم الشاملة' : 'Real-time operational dashboard, live metrics, and quick workflows for this vertical'}
              </p>
            </div>
          </div>

          {config.defaultRoute && (
            <button
              onClick={() => navigate(config.defaultRoute)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-gray-900 font-bold text-sm shadow-md hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <span>{isAr ? 'فتح واجهة التطبيق الرئيسية' : 'Launch Full Module'}</span>
              <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {config.kpis.map((kpi, idx) => {
          const IconComp = kpi.icon || BarChart3
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-200/80 dark:border-dark-700 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${
                  kpi.alert ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  kpi.success ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400'
                }`}>
                  <IconComp className="w-5 h-5" />
                </div>
                {kpi.alert && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    {isAr ? 'تنبيه' : 'Alert'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {kpi.label}
                </p>
                <p className={`text-2xl font-black ${
                  kpi.alert ? 'text-amber-600 dark:text-amber-400' :
                  kpi.success ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-gray-900 dark:text-white'
                }`}>
                  {kpi.isCurrency ? (
                    <Money value={kpi.value} minimumFractionDigits={0} maximumFractionDigits={0} />
                  ) : (
                    kpi.value
                  )}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions Bar */}
      {config.quickActions && config.quickActions.length > 0 && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-200/80 dark:border-dark-700 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-500" />
            {isAr ? 'الإجراءات السريعة والعمليات' : 'Instant Actions & Workflows'}
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {config.quickActions.map((action, aIdx) => {
              const ActionIcon = action.icon || ArrowRight
              return (
                <button
                  key={aIdx}
                  onClick={() => navigate(action.route)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    action.primary
                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-primary-500/20'
                      : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <ActionIcon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Activity List if available */}
      {config.recentList && config.recentList.items?.length > 0 && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200/80 dark:border-dark-700 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {config.recentList.title}
            </h3>
            <span className="text-xs font-semibold text-gray-400">
              {config.recentList.items.length} {isAr ? 'سجلات' : 'items'}
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {config.recentList.items.map((rawItem, idx) => {
              const item = config.recentList.renderItem(rawItem)
              return (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="text-end">
                    {item.amount !== undefined && (
                      <p className="font-bold text-sm text-gray-900 dark:text-white">
                        <Money value={item.amount} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                    )}
                    {item.badge && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 capitalize">
                        {item.badge}
                      </span>
                    )}
                    {item.date && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(item.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ListOrderedIconWrapper(props) {
  return <Receipt {...props} />
}

export default AppVerticalView
