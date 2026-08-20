import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/ui/header-3'
import { HeroSection } from '../components/ui/hero-3'
import { motion } from 'framer-motion'
import { usePublicWebsiteSettings } from '../lib/website'
import { getBusinessTypeOptions } from '../lib/businessTypes'
import {
  FileText,
  Users,
  Package,
  BarChart3,
  Shield,
  Zap,
  Globe,
  CheckCircle2,
  ArrowRight,
  Star,
  Building2,
  Receipt,
  Calculator,
  Truck,
  Warehouse,
  ClipboardList,
  MessageCircle,
  PieChart,
  Settings,
  Lock,
  Cloud,
  Smartphone,
  ChevronRight,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Play,
  Sparkles,
  TrendingUp,
  CreditCard,
  UserCheck,
  CalendarDays,
  FileCheck,
  Boxes,
  Factory,
  Cpu,
  LineChart,
  BadgeCheck,
  Award,
  Headphones,
  Scissors,
  HardHat,
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const features = [
  {
    icon: FileText,
    title: 'ZATCA E-Invoicing',
    titleAr: 'الفوترة الإلكترونية',
    description: 'Fully compliant with Saudi ZATCA Phase 2 requirements. Automatic QR code generation, XML signing, and real-time submission.',
    descriptionAr: 'متوافق بالكامل مع متطلبات المرحلة الثانية من هيئة الزكاة والضريبة والجمارك',
  },
  {
    icon: Users,
    title: 'HR & Payroll',
    titleAr: 'الموارد البشرية والرواتب',
    description: 'Complete employee management with GOSI calculations, WPS file generation, leave tracking, and Iqama expiry alerts.',
    descriptionAr: 'إدارة كاملة للموظفين مع حسابات التأمينات وملفات حماية الأجور',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    titleAr: 'إدارة المخزون',
    description: 'Multi-warehouse support, stock tracking, automatic reorder points, and barcode scanning integration.',
    descriptionAr: 'دعم متعدد المستودعات وتتبع المخزون ونقاط إعادة الطلب التلقائية',
  },
  {
    icon: Receipt,
    title: 'Expense Management',
    titleAr: 'إدارة المصروفات',
    description: 'Track company expenses with approval workflows, categorization, and integration with financial reports.',
    descriptionAr: 'تتبع مصروفات الشركة مع سير عمل الموافقات والتصنيف',
  },
  {
    icon: Truck,
    title: 'Purchase & Suppliers',
    titleAr: 'المشتريات والموردين',
    description: 'Manage suppliers, create purchase orders, track shipments, and automate procurement workflows.',
    descriptionAr: 'إدارة الموردين وأوامر الشراء وتتبع الشحنات',
  },
  {
    icon: BarChart3,
    title: 'Financial Reports',
    titleAr: 'التقارير المالية',
    description: 'Comprehensive VAT returns, profit/loss statements, and real-time financial dashboards.',
    descriptionAr: 'إقرارات ضريبة القيمة المضافة الشاملة ولوحات المعلومات المالية',
  },
  {
    icon: ClipboardList,
    title: 'Project Management',
    titleAr: 'إدارة المشاريع',
    description: 'Create projects, assign tasks, track progress, and manage job costing with detailed breakdowns.',
    descriptionAr: 'إنشاء المشاريع وتعيين المهام وتتبع التقدم وإدارة تكاليف العمل',
  },
  {
    icon: Factory,
    title: 'MRP & Manufacturing',
    titleAr: 'تخطيط موارد التصنيع',
    description: 'Material Requirements Planning with BOM management, production orders, and capacity planning.',
    descriptionAr: 'تخطيط متطلبات المواد مع إدارة قائمة المواد وأوامر الإنتاج',
  },
  {
    icon: Cpu,
    title: 'IoT Integration',
    titleAr: 'تكامل إنترنت الأشياء',
    description: 'Connect sensors and devices for real-time monitoring of temperature, humidity, and equipment status.',
    descriptionAr: 'ربط أجهزة الاستشعار للمراقبة في الوقت الفعلي',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Business',
    titleAr: 'واتساب للأعمال',
    description: 'Send invoices, payment reminders, and notifications directly to customers via WhatsApp.',
    descriptionAr: 'إرسال الفواتير والتذكيرات والإشعارات عبر واتساب',
  },
  {
    icon: Globe,
    title: 'Multi-Language',
    titleAr: 'متعدد اللغات',
    description: 'Full Arabic and English support with RTL layout. Switch languages instantly across the entire system.',
    descriptionAr: 'دعم كامل للعربية والإنجليزية مع تخطيط RTL',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    titleAr: 'أمان المؤسسات',
    description: 'Role-based access control, audit logs, two-factor authentication, and encrypted data storage.',
    descriptionAr: 'التحكم في الوصول والسجلات والمصادقة الثنائية',
  },
]

const stats = [
  { value: '99.9%', label: 'Uptime', labelAr: 'وقت التشغيل' },
  { value: '50K+', label: 'Invoices/Day', labelAr: 'فاتورة يومياً' },
  { value: '500+', label: 'Companies', labelAr: 'شركة' },
  { value: '24/7', label: 'Support', labelAr: 'دعم فني' },
]

const modules = [
  { icon: FileText, name: 'E-Invoicing', nameAr: 'الفوترة الإلكترونية', color: 'from-emerald-500 to-teal-600' },
  { icon: Users, name: 'HR Management', nameAr: 'إدارة الموارد البشرية', color: 'from-blue-500 to-indigo-600' },
  { icon: Calculator, name: 'Payroll & GOSI', nameAr: 'الرواتب والتأمينات', color: 'from-purple-500 to-violet-600' },
  { icon: Package, name: 'Inventory', nameAr: 'المخزون', color: 'from-orange-500 to-amber-600' },
  { icon: Warehouse, name: 'Warehouses', nameAr: 'المستودعات', color: 'from-cyan-500 to-sky-600' },
  { icon: Truck, name: 'Procurement', nameAr: 'المشتريات', color: 'from-rose-500 to-pink-600' },
  { icon: Receipt, name: 'Expenses', nameAr: 'المصروفات', color: 'from-red-500 to-rose-600' },
  { icon: ClipboardList, name: 'Projects', nameAr: 'المشاريع', color: 'from-lime-500 to-green-600' },
  { icon: Factory, name: 'Manufacturing', nameAr: 'التصنيع', color: 'from-slate-500 to-gray-600' },
  { icon: LineChart, name: 'Reports', nameAr: 'التقارير', color: 'from-fuchsia-500 to-purple-600' },
  { icon: UserCheck, name: 'Contacts', nameAr: 'جهات الاتصال', color: 'from-teal-500 to-emerald-600' },
  { icon: Settings, name: 'Settings', nameAr: 'الإعدادات', color: 'from-gray-500 to-slate-600' },
]

const testimonials = [
  {
    name: 'Ahmed Al-Rashid',
    nameAr: 'أحمد الراشد',
    role: 'CFO, Tech Solutions',
    roleAr: 'المدير المالي، حلول التقنية',
    content: 'Maqder ERP transformed our invoicing process. ZATCA compliance is now automatic and hassle-free.',
    contentAr: 'حوّل Maqder ERP عملية الفوترة لدينا. الامتثال لهيئة الزكاة أصبح تلقائياً وسهلاً.',
    rating: 5,
  },
  {
    name: 'Sara Mohammed',
    nameAr: 'سارة محمد',
    role: 'HR Director, Retail Group',
    roleAr: 'مديرة الموارد البشرية، مجموعة التجزئة',
    content: 'The HR module with GOSI calculations saved us countless hours. Payroll is now processed in minutes.',
    contentAr: 'وحدة الموارد البشرية مع حسابات التأمينات وفرت علينا ساعات لا تحصى.',
    rating: 5,
  },
  {
    name: 'Khalid Hassan',
    nameAr: 'خالد حسن',
    role: 'Operations Manager',
    roleAr: 'مدير العمليات',
    content: 'Multi-warehouse inventory tracking with real-time updates. Exactly what we needed for our growth.',
    contentAr: 'تتبع المخزون متعدد المستودعات مع التحديثات الفورية. بالضبط ما نحتاجه لنمونا.',
    rating: 5,
  },
]

const fallbackPricingPlans = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    priceMonthly: 49.99,
    priceYearly: 499,
    priceMonthlySar: 49.99,
    priceYearlySar: 499,
    priceMonthlyUsd: 29.99,
    priceYearlyUsd: 299,
    popular: false,
    featuresEn: ['ZATCA E-Invoicing', '1 user', '50 invoices / month', '50 quotations / month', 'Inventory & Warehouses', 'Basic Reports', 'Email Support'],
    featuresAr: ['الفوترة الإلكترونية', 'مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'المخزون والمستودعات', 'تقارير أساسية', 'دعم بالبريد'],
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    priceMonthly: 99.99,
    priceYearly: 999,
    priceMonthlySar: 99.99,
    priceYearlySar: 999,
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599,
    popular: true,
    featuresEn: ['Everything in Starter', '3 users', '100 invoices / month', '100 quotations / month', 'HR & Payroll (GOSI/WPS)', 'Expenses & Finance', 'Projects & Tasks', 'Advanced Reports', 'Priority Support'],
    featuresAr: ['كل ما في البداية', '3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'الموارد البشرية والرواتب', 'المصروفات والمالية', 'المشاريع والمهام', 'تقارير متقدمة', 'دعم ذو أولوية'],
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    priceMonthly: 0,
    priceYearly: 0,
    popular: false,
    featuresEn: ['Everything in Professional', 'Unlimited users', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise Option', '24/7 Phone Support', 'SLA Guarantee'],
    featuresAr: ['كل ما في الاحترافية', 'مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خيار الخادم الخاص', 'دعم هاتفي 24/7', 'ضمان SLA'],
  },
]

const businessTypeTabs = getBusinessTypeOptions('en')

const complianceLogos = [
  { src: '/ZATCA_Logo.svg', alt: 'ZATCA', imageClassName: 'scale-[1.35]' },
  { src: '/saudi-vision-2030-logo.webp', alt: 'Saudi Vision 2030', imageClassName: 'scale-100' },
]

const solutionsData = [
  {
    title: 'Trading & Supply Chain',
    titleAr: 'التجارة وسلاسل الإمداد',
    icon: Building2,
    image: '/images/solutions/trading.webp',
    color: 'from-blue-500 to-indigo-600',
    description: 'Complete wholesale, retail, and advanced inventory tracking.',
    descriptionAr: 'تتبع شامل لتجارة الجملة والتجزئة والمخزون المتقدم.',
    longDescription: 'Optimize your entire supply chain with multi-warehouse tracking, automated reorder points, comprehensive supplier management, and seamless ZATCA e-invoicing for B2B and B2C transactions.',
    longDescriptionAr: 'قم بتحسين سلسلة التوريد الخاصة بك بالكامل مع تتبع المستودعات المتعددة ونقاط إعادة الطلب الآلية وإدارة الموردين الشاملة والفوترة الإلكترونية السلسة لمعاملات B2B و B2C.',
    features: ['Multi-warehouse inventory', 'Automated purchase orders', 'Real-time stock valuation', 'ZATCA B2B & B2C invoicing'],
    featuresAr: ['مخزون متعدد المستودعات', 'أوامر شراء مؤتمتة', 'تقييم المخزون في الوقت الفعلي', 'فواتير ZATCA B2B و B2C'],
    email: 'trading@test.com'
  },
  {
    title: 'Construction & Contracting',
    titleAr: 'المقاولات والبناء',
    icon: HardHat,
    image: '/images/solutions/construction.webp',
    color: 'from-orange-500 to-red-600',
    description: 'Project management, job costing, and fleet tracking.',
    descriptionAr: 'إدارة المشاريع وحساب تكاليف العمليات وتتبع الأسطول.',
    longDescription: 'Take control of your construction projects with precise job costing, material requisitions, fleet and machinery maintenance tracking, and detailed project profitability reports.',
    longDescriptionAr: 'تحكم في مشاريع البناء الخاصة بك من خلال حساب دقيق لتكاليف العمل، وطلبات المواد، وتتبع صيانة الأسطول والآلات، وتقارير ربحية المشروع المفصلة.',
    features: ['Detailed Job Costing', 'Project Management & Tasks', 'Heavy Machinery Fleet Tracking', 'Subcontractor Invoicing'],
    featuresAr: ['حساب مفصل لتكاليف العمل', 'إدارة المشاريع والمهام', 'تتبع أسطول الآليات الثقيلة', 'فواتير المقاولين من الباطن'],
    email: 'construction@test.com'
  },
  {
    title: 'Travel & Tourism',
    titleAr: 'السياحة والسفر',
    icon: Globe,
    image: '/images/solutions/travel.webp',
    color: 'from-sky-500 to-cyan-600',
    description: 'Flight bookings, margin scheme taxation, and itineraries.',
    descriptionAr: 'حجوزات الطيران ونظام ضريبة الهامش والمسارات.',
    longDescription: 'Tailored for travel agencies, our system supports complex Margin Scheme VAT calculations, passenger tracking, flight ticket logs, and comprehensive booking profitability analysis.',
    longDescriptionAr: 'مصمم خصيصاً لوكالات السفر، يدعم نظامنا حسابات ضريبة القيمة المضافة المعقدة (نظام الهامش)، وتتبع الركاب، وسجلات تذاكر الطيران، والتحليل الشامل لربحية الحجوزات.',
    features: ['Margin Scheme VAT (ZATCA)', 'Flight & Hotel Booking Logs', 'Passenger Manifests', 'Supplier Payment Tracking'],
    featuresAr: ['ضريبة القيمة المضافة بنظام الهامش', 'سجلات حجوزات الطيران والفنادق', 'قوائم الركاب', 'تتبع مدفوعات الموردين'],
    email: 'travel@test.com'
  },
  {
    title: 'Restaurant & Cafe',
    titleAr: 'المطاعم والمقاهي',
    icon: PieChart,
    image: '/images/solutions/restaurant.webp',
    color: 'from-amber-500 to-orange-500',
    description: 'Table management, kitchen displays, and smart POS.',
    descriptionAr: 'إدارة الطاولات وشاشات المطبخ ونقاط البيع الذكية.',
    longDescription: 'A lightning-fast, touch-friendly POS integrated with a Kitchen Display System (KDS). Manage table reservations, recipe ingredients, shift cash registers, and deliver exceptional dining experiences.',
    longDescriptionAr: 'نظام نقاط بيع فائق السرعة وسهل الاستخدام باللمس ومتكامل مع شاشة المطبخ (KDS). قم بإدارة حجوزات الطاولات ومكونات الوصفات وسجلات النقد للورديات.',
    features: ['Touch-friendly Smart POS', 'Kitchen Display System (KDS)', 'Table & Area Management', 'Recipe & Ingredient Tracking'],
    featuresAr: ['نظام نقاط بيع ذكي باللمس', 'نظام عرض المطبخ (KDS)', 'إدارة الطاولات والمناطق', 'تتبع الوصفات والمكونات'],
    email: 'restaurant@test.com'
  },
  {
    title: 'Car Rental',
    titleAr: 'تأجير السيارات',
    icon: Truck,
    image: '/images/solutions/car-rental.webp',
    color: 'from-rose-500 to-red-600',
    description: 'Vehicle tracking, rental contracts, and maintenance logs.',
    descriptionAr: 'تتبع المركبات وعقود التأجير وسجلات الصيانة.',
    longDescription: 'Manage your rental fleet with ease. Create dynamic rental agreements, track vehicle availability, monitor maintenance schedules, and automatically calculate late return fees.',
    longDescriptionAr: 'إدارة أسطول التأجير الخاص بك بسهولة. إنشاء اتفاقيات تأجير ديناميكية، وتتبع توفر المركبات، ومراقبة جداول الصيانة، وحساب رسوم التأخير تلقائياً.',
    features: ['Dynamic Rental Contracts', 'Fleet Availability Calendar', 'Damage Check-in/Check-out', 'Automated Late Fees'],
    featuresAr: ['عقود تأجير ديناميكية', 'تقويم توفر الأسطول', 'فحص الأضرار عند التسليم والاستلام', 'رسوم التأخير التلقائية'],
    email: 'rental@test.com'
  },
  {
    title: 'Laundry Services',
    titleAr: 'خدمات المغاسل',
    icon: Sparkles,
    image: '/images/solutions/laundry.webp',
    color: 'from-emerald-500 to-teal-600',
    description: 'Garment tracking, weight billing, and touch POS.',
    descriptionAr: 'تتبع الملابس والفواتير بالوزن ونقاط البيع باللمس.',
    longDescription: 'Streamline your laundry operations with precise garment tracking, automated weight-based billing, express service surcharges, and integrated WhatsApp notifications when clothes are ready.',
    longDescriptionAr: 'تبسيط عمليات المغسلة الخاصة بك مع التتبع الدقيق للملابس، والفوترة الآلية على أساس الوزن، ورسوم الخدمة السريعة، وإشعارات الواتساب المتكاملة عندما تكون الملابس جاهزة.',
    features: ['Garment Tracking Tags', 'Weight-based Billing', 'Express Service Management', 'WhatsApp Ready Alerts'],
    featuresAr: ['علامات تتبع الملابس', 'الفوترة بناءً على الوزن', 'إدارة الخدمة السريعة', 'إشعارات الواتساب للجاهزية'],
    email: 'laundry@test.com'
  },
  {
    title: 'Saloon & Barber Shop',
    titleAr: 'صالونات الحلاقة والتجميل',
    icon: Scissors,
    image: '/images/solutions/saloon.webp',
    color: 'from-purple-500 to-fuchsia-600',
    description: 'Appointments scheduling, staff commissions, and service POS.',
    descriptionAr: 'جدولة المواعيد وعمولات الموظفين ونقاط بيع الخدمات.',
    longDescription: 'Elevate your grooming business with sleek appointment scheduling, automated staff commission calculations, premium service catalogs, and customer loyalty tracking.',
    longDescriptionAr: 'ارتق بأعمال الصالون الخاصة بك مع جدولة المواعيد الأنيقة، وحسابات عمولات الموظفين الآلية، وقوائم الخدمات المتميزة، وتتبع ولاء العملاء.',
    features: ['Staff Commission Tracking', 'Appointment Scheduling', 'Service Variations POS', 'Customer Loyalty'],
    featuresAr: ['تتبع عمولات الموظفين', 'جدولة المواعيد', 'نظام نقاط البيع للخدمات', 'ولاء العملاء'],
    email: 'saloon@test.com'
  },
  {
    title: 'Supermarket & Bakala',
    titleAr: 'السوبرماركت والبقالة',
    icon: Package,
    image: '/images/solutions/trading.webp',
    color: 'from-green-500 to-emerald-600',
    description: 'Fast barcode scanning, scale integration, and inventory.',
    descriptionAr: 'مسح الباركود السريع، تكامل الميزان، والمخزون.',
    longDescription: 'A highly efficient POS system tailored for supermarkets and local Bakalas. Seamlessly integrated with barcode scanners, weighing scales, and real-time inventory tracking to keep your shelves stocked.',
    longDescriptionAr: 'نظام نقاط بيع عالي الكفاءة مصمم خصيصاً للسوبرماركت والبقالات المحلية. متكامل بسلاسة مع ماسحات الباركود وموازين الوزن وتتبع المخزون في الوقت الفعلي.',
    features: ['Barcode Scanner & Scale Ready', 'Fast Checkout POS', 'Expiry Date Tracking', 'Supplier Direct Orders'],
    featuresAr: ['متوافق مع ماسح الباركود والميزان', 'نقاط بيع سريعة الدفع', 'تتبع تاريخ الصلاحية', 'طلبات الموردين المباشرة'],
    email: 'bakala@test.com'
  }
]

export default function Landing() {
  const [language, setLanguage] = useState('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedSolution, setSelectedSolution] = useState(null)
  const [pricingBusinessType, setPricingBusinessType] = useState('default')
  const isArabic = language === 'ar'

  const { data: websiteData } = usePublicWebsiteSettings()
  const [websiteSettings, setWebsiteSettings] = useState(null)

  useEffect(() => {
    if (websiteData) setWebsiteSettings(websiteData)
  }, [websiteData])

  useEffect(() => {
    if (pricingBusinessType !== 'default') {
      import('../lib/api').then(({ default: api }) => {
        api.get('/public/website', { params: { businessType: pricingBusinessType } }).then((res) => {
          setWebsiteSettings(res.data)
        }).catch(() => {})
      })
    } else if (websiteData) {
      setWebsiteSettings(websiteData)
    }
  }, [pricingBusinessType])

  const currentPlans = (() => {
    const plans = Array.isArray(websiteSettings?.pricing?.plans) && websiteSettings.pricing.plans.length > 0
      ? websiteSettings.pricing.plans
      : fallbackPricingPlans
    return plans
  })()

  return (
    <div className={`flex w-full flex-col min-h-screen bg-white ${isArabic ? 'rtl' : 'ltr'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header isArabic={isArabic} setIsArabic={setIsArabic} />
      <main className="grow">
        <HeroSection isArabic={isArabic} />
      </main>
      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-primary-100 font-medium">{isArabic ? stat.labelAr : stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {isArabic ? 'كل ما تحتاجه لإدارة أعمالك' : 'Everything You Need to Run Your Business'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {isArabic
                ? 'منصة متكاملة تجمع جميع أدوات إدارة الأعمال في مكان واحد'
                : 'A unified platform that brings all your business management tools together'}
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {isArabic ? feature.titleAr : feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {isArabic ? feature.descriptionAr : feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Modules Grid */}
      <section id="modules" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {isArabic ? 'وحدات النظام' : 'System Modules'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {isArabic
                ? 'اختر الوحدات التي تناسب احتياجات عملك'
                : 'Choose the modules that fit your business needs'}
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {modules.map((module, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group cursor-pointer"
              >
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 text-center">
                  <div
                    className={`w-14 h-14 mx-auto bg-gradient-to-br ${module.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
                  >
                    <module.icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {isArabic ? module.nameAr : module.name}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ZATCA Compliance Section */}
      <section className="py-24 bg-gradient-to-br from-gray-900 to-gray-800 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-primary-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 font-medium text-sm mb-6">
                <Shield className="w-4 h-4" />
                {isArabic ? 'امتثال كامل' : 'Full Compliance'}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                {isArabic
                  ? 'مزود خدمات الفوترة الإلكترونية - متوافق 100% مع متطلبات ZATCA'
                  : 'Provision of E-Invoicing Services - 100% ZATCA Phase 2 Compliant'}
              </h2>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                {isArabic
                  ? 'تقديم خدمات الفوترة الإلكترونية مع فواتير موقعة رقمياً ورموز QR وتكامل مباشر مع بوابة ZATCA'
                  : 'Providing E-Invoicing Services with digitally signed e-invoices, QR codes, and direct ZATCA gateway integration'}
              </p>
              <ul className="space-y-4">
                {[
                  { en: 'Automatic XML generation & signing', ar: 'إنشاء وتوقيع XML تلقائي' },
                  { en: 'Real-time ZATCA submission', ar: 'إرسال فوري لهيئة الزكاة' },
                  { en: 'QR code with all required fields', ar: 'رمز QR مع جميع الحقول المطلوبة' },
                  { en: 'Credit notes & debit notes', ar: 'إشعارات دائنة ومدينة' },
                  { en: 'B2B and B2C invoices', ar: 'فواتير الأعمال والمستهلكين' },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-gray-200">{isArabic ? item.ar : item.en}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                    <FileCheck className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">{isArabic ? 'رقم الفاتورة' : 'Invoice Number'}</p>
                    <p className="text-white font-bold text-xl">INV-2024-000123</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-gray-400">{isArabic ? 'المبلغ' : 'Amount'}</span>
                    <span className="text-white font-semibold">SAR 5,750.00</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-gray-400">{isArabic ? 'الضريبة' : 'VAT (15%)'}</span>
                    <span className="text-white font-semibold">SAR 862.50</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-gray-400">{isArabic ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-emerald-400 font-bold text-xl">SAR 6,612.50</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-3 p-3 bg-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300 text-sm font-medium">
                    {isArabic ? 'تم الإرسال والاعتماد من ZATCA' : 'Submitted & Approved by ZATCA'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Solutions Showcase Section */}
      <section id="solutions" className="py-24 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-900/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-1/2 h-full bg-gradient-to-t from-emerald-900/30 to-transparent" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-full font-medium text-sm mb-6 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <Sparkles className="w-4 h-4 text-primary-400" />
              {isArabic ? 'حلول مصممة لنشاطك' : 'Tailored Solutions'}
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
              {isArabic ? 'صناعتك، بطريقتنا' : 'Your Industry, Our Expertise'}
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto font-light">
              {isArabic
                ? 'اختر نوع نشاطك التجاري واستكشف كيف يسهل نظام مقدر إدارة عملياتك اليومية بأناقة وفعالية.'
                : 'Select your business type and explore how Maqder streamlines your daily operations with elegance and efficiency.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {solutionsData.map((solution, index) => (
              <motion.div
                key={index}
                onClick={() => setSelectedSolution(solution)}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group relative h-[420px] rounded-3xl overflow-hidden shadow-2xl bg-gray-800 cursor-pointer"
              >
                {/* Background Image inside a Mac Window to look like live tenant panel */}
                <div className="absolute inset-0 p-4 transition-transform duration-700 group-hover:scale-[1.02]">
                  <div className="w-full h-full bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 relative">
                    {/* Mac Window Header */}
                    <div className="h-6 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      <div className="mx-auto text-[10px] text-gray-500 font-mono tracking-wider">maqder.com/app</div>
                    </div>
                    {/* Panel Screen */}
                    <img 
                      src={solution.image} 
                      alt={solution.title} 
                      loading="lazy"
                      className="w-full h-[calc(100%-1.5rem)] object-cover object-top opacity-50 group-hover:opacity-90 transition-opacity duration-500 filter blur-[1px] group-hover:blur-none"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent transition-opacity duration-500 group-hover:opacity-95" />
                </div>
                
                {/* Content Container */}
                <div className="relative h-full flex flex-col justify-end p-8 z-10">
                  <div className={`w-14 h-14 bg-gradient-to-br ${solution.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/30 backdrop-blur-md border border-white/20 transform transition-transform duration-500 group-hover:-translate-y-2`}>
                    <solution.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3 transform transition-all duration-500 group-hover:-translate-y-2">
                    {isArabic ? solution.titleAr : solution.title}
                  </h3>
                  
                  <p className="text-gray-300 mb-6 font-light leading-relaxed opacity-0 translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 h-0 group-hover:h-auto overflow-hidden">
                    {isArabic ? solution.descriptionAr : solution.description}
                  </p>
                  
                  <div className="inline-flex items-center justify-between w-full p-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-lg text-white font-medium transition-all duration-300 transform group-hover:-translate-y-1">
                    <span>{isArabic ? 'عرض التفاصيل' : 'View Details'}</span>
                    <ArrowRight className={`w-5 h-5 ${isArabic ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Detail Modal */}
      <AnimatePresence>
        {selectedSolution && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir={isArabic ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSolution(null)}
              className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl overflow-hidden custom-scrollbar"
            >
              <button 
                onClick={() => setSelectedSolution(null)}
                className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} z-10 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors`}
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="relative h-72 sm:h-96 w-full bg-gray-900 p-4 sm:p-8 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                  <img src={selectedSolution.image} loading="lazy" className="w-full h-full object-cover opacity-20 blur-sm" alt={selectedSolution.title} />
                  <div className={`absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent`} />
                </div>

                {/* Live Display Mac Window */}
                <div className="relative z-10 w-full max-w-2xl bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden transform transition-transform hover:scale-105 duration-700">
                  <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="mx-auto flex items-center gap-2 px-4 py-1 bg-gray-900 rounded-md text-xs text-gray-400 font-mono">
                      <Lock className="w-3 h-3 text-emerald-500" />
                      maqder.com/app/tenant
                    </div>
                  </div>
                  <div className="relative w-full h-48 sm:h-64 overflow-hidden group">
                    <img 
                      src={selectedSolution.image} 
                      loading="lazy"
                      className="w-full h-auto object-cover object-top transition-transform duration-[3000ms] ease-linear group-hover:-translate-y-[20%]" 
                      alt={selectedSolution.title} 
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 relative">
                <div className="absolute -top-12 left-8 right-8 flex justify-between items-end">
                  <div className={`w-20 h-20 bg-gradient-to-br ${selectedSolution.color} rounded-2xl flex items-center justify-center shadow-2xl shadow-black/50 border-4 border-white`}>
                    <selectedSolution.icon className="w-10 h-10 text-white" />
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                    {isArabic ? selectedSolution.titleAr : selectedSolution.title}
                  </h2>
                </div>
                <p className="text-xl text-gray-700 leading-relaxed mb-10 font-light">
                  {isArabic ? selectedSolution.longDescriptionAr : selectedSolution.longDescription}
                </p>

                <h3 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-sm">
                  {isArabic ? 'المميزات الرئيسية' : 'Key Features'}
                </h3>
                
                <div className="grid sm:grid-cols-2 gap-4 mb-10">
                  {(isArabic ? selectedSolution.featuresAr : selectedSolution.features).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
                  <Link
                    to={`/login?demoEmail=${encodeURIComponent(selectedSolution.email)}&demoPassword=password123&autoLogin=true`}
                    state={{ email: selectedSolution.email, password: 'password123' }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-4 rounded-xl text-white font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 bg-gradient-to-r ${selectedSolution.color}`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{isArabic ? 'إطلاق النسخة التجريبية' : 'Launch Live Demo'}</span>
                  </Link>
                  <a
                    href="#contact"
                    onClick={() => setSelectedSolution(null)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-4 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold transition-colors"
                  >
                    <Headphones className="w-5 h-5" />
                    <span>{isArabic ? 'تواصل مع المبيعات' : 'Contact Sales'}</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {isArabic ? 'ماذا يقول عملاؤنا' : 'What Our Customers Say'}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  "{isArabic ? testimonial.contentAr : testimonial.content}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(isArabic ? testimonial.nameAr : testimonial.name).charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {isArabic ? testimonial.nameAr : testimonial.name}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {isArabic ? testimonial.roleAr : testimonial.role}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-700 font-medium text-sm mb-4 border border-emerald-200"
            >
              <Sparkles className="w-4 h-4" />
              {isArabic ? '\u0623\u0633\u0639\u0627\u0631 \u0645\u062E\u0635\u0635\u0629 \u0644\u0643\u0644 \u0646\u0634\u0627\u0637' : 'Pricing tailored to your business'}
            </motion.div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {isArabic ? '\u062E\u0637\u0637 \u0627\u0644\u0623\u0633\u0639\u0627\u0631' : 'Pricing Plans'}
            </h2>
            <p className="text-xl text-gray-600">
              {isArabic ? '\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0646\u0634\u0627\u0637\u0643 \u0644\u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629' : 'Select your business type to see tailored pricing'}
            </p>
          </div>

          {/* Business Type Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              onClick={() => setPricingBusinessType('default')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${pricingBusinessType === 'default' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isArabic ? '\u0627\u0644\u0643\u0644' : 'All Types'}
            </button>
            {getBusinessTypeOptions(language).map((bt) => (
              <button
                key={bt.id}
                onClick={() => setPricingBusinessType(bt.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${pricingBusinessType === bt.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {bt.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {currentPlans.map((plan, index) => {
              const name = isArabic ? (plan.nameAr || plan.nameEn || plan.name) : (plan.nameEn || plan.name || plan.nameAr)
              const features = isArabic ? (plan.featuresAr || plan.featuresEn || plan.features || []) : (plan.featuresEn || plan.features || plan.featuresAr || [])
              const monthly = Number(plan.priceMonthly || plan.price || 0)
              const yearly = Number(plan.priceYearly || 0)
              return (
              <motion.div
                key={plan.id || index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-3xl p-8 ${
                  plan.popular
                    ? 'border-2 border-primary-500 shadow-xl shadow-primary-500/20'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-full">
                    {isArabic ? '\u0627\u0644\u0623\u0643\u062B\u0631 \u0634\u064A\u0648\u0639\u0627\u064B' : 'Most Popular'}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {name}
                </h3>
                <div className="mb-6">
                  {monthly > 0 ? (
                    <>
                      <span className="text-4xl font-bold text-gray-900">SAR {monthly}</span>
                      <span className="text-gray-500">{isArabic ? '/\u0634\u0647\u0631' : '/month'}</span>
                      {yearly > 0 && (
                        <div className="mt-1 text-sm text-gray-400">
                          {isArabic ? `\u0633\u0646\u0648\u064A\u0627\u064B: SAR ${yearly}` : `Yearly: SAR ${yearly}`}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-4xl font-bold text-gray-900">{isArabic ? '\u0645\u062E\u0635\u0635' : 'Custom'}</span>
                  )}
                </div>
                <ul className="space-y-4 mb-8">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-xl font-semibold transition ${
                    plan.popular
                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isArabic ? '\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646' : 'Get Started'}
                </button>
              </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                {isArabic ? 'تواصل معنا' : 'Get in Touch'}
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                {isArabic
                  ? 'فريقنا جاهز لمساعدتك في البدء مع Maqder ERP'
                  : 'Our team is ready to help you get started with Maqder ERP'}
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{isArabic ? 'الهاتف / واتساب' : 'Phone / WhatsApp'}</p>
                    <a href="https://wa.me/966596775485" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gray-900 font-semibold hover:text-emerald-600 transition">
                      <span dir="ltr">+966 59 677 5485</span>
                      <MessageCircle className="w-4 h-4 text-emerald-500" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{isArabic ? 'البريد الإلكتروني' : 'Email'}</p>
                    <a href="mailto:support@maqder.com" className="text-gray-900 font-semibold hover:text-primary-600 transition">support@maqder.com</a>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{isArabic ? 'الموقع' : 'Location'}</p>
                    <p className="text-gray-900 font-semibold">{isArabic ? 'الدمام، حي مدينة العمال 18' : 'DAMMAM, Madinat Al Ummal Dist. 18'}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <form className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {isArabic ? 'الاسم' : 'Name'}
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                        placeholder={isArabic ? 'أدخل اسمك' : 'Enter your name'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {isArabic ? 'البريد الإلكتروني' : 'Email'}
                      </label>
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                        placeholder={isArabic ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isArabic ? 'الشركة' : 'Company'}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                      placeholder={isArabic ? 'اسم الشركة' : 'Company name'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isArabic ? 'الرسالة' : 'Message'}
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition resize-none"
                      placeholder={isArabic ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/30 hover:shadow-xl transition"
                  >
                    {isArabic ? 'إرسال الرسالة' : 'Send Message'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Desktop App Download Section */}
      <section className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-100/50 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl shadow-primary-900/5 border border-primary-100 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
            {/* Decorative background element */}
            <div className="absolute -right-24 -top-24 w-64 h-64 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
            
            <div className="flex-1 space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium border border-primary-100">
                <Sparkles className="w-4 h-4" />
                {isArabic ? 'جديد!' : 'New!'}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                {isArabic ? 'حمل تطبيق سطح المكتب من مقدر' : 'Download Maqder Desktop App'}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {isArabic 
                  ? 'يعمل التطبيق بالكامل بدون إنترنت لإصدار فواتير متوافقة مع متطلبات الزكاة والضريبة (المرحلة الأولى)، مع مزامنة تلقائية عند الاتصال بالإنترنت.' 
                  : 'Works completely offline for ZATCA Phase 1 compliant invoicing, with automatic background sync when you reconnect to the internet.'}
              </p>
              
              <ul className="space-y-3">
                {[
                  isArabic ? 'فواتير غير متصلة بالإنترنت بالكامل (المرحلة الأولى)' : 'Fully offline invoicing (Phase 1)',
                  isArabic ? 'مزامنة تلقائية مع السحابة' : 'Automatic cloud sync',
                  isArabic ? 'إنشاء رموز QR سريعة جداً' : 'Lightning fast QR generation',
                  isArabic ? 'طباعة مباشرة للفواتير الحرارية' : 'Direct thermal printing support'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-primary-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 flex items-center gap-4">
                <a 
                  href="https://maqder.com/downloads/MaqderDesktop-Setup.exe" 
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-all hover:-translate-y-0.5 shadow-lg shadow-gray-900/20"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801"/>
                  </svg>
                  {isArabic ? 'تحميل لنظام ويندوز' : 'Download for Windows'}
                </a>
                <div className="text-sm text-gray-500">
                  <p>v1.0.0 • Windows 10/11</p>
                  <p>{isArabic ? 'يتطلب 4 جيجابايت رام' : 'Requires 4GB RAM'}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 relative z-10 w-full">
              <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-xs text-gray-400 font-mono ml-2">Maqder Desktop</div>
                </div>
                <div className="p-1 bg-gray-900">
                  <img 
                    src="/images/pos-screenshot.webp" 
                    alt="Maqder Desktop Interface" 
                    className="rounded opacity-90 hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      // Fallback if image doesn't exist
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden h-64 items-center justify-center bg-gray-800 text-gray-400 text-sm">
                    {isArabic ? 'واجهة التطبيق' : 'App Interface'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              {isArabic ? 'ابدأ رحلتك مع Maqder ERP اليوم' : 'Start Your Journey with Maqder ERP Today'}
            </h2>
            <p className="text-xl text-primary-100 mb-8">
              {isArabic
                ? 'انضم إلى أكثر من 500 شركة سعودية تثق في Maqder ERP'
                : 'Join 500+ Saudi companies that trust Maqder ERP'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-700 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
              >
                {isArabic ? 'ابدأ مجاناً' : 'Start Free Trial'}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white rounded-2xl font-semibold text-lg hover:bg-white/20 transition border border-white/20"
              >
                <Headphones className="w-5 h-5" />
                {isArabic ? 'تحدث مع المبيعات' : 'Talk to Sales'}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-auto h-10 flex items-center justify-center">
                  <img src="/maqdernewlogo.webp" alt="Maqder" className="h-full w-auto object-contain" />
                </div>
              </div>
              <p className="text-gray-500 leading-relaxed">
                {isArabic
                  ? 'مزود خدمات الفوترة الإلكترونية ونظام ERP متكامل للشركات السعودية مع امتثال كامل لهيئة الزكاة والضريبة والجمارك'
                  : 'E-Invoicing Services Provider and complete ERP system for Saudi businesses with full ZATCA compliance'}
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{isArabic ? 'المنتج' : 'Product'}</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="hover:text-white transition">{isArabic ? 'المميزات' : 'Features'}</a></li>
                <li><a href="#modules" className="hover:text-white transition">{isArabic ? 'الوحدات' : 'Modules'}</a></li>
                <li><a href="#pricing" className="hover:text-white transition">{isArabic ? 'الأسعار' : 'Pricing'}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{isArabic ? 'الشركة' : 'Company'}</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition">{isArabic ? 'من نحن' : 'About Us'}</a></li>
                <li><a href="#contact" className="hover:text-white transition">{isArabic ? 'تواصل معنا' : 'Contact'}</a></li>
                <li><a href="#" className="hover:text-white transition">{isArabic ? 'الوظائف' : 'Careers'}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{isArabic ? 'قانوني' : 'Legal'}</h4>
              <ul className="space-y-3">
                <li><a href="/privacy" className="hover:text-white transition">{isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}</a></li>
                <li><a href="/terms" className="hover:text-white transition">{isArabic ? 'شروط الخدمة' : 'Terms of Service'}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              Â© 2024 Maqder ERP. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-gray-500 text-sm">
                {isArabic ? 'صنع بواسطة مؤسسة حلول القوى العاملة الشرقية' : 'Built by Eastern Workforce Solutions Establishment'}
              </p>
              <p className="text-gray-500 text-sm opacity-70">
                {isArabic ? 'Eastern Workforce Solutions Establishment' : 'مؤسسة حلول القوى العاملة الشرقية'}
              </p>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/966596775485" 
        target="_blank" 
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-500/30 hover:scale-110 hover:shadow-xl hover:shadow-emerald-500/40 transition-all flex items-center justify-center"
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle className="w-7 h-7" />
      </a>
    </div>
  )
}
