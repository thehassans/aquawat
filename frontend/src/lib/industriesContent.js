/**
 * Comprehensive Industry Blueprints & Deep SEO Data Store for Maqder ERP.
 * Powers /industries and /industries/:slug with rich schema, deep architecture,
 * workflow maps, compliance specifications, and ROI metrics.
 */

export const INDUSTRIES = [
  {
    slug: 'hospitality-resorts',
    aliasSlugs: ['hospitality', 'hotels', 'resorts'],
    sectorCode: 'SECTOR // 08',
    sectorName: 'Direct Booking & PMS',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Hospitality & Luxury Resorts',
    nameAr: 'الفنادق والمنتجعات السياحية',
    headline: 'Zero-Commission Direct Booking Engines & Guest Experience Portals',
    headlineAr: 'محركات الحجز المباشر بدون عمولة وبوابات تجربة النزلاء الذكية',
    subtitle: 'Empowering boutique hotels, luxury chalets, and tourist resorts across Saudi Arabia & the GCC to bypass hefty OTA commissions with elegant, lightning-fast direct booking engines, room customization, and digital guest concierge web apps.',
    subtitleAr: 'تمكين الفنادق الفاخرة والشاليهات والمنتجعات السياحية في المملكة ودول الخليج من تجاوز عمولات المنصات الوسيطة بمحركات حجز مباشر سريعة وتطبيقات خدمة النزلاء الرقمية.',
    tags: ['#Direct Booking', '#Channel Manager', '#Guest Web App', '#Hospitality', '#ZATCA Phase 2', '#Tourism Tax 5%'],
    kpis: [
      { value: '+38%', label: 'Direct Booking Revenue Share Lift', desc: 'Shift guests from 18% OTA fees to direct 0% commission direct bookings.' },
      { value: '0 SAR', label: 'OTA Commission on Direct Bookings', desc: 'Keep 100% of room revenues and ancillary service charges.' },
      { value: '< 1.5s', label: 'Full Booking Funnel Completion', desc: 'Mobile-first instant reservation flow with Mada and Apple Pay.' },
    ],
    demoEmail: 'hotel@maqder.com',
    accentColor: '#059669',
    glowColor: 'rgba(5, 150, 105, 0.15)',
    metaTitle: 'Hotel PMS & Direct Booking Engine Saudi Arabia | Maqder ERP',
    metaDescription: 'Unified hotel property management system, zero-commission booking engine, housekeeping PMS, and ZATCA Phase 2 tourism tax invoicing in Saudi Arabia.',
    keywords: 'hotel pms saudi arabia, resort booking engine ksa, hotel zatca einvoicing, tourism tax calculator ksa, direct booking portal riyadh',
    architecture: [
      {
        title: 'Multi-Channel Live Availability Sync',
        desc: 'Two-way automated synchronization between your direct booking engine, front-desk PMS, and OTAs to eliminate overbooking and room parity discrepancies.',
      },
      {
        title: 'Bilingual Mobile Guest Concierge Web App',
        desc: 'Contactless mobile check-in, keyless digital room requests, room service ordering, and instant billing via progressive web app.',
      },
      {
        title: 'Saudi Tourism Municipality & ZATCA Tax Compliance',
        desc: 'Automated 15% VAT plus 5% Municipality Tourism Tax calculation with cryptographic Phase 2 XML transmission on check-out.',
      },
      {
        title: 'Dynamic Yield Management & Room Customization',
        desc: 'AI-driven dynamic room pricing based on occupancy rates, seasonal Riyadh Season / Jeddah Season demand, and automated add-on upsells.',
      },
    ],
    modules: [
      {
        name: 'Front-Desk PMS & Room Matrix',
        desc: 'Visual timeline grid of rooms, chalets, and suites with drag-and-drop check-in, maintenance blocks, and housekeeping status.',
      },
      {
        name: 'Housekeeping & Maintenance Operations',
        desc: 'Real-time room cleaning queue, maid assignment, minibar replenishment auditing, and maintenance ticket escalation.',
      },
      {
        name: 'Restaurant & Spa Cross-Folio Billing',
        desc: 'Charge dining, pool bar, and spa treatments directly to the room folio with signature confirmation on mobile POS.',
      },
      {
        name: 'Automated Payment Gateway & Deposit Holds',
        desc: 'Instant pre-authorization holds and automated settlement with Mada, Visa, Mastercard, Tabby, and Apple Pay.',
      },
    ],
    workflow: [
      { step: '01', title: 'Direct Guest Discovery & Booking', desc: 'Guest selects dates and suite via high-converting web engine with instant Mada/Apple Pay authorization.' },
      { step: '02', title: 'Automated Check-In & Folio Initialization', desc: 'Front desk verifies National ID / Passport, assigns room key, and activates digital concierge folio.' },
      { step: '03', title: 'Stay & Cross-Department Services', desc: 'Room service, laundry, and leisure charges seamlessly post to unified guest account.' },
      { step: '04', title: 'Express Check-Out & ZATCA E-Invoicing', desc: 'Folio auto-settles, generates ZATCA Phase 2 compliant bilingual tax invoice with QR, and sends via WhatsApp.' },
    ],
    faqs: [
      {
        q: 'Does Maqder support Saudi Tourism Tax and ZATCA Phase 2?',
        a: 'Yes. Maqder automatically computes standard 15% VAT along with the 5% Tourism Tax (where applicable for classified hotel units and resorts), generating cryptographically signed XML invoices and QR codes compliant with ZATCA Phase 2 regulations.',
      },
      {
        q: 'Can we integrate existing hardware like door locks and card terminals?',
        a: 'Yes. Maqder integrates with standard networked POS card payment terminals (Mada-certified) and supports keycard encoder APIs as well as QR-based contactless room access.',
      },
      {
        q: 'How does the direct booking engine reduce commission costs?',
        a: 'By embedding a lightning-fast booking widget on your domain with localized payment options (Mada, Apple Pay, Tabby), guests book directly with zero intermediary platform fees.',
      },
    ],
  },
  {
    slug: 'wholesale-distribution',
    aliasSlugs: ['trading', 'wholesale', 'distribution', 'supply-chain'],
    sectorCode: 'SECTOR // 01',
    sectorName: 'Supply Chain & B2B',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Wholesale, Supply Chain & Trading',
    nameAr: 'تجارة الجملة والتوزيع وسلاسل الإمداد',
    headline: 'High-Velocity Multi-Warehouse Distribution & Automated B2B E-Invoicing',
    headlineAr: 'إدارة توزيع متعددة المستودعات وفواتير ضريبية فورية لقطاع الجملة والتوريد',
    subtitle: 'Engineered for high-volume distributors, FMCG wholesalers, and import enterprises. Streamline bulk purchasing, automated landed cost calculations, tiered credit limits, and real-time ZATCA Phase 2 B2B clearance.',
    subtitleAr: 'منظومة متكاملة لشركات تجارة الجملة والموزعين والتوريد. إدارة المشتريات الضخمة وحساب تكلفة البضائع المستوردة وحدود الائتمان والفوترة الضريبية المعتمدة.',
    tags: ['#B2B Distribution', '#Multi-Warehouse', '#Landed Cost', '#ZATCA B2B Clearance', '#Credit Limits', '#WMS'],
    kpis: [
      { value: '99.4%', label: 'Order Dispatch Accuracy', desc: 'Barcode-driven bin picking and batch verification.' },
      { value: '60s', label: 'ZATCA Phase 2 B2B Clearance', desc: 'Direct cryptographic XML submission with automated clearance receipt.' },
      { value: '-42%', label: 'Days Sales Outstanding (DSO)', desc: 'Automated statement generation and WhatsApp payment reminders.' },
    ],
    demoEmail: 'admin@maqder.com',
    accentColor: '#0891b2',
    glowColor: 'rgba(8, 145, 178, 0.15)',
    metaTitle: 'Wholesale ERP & Multi-Warehouse Distribution Saudi Arabia | Maqder',
    metaDescription: 'Best ERP for wholesale distribution in Saudi Arabia. Multi-warehouse inventory, purchase orders, landed cost tracking, and ZATCA Phase 2 B2B electronic invoicing.',
    keywords: 'wholesale erp saudi arabia, b2b distribution software ksa, landed cost calculation, multi warehouse wms riyadh, zatca b2b clearance erp',
    architecture: [
      {
        title: 'Multi-Warehouse & Bin Location Routing',
        desc: 'Track thousands of SKUs across primary distribution hubs, regional warehouses, and van sales fleets with real-time stock transfer requisitions.',
      },
      {
        title: 'Comprehensive Landed Cost Engine',
        desc: 'Automatically allocate customs duties, ocean freight, port handling, and insurance across individual shipment line items to compute true unit costs.',
      },
      {
        title: 'Tiered Pricing & Customer Credit Controls',
        desc: 'Enforce custom wholesale price lists, volume discount rules, credit limits, and overdue invoice locks at the point of order creation.',
      },
      {
        title: 'Cryptographic ZATCA B2B Clearance',
        desc: 'Instant XML generation with cryptographic digital signatures and automated API transmission to the ZATCA FATOORA portal.',
      },
    ],
    modules: [
      {
        name: 'Purchase Orders & GRN Receiving',
        desc: 'Two-way and three-way matching of purchase orders, goods received notes (GRN), and vendor bills with backorder tracking.',
      },
      {
        name: 'B2B Sales Orders & Dispatch Manifests',
        desc: 'Sales order approval workflows, picking slips, delivery notes, and driver route allocation.',
      },
      {
        name: 'Customer & Supplier Sub-Ledgers',
        desc: 'Real-time aging reports, debit/credit notes, automated reconciliation, and bilingual account statements.',
      },
      {
        name: 'Van Sales & Field Rep Mobile POS',
        desc: 'Equip sales reps with tablet POS for on-the-spot stock issuance, cash collection, and mobile thermal receipt printing.',
      },
    ],
    workflow: [
      { step: '01', title: 'Procurement & Import Costing', desc: 'Issue POs, record container shipments, and allocate landed freight and customs charges.' },
      { step: '02', title: 'Receiving & Bin Allocation', desc: 'Audit inbound stock against GRN, print barcode labels, and store in designated warehouse bins.' },
      { step: '03', title: 'B2B Sales Order & Credit Verification', desc: 'Sales rep captures bulk order, system validates customer credit terms and reserves inventory.' },
      { step: '04', title: 'Dispatch & Instant ZATCA Clearance', desc: 'Generate delivery note, issue cleared tax invoice, and sync accounting journal entries.' },
    ],
    faqs: [
      {
        q: 'How does Maqder handle landed cost for imported goods?',
        a: 'Maqder allows you to attach freight bills, customs duties, and clearance expenses directly to purchase orders or shipments. The system allocates costs by value or volume to recalculate the accurate weighted average unit cost for each item.',
      },
      {
        q: 'Can we manage multiple price tiers for different wholesale customers?',
        a: 'Yes. You can configure unlimited price lists (e.g. VIP Distributor, Key Account, Cash Wholesale) and link them to customer accounts for automatic price application.',
      },
      {
        q: 'Does it support ZATCA B2B standard tax invoices with cryptographic clearance?',
        a: 'Yes. Maqder generates fully compliant UBL 2.1 XML invoices with CSID cryptographic signatures, submitting them to the ZATCA portal for instant clearance before delivery.',
      },
    ],
  },
  {
    slug: 'restaurants-cafes',
    aliasSlugs: ['restaurant', 'cafe', 'food-beverage', 'cloud-kitchen'],
    sectorCode: 'SECTOR // 02',
    sectorName: 'F&B & Cloud Kitchens',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Restaurants, Cafes & Cloud Kitchens',
    nameAr: 'المطاعم والمقاهي والمطابخ السحابية',
    headline: 'Ultra-Fast Cloud POS, Visual Kitchen Routing & QR Table Ordering',
    headlineAr: 'نظام نقاط بيع سحابي وشاشات مطبخ ذكية مع طلبات الباركود على الطاولة',
    subtitle: 'Built for high-tempo dining rooms, specialty coffee shops, and multi-brand cloud kitchens. Enjoy 0.3-second order firing, intelligent kitchen display systems (KDS), delivery aggregator sync, and ZATCA Phase 2 thermal receipts.',
    subtitleAr: 'نظام مصمم للمطاعم المزدحمة والمقاهي المختصة والمطابخ السحابية. إرسال فوري للطلبات وشاشات مطبخ تفاعلية وربط تطبيقات التوصيل وفواتير ضريبية مبسطة معتمدة.',
    tags: ['#Restaurant POS', '#Kitchen KDS', '#QR Digital Menu', '#Recipe Costing', '#Aggregator Sync', '#ZATCA POS'],
    kpis: [
      { value: '0.3s', label: 'Order-to-Kitchen Fire Velocity', desc: 'Instant wireless printing and digital KDS ticket dispatch.' },
      { value: '-28%', label: 'Food Waste & Shrinkage', desc: 'Real-time recipe ingredient deduction per dish sold.' },
      { value: '+22%', label: 'Average Table Turnover Rate', desc: 'QR code digital ordering and fast mobile pay at table.' },
    ],
    demoEmail: 'restaurant@maqder.com',
    accentColor: '#dc2626',
    glowColor: 'rgba(220, 38, 38, 0.15)',
    metaTitle: 'Restaurant Cloud POS & Kitchen KDS Saudi Arabia | Maqder ERP',
    metaDescription: 'Modern cloud POS for restaurants and cafes in Saudi Arabia. Table management, kitchen display system (KDS), recipe inventory, and ZATCA Phase 2 QR receipts.',
    keywords: 'restaurant pos saudi arabia, cafe pos riyadh, kitchen display system kds, zatca pos qr code, recipe inventory management f&b',
    architecture: [
      {
        title: 'Floor Plan & Interactive Table Management',
        desc: 'Visual drag-and-drop table layouts for indoor, patio, and VIP sections with real-time dining duration timers and split-bill workflows.',
      },
      {
        title: 'Intelligent Kitchen Display System (KDS)',
        desc: 'Multi-station routing (Grill, Salad, Barista, Expediter) with color-coded preparation timers and recipe instruction view.',
      },
      {
        title: 'Recipe Management & Raw Ingredient Costing',
        desc: 'Break down menu items into raw grams, liters, and units to automatically deplete stock and calculate gross profit margins.',
      },
      {
        title: 'Offline-Resilient POS & Hardware Integrations',
        desc: 'Keep ringing up orders even during internet outages with auto-sync, kitchen bump bars, cash drawers, and Mada terminals.',
      },
    ],
    modules: [
      {
        name: 'Dine-In, Takeaway & Drive-Thru POS',
        desc: 'Touch-optimized order entry with modifiers, combos, customer notes, and fast tipping.',
      },
      {
        name: 'QR Code Contactless Menu & Ordering',
        desc: 'Self-ordering web app at each table with photo menus, allergen indicators, and Apple Pay payment.',
      },
      {
        name: 'Delivery Aggregator Hub',
        desc: 'Consolidated dashboard for Jahez, Hungerstation, ToYou, and Chefz orders without managing multiple tablets.',
      },
      {
        name: 'Staff Shifts & Cashier Drawer Balancing',
        desc: 'Blind cash drops, shift closing reports, server commission tracking, and discrepancy alerts.',
      },
    ],
    workflow: [
      { step: '01', title: 'Order Capture', desc: 'Server captures order on handheld terminal or customer scans QR menu at table.' },
      { step: '02', title: 'Kitchen Routing', desc: 'Items split automatically to kitchen stations (Bar, Grill, Cold Prep) on digital KDS screens.' },
      { step: '03', title: 'Preparation & Expediting', desc: 'Chefs bump tickets when ready, notifying waitstaff or customer for pickup.' },
      { step: '04', title: 'Payment & ZATCA Receipt', desc: 'Tap Mada card or Apple Pay, print compliant ZATCA Phase 2 simplified tax invoice with QR code.' },
    ],
    faqs: [
      {
        q: 'Does Maqder POS continue working if the internet goes down?',
        a: 'Yes. Maqder POS is built with local offline resilience, allowing cashiers to continue placing orders and printing kitchen tickets even during network drops, syncing data as soon as connectivity restores.',
      },
      {
        q: 'How does ingredient inventory tracking work for recipes?',
        a: 'You can link each menu item to a bill of materials (recipe). When a burger or coffee is sold, the exact quantities of buns, patties, milk, and coffee beans are deducted from inventory.',
      },
      {
        q: 'Is it compliant with ZATCA Phase 2 simplified tax invoices?',
        a: 'Yes. Every receipt printed on thermal printers or sent digitally contains the cryptographic Phase 2 QR code required by Saudi tax authority regulations.',
      },
    ],
  },
  {
    slug: 'retail-supermarkets',
    aliasSlugs: ['retail', 'supermarkets', 'grocery', 'bakala'],
    sectorCode: 'SECTOR // 03',
    sectorName: 'Retail & Supermarkets',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Retail Supermarkets & Grocery',
    nameAr: 'السوبرماركت والتموينات ومحلات التجزئة',
    headline: 'High-Density Barcode POS, Electronic Weighing Scales & Expiry Control',
    headlineAr: 'نقاط بيع سريعة للمتاجر مع قراءة الباركود والموازين الإلكترونية وإدارة الصلاحية',
    subtitle: 'Purpose-built for grocery stores, supermarkets, and specialty retail. Handle massive barcode catalogs, weight-scale embedded barcodes, batch expiry tracking, supplier replenishment, and lightning-fast cashier checkouts.',
    subtitleAr: 'نظام متقدم للسوبرماركت ومحلات البقالة والتجزئة. قراءة الباركود الموزون وإدارة تواريخ انتهاء الصلاحية وإعادة الطلب التلقائي وفواتير ضريبية فورية.',
    tags: ['#Retail POS', '#Barcode Scanner', '#Weight Scales', '#Expiry Date Tracking', '#Fast Checkout', '#ZATCA QR'],
    kpis: [
      { value: '< 2s', label: 'Scan-to-Payment Checkout Speed', desc: 'High-speed cashier workflow with omnidirectional barcode scanning.' },
      { value: '100k+', label: 'SKU Inventory Capacity', desc: 'Seamlessly search and index massive retail product catalogs.' },
      { value: '-35%', label: 'Expired Product Loss Reduction', desc: 'Automated FEFO (First-Expired, First-Out) shelf alert notifications.' },
    ],
    demoEmail: 'bakala@maqder.com',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    metaTitle: 'Supermarket & Retail POS Software Saudi Arabia | Maqder ERP',
    metaDescription: 'Complete supermarket ERP and retail POS system in Saudi Arabia. Barcode printing, weighing scale integration, stock expiry alerts, and ZATCA Phase 2 compliance.',
    keywords: 'supermarket pos saudi arabia, grocery software riyadh, retail pos barcode scales, zatca retail invoice ksa, inventory expiry tracking',
    architecture: [
      {
        title: 'Weight-Embedded Barcode & Scale Integration',
        desc: 'Instantly decode GS1 weight-embedded barcodes from deli and produce scales to accurately price meats, cheeses, and bulk fruits.',
      },
      {
        title: 'Batch & Expiry Date Management (FEFO)',
        desc: 'Track arrival dates and expiry timelines per product batch with automatic alerts for goods nearing end of shelf-life.',
      },
      {
        title: 'Automated Reorder Thresholds & Vendor Buying',
        desc: 'Generate automated replenishment purchase orders when stock levels hit critical reorder minimums.',
      },
      {
        title: 'Customer Loyalty & Promotional Bundles',
        desc: 'Create mix-and-match promotions, buy-one-get-one deals, loyalty points, and digital customer receipts via SMS/WhatsApp.',
      },
    ],
    modules: [
      {
        name: 'High-Speed Cashier Terminal',
        desc: 'Clean keyboard/touch interface with price check, item void authorization, change calculator, and dual-display support.',
      },
      {
        name: 'Barcode Label & Shelf Tag Printing',
        desc: 'Design and print custom barcode labels, price tags, and promotional shelf talkers directly from inventory updates.',
      },
      {
        name: 'Stocktake & Handheld Mobile Auditing',
        desc: 'Perform periodic or perpetual cycle counts using smartphone camera or dedicated wireless barcode scanners.',
      },
      {
        name: 'Supplier Purchase & Consignment Tracking',
        desc: 'Manage supplier delivery schedules, credit returns for damaged goods, and consignment item settlements.',
      },
    ],
    workflow: [
      { step: '01', title: 'Cataloging & Price Tagging', desc: 'Bulk import master items via Excel, set wholesale/retail margins, and print shelf tags.' },
      { step: '02', title: 'Receiving with Expiry Checks', desc: 'Receive goods from vendors, log batch numbers, and verify cost prices.' },
      { step: '03', title: 'Fast Checkout', desc: 'Scan items or weigh produce, apply promotions, and swipe Mada or Apple Pay in seconds.' },
      { step: '04', title: 'ZATCA Compliance & Inventory Sync', desc: 'Print compliant thermal receipt with Phase 2 QR and auto-deduct shelf stock.' },
    ],
    faqs: [
      {
        q: 'Does it support barcode scales for fruits and butcher sections?',
        a: 'Yes. Maqder supports GS1 weight and price-embedded barcode formats generated by standard electronic scales (e.g. CAS, Dibal, Avery Berkel).',
      },
      {
        q: 'How does it help reduce loss from expired stock?',
        a: 'The system logs expiry dates upon receiving and provides an automated dashboard of items expiring in 30/60/90 days so you can discount or return them to suppliers.',
      },
      {
        q: 'Can we import thousands of items quickly during setup?',
        a: 'Yes. You can import your entire product catalog via Excel/CSV within minutes, including Arabic/English names, barcodes, categories, and tax rates.',
      },
    ],
  },
  {
    slug: 'salons-spas',
    aliasSlugs: ['saloon', 'spas', 'barber', 'beauty-clinic'],
    sectorCode: 'SECTOR // 04',
    sectorName: 'Salons & Wellness',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Salons, Spas & Beauty Centers',
    nameAr: 'الصالونات ومراكز التجميل والسبا',
    headline: 'Appointment Calendars, Staff Commission Splitting & Service POS',
    headlineAr: 'جدولة المواعيد الذكية وحساب عمولات الموظفين ونقاط بيع الخدمات',
    subtitle: 'Crafted for beauty salons, luxury spas, and upscale barbershops. Optimize chair utilization, automate stylist commissions, manage product consumption per treatment, and delight clients with automated WhatsApp appointment reminders.',
    subtitleAr: 'منظومة مخصصة لمراكز التجميل والسبا وصالونات الحلاقة. تنظيم الحجوزات وحساب عمولات الخبيرات ومراقبة استهلاك مستحضرات التجميل وفواتير معتمدة.',
    tags: ['#Salon POS', '#Appointment Calendar', '#Staff Commissions', '#Beauty Spa', '#WhatsApp Reminders', '#ZATCA'],
    kpis: [
      { value: '100%', label: 'Automated Commission Calculation', desc: 'Eliminate manual end-of-month stylist earnings calculation.' },
      { value: '-65%', label: 'No-Show Rate Reduction', desc: 'Automated 24h & 2h WhatsApp appointment reminders.' },
      { value: '+30%', label: 'Retail Product Add-On Sales', desc: 'Prompt staff at checkout with recommended aftercare products.' },
    ],
    demoEmail: 'saloon@maqder.com',
    accentColor: '#9333ea',
    glowColor: 'rgba(147, 51, 234, 0.15)',
    metaTitle: 'Salon & Spa Management Software Saudi Arabia | Maqder ERP',
    metaDescription: 'All-in-one salon POS, appointment booking, staff commission tracking, and ZATCA Phase 2 e-invoicing for beauty centers and spas in Saudi Arabia.',
    keywords: 'salon pos saudi arabia, spa booking software riyadh, beauty center erp ksa, hairdresser commission tracker, zatca salon invoice',
    architecture: [
      {
        title: 'Visual Multi-Stylist Appointment Calendar',
        desc: 'Interactive day/week/month appointment grid organized by staff member, treatment room, or VIP suite with color-coded service statuses.',
      },
      {
        title: 'Dynamic Commission & Payout Rules',
        desc: 'Configure flexible commission structures per service type, retail sales percentage, or tiered monthly performance milestones.',
      },
      {
        title: 'Professional Product Consumption Tracking',
        desc: 'Monitor internal salon stock usage (hair dyes, shampoos, oils) versus retail products sold off the shelf.',
      },
      {
        title: 'Automated Bilingual WhatsApp Messaging',
        desc: 'Send booking confirmations, appointment reminders, feedback requests, and promotional birthday offers directly via WhatsApp.',
      },
    ],
    modules: [
      {
        name: 'Service POS & Quick Chair Check-In',
        desc: 'Add services, assign stylists, add retail hair/skin products, and process card payment on one unified screen.',
      },
      {
        name: 'Client Digital Beauty Profiles',
        desc: 'Store customer color formulas, hair history, preferences, skin allergies, and past visit invoices.',
      },
      {
        name: 'Service Packages & Membership Passes',
        desc: 'Sell prepaid treatment packages (e.g. 5 Moroccan Baths get 1 free) with automated balance tracking per visit.',
      },
      {
        name: 'Staff Attendance & Shift Rosters',
        desc: 'Manage staff working hours, breaks, sick leaves, and integrate directly with monthly payroll calculations.',
      },
    ],
    workflow: [
      { step: '01', title: 'Booking & Client Reminder', desc: 'Client books online or via phone, receives instant WhatsApp confirmation with calendar invite.' },
      { step: '02', title: 'Check-In & Treatment', desc: 'Stylist views customer color formula history and begins customized treatment.' },
      { step: '03', title: 'Add Retail & Checkout', desc: 'Receptionist rings up service, adds recommended homecare product, and takes Mada payment.' },
      { step: '04', title: 'Commission & ZATCA Invoice', desc: 'Commission instantly credits to stylist ledger and compliant ZATCA Phase 2 QR receipt is issued.' },
    ],
    faqs: [
      {
        q: 'Can stylists have different commission rates for different services?',
        a: 'Yes. You can assign custom percentage or fixed commission rates per staff member and per service category (e.g. 15% for hair coloring, 10% for retail products).',
      },
      {
        q: 'Can customers book appointments online from our Instagram or website?',
        a: 'Yes. Maqder provides a branded online booking link that you can put in your Instagram bio or website for 24/7 client self-booking.',
      },
      {
        q: 'Does it support service package tracking (e.g. prepaid 6 sessions)?',
        a: 'Yes. Clients can purchase multi-session packages, and each visit automatically deducts a session with remaining balance displayed on the receipt.',
      },
    ],
  },
  {
    slug: 'laundry-drycleaning',
    aliasSlugs: ['laundry', 'dry-cleaning', 'maghsala'],
    sectorCode: 'SECTOR // 05',
    sectorName: 'Laundries & Dry Cleaning',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Laundries & Dry Cleaning Services',
    nameAr: 'المغاسل والتنظيف الجاف',
    headline: 'Garment Barcode Tagging, Weight-Based Billing & WhatsApp Pickup Alerts',
    headlineAr: 'وسم الملابس بالباركود والفوترة بالوزن أو القطعة مع تنبيهات الجاهزية عبر واتساب',
    subtitle: 'Tailored for express laundries, luxury dry cleaners, and institutional linen services. Accelerate drop-off intake, print durable heat-resistant garment tags, track processing stages, and notify customers automatically when ready.',
    subtitleAr: 'برنامج مخصص للمغاسل وخدمات التنظيف الجاف والفندقي. طباعة وسوم الملابس المقاومة للغسيل والفوترة بالقطعة أو الكيلو وإرسال إشعار الجاهزية للعميل.',
    tags: ['#Laundry POS', '#Garment Tagging', '#Dry Cleaning', '#Weight Billing', '#WhatsApp Ready Alert', '#ZATCA'],
    kpis: [
      { value: '100%', label: 'Garment Traceability', desc: 'Unique barcode tag attached to every received item.' },
      { value: '15s', label: 'Average Intake Drop-Off Time', desc: 'Rapid item counting with pre-set price categories.' },
      { value: '+40%', label: 'Customer Collection Speed', desc: 'Instant WhatsApp message sent when order status changes to Ready.' },
    ],
    demoEmail: 'laundry@maqder.com',
    accentColor: '#059669',
    glowColor: 'rgba(5, 150, 105, 0.15)',
    metaTitle: 'Laundry & Dry Cleaning POS Software Saudi Arabia | Maqder ERP',
    metaDescription: 'Best laundry software in Saudi Arabia. Barcode garment tagging, weight billing, express services, WhatsApp pickup notifications, and ZATCA Phase 2 invoices.',
    keywords: 'laundry pos saudi arabia, dry cleaning software ksa, maghsala billing system riyadh, garment tag barcode, zatca laundry invoice',
    architecture: [
      {
        title: 'Thermal & Hydro-Fix Garment Tag Printing',
        desc: 'Instantly generate durable laundry tags with customer ID, ticket number, and special handling instructions (Dry Clean, Steam, Starch).',
      },
      {
        title: 'Flexible Piece & Weight-Based Billing',
        desc: 'Bill by individual garment (Thobe, Abaya, Suit, Curtain) or calculate bulk laundry pricing by total weight in kilograms.',
      },
      {
        title: 'Live Processing Stage Kanban',
        desc: 'Track batches through Intake, Washing, Dry Cleaning, Pressing, Quality Inspection, and Ready for Collection.',
      },
      {
        title: 'Automated WhatsApp Readiness Notifications',
        desc: 'Notify customers automatically via WhatsApp as soon as their laundry is packed and placed in the collection bay.',
      },
    ],
    modules: [
      {
        name: 'Touch Drop-Off Intake POS',
        desc: 'Quick touch interface with visual garment icons, urgent/express surcharges, and promised pickup time calculation.',
      },
      {
        name: 'Rack & Bay Location Management',
        desc: 'Assign completed orders to numbered hanging racks or shelf bins for 5-second customer pickup retrieval.',
      },
      {
        name: 'Corporate & Hotel Linen Contracts',
        desc: 'Manage monthly billing for corporate clients, hotels, and gyms with recurring invoicing and pickup manifests.',
      },
      {
        name: 'Driver Delivery & Collection App',
        desc: 'Mobile driver tool for doorstep pickup and delivery with on-site card payment collection.',
      },
    ],
    workflow: [
      { step: '01', title: 'Drop-Off & Intake', desc: 'Count items, log special instructions, print durable tags, and issue customer claim ticket.' },
      { step: '02', title: 'Washing & Processing', desc: 'Staff wash, dry clean, and press garments according to fabric tags.' },
      { step: '03', title: 'Quality Check & Rack Slotting', desc: 'Scan items into finished rack slot, system automatically sends WhatsApp notification to client.' },
      { step: '04', title: 'Handover & Payment', desc: 'Scan claim ticket, retrieve garments from rack, collect payment via Mada, and print ZATCA invoice.' },
    ],
    faqs: [
      {
        q: 'Does the system support printing wash-resistant tags?',
        a: 'Yes. Maqder connects to standard thermal and hydro-fix tag printers to print durable tags that withstand washing and high-temperature pressing.',
      },
      {
        q: 'Can we bill customers by weight (per KG) as well as per piece?',
        a: 'Yes. You can seamlessly switch between per-piece pricing (e.g. Thobe, Suit) and weight-based pricing (e.g. SAR 10 per KG) on the same ticket.',
      },
      {
        q: 'How does customer notification work?',
        a: 'When your team marks an order as "Ready" on the system, an automated WhatsApp message is instantly dispatched with order details, total amount, and shop location.',
      },
    ],
  },
  {
    slug: 'travel-tourism',
    aliasSlugs: ['travel_agency', 'travel', 'tourism', 'umrah'],
    sectorCode: 'SECTOR // 06',
    sectorName: 'Travel & Tourism',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Travel Agencies & Tourism Operators',
    nameAr: 'وكالات السفر والسياحة والعمرة',
    headline: 'Margin-Scheme VAT Calculations, PNR Ticket Invoicing & Umrah Package Management',
    headlineAr: 'احتساب ضريبة نظام الهامش وفواتير التذاكر وإدارة باقات السياحة والعمرة',
    subtitle: 'Specialized ERP for travel agencies, destination management companies (DMCs), and Umrah operators. Automate ZATCA-compliant margin-scheme VAT, manage flight PNR bookings, customer visa applications, and hotel vouchers.',
    subtitleAr: 'منظومة متخصصة لوكالات السفر ومنظمي رحلات العمرة والسياحة. تطبيق ضريبة القيمة المضافة على هامش الربح وإصدار فواتير تذاكر الطيران وباقات الفنادق.',
    tags: ['#Travel Agency', '#Margin Scheme VAT', '#Flight PNR Invoicing', '#Umrah Packages', '#Hotel Vouchers', '#ZATCA'],
    kpis: [
      { value: '100%', label: 'Margin VAT Compliance', desc: 'Automated calculation of 15% tax strictly on agency profit margin.' },
      { value: '30s', label: 'Ticket Invoice Generation', desc: 'Capture PNR, passenger names, and issue ZATCA tax invoice.' },
      { value: '0 Error', label: 'BSP / Airline Ledger Audit', desc: 'Accurate reconciliation of net airline cost versus customer billing.' },
    ],
    demoEmail: 'travel@maqder.com',
    accentColor: '#0284c7',
    glowColor: 'rgba(2, 132, 199, 0.15)',
    metaTitle: 'Travel Agency ERP & Margin VAT Invoicing Saudi Arabia | Maqder',
    metaDescription: 'Purpose-built ERP for travel agencies in Saudi Arabia. Automated margin-scheme VAT calculation, ticket invoicing, Umrah package billing, and ZATCA Phase 2 compliance.',
    keywords: 'travel agency erp saudi arabia, margin scheme vat calculator ksa, travel invoice zatca, umrah agency software riyadh, airline ticket billing',
    architecture: [
      {
        title: 'ZATCA Margin-Scheme Tax Calculation Engine',
        desc: 'Automatically computes VAT strictly on the agency markup margin rather than the gross ticket price, compliant with Saudi tax rules for travel agents.',
      },
      {
        title: 'PNR & Flight Booking Integration',
        desc: 'Record passenger details, routing (origin/destination), ticket numbers, airline codes, and GDS reference numbers.',
      },
      {
        title: 'Umrah & Group Tour Package Builder',
        desc: 'Combine flights, Makkah/Madinah hotel vouchers, ground transportation, and visa processing into one bundled invoice.',
      },
      {
        title: 'Corporate Credit Accounts & Traveler Statements',
        desc: 'Manage corporate travel accounts with LPO tracking, monthly consolidated billing, and traveler expense breakdowns.',
      },
    ],
    modules: [
      {
        name: 'Flight Ticket & Voucher Invoicing',
        desc: 'Issue bilingual ZATCA Phase 2 invoices displaying net agency service fee, gross amounts, and passenger details.',
      },
      {
        name: 'Hotel & Visa Booking Records',
        desc: 'Track hotel reservation confirmations, supplier room costs, and visa processing fees.',
      },
      {
        name: 'Airline & Supplier Ledger Reconciliation',
        desc: 'Reconcile BSP billing statements against issued tickets to prevent supplier overcharges.',
      },
      {
        name: 'Commission & Sales Agent Tracking',
        desc: 'Track sales rep commissions per booking type and calculate net agency profitability.',
      },
    ],
    workflow: [
      { step: '01', title: 'Record Booking & PNR', desc: 'Enter passenger names, flight routing, airline net cost, and customer selling price.' },
      { step: '02', title: 'Automated Margin VAT', desc: 'System isolates agency margin and applies 15% VAT exclusively to the markup.' },
      { step: '03', title: 'ZATCA Invoice Submission', desc: 'Issue compliant Phase 2 invoice with QR code and email/WhatsApp directly to traveler.' },
      { step: '04', title: 'Supplier Settlement', desc: 'Reconcile airline BSP ledger and mark customer payment as settled.' },
    ],
    faqs: [
      {
        q: 'How does Maqder calculate VAT under the Saudi Margin Scheme for travel agencies?',
        a: 'Under ZATCA regulations, travel agencies act as intermediaries and pay VAT only on their profit margin (Customer Price - Supplier Net Cost). Maqder automatically computes this margin and reflects the correct tax on the invoice.',
      },
      {
        q: 'Can we issue corporate travel invoices with employee reference numbers and LPOs?',
        a: 'Yes. You can attach Local Purchase Order (LPO) numbers, project codes, and passenger employee IDs to generate consolidated monthly billing for corporate clients.',
      },
      {
        q: 'Does it support multi-currency bookings (e.g. USD, EUR, AED)?',
        a: 'Yes. Maqder supports multi-currency invoicing with real-time exchange rates and automatic conversion to SAR for ZATCA tax reporting.',
      },
    ],
  },
  {
    slug: 'construction-contracting',
    aliasSlugs: ['construction', 'contracting', 'engineering', 'projects'],
    sectorCode: 'SECTOR // 07',
    sectorName: 'Contracting & Projects',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Construction, Contracting & Projects',
    nameAr: 'المقاولات والإنشاءات وإدارة المشاريع',
    headline: 'Job Costing, Milestone Progress Invoicing & Subcontractor Retention',
    headlineAr: 'تكاليف المشاريع وفواتير المستخلصات المرحلية وإدارة دفعات مقاولي الباطن',
    subtitle: 'Tailored for general contractors, MEP engineers, and fit-out specialists. Track direct labor, material purchases, heavy equipment rentals, project retention guarantees, and issue ZATCA Phase 2 milestone progress invoices.',
    subtitleAr: 'منظومة مصممة لشركات المقاولات والإنشاءات والتطوير العقاري. تتبع تكاليف المواد والعمالة ومقاولي الباطن وإصدار فواتير المستخلصات المعتمدة.',
    tags: ['#Contracting ERP', '#Job Costing', '#Progress Invoices', '#Subcontractor Ledger', '#Retention Guarantee', '#ZATCA B2B'],
    kpis: [
      { value: '100%', label: 'Project P&L Visibility', desc: 'Real-time comparison of estimated BOQ vs actual project costs.' },
      { value: '5-10%', label: 'Retention Hold Automation', desc: 'Automatic retention percentage holdback and release tracking.' },
      { value: '-50%', label: 'Billing Dispute Frequency', desc: 'Transparent milestone progress certificates with linked attachments.' },
    ],
    demoEmail: 'admin@maqder.com',
    accentColor: '#475569',
    glowColor: 'rgba(71, 85, 105, 0.15)',
    metaTitle: 'Contracting & Construction ERP Saudi Arabia | Maqder',
    metaDescription: 'Complete contracting ERP software in Saudi Arabia. Job costing, progress milestone invoicing, subcontractor management, and ZATCA Phase 2 B2B clearance.',
    keywords: 'contracting erp saudi arabia, construction software ksa, progress invoicing zatca, job costing contracting riyadh, retention guarantee billing',
    architecture: [
      {
        title: 'Project Bill of Quantities (BOQ) & Cost Breakdown',
        desc: 'Define project stages, cost codes, and budgeted quantities for materials, labor, equipment, and subcontractor fees.',
      },
      {
        title: 'Milestone Progress Invoicing (Mustakhlasat)',
        desc: 'Generate progressive milestone invoices based on certified percentage of completion with automatic retention and advance deduction.',
      },
      {
        title: 'Subcontractor Claims & Performance Guarantees',
        desc: 'Audit subcontractor invoices against site delivery, manage holdbacks, and track performance bond expiry dates.',
      },
      {
        title: 'Site Material Requisitions & Direct Stock Issue',
        desc: 'Issue purchase orders linked directly to specific project cost centers to eliminate inventory leakage and overspending.',
      },
    ],
    modules: [
      {
        name: 'Job Costing & Site Budget Tracking',
        desc: 'Live dashboard comparing budgeted vs actual spend across materials, labor wages, equipment, and overheads.',
      },
      {
        name: 'Progress Invoicing & Certificate Billing',
        desc: 'Issue ZATCA-cleared B2B invoices with prior billing deductions, retention percentages, and net payable summaries.',
      },
      {
        name: 'Manpower & Equipment Timecards',
        desc: 'Log site worker hours, technician allocations, and heavy machinery utilization per job site.',
      },
      {
        name: 'Supplier & Subcontractor Payables',
        desc: 'Manage supplier credit terms, material delivery notes (GRN), and payment certificates.',
      },
    ],
    workflow: [
      { step: '01', title: 'Project Budget & BOQ Setup', desc: 'Upload project BOQ, allocate budgets for materials, manpower, and equipment.' },
      { step: '02', title: 'Site Expense & Material Issue', desc: 'Purchase and assign materials and site labor hours directly to project cost codes.' },
      { step: '03', title: 'Certify Milestone Completion', desc: 'Engineer certifies progress percentage and issues milestone certificate.' },
      { step: '04', title: 'ZATCA Progress Invoice Clearance', desc: 'Submit B2B progress invoice to ZATCA portal with retention holds and clear for payment.' },
    ],
    faqs: [
      {
        q: 'Does Maqder support progress billing (Mustakhlasat) with retention holds?',
        a: 'Yes. You can issue milestone progress invoices where the system automatically calculates cumulative percentage completed, deducts previous billings, applies 5-10% retention holdbacks, and submits the net amount to ZATCA.',
      },
      {
        q: 'Can we track individual project profitability in real time?',
        a: 'Yes. Every material purchase, labor timesheet, and subcontractor bill is linked to a project cost center, giving you a real-time Profit & Loss (P&L) statement per project.',
      },
      {
        q: 'Is it compliant with ZATCA Phase 2 B2B clearance for contracting firms?',
        a: 'Yes. Maqder generates cryptographically signed UBL 2.1 XML invoices with direct ZATCA FATOORA API clearance required for corporate and government clients.',
      },
    ],
  },
  {
    slug: 'tailoring-boutiques',
    aliasSlugs: ['khayyat', 'tailoring', 'boutique', 'fashion'],
    sectorCode: 'SECTOR // 09',
    sectorName: 'Tailoring & Boutiques',
    categoryTag: '# DOMAIN ARCHITECTURE & EXECUTION',
    nameEn: 'Custom Tailoring & Fashion Boutiques',
    nameAr: 'الخياطة الرجالية والنسائية ومحلات الأزياء',
    headline: 'Digital Customer Measurements, Fabric Roll Inventory & Worker Piece-Rate Payouts',
    headlineAr: 'سجل المقاسات الرقمي وإدارة طاقات الأقمشة وحساب أجور الخياطين بالقطعة',
    subtitle: 'Built specifically for bespoke thobe tailors, luxury abaya ateliers, and fashion boutiques. Record 20+ custom customer dimensions, track fabric rolls by the meter, assign orders to master tailors, and settle piece-rate worker payouts.',
    subtitleAr: 'نظام متكامل لمشاغل الخياطة ومصممي الأزياء ومحلات الثياب والعبايات. حفظ مقاسات العملاء وتتبع طاقات الأقمشة بالمتر وحساب أرباح الخياطين وفواتير ضريبية.',
    tags: ['#Tailoring POS', '#Digital Measurements', '#Fabric Inventory', '#Worker Piece-Rate', '#Fashion Boutique', '#ZATCA'],
    kpis: [
      { value: '20+', label: 'Digital Body Measurements', desc: 'Precision recording of collar, sleeve, length, chest, and cuff dimensions.' },
      { value: '100%', label: 'Fabric Meter Traceability', desc: 'Track raw fabric roll yardage and calculate leftover scrap.' },
      { value: '0 Error', label: 'Tailor Piece-Rate Settlements', desc: 'Automated wage calculation based on stitched garments completed.' },
    ],
    demoEmail: 'admin@maqder.com',
    accentColor: '#7c3aed',
    glowColor: 'rgba(124, 58, 237, 0.15)',
    metaTitle: 'Tailoring & Boutique POS Software Saudi Arabia | Maqder ERP',
    metaDescription: 'Best ERP for custom tailoring and fashion boutiques in Saudi Arabia. Digital measurements, fabric roll inventory, worker piece-rate payouts, and ZATCA Phase 2.',
    keywords: 'tailoring pos saudi arabia, khayyat software riyadh, thobe measurement app, abaya boutique pos, fabric roll inventory ksa',
    architecture: [
      {
        title: 'Comprehensive Digital Measurement Profiles',
        desc: 'Save and update customer measurements (Thobe, Abaya, Suit, Dress) with one-click reload for repeat orders without re-measuring.',
      },
      {
        title: 'Fabric Roll & Yardage Inventory Control',
        desc: 'Manage rolls of wool, cotton, linen, and silk down to the exact meter, deducting fabric as cutting slips are generated.',
      },
      {
        title: 'Master Tailor Assignment & Piece-Rate Earnings',
        desc: 'Assign cutting, stitching, and embroidery tasks to specific workers and automatically credit their piece-rate earnings upon order completion.',
      },
      {
        title: 'Visual Embroidery & Styling Catalog',
        desc: 'Present custom collar types, cuffs, embroidery patterns, and button selections with photo previews on tablet POS.',
      },
    ],
    modules: [
      {
        name: 'Tailoring Order Intake & Measurement POS',
        desc: 'Record customer dimensions, pick fabric roll, specify promised delivery date, and collect advance deposit.',
      },
      {
        name: 'Workshop Cutting & Stitching Kanban',
        desc: 'Track orders across In Queue, Cutting, Stitching, Embroidery, Pressing, and Ready for Fitting.',
      },
      {
        name: 'Worker Wages & Commission Ledger',
        desc: 'Audit completed garments per tailor, calculate piece-rate earnings, and disburse weekly/monthly worker payouts.',
      },
      {
        name: 'Automated Fitting & Ready WhatsApp Alerts',
        desc: 'Notify customers via WhatsApp when garments are ready for initial fitting or final collection.',
      },
    ],
    workflow: [
      { step: '01', title: 'Measurement & Style Intake', desc: 'Measure customer, select fabric roll from inventory, choose collar and cuff designs.' },
      { step: '02', title: 'Advance Payment & Deposit', desc: 'Collect deposit via Mada/Apple Pay and print cutting job card with customer dimensions.' },
      { step: '03', title: 'Workshop Stitching & Worker Credit', desc: 'Tailor completes garment, scans barcode, and piece-rate fee is credited to worker.' },
      { step: '04', title: 'Final Handover & ZATCA Invoice', desc: 'Customer arrives for fitting, settles balance, and receives compliant ZATCA Phase 2 tax invoice.' },
    ],
    faqs: [
      {
        q: 'Can we store customer measurements for future repeat orders?',
        a: 'Yes. Customer profiles store complete digital measurements, so returning customers can order new garments via phone or in-store without needing new measurements taken.',
      },
      {
        q: 'How does fabric inventory tracking work for rolls of cloth?',
        a: 'You record fabric rolls in meters/yards. When an order is placed, the standard requirement (e.g. 3.5 meters for a thobe) is automatically deducted from that specific roll.',
      },
      {
        q: 'Does it calculate piece-rate worker payouts automatically?',
        a: 'Yes. You can assign fixed compensation per garment type (e.g. SAR 25 per stitched thobe). When the garment is marked finished, the amount is automatically logged in the worker earnings ledger.',
      },
    ],
  },
]

export const getIndustry = (slug) => {
  if (!slug) return null
  const clean = slug.toLowerCase().trim()
  return INDUSTRIES.find(
    (item) =>
      item.slug === clean ||
      (Array.isArray(item.aliasSlugs) && item.aliasSlugs.includes(clean))
  ) || null
}
