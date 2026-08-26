import { useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { usePageVisible } from '../hooks/usePageVisible'
import { 
  TrendingUp, 
  FileText, 
  Users, 
  Package, 
  AlertTriangle,
  Wallet,
  ShoppingCart,
  Truck,
  ClipboardList,
  Factory,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Receipt,
  Plane,
  BarChart3,
  Calendar,
  Star,
  Mail,
  Building2,
  Boxes,
  Percent,
  Layers,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Utensils,
  Car,
  Hammer,
  Dumbbell,
  Scissors,
  Shirt,
  ShoppingBag,
  Store,
  Pill,
  Wrench,
  BookOpen,
  MessageSquare,
  QrCode,
  CalendarDays
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { isAppAccessValid } from '../lib/appStoreTrial'

const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts'))

const DASHBOARD_REFRESH_MS = 60 * 1000 // 60s
const DASHBOARD_CHART_REFRESH_MS = 120 * 1000 // 2m

function useDashboardPollInterval(ms) {
  const pageVisible = usePageVisible()
  return pageVisible ? ms : false
}

export default function Dashboard() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const isAr = language === 'ar'
  const tenantCurrency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()
  const isSarCurrencyTenant = tenantCurrency === 'SAR'
  const isPkrCurrencyTenant = tenantCurrency === 'PKR'
  const isBdtCurrencyTenant = tenantCurrency === 'BDT'

  const businessTypes = getTenantBusinessTypes(tenant)
  const isTrading = businessTypes.includes('trading')
  const isRestaurant = businessTypes.includes('restaurant') || businessTypes.includes('food_beverage') || Boolean(tenant?.settings?.installedApps?.restaurant_cafe?.isInstalled || tenant?.settings?.installedApps?.restaurant?.isInstalled)
  const isCarRental = businessTypes.includes('car_rental') || Boolean(tenant?.settings?.installedApps?.car_rental?.isInstalled)
  const isTravel = businessTypes.includes('travel_agency') || Boolean(tenant?.settings?.installedApps?.travel_agency?.isInstalled)
  const isConstruction = businessTypes.includes('construction') || Boolean(tenant?.settings?.installedApps?.construction_projects?.isInstalled)
  const isMarquee = businessTypes.includes('marquee') || Boolean(tenant?.settings?.installedApps?.marquee_management?.isInstalled || tenant?.settings?.installedApps?.marquee?.isInstalled)
  const mrpApp = tenant?.settings?.installedApps?.manufacturing_mes
  const isMrpInstalled = Boolean(mrpApp?.isInstalled && mrpApp?.isEnabled !== false)

  const dashboardPollMs = useDashboardPollInterval(DASHBOARD_REFRESH_MS)
  const chartPollMs = useDashboardPollInterval(DASHBOARD_CHART_REFRESH_MS)

  // Fetch Dashboard Aggregated Data
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data),
    refetchInterval: dashboardPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
  })

  // Fetch Charts Data
  const { data: revenueData } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => api.get('/dashboard/charts/revenue').then(res => res.data),
    refetchInterval: chartPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
  })

  const { data: expensesData } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => api.get('/dashboard/charts/expenses').then(res => res.data),
    refetchInterval: chartPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
  })

  // Trading specific stats
  const { data: poStats } = useQuery({
    queryKey: ['dashboard-po-stats'],
    queryFn: () => api.get('/purchase-orders/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: shipmentStats } = useQuery({
    queryKey: ['dashboard-shipment-stats'],
    queryFn: () => api.get('/shipments/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: taskStats } = useQuery({
    queryKey: ['dashboard-task-stats'],
    queryFn: () => api.get('/tasks/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: mrpStats } = useQuery({
    queryKey: ['dashboard-mrp-stats'],
    queryFn: () => api.get('/mrp/stats?multiplier=2').then(res => res.data),
    refetchInterval: chartPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: isTrading && isMrpInstalled
  })

  const { data: mrpTop } = useQuery({
    queryKey: ['dashboard-mrp-top'],
    queryFn: () => api.get('/mrp/suggestions?limit=5&page=1&multiplier=2').then(res => res.data),
    refetchInterval: chartPollMs,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: isTrading && isMrpInstalled
  })

  // Vertical-specific Stats
  const { data: restaurantStats } = useQuery({
    queryKey: ['dashboard-restaurant-stats'],
    queryFn: () => api.get('/restaurant/orders/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isRestaurant
  })

  const { data: carRentalStats } = useQuery({
    queryKey: ['dashboard-car-rental-stats'],
    queryFn: () => api.get('/rental-contracts/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isCarRental
  })

  const { data: travelStats } = useQuery({
    queryKey: ['dashboard-travel-stats'],
    queryFn: () => api.get('/travel-bookings/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isTravel
  })

  const { data: projectStats } = useQuery({
    queryKey: ['dashboard-project-stats'],
    queryFn: () => api.get('/projects/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isConstruction
  })

  // Marquee Specific Stats & Appointments
  const { data: marqueeStats } = useQuery({
    queryKey: ['dashboard-marquee-stats'],
    queryFn: () => api.get('/marquee/stats').then(res => res.data),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isMarquee
  })

  const { data: marqueeAppointments = [] } = useQuery({
    queryKey: ['dashboard-marquee-appointments'],
    queryFn: () => api.get('/marquee/appointments').then(res => Array.isArray(res.data) ? res.data : []),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isMarquee
  })

  const { data: marqueePackages = [] } = useQuery({
    queryKey: ['dashboard-marquee-packages'],
    queryFn: () => api.get('/marquee/packages').then(res => Array.isArray(res.data) ? res.data : []),
    refetchInterval: dashboardPollMs,
    retry: false,
    enabled: isMarquee
  })

  const payrollPaidNet = (dashboard?.payroll?.stats || []).find((s) => s._id === 'paid')?.totalNet || 0
  const openPoCount = poStats?.totals?.[0]?.openCount || 0
  const inTransitShipments = shipmentStats?.totals?.[0]?.inTransit || 0
  const overdueTasks = taskStats?.overdue?.[0]?.count || 0
  const mrpSuggestions = mrpStats?.totals?.suggestions || 0

  // Top General Stats
  const stats = useMemo(() => [
    {
      label: t('totalRevenue'),
      value: dashboard?.invoices?.total?.revenue || 0,
      format: 'currency',
      icon: TrendingUp,
      color: 'from-primary-500 to-primary-600',
      change: '+12.5%',
      positive: true
    },
    {
      label: isAr ? 'إجمالي الخصومات' : 'Invoice Discounts',
      value: dashboard?.invoices?.total?.discount || 0,
      format: 'currency',
      icon: Percent,
      color: 'from-amber-500 to-amber-600',
      change: isAr ? 'على جميع الفواتير' : 'Across all invoices',
      positive: true
    },
    {
      label: isAr ? 'مصروفات الرواتب' : 'Payroll Expenses',
      value: payrollPaidNet,
      format: 'currency',
      icon: Wallet,
      color: 'from-rose-500 to-rose-600',
      change: isAr ? 'هذا الشهر' : 'This month',
      positive: true
    },
    {
      label: t('totalInvoices'),
      value: dashboard?.invoices?.total?.count || 0,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      change: '+8.2%',
      positive: true
    },
    {
      label: t('activeEmployees'),
      value: dashboard?.employees?.total || 0,
      icon: Users,
      color: 'from-violet-500 to-violet-600',
      change: '+2',
      positive: true
    },
    ...(isTrading
      ? [
          {
            label: t('lowStockItems'),
            value: dashboard?.products?.lowStock || 0,
            icon: Package,
            color: 'from-amber-500 to-amber-600',
            change: '-3',
            positive: false
          },
          {
            label: isAr ? 'طلبات شراء مفتوحة' : 'Open Purchase Orders',
            value: openPoCount,
            icon: ShoppingCart,
            color: 'from-emerald-500 to-emerald-600',
            change: isAr ? 'تحت المعالجة' : 'In process',
            positive: true
          },
          {
            label: isAr ? 'شحنات قيد التوصيل' : 'In-Transit Shipments',
            value: inTransitShipments,
            icon: Truck,
            color: 'from-indigo-500 to-indigo-600',
            change: isAr ? 'حي' : 'Live',
            positive: true
          },
          {
            label: isAr ? 'مهام متأخرة' : 'Overdue Tasks',
            value: overdueTasks,
            icon: ClipboardList,
            color: 'from-red-500 to-red-600',
            change: isAr ? 'يحتاج متابعة' : 'Needs attention',
            positive: false
          },
          ...(isMrpInstalled
            ? [{
                label: isAr ? 'توصيات MRP' : 'MRP Suggestions',
                value: mrpSuggestions,
                icon: Factory,
                color: 'from-secondary-500 to-secondary-600',
                change: isAr ? 'إعادة طلب' : 'Reorder',
                positive: true
              }]
            : []),
        ]
      : []),
    ...(isMarquee
      ? [
          {
            label: isAr ? 'حجوزات القاعات القادمة' : 'Upcoming Marquee Events',
            value: marqueeStats?.upcomingEvents || 0,
            icon: Calendar,
            color: 'from-emerald-500 to-teal-600',
            change: isAr ? `${marqueeStats?.monthBookings || 0} هذا الشهر` : `${marqueeStats?.monthBookings || 0} this month`,
            positive: true
          },
          {
            label: isAr ? 'إيرادات الحجوزات (الشهر)' : 'Banquet Revenue (Month)',
            value: marqueeStats?.monthRevenue || 0,
            format: 'currency',
            icon: Wallet,
            color: 'from-amber-500 to-emerald-600',
            change: isAr ? `مقدم: ${marqueeStats?.monthAdvanceReceived || 0}` : `Advance: ${marqueeStats?.monthAdvanceReceived || 0}`,
            positive: true
          },
          {
            label: isAr ? 'باقات المناسبات النشطة' : 'Active Event Packages',
            value: marqueeStats?.activePackages || marqueePackages.length || 0,
            icon: Boxes,
            color: 'from-purple-500 to-indigo-600',
            change: isAr ? 'باقات جاهزة' : 'Ready Menu',
            positive: true
          },
          {
            label: isAr ? 'إجمالي الضيوف المتوقعين' : 'Month Event Guests',
            value: marqueeStats?.monthTotalGuests || 0,
            icon: Users,
            color: 'from-sky-500 to-blue-600',
            change: isAr ? 'سعة مناسبات' : 'Capacity',
            positive: true
          },
        ]
      : []),
    ...(isRestaurant
      ? [
          {
            label: isAr ? 'طلبات المطعم (اليوم)' : 'Restaurant Orders (Today)',
            value: restaurantStats?.totals?.[0]?.total || 0,
            icon: Utensils,
            color: 'from-orange-500 to-orange-600',
            change: isAr ? 'مفتوح' : 'Open: ' + (restaurantStats?.totals?.[0]?.open || 0),
            positive: true
          },
          {
            label: isAr ? 'مبيعات المطعم (اليوم)' : 'Restaurant Revenue',
            value: restaurantStats?.totals?.[0]?.revenue || 0,
            format: 'currency',
            icon: Receipt,
            color: 'from-amber-500 to-orange-600',
            change: isAr ? 'صافي' : 'Net',
            positive: true
          },
        ]
      : []),
    ...(isCarRental
      ? [
          {
            label: isAr ? 'عقود التأجير النشطة' : 'Active Car Leases',
            value: carRentalStats?.statusAgg?.find(s => s._id === 'OPEN')?.count || 0,
            icon: Car,
            color: 'from-blue-500 to-blue-600',
            change: isAr ? 'متأخر: ' : 'Overdue: ' + (carRentalStats?.overdueCount || 0),
            positive: (carRentalStats?.overdueCount || 0) === 0
          },
          {
            label: isAr ? 'مبيعات التأجير (الشهر)' : 'Rental Revenue (Month)',
            value: carRentalStats?.revenueMonth?.[0]?.total || 0,
            format: 'currency',
            icon: Wallet,
            color: 'from-cyan-500 to-blue-600',
            change: isAr ? 'إغلاق' : 'Closed',
            positive: true
          },
        ]
      : []),
    ...(isTravel
      ? [
          {
            label: isAr ? 'حجوزات السفر המفتوحة' : 'Open Travel Bookings',
            value: travelStats?.totals?.[0]?.open || 0,
            icon: Plane,
            color: 'from-sky-500 to-indigo-600',
            change: isAr ? 'مجموع' : 'Total: ' + (travelStats?.totals?.[0]?.total || 0),
            positive: true
          },
        ]
      : []),
    ...(isConstruction
      ? [
          {
            label: isAr ? 'المشاريع النشطة' : 'Active Projects',
            value: projectStats?.totals?.[0]?.active || 0,
            icon: Hammer,
            color: 'from-emerald-500 to-teal-600',
            change: isAr ? 'مجموع' : 'Total: ' + (projectStats?.totals?.[0]?.total || 0),
            positive: true
          },
        ]
      : []),
  ], [dashboard, payrollPaidNet, openPoCount, inTransitShipments, overdueTasks, mrpSuggestions, isTrading, isMrpInstalled, isMarquee, marqueeStats, marqueePackages, isRestaurant, restaurantStats, isCarRental, carRentalStats, isTravel, travelStats, isConstruction, projectStats, isAr, t])

  const installedAppsList = useMemo(() => {
    const apps = tenant?.settings?.installedApps || {}
    const list = []

    const addIf = (condition, item) => {
      if (condition && !list.some(x => x.id === item.id)) {
        list.push(item)
      }
    }

    addIf(
      isMarquee,
      {
        id: 'marquee_management',
        nameEn: 'Marquee & Events',
        nameAr: 'قاعات ومناسبات',
        descEn: 'Banquet & packages',
        descAr: 'باقات وحجوزات القاعات',
        route: '/app/dashboard/marquee/packages',
        icon: Boxes,
      }
    )

    addIf(
      isRestaurant,
      {
        id: 'restaurant_cafe',
        nameEn: 'Restaurant & POS',
        nameAr: 'المطاعم والمقاهي',
        descEn: 'Orders & kitchen POS',
        descAr: 'الطلبات والمطبخ',
        route: '/app/dashboard/restaurant',
        icon: Utensils,
      }
    )

    addIf(
      isPkrCurrencyTenant || isAppAccessValid(apps.pakistan_fbr_einvoicing),
      {
        id: 'pakistan_fbr_einvoicing',
        nameEn: 'FBR Digital Invoicing',
        nameAr: 'بوابة FBR للفوترة',
        descEn: 'Pakistan FBR Compliance',
        descAr: 'الامتثال الضريبي الرقمي',
        route: '/app/dashboard/tenant-settings/fbr-dashboard',
        icon: ShieldCheck,
      }
    )

    addIf(
      isBdtCurrencyTenant || isAppAccessValid(apps.bangladesh_nbr_einvoicing),
      {
        id: 'bangladesh_nbr_einvoicing',
        nameEn: 'NBR / Mushak Portal',
        nameAr: 'بوابة NBR / Mushak',
        descEn: 'Bangladesh NBR Compliance',
        descAr: 'الامتثال الضريبي لبنغلاديش',
        route: '/app/dashboard/tenant-settings/nbr-dashboard',
        icon: ShieldCheck,
      }
    )

    addIf(
      isSarCurrencyTenant && isAppAccessValid(apps.zatca_phase2_pro),
      {
        id: 'zatca_phase2_pro',
        nameEn: 'ZATCA Portal',
        nameAr: 'بوابة زاتكا',
        descEn: 'Saudi Phase 2 E-Invoicing',
        descAr: 'المرحلة الثانية للفوترة',
        route: '/app/dashboard/tenant-settings/government-integrations/zatca',
        icon: ShieldCheck,
      }
    )

    addIf(
      ['AED', 'OMR', 'BHD', 'KWD', 'QAR'].includes(tenantCurrency) ||
      isAppAccessValid(apps.uae_fta_compliance) ||
      isAppAccessValid(apps.oman_ota_compliance) ||
      isAppAccessValid(apps.bahrain_nbr_compliance) ||
      isAppAccessValid(apps.kuwait_mof_compliance) ||
      isAppAccessValid(apps.qatar_dhareeba_compliance),
      {
        id: 'gcc_tax_compliance',
        nameEn: tenantCurrency === 'AED' ? 'UAE FTA Compliance' : (tenantCurrency === 'OMR' ? 'Oman OTA Compliance' : (tenantCurrency === 'BHD' ? 'Bahrain NBR Compliance' : (tenantCurrency === 'KWD' ? 'Kuwait MOF Compliance' : (tenantCurrency === 'QAR' ? 'Qatar GTA Dhareeba' : 'GCC Compliance')))),
        nameAr: tenantCurrency === 'AED' ? 'الامتثال الضريبي الإماراتي (FTA)' : (tenantCurrency === 'OMR' ? 'الامتثال الضريبي العماني (OTA)' : (tenantCurrency === 'BHD' ? 'الامتثال الضريبي البحريني (NBR)' : (tenantCurrency === 'KWD' ? 'الامتثال الضريبي الكويتي (MOF)' : (tenantCurrency === 'QAR' ? 'الامتثال الضريبي القطري (ضريبة)' : 'الامتثال الضريبي الخليجي')))),
        descEn: `${tenantCurrency || 'GCC'} Tax & E-Invoicing`,
        descAr: 'الفوترة والامتثال الضريبي',
        route: '/app/dashboard/tenant-settings/government-integrations',
        icon: ShieldCheck,
      }
    )

    addIf(
      businessTypes.includes('gym') || isAppAccessValid(apps.gym_fitness_club),
      {
        id: 'gym_fitness_club',
        nameEn: 'Gym & Fitness',
        nameAr: 'النادي الرياضي',
        descEn: 'Memberships & check-in',
        descAr: 'الاشتراكات والدخول الذكي',
        route: '/app/dashboard/gym/dashboard',
        icon: Dumbbell,
      }
    )

    addIf(
      isMrpInstalled || businessTypes.includes('manufacturing') || isAppAccessValid(apps.manufacturing_mes),
      {
        id: 'manufacturing_mes',
        nameEn: 'Manufacturing & MES',
        nameAr: 'التصنيع والإنتاج',
        descEn: 'BOM, MRP II & shop floor',
        descAr: 'شجرة المواد وتخطيط الإنتاج',
        route: '/app/dashboard/manufacturing',
        icon: Factory,
      }
    )

    addIf(
      isConstruction || isAppAccessValid(apps.construction_projects) || isAppAccessValid(apps.projects),
      {
        id: 'construction_projects',
        nameEn: 'Projects & Contracts',
        nameAr: 'المشاريع والمقاولات',
        descEn: 'Project management',
        descAr: 'إدارة وتكاليف المشاريع',
        route: '/app/dashboard/projects',
        icon: Hammer,
      }
    )

    addIf(
      isTravel || isAppAccessValid(apps.travel_agency),
      {
        id: 'travel_agency',
        nameEn: 'Travel Agency',
        nameAr: 'وكالة السفر',
        descEn: 'Bookings & itineraries',
        descAr: 'حجوزات التذاكر والرحلات',
        route: '/app/dashboard/travel',
        icon: Plane,
      }
    )

    addIf(
      isCarRental || isAppAccessValid(apps.car_rental),
      {
        id: 'car_rental',
        nameEn: 'Car Rental',
        nameAr: 'تأجير السيارات',
        descEn: 'Fleet & contracts',
        descAr: 'إدارة الأسطول والعقود',
        route: '/app/dashboard/rental',
        icon: Car,
      }
    )

    addIf(
      businessTypes.includes('laundry') || isAppAccessValid(apps.laundry_cleaning),
      {
        id: 'laundry_cleaning',
        nameEn: 'Laundry & Cleaning',
        nameAr: 'المغاسل والتنظيف',
        descEn: 'Laundry POS',
        descAr: 'نقاط بيع وتسليم الملابس',
        route: '/app/dashboard/laundry',
        icon: Shirt,
      }
    )

    addIf(
      businessTypes.includes('saloon') || isAppAccessValid(apps.saloon_barber),
      {
        id: 'saloon_barber',
        nameEn: 'Saloon & Spa',
        nameAr: 'الصالون والسبا',
        descEn: 'Saloon & barber POS',
        descAr: 'المواعيد وخدمات الصالون',
        route: '/app/dashboard/saloon',
        icon: Scissors,
      }
    )

    addIf(
      businessTypes.includes('khayyat') || isAppAccessValid(apps.tailor_khayyat),
      {
        id: 'tailor_khayyat',
        nameEn: 'Tailor & Atelier',
        nameAr: 'الخياط والمشغل',
        descEn: 'Measurements & tailoring',
        descAr: 'المقاسات وتفصيل الأقمشة',
        route: '/app/dashboard/khayyat',
        icon: Scissors,
      }
    )

    addIf(
      businessTypes.includes('boutique') || isAppAccessValid(apps.boutique_rental),
      {
        id: 'boutique_rental',
        nameEn: 'Boutique & Rental',
        nameAr: 'البوتيك وتأجير الفساتين',
        descEn: 'Dress bookings',
        descAr: 'حجوزات وتأجير الفساتين',
        route: '/app/dashboard/boutique',
        icon: ShoppingBag,
      }
    )

    addIf(
      businessTypes.includes('bakala') || isAppAccessValid(apps.bakala_supermarket),
      {
        id: 'bakala_supermarket',
        nameEn: 'Bakala & Supermarket',
        nameAr: 'البقالة والسوبرماركت',
        descEn: 'Barcode scanning POS',
        descAr: 'نقطة بيع سريعة مع الباركود',
        route: '/app/dashboard/bakala',
        icon: Store,
      }
    )

    addIf(
      businessTypes.includes('pharmacy') || isAppAccessValid(apps.pharmacy),
      {
        id: 'pharmacy',
        nameEn: 'Pharmacy POS',
        nameAr: 'الصيدلية والأدوية',
        descEn: 'Prescriptions & expiry logs',
        descAr: 'الوصفات وتواريخ الصلاحية',
        route: '/app/dashboard/pharmacy',
        icon: Pill,
      }
    )

    addIf(
      businessTypes.includes('car_workshop') || isAppAccessValid(apps.car_workshop),
      {
        id: 'car_workshop',
        nameEn: 'Car Workshop',
        nameAr: 'مركز صيانة السيارات',
        descEn: 'Job cards & repair quotes',
        descAr: 'بطاقات الإصلاح والتقديرات',
        route: '/app/dashboard/workshop',
        icon: Wrench,
      }
    )

    addIf(
      businessTypes.includes('bookstore') || isAppAccessValid(apps.bookstore_stationery),
      {
        id: 'bookstore_stationery',
        nameEn: 'Bookstore & POS',
        nameAr: 'المكتبة والقرطاسية',
        descEn: 'Books & stationery POS',
        descAr: 'الكتب والقرطاسية والباركود',
        route: '/app/dashboard/bookstore',
        icon: BookOpen,
      }
    )

    addIf(
      isAppAccessValid(apps.whatsapp_cloud_auto),
      {
        id: 'whatsapp_cloud_auto',
        nameEn: 'WhatsApp Cloud',
        nameAr: 'واتساب السحابي',
        descEn: 'Automated invoice notifications',
        descAr: 'إرسال الفواتير والإشعارات',
        route: '/app/dashboard/communicate/whatsapp',
        icon: MessageSquare,
      }
    )

    addIf(
      isAppAccessValid(apps.crm_sales_pipeline),
      {
        id: 'crm_sales_pipeline',
        nameEn: 'CRM & Pipeline',
        nameAr: 'إدارة العملاء CRM',
        descEn: 'Leads & pipeline',
        descAr: 'متابعة الصفقات والعملاء',
        route: '/app/dashboard/crm',
        icon: TrendingUp,
      }
    )

    return list
  }, [tenant, businessTypes, isMarquee, isRestaurant, isPkrCurrencyTenant, isBdtCurrencyTenant, isSarCurrencyTenant, isMrpInstalled, isConstruction, isTravel, isCarRental])

  const zatcaStatusData = dashboard?.invoices?.zatcaStatus?.map(s => ({
    name: s._id || 'Pending',
    value: s.count
  })) || []

  const trendData = useMemo(() => {
    const byKey = new Map()

    ;(revenueData || []).forEach((r) => {
      const key = `${r._id?.year}-${r._id?.month}`
      byKey.set(key, { ...byKey.get(key), year: r._id?.year, month: r._id?.month, revenue: r.revenue || 0, tax: r.tax || 0 })
    })

    ;(expensesData || []).forEach((e) => {
      const key = `${e._id?.year}-${e._id?.month}`
      byKey.set(key, { ...byKey.get(key), year: e._id?.year, month: e._id?.month, expenses: (e.salaries || 0) + (e.gosi || 0) + (e.other || 0) })
    })

    const items = Array.from(byKey.values())
      .filter((x) => x.year && x.month)
      .sort((a, b) => (a.year - b.year) || (a.month - b.month))
      .slice(-12)

    return items.map((x) => {
      const label = new Date(x.year, x.month - 1, 1).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
        month: 'short'
      })
      return { ...x, label }
    })
  }, [expensesData, revenueData, isAr])

  const invoiceStatusData = (dashboard?.invoices?.byStatus || []).map((s) => ({
    name: s._id || 'unknown',
    value: s.count || 0
  }))

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-dark-700 rounded-xl w-1/4" />
        <div className="h-36 bg-gray-200 dark:bg-dark-700 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-6 h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Header & App Store Shortcut */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {tenant?.isDemo && !tenant?.demoUpgraded
                ? (isAr
                    ? `مرحباً بك في ${tenant?.business?.legalNameAr || tenant?.name || 'مساحتك'}`
                    : `Welcome to ${tenant?.business?.legalNameEn || tenant?.name || 'your workspace'}`)
                : t('dashboard')}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {tenant?.isDemo && !tenant?.demoUpgraded
              ? (isAr
                  ? 'مساحتك المباشرة جاهزة — الفوترة والعملاء والتقارير في مركز قيادة واحد'
                  : 'Your live workspace is ready — invoicing, customers, and reports in one command center')
              : (isAr
                  ? 'مرحباً بعودتك! مركز القيادة الموحد لجميع مساحات العمل والتطبيقات التشغيلية'
                  : 'Welcome back! Unified command center for all business verticals and operational apps')}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl shadow-md shadow-primary-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'فاتورة جديدة' : 'New Invoice'}</span>
          </Link>

          <Link
            to="/app/dashboard/app-store"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-xl border border-gray-200/80 dark:border-dark-700 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{isAr ? 'متجر التطبيقات' : 'App Store'}</span>
          </Link>
        </div>
      </div>

      {/* Main dashboard content */}
      <AnimatePresence mode="wait">
        <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Today's Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 bg-gradient-to-r from-[#143120] via-[#1b432c] to-[#26593b] text-white shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-inner">
                    <Calendar className="w-7 h-7 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-emerald-200/80 text-xs font-semibold uppercase tracking-wider">
                      {isAr ? 'ملخص العمليات الفورية' : "Today's Live Summary"}
                    </p>
                    <p className="text-lg font-bold text-white mt-0.5">
                      {new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8">
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'فواتير اليوم' : "Today's Invoices"}</p>
                    <p className="text-2xl font-black mt-0.5">{dashboard?.todayStats?.count || 0}</p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'إيرادات اليوم' : "Today's Revenue"}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.todayStats?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'إيرادات الشهر' : 'Monthly Revenue'}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.invoices?.thisMonth?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'قيمة المخزون' : 'Inventory Value'}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.products?.totalValue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Master Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="stat-card xl:col-span-2"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-md text-white`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-bold ${
                      stat.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {stat.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {stat.format === 'currency' ? <Money value={stat.value} minimumFractionDigits={0} maximumFractionDigits={0} /> : stat.value.toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </div>

            <Suspense fallback={<div className="h-80 card animate-pulse" />}>
              <DashboardCharts
                trendData={trendData}
                zatcaStatusData={zatcaStatusData}
                isSarCurrencyTenant={isSarCurrencyTenant}
                isAr={isAr}
                zatcaStatusLabel={t('zatcaStatus')}
              />
            </Suspense>

            {/* Marquee & Banquet Management Operations Hub */}
            {isMarquee && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-amber-500/20 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0c111a] space-y-5"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {isAr ? 'إدارة قاعات الأفراح والمناسبات' : 'Marquee & Banquet Management'}
                        </h3>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          {marqueeAppointments.length} {isAr ? 'حجز مسجل' : 'Bookings'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {isAr ? 'متابعة حجوزات القاعات، باقات الأطعمة، وقوائم الطاولات الرقمية' : 'Live overview of hall appointments, per-head packages & digital QR menu'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/app/dashboard/marquee/packages"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 transition"
                    >
                      <Boxes className="h-3.5 w-3.5 text-amber-600" />
                      <span>{isAr ? 'الباقات' : 'Packages'}</span>
                    </Link>
                    <Link
                      to="/app/dashboard/marquee/appointments"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 transition"
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{isAr ? 'الحجوزات والتقويم' : 'Bookings & Calendar'}</span>
                    </Link>
                    <Link
                      to="/app/dashboard/marquee/qr-menu"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 transition"
                    >
                      <QrCode className="h-3.5 w-3.5 text-blue-600" />
                      <span>{isAr ? 'قائمة QR' : 'Table QR Menu'}</span>
                    </Link>
                  </div>
                </div>

                {/* Bookings & Packages Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Upcoming Bookings Table (7 cols) */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isAr ? 'أحدث حجوزات المناسبات' : 'Upcoming Event Bookings'}
                      </h4>
                      <Link to="/app/dashboard/marquee/appointments" className="text-[11px] font-bold text-emerald-600 hover:underline">
                        {isAr ? 'عرض الكل' : 'View All'} →
                      </Link>
                    </div>

                    {marqueeAppointments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-white/10">
                        <Calendar className="mx-auto h-8 w-8 opacity-40 mb-2" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">{isAr ? 'لا توجد حجوزات مناسبات مسجلة بعد' : 'No Marquee Bookings Scheduled'}</p>
                        <Link to="/app/dashboard/marquee/appointments" className="mt-2 inline-block font-bold text-emerald-600">
                          {isAr ? '+ حجز قاعة جديد' : '+ Book First Event'}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {marqueeAppointments.slice(0, 4).map((b) => (
                          <div key={b._id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-dark-800/60 transition hover:border-slate-300">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-black text-xs dark:bg-amber-500/10 dark:text-amber-300">
                                {b.hallName ? b.hallName.charAt(0).toUpperCase() : 'H'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-xs text-slate-900 dark:text-white">{b.title || b.clientName}</p>
                                  <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                    {b.hallName || 'Main Hall'}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {new Date(b.eventDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')} • {b.eventShift || 'Evening'} • {b.guestCount || 0} {isAr ? 'ضيف' : 'guests'}
                                </p>
                              </div>
                            </div>

                            <div className="text-end">
                              <p className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                <Money value={b.totalAmount || 0} />
                              </p>
                              <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                b.status === 'advance_paid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              }`}>
                                {b.status || 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Packages Showcase (5 cols) */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isAr ? 'باقات المناسبات الجاهزة' : 'Available Banquet Packages'}
                      </h4>
                      <Link to="/app/dashboard/marquee/packages" className="text-[11px] font-bold text-amber-600 hover:underline">
                        {isAr ? 'إدارة الباقات' : 'Manage'} →
                      </Link>
                    </div>

                    {marqueePackages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-white/10">
                        <Boxes className="mx-auto h-8 w-8 opacity-40 mb-2" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">{isAr ? 'لم يتم إنشاء أي باقة بعد' : 'No Packages Created'}</p>
                        <Link to="/app/dashboard/marquee/packages" className="mt-2 inline-block font-bold text-amber-600">
                          {isAr ? '+ إنشاء باقة جديدة' : '+ Create Package'}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {marqueePackages.slice(0, 3).map((pkg) => (
                          <div key={pkg._id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-dark-800/60">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                                <Sparkles className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? pkg.nameAr || pkg.name : pkg.name}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{pkg.category} • {pkg.items?.length || 0} items</p>
                              </div>
                            </div>
                            <div className="text-end">
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                <Money value={pkg.ratePerHead} />
                              </span>
                              <p className="text-[9px] text-slate-400">/ {isAr ? 'شخص' : 'head'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bottom Row: Recent Invoices & Expiring Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices with ZATCA Pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {t('recentInvoices')}
                  </h3>
                  <Link to="/invoices" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.recentInvoices || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      {isAr ? 'لا توجد فواتير بعد' : 'No invoices yet'}
                    </div>
                  ) : (
                    dashboard?.recentInvoices?.map((invoice) => (
                      <div key={invoice._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {isSarCurrencyTenant ? (
                            <div className={`p-2 rounded-xl ${
                              invoice.zatca?.submissionStatus === 'cleared' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                              invoice.zatca?.submissionStatus === 'reported' ? 'bg-blue-100 dark:bg-blue-900/30' :
                              invoice.zatca?.submissionStatus === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                              'bg-amber-100 dark:bg-amber-900/30'
                            }`}>
                              {invoice.zatca?.submissionStatus === 'cleared' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                               invoice.zatca?.submissionStatus === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> :
                               <Clock className="w-4 h-4 text-amber-600" />}
                            </div>
                          ) : (
                            <div className={`p-2 rounded-xl ${
                              invoice.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                              invoice.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                              'bg-amber-100 dark:bg-amber-900/30'
                            }`}>
                              {invoice.status === 'approved' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                               invoice.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> :
                               <Clock className="w-4 h-4 text-amber-600" />}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{invoice.buyer?.name || (isAr ? 'عميل نقدي' : 'Cash Customer')}</p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            <Money value={invoice.grandTotal} minimumFractionDigits={0} maximumFractionDigits={0} />
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(invoice.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Expiring Government Documents & Iqamas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {t('expiringDocuments')}
                    </h3>
                    <span className="badge badge-warning text-[10px]">
                      <AlertTriangle className="w-3 h-3 me-1" />
                      {dashboard?.expiringDocuments?.length || 0}
                    </span>
                  </div>
                  {isSarCurrencyTenant && (
                    <Link to="/app/dashboard/tenant-settings/government-integrations" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                      {isAr ? 'بوابة الامتثال' : 'Gov Portal'}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {dashboard?.expiringDocuments?.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                      {isAr ? 'جميع الوثائق والإقامات سارية ومتوافقة' : 'All documents and Iqamas are valid & compliant'}
                    </div>
                  ) : (
                    dashboard?.expiringDocuments?.map((doc) => (
                      <div key={doc._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{doc.fullName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{doc.documentType}</p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-bold text-red-600">
                            {new Date(doc.expiryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* Customers & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Customers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAr ? 'أحدث العملاء' : 'Recent Customers'}
                  </h3>
                  <Link to="/customers" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.recentCustomers || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>{isAr ? 'لا يوجد عملاء بعد' : 'No customers yet'}</p>
                      <Link to="/customers/new" className="text-primary-600 text-xs font-bold mt-2 inline-block">
                        {isAr ? '+ إضافة أول عميل' : '+ Add first customer'}
                      </Link>
                    </div>
                  ) : (
                    (dashboard?.recentCustomers || []).map((customer) => (
                      <div key={customer._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            customer.type === 'business' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
                          }`}>
                            {customer.type === 'business' ? 
                              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /> :
                              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                            }
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {isAr ? customer.nameAr || customer.name : customer.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <span className={`badge ${customer.type === 'business' ? 'badge-primary' : 'badge-success'}`}>
                            {customer.type === 'business' ? (isAr ? 'شركة' : 'Business') : (isAr ? 'فرد' : 'Individual')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Top Selling Products */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAr ? 'أفضل المنتجات مبيعاً' : 'Top Selling Products'}
                  </h3>
                  <Link to="/app/dashboard/inventory/products" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.topProducts || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>{isAr ? 'لا توجد مبيعات منتجات بعد' : 'No product sales yet'}</p>
                    </div>
                  ) : (
                    (dashboard?.topProducts || []).map((product, index) => (
                      <div key={product._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                            index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {index === 0 ? <Star className="w-4 h-4" /> : index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {isAr ? product.nameAr || product.name : product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {isAr ? 'الكمية المباعة' : 'Qty Sold'}: {product.totalQty}
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            <Money value={product.totalRevenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* Trading Supply Chain Cards (PO, Shipments, MRP) */}
            {isTrading && (
              <div className={`grid grid-cols-1 gap-6 ${isMrpInstalled ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'أحدث طلبات الشراء' : 'Recent Purchase Orders'}
                    </h3>
                    <Link to="/app/dashboard/purchases/orders" className="text-xs text-primary-600 font-bold">
                      {isAr ? 'الكل' : 'All'}
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(poStats?.recent || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد بيانات' : 'No data'}
                      </div>
                    ) : (
                      (poStats?.recent || []).map((po) => (
                        <div key={po._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">{po.poNumber}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{po.status}</p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              <Money value={po.grandTotal || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'أحدث الشحنات' : 'Recent Shipments'}
                    </h3>
                    <Link to="/app/dashboard/shipments" className="text-xs text-primary-600 font-bold">
                      {isAr ? 'الكل' : 'All'}
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(shipmentStats?.recent || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد بيانات' : 'No data'}
                      </div>
                    ) : (
                      (shipmentStats?.recent || []).map((s) => (
                        <div key={s._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">{s.shipmentNumber}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{s.status} • {s.type}</p>
                          </div>
                          <div className="text-end">
                            <p className="text-[10px] text-gray-400">
                              {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                {isMrpInstalled ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'توصيات MRP' : 'MRP Suggestions'}
                    </h3>
                    <span className="badge badge-neutral text-xs">{mrpSuggestions}</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(mrpTop?.suggestions || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد توصيات حالياً' : 'No suggestions right now'}
                      </div>
                    ) : (
                      (mrpTop?.suggestions || []).map((row) => (
                        <div key={row.productId} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              {isAr ? row.nameAr || row.nameEn : row.nameEn || row.nameAr}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {row.sku} • {isAr ? 'الكمية' : 'Qty'}: {Math.round(row.recommendedQty || 0)}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              <Money value={row.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
                ) : null}
              </div>
            )}
          </motion.div>
      </AnimatePresence>
    </div>
  )
}
