import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { getMe, setTenantInactive, forceLogout } from './store/slices/authSlice'
import { setLanguage, setTheme, setDisplayMode, loadThemeForTenant, loadHiddenMenuItemsForTenant, loadDisplayModeForTenant, loadNavigationStyleForTenant } from './store/slices/uiSlice'
import { applyTenantBranding } from './lib/branding'
import { getTenantBusinessTypes } from './lib/businessTypes'
import { ErrorBoundary } from './lib/errorBoundary'
import { initSocket, disconnectSocket } from './lib/socket'

import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/invoices/Invoices'
import InvoiceCreate from './pages/invoices/InvoiceCreate'
import InvoiceCreateSellPage from './pages/invoices/InvoiceCreateSellPage'
import InvoiceCreatePurchasePage from './pages/invoices/InvoiceCreatePurchasePage'
import InvoiceEditPage from './pages/invoices/InvoiceEditPage'
import InvoiceView from './pages/invoices/InvoiceView'
import Quotations from './pages/quotations/Quotations'
import QuotationCreatePage from './pages/quotations/QuotationCreatePage'
import QuotationEditPage from './pages/quotations/QuotationEditPage'
import QuotationView from './pages/quotations/QuotationView'

// Lazy-load other layouts for code-splitting
const SuperAdminLayout = lazy(() => import('./layouts/SuperAdminLayout'))
const ResellerLayout = lazy(() => import('./layouts/ResellerLayout'))
const MarketingLayout = lazy(() => import('./layouts/MarketingLayout'))
const CarRentalLayout = lazy(() => import('./layouts/CarRentalLayout'))
const WorkshopLayout = lazy(() => import('./layouts/WorkshopLayout'))
const LaundryLayout = lazy(() => import('./layouts/LaundryLayout'))
const SaloonLayout = lazy(() => import('./layouts/SaloonLayout'))

// Auth pages (lazy — only needed at login)
const Login = lazy(() => import('./pages/auth/Login'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const InactiveTenant = lazy(() => import('./pages/auth/InactiveTenant'))

// Storefront shell (lazy — encapsulates layout + all providers)
const StorefrontShell = lazy(() => import('./components/storefront/StorefrontShell'))

// Lazy-load marketing pages (separate from app, only needed on public site)
const MarketingHome = lazy(() => import('./pages/marketing/Home'))
const MarketingSolutions = lazy(() => import('./pages/marketing/Solutions'))
const SolutionDetail = lazy(() => import('./pages/marketing/SolutionDetail'))
const MarketingPricing = lazy(() => import('./pages/marketing/Pricing'))
const MarketingAbout = lazy(() => import('./pages/marketing/About'))
const MarketingContact = lazy(() => import('./pages/marketing/Contact'))
const MarketingPrivacy = lazy(() => import('./pages/marketing/Privacy'))
const MarketingTerms = lazy(() => import('./pages/marketing/Terms'))

// Lazy-load all admin/dashboard pages for code-splitting
const KhayyatDashboard = lazy(() => import('./pages/khayyat/Dashboard'))
const KhayyatWorkers = lazy(() => import('./pages/khayyat/Workers'))
const KhayyatWorkerForm = lazy(() => import('./pages/khayyat/WorkerForm'))
const KhayyatWorkerAmounts = lazy(() => import('./pages/khayyat/WorkerAmounts'))
const KhayyatStitchings = lazy(() => import('./pages/khayyat/Stitchings'))
const KhayyatStitchingForm = lazy(() => import('./pages/khayyat/StitchingForm'))
const KhayyatEmbroideryDesigns = lazy(() => import('./pages/khayyat/EmbroideryDesigns'))
const KhayyatFabrics = lazy(() => import('./pages/khayyat/Fabrics'))
const KhayyatLaundry = lazy(() => import('./pages/khayyat/Laundry'))
const KhayyatLoyalty = lazy(() => import('./pages/khayyat/Loyalty'))
const KhayyatQuickInvoice = lazy(() => import('./pages/khayyat/QuickInvoice'))
const KhayyatCompleteOrder = lazy(() => import('./pages/khayyat/CompleteOrder'))
const KhayyatMeasurements = lazy(() => import('./pages/khayyat/KhayyatMeasurements'))
const KhayyatCustomizations = lazy(() => import('./pages/khayyat/KhayyatCustomizations'))
const InvoiceCreateSell = InvoiceCreateSellPage
const InvoiceCreatePurchase = InvoiceCreatePurchasePage
const Employees = lazy(() => import('./pages/hr/Employees'))
const EmployeeForm = lazy(() => import('./pages/hr/EmployeeForm'))
const Payroll = lazy(() => import('./pages/hr/Payroll'))
const PayrollCalculators = lazy(() => import('./pages/hr/PayrollCalculators'))
const HRCompliance = lazy(() => import('./pages/hr/HRCompliance'))
const Attendance = lazy(() => import('./pages/hr/Attendance'))
const Hiring = lazy(() => import('./pages/hr/Hiring'))
const Leaves = lazy(() => import('./pages/hr/Leaves'))
const Performance = lazy(() => import('./pages/hr/Performance'))
const HRReports = lazy(() => import('./pages/hr/HRReports'))
const ExpenseClaims = lazy(() => import('./pages/hr/ExpenseClaims'))
const Products = lazy(() => import('./pages/inventory/Products'))
const ProductForm = lazy(() => import('./pages/inventory/ProductForm'))
const Warehouses = lazy(() => import('./pages/inventory/Warehouses'))
const WarehouseForm = lazy(() => import('./pages/inventory/WarehouseForm'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const HiddenNavbars = lazy(() => import('./pages/HiddenNavbars'))
const Reports = lazy(() => import('./pages/Reports'))
const VatReturns = lazy(() => import('./pages/VatReturns'))
const Vouchers = lazy(() => import('./pages/finance/Vouchers'))
const Finance = lazy(() => import('./pages/Finance'))
const Backup = lazy(() => import('./pages/Backup'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const SupplierForm = lazy(() => import('./pages/SupplierForm'))
const SupplierPerformance = lazy(() => import('./pages/trading/SupplierPerformance'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const PurchaseOrderForm = lazy(() => import('./pages/PurchaseOrderForm'))
const GoodsReceiptNote = lazy(() => import('./pages/inventory/GoodsReceiptNote'))
const PurchaseReturns = lazy(() => import('./pages/inventory/PurchaseReturns'))
const ZatcaLogs = lazy(() => import('./pages/finance/ZatcaLogs'))
const Shipments = lazy(() => import('./pages/Shipments'))
const ShipmentForm = lazy(() => import('./pages/ShipmentForm'))
const DeliveryNotes = lazy(() => import('./pages/DeliveryNotes'))
const DeliveryNoteForm = lazy(() => import('./pages/DeliveryNoteForm'))
const TravelBookings = lazy(() => import('./pages/travel/TravelBookings'))
const TravelBookingForm = lazy(() => import('./pages/travel/TravelBookingForm'))
const RestaurantMenuItems = lazy(() => import('./pages/restaurant/RestaurantMenuItems'))
const RestaurantMenuItemForm = lazy(() => import('./pages/restaurant/RestaurantMenuItemForm'))
const RestaurantOrders = lazy(() => import('./pages/restaurant/RestaurantOrders'))
const RestaurantOrderForm = lazy(() => import('./pages/restaurant/RestaurantOrderForm'))
const RestaurantKitchen = lazy(() => import('./pages/restaurant/RestaurantKitchen'))
const RestaurantPOS = lazy(() => import('./pages/restaurant/RestaurantPOS'))
const RestaurantTables = lazy(() => import('./pages/restaurant/Tables'))
const RestaurantInventory = lazy(() => import('./pages/restaurant/Inventory'))
const RestaurantBranches = lazy(() => import('./pages/restaurant/Branches'))
const CashierPanel = lazy(() => import('./pages/restaurant/CashierPanel'))
const QRMenu = lazy(() => import('./pages/restaurant/QRMenu'))
const BoutiquePOS = lazy(() => import('./pages/boutique/BoutiquePOS'))
const BoutiqueProducts = lazy(() => import('./pages/boutique/BoutiqueProducts'))
const FurniturePOS = lazy(() => import('./pages/furniture/FurniturePOS'))
const FurnitureProducts = lazy(() => import('./pages/furniture/FurnitureProducts'))
const BoutiquePendingReturns = lazy(() => import('./pages/boutique/BoutiquePendingReturns'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectForm = lazy(() => import('./pages/ProjectForm'))
const Tasks = lazy(() => import('./pages/Tasks'))
const TaskForm = lazy(() => import('./pages/TaskForm'))
const BakalaPOS = lazy(() => import('./pages/bakala/BakalaPOS'))
const BakalaDashboard = lazy(() => import('./pages/bakala/BakalaDashboard'))
const BakalaProducts = lazy(() => import('./pages/bakala/BakalaProducts'))
const BakalaAddProduct = lazy(() => import('./pages/bakala/BakalaAddProduct'))
const BakalaProduce = lazy(() => import('./pages/bakala/BakalaProduce'))
const WeightScale = lazy(() => import('./pages/bakala/WeightScale'))
const InventoryAlerts = lazy(() => import('./pages/bakala/InventoryAlerts'))
const ExpiryWasteManagement = lazy(() => import('./pages/bakala/ExpiryWasteManagement'))
const Promotions = lazy(() => import('./pages/bakala/Promotions'))
const ProfitMargins = lazy(() => import('./pages/bakala/ProfitMargins'))
const AutoReorder = lazy(() => import('./pages/bakala/AutoReorder'))
const BarcodeLabelPrinting = lazy(() => import('./pages/bakala/BarcodeLabelPrinting'))
const DailyPnL = lazy(() => import('./pages/bakala/DailyPnL'))
const RestaurantReservations = lazy(() => import('./pages/restaurant/RestaurantReservations'))
const SaloonAppointments = lazy(() => import('./pages/saloon/SaloonAppointments'))
const LaundryDelivery = lazy(() => import('./pages/laundry/LaundryDelivery'))
const RentalMaintenance = lazy(() => import('./pages/car_rental/RentalMaintenance'))
const BoutiqueRentalCalendar = lazy(() => import('./pages/boutique/BoutiqueRentalCalendar'))
const ManpowerTimesheets = lazy(() => import('./pages/manpower/ManpowerTimesheets'))
const WorkshopServiceHistory = lazy(() => import('./pages/car_workshop/WorkshopServiceHistory'))
const RestaurantCombos = lazy(() => import('./pages/restaurant/RestaurantCombos'))
const RestaurantAnalytics = lazy(() => import('./pages/restaurant/RestaurantAnalytics'))
const RestaurantKDS = lazy(() => import('./pages/restaurant/RestaurantKDS'))
const RestaurantMess = lazy(() => import('./pages/restaurant/RestaurantMess'))
const RestaurantDelivery = lazy(() => import('./pages/restaurant/RestaurantDelivery'))
const BakalaShiftManagement = lazy(() => import('./pages/bakala/BakalaShiftManagement'))
const BakalaReturns = lazy(() => import('./pages/bakala/BakalaReturns'))
const BookStorePOS = lazy(() => import('./pages/bookstore/BookStorePOS'))
const BookStoreDashboard = lazy(() => import('./pages/bookstore/BookStoreDashboard'))
const BookStoreProducts = lazy(() => import('./pages/bookstore/BookStoreProducts'))
const BookStoreAddProduct = lazy(() => import('./pages/bookstore/BookStoreAddProduct'))
const BookStoreShiftManagement = lazy(() => import('./pages/bookstore/BookStoreShiftManagement'))
const BookStoreImport = lazy(() => import('./pages/bookstore/BookStoreImport'))
const BookStoreBestsellers = lazy(() => import('./pages/bookstore/BookStoreBestsellers'))
const BookStoreSupplyLists = lazy(() => import('./pages/bookstore/BookStoreSupplyLists'))
const BookStoreBuyBack = lazy(() => import('./pages/bookstore/BookStoreBuyBack'))
const BookStoreRentals = lazy(() => import('./pages/bookstore/BookStoreRentals'))
const BookStoreCourseEnrollments = lazy(() => import('./pages/bookstore/BookStoreCourseEnrollments'))
const BookStoreReports = lazy(() => import('./pages/bookstore/BookStoreReports'))
const EcommerceDashboard = lazy(() => import('./pages/ecommerce/EcommerceDashboard'))
const EcommerceOrders = lazy(() => import('./pages/ecommerce/EcommerceOrders'))
const EcommerceProducts = lazy(() => import('./pages/ecommerce/EcommerceProducts'))
const EcommerceAddProduct = lazy(() => import('./pages/ecommerce/EcommerceAddProduct'))
const EcommerceThemeEditor = lazy(() => import('./pages/ecommerce/EcommerceThemeEditor'))
const EcommerceDomains = lazy(() => import('./pages/ecommerce/EcommerceDomains'))
const EcommerceStoreSettings = lazy(() => import('./pages/ecommerce/EcommerceStoreSettings'))
const EcommerceProductDetail = lazy(() => import('./pages/ecommerce/EcommerceProductDetail'))
const EcommerceOrderDetail = lazy(() => import('./pages/ecommerce/EcommerceOrderDetail'))
const EcommercePayments = lazy(() => import('./pages/ecommerce/EcommercePayments'))
const EcommerceCouriers = lazy(() => import('./pages/ecommerce/EcommerceCouriers'))
const EcommercePixels = lazy(() => import('./pages/ecommerce/EcommercePixels'))
const EcommerceReviews = lazy(() => import('./pages/ecommerce/EcommerceReviews'))
const EcommerceNewsletter = lazy(() => import('./pages/ecommerce/EcommerceNewsletter'))
const EcommerceWordPress = lazy(() => import('./pages/ecommerce/EcommerceWordPress'))
const EcommerceAbandonedCarts = lazy(() => import('./pages/ecommerce/EcommerceAbandonedCarts'))
const EcommerceReturns = lazy(() => import('./pages/ecommerce/EcommerceReturns'))
const EcommerceGiftCards = lazy(() => import('./pages/ecommerce/EcommerceGiftCards'))
const EcommerceQuestions = lazy(() => import('./pages/ecommerce/EcommerceQuestions'))
const EcommerceInventory = lazy(() => import('./pages/ecommerce/EcommerceInventory'))
const EcommerceCustomers = lazy(() => import('./pages/ecommerce/EcommerceCustomers'))
const EcommerceSalesReport = lazy(() => import('./pages/ecommerce/EcommerceSalesReport'))
const EcommerceCoupons = lazy(() => import('./pages/ecommerce/EcommerceCoupons'))
const EcommerceBundles = lazy(() => import('./pages/ecommerce/EcommerceBundles'))

// Lazy-load storefront pages for code-splitting
const StorefrontHome = lazy(() => import('./pages/storefront/StorefrontHome'))
const StorefrontProducts = lazy(() => import('./pages/storefront/StorefrontProducts'))
const StorefrontProductDetail = lazy(() => import('./pages/storefront/StorefrontProductDetail'))
const StorefrontCheckout = lazy(() => import('./pages/storefront/StorefrontCheckout'))
const StorefrontCheckoutSuccess = lazy(() => import('./pages/storefront/StorefrontCheckoutSuccess'))
const StorefrontCheckoutCancel = lazy(() => import('./pages/storefront/StorefrontCheckoutCancel'))
const StorefrontWishlist = lazy(() => import('./pages/storefront/StorefrontWishlist'))
const StorefrontOrderTracking = lazy(() => import('./pages/storefront/StorefrontOrderTracking'))
const StorefrontReturnRequest = lazy(() => import('./pages/storefront/StorefrontReturnRequest'))
const StorefrontCompare = lazy(() => import('./pages/storefront/StorefrontCompare'))
const StorefrontAccount = lazy(() => import('./pages/storefront/StorefrontAccount'))
const StorefrontContact = lazy(() => import('./pages/storefront/StorefrontContact'))
const StorefrontFAQ = lazy(() => import('./pages/storefront/StorefrontFAQ'))
const StorefrontAbout = lazy(() => import('./pages/storefront/StorefrontAbout'))
const StorefrontShippingPolicy = lazy(() => import('./pages/storefront/StorefrontShippingPolicy'))
const StorefrontPrivacy = lazy(() => import('./pages/storefront/StorefrontPrivacy'))
const StorefrontTerms = lazy(() => import('./pages/storefront/StorefrontTerms'))
const StorefrontCategory = lazy(() => import('./pages/storefront/StorefrontCategory'))
const IoT = lazy(() => import('./pages/IoT'))
const IoTDeviceForm = lazy(() => import('./pages/IoTDeviceForm'))
const Khata = lazy(() => import('./pages/finance/Khata'))
const JobCosting = lazy(() => import('./pages/JobCosting'))
const JobCostingForm = lazy(() => import('./pages/JobCostingForm'))
const MRP = lazy(() => import('./pages/MRP'))
const Manufacturing = lazy(() => import('./pages/manufacturing/Manufacturing'))
const AppStore = lazy(() => import('./pages/app-store/AppStore'))
const WhatsApp = lazy(() => import('./pages/WhatsApp'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Expenses = lazy(() => import('./pages/Expenses'))
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'))
const CustomerList = lazy(() => import('./pages/customers/CustomerList'))
const CustomerForm = lazy(() => import('./pages/customers/CustomerForm'))
const CustomerStatement = lazy(() => import('./pages/customers/CustomerStatement'))
const Users = lazy(() => import('./pages/Users'))
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/SuperAdminDashboard'))
const PosSessions = lazy(() => import('./pages/super-admin/PosSessions'))
const TenantManagement = lazy(() => import('./pages/super-admin/TenantManagement'))
const TenantForm = lazy(() => import('./pages/super-admin/TenantForm'))
const TenantCustomization = lazy(() => import('./pages/super-admin/TenantCustomization'))
const UserManagement = lazy(() => import('./pages/super-admin/UserManagement'))
const IdentitySettings = lazy(() => import('./pages/super-admin/IdentitySettings'))
const GeminiSettings = lazy(() => import('./pages/super-admin/GeminiSettings'))
const EmailSettings = lazy(() => import('./pages/super-admin/EmailSettings'))
const SuperAdminMailbox = lazy(() => import('./pages/super-admin/SuperAdminMailbox'))
const SuperAdminWhatsApp = lazy(() => import('./pages/super-admin/SuperAdminWhatsApp'))
const WebsiteSettings = lazy(() => import('./pages/super-admin/WebsiteSettings'))
const DemoUsers = lazy(() => import('./pages/super-admin/DemoUsers'))
const PaymentSettings = lazy(() => import('./pages/super-admin/PaymentSettings'))
const PaymentResult = lazy(() => import('./pages/PaymentResult'))
const DemoCheckout = lazy(() => import('./pages/DemoCheckout'))
const ResellerManagement = lazy(() => import('./pages/super-admin/ResellerManagement'))
const ResellerDashboard = lazy(() => import('./pages/reseller/ResellerDashboard'))
const ResellerTenants = lazy(() => import('./pages/reseller/ResellerTenants'))
const ManpowerDashboard = lazy(() => import('./pages/manpower/ManpowerDashboard'))
const ManpowerWorkers = lazy(() => import('./pages/manpower/ManpowerWorkers'))
const ManpowerWorkerForm = lazy(() => import('./pages/manpower/ManpowerWorkerForm'))
const ManpowerWorkersBulk = lazy(() => import('./pages/manpower/ManpowerWorkersBulk'))
const ManpowerAssignments = lazy(() => import('./pages/manpower/ManpowerAssignments'))
const ManpowerAssignmentForm = lazy(() => import('./pages/manpower/ManpowerAssignmentForm'))
const ManpowerContractPrint = lazy(() => import('./pages/manpower/ManpowerContractPrint'))
const SystemSettings = lazy(() => import('./pages/super-admin/SystemSettings'))
const ZatcaManagement = lazy(() => import('./pages/super-admin/ZatcaManagement'))
const QueriesCRM = lazy(() => import('./pages/super-admin/QueriesCRM'))
const MaqderUpdates = lazy(() => import('./pages/MaqderUpdates'))
const LeadsGeneration = lazy(() => import('./pages/super-admin/LeadsGeneration'))
const LeadSetup = lazy(() => import('./pages/super-admin/LeadSetup'))
const AppCatalogManagement = lazy(() => import('./pages/super-admin/AppCatalogManagement'))
const EmailCommunication = lazy(() => import('./pages/EmailCommunication'))
const FleetAssets = lazy(() => import('./pages/fleet/FleetAssets'))
const FleetAssetForm = lazy(() => import('./pages/fleet/FleetAssetForm'))
const MaintenanceAlerts = lazy(() => import('./pages/fleet/MaintenanceAlerts'))
const SaloonDashboard = lazy(() => import('./pages/saloon/SaloonDashboard'))
const Contracts = lazy(() => import('./pages/contracts/Contracts'))
const ContractForm = lazy(() => import('./pages/contracts/ContractForm'))
const LandedCosts = lazy(() => import('./pages/landed-costs/LandedCosts'))
const LandedCostForm = lazy(() => import('./pages/landed-costs/LandedCostForm'))
const Compliance = lazy(() => import('./pages/compliance/Compliance'))
const Communicate = lazy(() => import('./pages/Communicate'))
const SaudiCompliance = lazy(() => import('./pages/compliance/SaudiCompliance'))
const GovernmentIntegrations = lazy(() => import('./pages/tenant-settings/GovernmentIntegrations'))
const GovernmentIntegrationDetail = lazy(() => import('./pages/tenant-settings/GovernmentIntegrationDetail'))
const ZatcaDashboard = lazy(() => import('./pages/tenant-settings/ZatcaDashboard'))
const FleetList = lazy(() => import('./pages/car-rental/FleetList'))
const CarForm = lazy(() => import('./pages/car-rental/CarForm'))
const CustomerRegistry = lazy(() => import('./pages/car-rental/CustomerRegistry'))
const CustomerKycForm = lazy(() => import('./pages/car-rental/CustomerForm'))
const ActiveRentals = lazy(() => import('./pages/car-rental/ActiveRentals'))
const CheckoutPOS = lazy(() => import('./pages/car-rental/CheckoutPOS'))
const CheckinPOS = lazy(() => import('./pages/car-rental/CheckinPOS'))
const ContractDetail = lazy(() => import('./pages/car-rental/ContractDetail'))
const WorkshopDashboard = lazy(() => import('./pages/workshop/WorkshopDashboard'))
const JobCards = lazy(() => import('./pages/workshop/JobCards'))
const Vehicles = lazy(() => import('./pages/workshop/Vehicles'))
const WorkshopInventory = lazy(() => import('./pages/workshop/WorkshopInventory'))
const CRMDashboard = lazy(() => import('./pages/crm/CRMDashboard'))
const CRMLeadsTab = lazy(() => import('./pages/crm/CRMLeadsTab'))
const CRMDealsTab = lazy(() => import('./pages/crm/CRMDealsTab'))
const CRMActivitiesTab = lazy(() => import('./pages/crm/CRMActivitiesTab'))
const CRMContactsTab = lazy(() => import('./pages/crm/CRMContactsTab'))
const CRMCampaignsTab = lazy(() => import('./pages/crm/CRMCampaignsTab'))

const LaundryPOS = lazy(() => import('./pages/laundry/LaundryPOS'))
const LaundryServices = lazy(() => import('./pages/laundry/LaundryServices'))
const LaundryKanban = lazy(() => import('./pages/laundry/LaundryKanban'))
const LaundryCustomers = lazy(() => import('./pages/laundry/LaundryCustomers'))
const LaundryInventory = lazy(() => import('./pages/laundry/LaundryInventory'))

const SaloonPOS = lazy(() => import('./pages/saloon/SaloonPOS'))
const SaloonServices = lazy(() => import('./pages/saloon/SaloonServices'))
const SaloonBarbers = lazy(() => import('./pages/saloon/SaloonBarbers'))
const QRServices = lazy(() => import('./pages/saloon/QRServices'))
const SaloonQueue = lazy(() => import('./pages/saloon/SaloonQueue'))
const Letterhead = lazy(() => import('./pages/Letterhead'))
const PublicMenu = lazy(() => import('./pages/public/PublicMenu'))
const PublicServices = lazy(() => import('./pages/public/PublicServices'))

import PageLoader from './components/ui/PageLoader'

function LegacyDashboardRedirect() {
  const location = useLocation()
  const nextPath = location.pathname.replace(/^\/dashboard/, '/app/dashboard')
  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />
}

function LegacyModuleRedirect({ module }) {
  const location = useLocation()
  const nextPath = location.pathname.replace(`/${module}`, `/app/dashboard/${module}`)
  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />
}

function ProtectedRoute({ children, allowedRoles, redirectSuperAdmin }) {
  const { isAuthenticated, isLoading, user, token } = useSelector((state) => state.auth)

  // No token = not logged in, redirect immediately (no loading)
  if (!token) return <Navigate to="/login" replace />
  
  // Has token but still verifying initial cold start
  if (isLoading && !isAuthenticated) return <PageLoader />
  
  if (!isAuthenticated) return <Navigate to="/login" replace />
  
  // Redirect super_admin to their dashboard if they try to access regular routes
  if (redirectSuperAdmin && user?.role === 'super_admin') {
    return <Navigate to="/super-admin" replace />
  }

  // Redirect reseller to their panel if they try to access regular routes
  if (redirectSuperAdmin && user?.role === 'reseller') {
    return <Navigate to="/reseller" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (user?.role === 'reseller') return <Navigate to="/reseller" replace />
    return <Navigate to="/app/dashboard" replace />
  }

  return children
}

function BusinessTypeRoute({ children, allowedTypes }) {
  const { tenant } = useSelector((state) => state.auth)
  const businessTypes = getTenantBusinessTypes(tenant)
  
  if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !allowedTypes.some((type) => businessTypes.includes(type))) {
    return <Navigate to="/app/dashboard" replace />
  }
  
  return children
}

function App() {
  const dispatch = useDispatch()
  const { token, tenant, user } = useSelector((state) => state.auth)
  const { language, theme, displayMode } = useSelector((state) => state.ui)

  const navigate = useNavigate()

  // Reconcile user and tenant details with backend on mount
  useEffect(() => {
    if (token) {
      dispatch(getMe())
      initSocket(token)
    } else {
      disconnectSocket()
    }
  }, [dispatch, token])

  // Cleanup socket on unmount
  useEffect(() => {
    return () => disconnectSocket();
  }, [])

  // Re-fetch fresh tenant data on window focus / tab visibility change (throttled)
  // so any changes made in Super Admin are immediately reflected in Admin Panel
  useEffect(() => {
    if (!token) return

    let lastFetch = Date.now()
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch > 60000) {
        lastFetch = Date.now()
        dispatch(getMe())
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [dispatch, token])

  useEffect(() => {
    const handler = () => dispatch(setTenantInactive())
    window.addEventListener('tenant-inactive', handler)
    return () => window.removeEventListener('tenant-inactive', handler)
  }, [dispatch])

  // Handle session expiry (401 from any API call) gracefully with a soft
  // React Router redirect instead of a hard page reload (which caused
  // white screen + redirect-back-to-login).
  // IMPORTANT: use forceLogout (synchronous) NOT logout (async thunk).
  // The async thunk completes too late — isAuthenticated stays true when
  // AuthLayout renders, making it redirect BACK to /app/dashboard in a loop.
  useEffect(() => {
    const handler = () => {
      dispatch(forceLogout())   // clears Redux state synchronously right now
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth-expired', handler)
    return () => window.removeEventListener('auth-expired', handler)
  }, [dispatch, navigate])

  useEffect(() => {
    dispatch(setLanguage(language))
    dispatch(setTheme(theme))
    dispatch(setDisplayMode(displayMode))
    
    // Clear chunk loading retry flag on successful app load
    sessionStorage.removeItem('chunk-load-retry')
  }, [])

  useEffect(() => {
    if (tenant?._id) {
      dispatch(loadDisplayModeForTenant(tenant._id))
    }
  }, [dispatch, tenant?._id])

  useEffect(() => {
    applyTenantBranding(tenant?.branding)
  }, [tenant])

  useEffect(() => {
    if (tenant?._id) {
      dispatch(loadThemeForTenant(tenant._id))
      dispatch(loadHiddenMenuItemsForTenant(tenant._id))
      dispatch(loadDisplayModeForTenant(tenant._id))
      dispatch(loadNavigationStyleForTenant(tenant._id))
    }
  }, [dispatch, tenant?._id])

  return (
    <Routes>
      {/* Public Marketing Website */}
      <Route path="/" element={<Suspense fallback={<PageLoader />}><MarketingLayout /></Suspense>}>
        <Route index element={<MarketingHome />} />
        <Route path="solutions" element={<MarketingSolutions />} />
        <Route path="solutions/:slug" element={<SolutionDetail />} />
        <Route path="pricing" element={<MarketingPricing />} />
        <Route path="about" element={<MarketingAbout />} />
        <Route path="contact" element={<MarketingContact />} />
        <Route path="privacy" element={<MarketingPrivacy />} />
        <Route path="terms" element={<MarketingTerms />} />
      </Route>

      {/* Public Application Routes */}
      <Route path="/public/menu" element={<Suspense fallback={<PageLoader />}><PublicMenu /></Suspense>} />
      <Route path="/public/services" element={<Suspense fallback={<PageLoader />}><PublicServices /></Suspense>} />
      <Route path="/payment-result" element={<Suspense fallback={<PageLoader />}><PaymentResult /></Suspense>} />
      <Route path="/demo-checkout" element={<Suspense fallback={<PageLoader />}><DemoCheckout /></Suspense>} />

      {/* Auth Routes */}
      <Route element={<Suspense fallback={<PageLoader />}><AuthLayout /></Suspense>}>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/inactive" element={<InactiveTenant />} />
      </Route>

      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />

      {/* Legacy redirect (backwards compatibility) */}
      <Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />

      {/* Legacy module redirects (backwards compatibility) */}
      <Route path="/invoices/*" element={<LegacyModuleRedirect module="invoices" />} />
      <Route path="/customers/*" element={<LegacyModuleRedirect module="customers" />} />
      <Route path="/contacts/*" element={<LegacyModuleRedirect module="contacts" />} />
      <Route path="/expenses/*" element={<LegacyModuleRedirect module="expenses" />} />
      <Route path="/employees/*" element={<LegacyModuleRedirect module="employees" />} />
      <Route path="/products/*" element={<LegacyModuleRedirect module="products" />} />
      <Route path="/warehouses/*" element={<LegacyModuleRedirect module="warehouses" />} />
      <Route path="/suppliers/*" element={<LegacyModuleRedirect module="suppliers" />} />
      <Route path="/purchase-orders/*" element={<LegacyModuleRedirect module="purchase-orders" />} />
      <Route path="/shipments/*" element={<LegacyModuleRedirect module="shipments" />} />
      <Route path="/projects/*" element={<LegacyModuleRedirect module="projects" />} />
      <Route path="/tasks/*" element={<LegacyModuleRedirect module="tasks" />} />
      <Route path="/iot/*" element={<LegacyModuleRedirect module="iot" />} />
      <Route path="/job-costing/*" element={<LegacyModuleRedirect module="job-costing" />} />
      <Route path="/mrp/*" element={<LegacyModuleRedirect module="mrp" />} />
      <Route path="/finance/*" element={<LegacyModuleRedirect module="finance" />} />
      <Route path="/reports/*" element={<LegacyModuleRedirect module="reports" />} />
      <Route path="/settings/*" element={<LegacyModuleRedirect module="settings" />} />


      {/* Super Admin Routes */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <Suspense fallback={<PageLoader />}><SuperAdminLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="pos-sessions" element={<PosSessions />} />
          <Route path="tenants" element={<TenantManagement />} />
          <Route path="tenants/new" element={<TenantForm />} />
          <Route path="tenants/:id" element={<TenantForm />} />
          <Route path="tenants/:id/customization" element={<TenantCustomization />}>
            <Route path="new" element={<RestaurantMenuItemForm />} />
            <Route path=":itemId" element={<RestaurantMenuItemForm />} />
          </Route>
          <Route path="users" element={<UserManagement />} />
          <Route path="queries" element={<QueriesCRM />} />
          <Route path="leads" element={<LeadsGeneration />} />
          <Route path="lead-setup" element={<LeadSetup />} />
        <Route path="resellers" element={<ResellerManagement />} />
        <Route path="website" element={<WebsiteSettings />} />
        <Route path="demo-users" element={<DemoUsers />} />
        <Route path="payment-settings" element={<PaymentSettings />} />
        <Route path="email" element={<EmailSettings />} />
        <Route path="mailbox" element={<SuperAdminMailbox />} />
        <Route path="whatsapp" element={<SuperAdminWhatsApp />} />
        <Route path="identity" element={<IdentitySettings />} />
        <Route path="gemini" element={<GeminiSettings />} />
        <Route path="system-settings" element={<SystemSettings />} />
        <Route path="app-catalog" element={<AppCatalogManagement />} />
        <Route path="zatca" element={<ZatcaManagement />} />
      </Route>

      {/* Reseller Panel Routes */}
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller']}>
            <Suspense fallback={<PageLoader />}><ResellerLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<ResellerDashboard />} />
        <Route path="tenants" element={<ResellerTenants />} />
        <Route path="leads" element={<LeadsGeneration />} />
        <Route path="lead-setup" element={<LeadSetup />} />
      </Route>

      {/* Main App Routes */}
      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute redirectSuperAdmin>
            <Suspense fallback={<PageLoader />}><MainLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
          {/* Khayyat Routes */}
          <Route path="khayyat" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatStitchingForm /></BusinessTypeRoute>} />
          <Route path="khayyat/analytics" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatDashboard /></BusinessTypeRoute>} />
          <Route path="khayyat/workers" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatWorkers /></BusinessTypeRoute>} />
          <Route path="khayyat/workers/new" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatWorkerForm /></BusinessTypeRoute>} />
          <Route path="khayyat/workers/:id" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatWorkerForm /></BusinessTypeRoute>} />
          <Route path="khayyat/worker-amounts" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatWorkerAmounts /></BusinessTypeRoute>} />
          <Route path="khayyat/stitchings" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatStitchings /></BusinessTypeRoute>} />
          <Route path="khayyat/stitchings/new" element={<Navigate to="/app/dashboard/khayyat" replace />} />
          <Route path="khayyat/stitchings/:id" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatStitchingForm /></BusinessTypeRoute>} />
          <Route path="khayyat/customizations" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatCustomizations /></BusinessTypeRoute>} />
          <Route path="khayyat/embroidery-designs" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatEmbroideryDesigns /></BusinessTypeRoute>} />
          <Route path="khayyat/fabrics" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatFabrics /></BusinessTypeRoute>} />
          <Route path="khayyat/laundry" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatLaundry /></BusinessTypeRoute>} />
          <Route path="khayyat/loyalty" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatLoyalty /></BusinessTypeRoute>} />
          <Route path="khayyat/quick-invoice" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatQuickInvoice /></BusinessTypeRoute>} />
          <Route path="khayyat/complete-order" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatCompleteOrder /></BusinessTypeRoute>} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceCreate />} />
        <Route path="invoices/new/sell" element={<InvoiceCreateSell />} />
        <Route path="invoices/new/purchase" element={<BusinessTypeRoute allowedTypes={['trading', 'construction', 'travel_agency']}><InvoiceCreatePurchase /></BusinessTypeRoute>} />
        <Route path="invoices/:id/edit" element={<InvoiceEditPage />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="quotations/new" element={<QuotationCreatePage />} />
        <Route path="quotations/:id/edit" element={<QuotationEditPage />} />
        <Route path="quotations/:id" element={<QuotationView />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="customers/:id" element={<CustomerForm />} />
        <Route path="customers/statement" element={<CustomerStatement />} />
        <Route path="customers/:id/edit" element={<CustomerForm />} />
        
        <Route path="letterhead" element={<Letterhead />} />
        <Route path="maqder-updates" element={<MaqderUpdates />} />

        {/* Manpower Routes */}
        <Route path="manpower" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerDashboard /></BusinessTypeRoute>} />
        <Route path="manpower/workers" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerWorkers /></BusinessTypeRoute>} />
        <Route path="manpower/workers/new" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerWorkerForm /></BusinessTypeRoute>} />
        <Route path="manpower/workers/bulk" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerWorkersBulk /></BusinessTypeRoute>} />
        <Route path="manpower/workers/:id" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerWorkerForm /></BusinessTypeRoute>} />
        <Route path="manpower/assignments" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerAssignments /></BusinessTypeRoute>} />
        <Route path="manpower/assignments/new" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerAssignmentForm /></BusinessTypeRoute>} />
        <Route path="manpower/assignments/:id" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerAssignmentForm /></BusinessTypeRoute>} />
        <Route path="manpower/assignments/:id/print" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerContractPrint /></BusinessTypeRoute>} />

        <Route path="travel-bookings" element={<BusinessTypeRoute allowedTypes={['travel_agency']}><TravelBookings /></BusinessTypeRoute>} />
        <Route path="travel-bookings/new" element={<BusinessTypeRoute allowedTypes={['travel_agency']}><TravelBookingForm /></BusinessTypeRoute>} />
        <Route path="travel-bookings/:id" element={<BusinessTypeRoute allowedTypes={['travel_agency']}><TravelBookingForm /></BusinessTypeRoute>} />
        <Route path="restaurant/pos" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantPOS /></BusinessTypeRoute>} />
        <Route path="restaurant/tables" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantTables /></BusinessTypeRoute>} />
        <Route path="restaurant/inventory" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantInventory /></BusinessTypeRoute>} />
        <Route path="restaurant/branches" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantBranches /></BusinessTypeRoute>} />
        <Route path="restaurant/menu-items" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantMenuItems /></BusinessTypeRoute>} />
        <Route path="restaurant/menu-items/new" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantMenuItemForm /></BusinessTypeRoute>} />
        <Route path="restaurant/menu-items/:id" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantMenuItemForm /></BusinessTypeRoute>} />
        <Route path="restaurant/orders" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantOrders /></BusinessTypeRoute>} />
        <Route path="restaurant/orders/new" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantOrderForm /></BusinessTypeRoute>} />
        <Route path="restaurant/orders/:id" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantOrderForm /></BusinessTypeRoute>} />
        
        {/* New Restaurant Features */}
        <Route path="restaurant/cashier" element={<BusinessTypeRoute allowedTypes={['restaurant']}><CashierPanel /></BusinessTypeRoute>} />
        <Route path="restaurant/qr-menu" element={<BusinessTypeRoute allowedTypes={['restaurant']}><QRMenu /></BusinessTypeRoute>} />
        
        {/* Legacy / Alternate paths */}
        <Route path="restaurant/kitchen" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantKitchen /></BusinessTypeRoute>} />
        <Route path="boutique/pos" element={<BusinessTypeRoute allowedTypes={['boutique']}><BoutiquePOS /></BusinessTypeRoute>} />
        <Route path="boutique/dresses" element={<BusinessTypeRoute allowedTypes={['boutique']}><BoutiqueProducts /></BusinessTypeRoute>} />
        <Route path="furniture/pos" element={<BusinessTypeRoute allowedTypes={['furniture_shop']}><FurniturePOS /></BusinessTypeRoute>} />
        <Route path="furniture/products" element={<BusinessTypeRoute allowedTypes={['furniture_shop']}><FurnitureProducts /></BusinessTypeRoute>} />
        <Route path="boutique/pending-returns" element={<BusinessTypeRoute allowedTypes={['boutique']}><BoutiquePendingReturns /></BusinessTypeRoute>} />
        <Route path="laundry/pos" element={<BusinessTypeRoute allowedTypes={['laundry']}><LaundryPOS /></BusinessTypeRoute>} />
        <Route path="laundry/services" element={<BusinessTypeRoute allowedTypes={['laundry']}><LaundryServices /></BusinessTypeRoute>} />
        <Route path="laundry/orders" element={<BusinessTypeRoute allowedTypes={['laundry']}><LaundryKanban /></BusinessTypeRoute>} />
        <Route path="restaurant/kitchen" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantKitchen /></BusinessTypeRoute>} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<ExpenseForm />} />
        <Route path="expenses/:id" element={<ExpenseForm />} />
        {/* HR Routes */}
        <Route path="employees" element={<Employees />} />
        <Route path="employees/new" element={<EmployeeForm />} />
        <Route path="employees/:id" element={<EmployeeForm />} />
        <Route path="hr/attendance" element={<Attendance />} />
        <Route path="hr/compliance" element={<HRCompliance />} />
        <Route path="hr/hiring" element={<Hiring />} />
        <Route path="hr/leaves" element={<Leaves />} />
        <Route path="hr/performance" element={<Performance />} />
        <Route path="hr/reports" element={<HRReports />} />
        <Route path="hr/expense-claims" element={<ExpenseClaims />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="payroll/calculators" element={<PayrollCalculators />} />

        {/* CRM Routes */}
        <Route path="crm" element={<CRMDashboard />} />
        <Route path="crm/leads" element={<CRMLeadsTab />} />
        <Route path="crm/contacts" element={<CRMContactsTab />} />
        <Route path="crm/deals" element={<CRMDealsTab />} />
        <Route path="crm/activities" element={<CRMActivitiesTab />} />
        <Route path="crm/campaigns" element={<CRMCampaignsTab />} />
        <Route path="products" element={<BusinessTypeRoute allowedTypes={['trading']}><Products /></BusinessTypeRoute>} />
        <Route path="products/new" element={<BusinessTypeRoute allowedTypes={['trading']}><ProductForm /></BusinessTypeRoute>} />
        <Route path="products/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><ProductForm /></BusinessTypeRoute>} />
        <Route path="warehouses" element={<BusinessTypeRoute allowedTypes={['trading']}><Warehouses /></BusinessTypeRoute>} />
        <Route path="warehouses/new" element={<BusinessTypeRoute allowedTypes={['trading']}><WarehouseForm /></BusinessTypeRoute>} />
        <Route path="warehouses/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><WarehouseForm /></BusinessTypeRoute>} />
        <Route path="suppliers" element={<BusinessTypeRoute allowedTypes={['trading']}><Suppliers /></BusinessTypeRoute>} />
        <Route path="suppliers/new" element={<BusinessTypeRoute allowedTypes={['trading']}><SupplierForm /></BusinessTypeRoute>} />
        <Route path="suppliers/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><SupplierForm /></BusinessTypeRoute>} />
        <Route path="supplier-performance" element={<BusinessTypeRoute allowedTypes={['trading']}><SupplierPerformance /></BusinessTypeRoute>} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="purchase-orders/new" element={<PurchaseOrderForm />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderForm />} />
        <Route path="grn" element={<GoodsReceiptNote />} />
        <Route path="purchase-returns" element={<PurchaseReturns />} />
        <Route path="shipments" element={<BusinessTypeRoute allowedTypes={['trading']}><Shipments /></BusinessTypeRoute>} />
        <Route path="shipments/new" element={<BusinessTypeRoute allowedTypes={['trading']}><ShipmentForm /></BusinessTypeRoute>} />
        <Route path="shipments/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><ShipmentForm /></BusinessTypeRoute>} />
        
        <Route path="delivery-notes" element={<BusinessTypeRoute allowedTypes={['trading']}><DeliveryNotes /></BusinessTypeRoute>} />
        <Route path="delivery-notes/new" element={<BusinessTypeRoute allowedTypes={['trading']}><DeliveryNoteForm /></BusinessTypeRoute>} />
        <Route path="delivery-notes/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><DeliveryNoteForm /></BusinessTypeRoute>} />

        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectForm />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/new" element={<TaskForm />} />
        <Route path="tasks/:id" element={<TaskForm />} />
        
        {/* Saloon System */}
        <Route path="saloon/services" element={<BusinessTypeRoute allowedTypes={['saloon']}><SaloonServices /></BusinessTypeRoute>} />
        <Route path="saloon/barbers" element={<BusinessTypeRoute allowedTypes={['saloon']}><SaloonBarbers /></BusinessTypeRoute>} />

        {/* Bakala Routes */}
        <Route path="bakala/pos" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaPOS /></BusinessTypeRoute>} />
        <Route path="bakala/shift" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaShiftManagement /></BusinessTypeRoute>} />
        <Route path="bakala/returns" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaReturns /></BusinessTypeRoute>} />
        <Route path="bakala/dashboard" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaDashboard /></BusinessTypeRoute>} />
        <Route path="bakala/products/*" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaProducts /></BusinessTypeRoute>} />
        <Route path="bakala/add-product" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaAddProduct /></BusinessTypeRoute>} />
        <Route path="bakala/produce" element={<BusinessTypeRoute allowedTypes={['bakala']}><BakalaProduce /></BusinessTypeRoute>} />
        <Route path="bakala/weight-scale" element={<BusinessTypeRoute allowedTypes={['bakala']}><WeightScale /></BusinessTypeRoute>} />
        <Route path="bakala/alerts" element={<BusinessTypeRoute allowedTypes={['bakala']}><InventoryAlerts /></BusinessTypeRoute>} />
        <Route path="bakala/expiry-waste" element={<BusinessTypeRoute allowedTypes={['bakala']}><ExpiryWasteManagement /></BusinessTypeRoute>} />
        <Route path="bakala/promotions" element={<BusinessTypeRoute allowedTypes={['bakala']}><Promotions /></BusinessTypeRoute>} />
        <Route path="bakala/profit-margins" element={<BusinessTypeRoute allowedTypes={['bakala']}><ProfitMargins /></BusinessTypeRoute>} />
        <Route path="bakala/auto-reorder" element={<BusinessTypeRoute allowedTypes={['bakala']}><AutoReorder /></BusinessTypeRoute>} />
        <Route path="bakala/label-printing" element={<BusinessTypeRoute allowedTypes={['bakala']}><BarcodeLabelPrinting /></BusinessTypeRoute>} />
        <Route path="bakala/pnl" element={<BusinessTypeRoute allowedTypes={['bakala']}><DailyPnL /></BusinessTypeRoute>} />

        {/* Bookstore Routes */}
        <Route path="bookstore/pos" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStorePOS /></BusinessTypeRoute>} />
        <Route path="bookstore/dashboard" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreDashboard /></BusinessTypeRoute>} />
        <Route path="bookstore/products" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreProducts /></BusinessTypeRoute>} />
        <Route path="bookstore/add-product" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreAddProduct /></BusinessTypeRoute>} />
        <Route path="bookstore/shift" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreShiftManagement /></BusinessTypeRoute>} />
        <Route path="bookstore/import" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreImport /></BusinessTypeRoute>} />
        <Route path="bookstore/bestsellers" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreBestsellers /></BusinessTypeRoute>} />
        <Route path="bookstore/supply-lists" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreSupplyLists /></BusinessTypeRoute>} />
        <Route path="bookstore/buyback" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreBuyBack /></BusinessTypeRoute>} />
        <Route path="bookstore/rentals" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreRentals /></BusinessTypeRoute>} />
        <Route path="bookstore/courses/:courseId/enrollments" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreCourseEnrollments /></BusinessTypeRoute>} />
        <Route path="bookstore/reports" element={<BusinessTypeRoute allowedTypes={['bookstore']}><BookStoreReports /></BusinessTypeRoute>} />

        {/* E-Commerce */}
        <Route path="ecommerce" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceDashboard /></BusinessTypeRoute>} end />
        <Route path="ecommerce/orders" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceOrders /></BusinessTypeRoute>} />
        <Route path="ecommerce/orders/:id" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceOrderDetail /></BusinessTypeRoute>} />
        <Route path="ecommerce/products" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceProducts /></BusinessTypeRoute>} />
        <Route path="ecommerce/products/new" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceAddProduct /></BusinessTypeRoute>} />
        <Route path="ecommerce/products/:id" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceProductDetail /></BusinessTypeRoute>} />
        <Route path="ecommerce/theme" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceThemeEditor /></BusinessTypeRoute>} />
        <Route path="ecommerce/domains" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceDomains /></BusinessTypeRoute>} />
        <Route path="ecommerce/payments" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommercePayments /></BusinessTypeRoute>} />
        <Route path="ecommerce/couriers" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceCouriers /></BusinessTypeRoute>} />
        <Route path="ecommerce/pixels" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommercePixels /></BusinessTypeRoute>} />
        <Route path="ecommerce/coupons" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceCoupons /></BusinessTypeRoute>} />
        <Route path="ecommerce/bundles" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceBundles /></BusinessTypeRoute>} />
        <Route path="ecommerce/reviews" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceReviews /></BusinessTypeRoute>} />
        <Route path="ecommerce/newsletter" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceNewsletter /></BusinessTypeRoute>} />
        <Route path="ecommerce/wordpress" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceWordPress /></BusinessTypeRoute>} />
        <Route path="ecommerce/abandoned-carts" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceAbandonedCarts /></BusinessTypeRoute>} />
        <Route path="ecommerce/returns" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceReturns /></BusinessTypeRoute>} />
        <Route path="ecommerce/gift-cards" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceGiftCards /></BusinessTypeRoute>} />
        <Route path="ecommerce/questions" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceQuestions /></BusinessTypeRoute>} />
        <Route path="ecommerce/inventory" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceInventory /></BusinessTypeRoute>} />
        <Route path="ecommerce/customers" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceCustomers /></BusinessTypeRoute>} />
        <Route path="ecommerce/sales-report" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceSalesReport /></BusinessTypeRoute>} />
        <Route path="ecommerce/settings" element={<BusinessTypeRoute allowedTypes={['ecommerce']}><EcommerceStoreSettings /></BusinessTypeRoute>} />

        <Route path="restaurant/reservations" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantReservations /></BusinessTypeRoute>} />
        <Route path="saloon/appointments" element={<BusinessTypeRoute allowedTypes={['saloon']}><SaloonAppointments /></BusinessTypeRoute>} />
        <Route path="laundry/delivery" element={<BusinessTypeRoute allowedTypes={['laundry']}><LaundryDelivery /></BusinessTypeRoute>} />
        <Route path="rental/maintenance" element={<BusinessTypeRoute allowedTypes={['car_rental']}><RentalMaintenance /></BusinessTypeRoute>} />
        <Route path="boutique/rental-calendar" element={<BusinessTypeRoute allowedTypes={['boutique']}><BoutiqueRentalCalendar /></BusinessTypeRoute>} />
        <Route path="manpower/timesheets" element={<BusinessTypeRoute allowedTypes={['manpower']}><ManpowerTimesheets /></BusinessTypeRoute>} />
        <Route path="workshop/service-history" element={<BusinessTypeRoute allowedTypes={['car_workshop']}><WorkshopServiceHistory /></BusinessTypeRoute>} />
        <Route path="khayyat/measurements" element={<BusinessTypeRoute allowedTypes={['khayyat']}><KhayyatMeasurements /></BusinessTypeRoute>} />
        <Route path="restaurant/combos" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantCombos /></BusinessTypeRoute>} />
        <Route path="restaurant/analytics" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantAnalytics /></BusinessTypeRoute>} />
        <Route path="restaurant/kds" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantKDS /></BusinessTypeRoute>} />
        <Route path="restaurant/mess" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantMess /></BusinessTypeRoute>} />
        <Route path="restaurant/delivery" element={<BusinessTypeRoute allowedTypes={['restaurant']}><RestaurantDelivery /></BusinessTypeRoute>} />

        <Route path="iot" element={<BusinessTypeRoute allowedTypes={['trading']}><IoT /></BusinessTypeRoute>} />
        <Route path="iot/devices/new" element={<BusinessTypeRoute allowedTypes={['trading']}><IoTDeviceForm /></BusinessTypeRoute>} />
        <Route path="iot/devices/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><IoTDeviceForm /></BusinessTypeRoute>} />
        <Route path="finance" element={<Finance />} />
        <Route path="vouchers" element={<Vouchers />} />
        <Route path="khata" element={<Khata />} />
        <Route path="users" element={<Users />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="hidden-navbars" element={<HiddenNavbars />} />
        <Route path="settings/government-integrations" element={<GovernmentIntegrations />} />
        <Route path="settings/government-integrations/:service" element={<GovernmentIntegrationDetail />} />
        <Route path="tenant-settings/government-integrations" element={<GovernmentIntegrations />} />
        <Route path="tenant-settings/government-integrations/:service" element={<GovernmentIntegrationDetail />} />
        <Route path="tenant-settings/zatca-dashboard" element={<ZatcaDashboard />} />
        <Route path="backup" element={<Backup />} />
        <Route path="super-admin" element={<BusinessTypeRoute allowedTypes={['super_admin']}><SuperAdminDashboard /></BusinessTypeRoute>} />
        <Route path="super-admin/resellers" element={<BusinessTypeRoute allowedTypes={['super_admin']}><ResellerManagement /></BusinessTypeRoute>} />
        <Route path="super-admin/queries" element={<BusinessTypeRoute allowedTypes={['super_admin']}><QueriesCRM /></BusinessTypeRoute>} />
        <Route path="super-admin/zatca" element={<BusinessTypeRoute allowedTypes={['super_admin']}><ZatcaManagement /></BusinessTypeRoute>} />
        <Route path="job-costing" element={<BusinessTypeRoute allowedTypes={['construction']}><JobCosting /></BusinessTypeRoute>} />
        <Route path="job-costing/new" element={<BusinessTypeRoute allowedTypes={['trading']}><JobCostingForm /></BusinessTypeRoute>} />
        <Route path="job-costing/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><JobCostingForm /></BusinessTypeRoute>} />
        <Route path="mrp" element={<BusinessTypeRoute allowedTypes={['trading', 'manufacturing']}><MRP /></BusinessTypeRoute>} />
        <Route path="manufacturing" element={<BusinessTypeRoute allowedTypes={['manufacturing', 'trading']}><Manufacturing /></BusinessTypeRoute>} />
        <Route path="app-store" element={<AppStore />} />
        <Route path="whatsapp" element={<WhatsApp />} />
        <Route path="reports" element={<Reports />} />
        <Route path="vat-returns" element={<VatReturns />} />
        <Route path="email" element={<EmailCommunication />} />
        <Route path="communicate" element={<ErrorBoundary><Communicate /></ErrorBoundary>} />
        <Route path="saudi-compliance" element={<ErrorBoundary><SaudiCompliance /></ErrorBoundary>} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
        <Route path="finance/zatca-logs" element={<ZatcaLogs />} />
        {/* Fleet & Machinery */}
        <Route path="fleet" element={<BusinessTypeRoute allowedTypes={['construction','trading']}><FleetAssets /></BusinessTypeRoute>} />
        <Route path="fleet/new" element={<BusinessTypeRoute allowedTypes={['construction','trading']}><FleetAssetForm /></BusinessTypeRoute>} />
        <Route path="fleet/maintenance-alerts" element={<BusinessTypeRoute allowedTypes={['construction','trading']}><MaintenanceAlerts /></BusinessTypeRoute>} />
        <Route path="fleet/:id" element={<BusinessTypeRoute allowedTypes={['construction','trading']}><FleetAssetForm /></BusinessTypeRoute>} />
        {/* Contract Management */}
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/new" element={<ContractForm />} />
        <Route path="contracts/:id" element={<ContractForm />} />
        {/* Landed Costs */}
        <Route path="landed-costs" element={<BusinessTypeRoute allowedTypes={['trading']}><LandedCosts /></BusinessTypeRoute>} />
        <Route path="landed-costs/new" element={<BusinessTypeRoute allowedTypes={['trading']}><LandedCostForm /></BusinessTypeRoute>} />
        <Route path="landed-costs/:id" element={<BusinessTypeRoute allowedTypes={['trading']}><LandedCostForm /></BusinessTypeRoute>} />
        {/* Local Compliance */}
        <Route path="compliance" element={<Compliance />} />
      </Route>

      {/* ───── Car Rental Shell ───── */}
      <Route
        path="/app/rental"
        element={
          <ProtectedRoute redirectSuperAdmin>
            <BusinessTypeRoute allowedTypes={['car_rental']}>
              <Suspense fallback={<PageLoader />}><CarRentalLayout /></Suspense>
            </BusinessTypeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/rental/active" replace />} />
        {/* POS */}
        <Route path="checkout" element={<CheckoutPOS />} />
        <Route path="active" element={<ActiveRentals />} />
        {/* Fleet */}
        <Route path="fleet" element={<FleetList />} />
        <Route path="fleet/new" element={<CarForm />} />
        <Route path="fleet/:id" element={<CarForm />} />
        {/* Customers */}
        <Route path="customers" element={<CustomerRegistry />} />
        <Route path="customers/new" element={<CustomerKycForm />} />
        <Route path="customers/:id" element={<CustomerKycForm />} />
        {/* Contracts */}
        <Route path="contracts" element={<Navigate to="/app/rental/active" replace />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="contracts/:id/checkin" element={<CheckinPOS />} />
      </Route>

      {/* ───── Car Workshop Shell ───── */}
      <Route
        path="/app/workshop"
        element={
          <ProtectedRoute redirectSuperAdmin>
            <BusinessTypeRoute allowedTypes={['car_workshop']}>
              <Suspense fallback={<PageLoader />}><WorkshopLayout /></Suspense>
            </BusinessTypeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkshopDashboard />} />
        <Route path="job-cards" element={<JobCards />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="inventory" element={<WorkshopInventory />} />
      </Route>

      {/* ───── Laundry Shell ───── */}
      <Route
        path="/app/laundry"
        element={
          <ProtectedRoute redirectSuperAdmin>
            <BusinessTypeRoute allowedTypes={['laundry']}>
              <Suspense fallback={<PageLoader />}><LaundryLayout /></Suspense>
            </BusinessTypeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/laundry/pos" replace />} />
        <Route path="pos" element={<LaundryPOS />} />
        <Route path="orders" element={<LaundryKanban />} />
        <Route path="customers" element={<LaundryCustomers />} />
        <Route path="inventory" element={<LaundryInventory />} />
        <Route path="catalog" element={<LaundryServices />} />
      </Route>

      <Route
        path="/app/saloon"
        element={
          <ProtectedRoute redirectSuperAdmin>
            <BusinessTypeRoute allowedTypes={['saloon']}>
              <Suspense fallback={<PageLoader />}><SaloonLayout /></Suspense>
            </BusinessTypeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/saloon/pos" replace />} />
        <Route path="dashboard" element={<SaloonDashboard />} />
        <Route path="pos" element={<SaloonPOS />} />
        <Route path="services" element={<SaloonServices />} />
        <Route path="barbers" element={<SaloonBarbers />} />
        <Route path="qr" element={<QRServices />} />
        <Route path="queue" element={<SaloonQueue />} />
      </Route>

      {/* ───── Public Storefront ───── */}
      <Route path="/store" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontHome /></StorefrontShell></Suspense>} />
      <Route path="/store/products" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontProducts /></StorefrontShell></Suspense>} />
      <Route path="/store/category/:slug" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontCategory /></StorefrontShell></Suspense>} />
      <Route path="/store/products/:id" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontProductDetail /></StorefrontShell></Suspense>} />
      <Route path="/store/checkout" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontCheckout /></StorefrontShell></Suspense>} />
      <Route path="/store/wishlist" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontWishlist /></StorefrontShell></Suspense>} />
      <Route path="/store/compare" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontCompare /></StorefrontShell></Suspense>} />
      <Route path="/store/account" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontAccount /></StorefrontShell></Suspense>} />
      <Route path="/store/contact" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontContact /></StorefrontShell></Suspense>} />
      <Route path="/store/faq" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontFAQ /></StorefrontShell></Suspense>} />
      <Route path="/store/about" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontAbout /></StorefrontShell></Suspense>} />
      <Route path="/store/shipping-policy" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontShippingPolicy /></StorefrontShell></Suspense>} />
      <Route path="/store/track-order" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontOrderTracking /></StorefrontShell></Suspense>} />
      <Route path="/store/returns" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontReturnRequest /></StorefrontShell></Suspense>} />
      <Route path="/store/privacy" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontPrivacy /></StorefrontShell></Suspense>} />
      <Route path="/store/terms" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontTerms /></StorefrontShell></Suspense>} />
      <Route path="/checkout/success" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontCheckoutSuccess /></StorefrontShell></Suspense>} />
      <Route path="/checkout/cancel" element={<Suspense fallback={<PageLoader />}><StorefrontShell><StorefrontCheckoutCancel /></StorefrontShell></Suspense>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

