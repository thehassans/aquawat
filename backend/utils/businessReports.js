import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import Project from '../models/Project.js';
import TravelBooking from '../models/TravelBooking.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import RentalContract from '../models/RentalContract.js';
import LaundryOrder from '../models/LaundryOrder.js';
import SaloonOrder from '../models/SaloonOrder.js';
import ManpowerAssignment from '../models/ManpowerAssignment.js';
import ManpowerWorker from '../models/ManpowerWorker.js';
import BakalaProduct from '../models/BakalaProduct.js';
import PosSession from '../models/PosSession.js';
import KhayyatStitching from '../models/khayyat/KhayyatStitching.js';
import { ManufacturingWorkOrder, ManufacturingBOM, ManufacturingJobCard } from '../models/Manufacturing.js';
import BoutiqueRental from '../models/BoutiqueRental.js';
import BoutiqueProduct from '../models/BoutiqueProduct.js';
import WorkshopJobCard from '../models/WorkshopJobCard.js';
import BookStoreProduct from '../models/BookStoreProduct.js';
import BookRental from '../models/BookRental.js';
import FurnitureOrder from '../models/FurnitureOrder.js';
import FurnitureProduct from '../models/FurnitureProduct.js';
import { getTenantBusinessTypes } from './businessTypes.js';

// Each builder returns a uniform section so the frontend can render it generically:
// { key, label:{en,ar}, kpis:[{key,label:{en,ar},value,format}], tables:[{key,title:{en,ar},columns:[{key,label:{en,ar},format}],rows:[{...}]}] }

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeAggregate = async (model, pipeline) => {
  try {
    return await model.aggregate(pipeline);
  } catch (error) {
    return [];
  }
};

const first = (rows, fallback = {}) => (Array.isArray(rows) && rows[0] ? rows[0] : fallback);

const SECTION_LABELS = {
  trading: { en: 'Trading & Inventory', ar: 'التجارة والمخزون' },
  construction: { en: 'Construction & Projects', ar: 'المقاولات والمشاريع' },
  travel_agency: { en: 'Travel Agency', ar: 'وكالة السفر' },
  restaurant: { en: 'Restaurant', ar: 'المطعم' },
  car_rental: { en: 'Car Rental', ar: 'تأجير السيارات' },
  laundry: { en: 'Laundry', ar: 'المغسلة' },
  saloon: { en: 'Saloon / Barber', ar: 'الصالون' },
  khayyat: { en: 'Tailor / Boutique', ar: 'الخياط' },
  manpower: { en: 'Manpower & Labor', ar: 'العمالة والموارد البشرية' },
  bakala: { en: 'Bakala / Supermarket', ar: 'البقالة والسوبر ماركت' },
  pharmacy: { en: 'Pharmacy', ar: 'الصيدلية' },
  manufacturing: { en: 'Manufacturing & MES', ar: 'التصنيع والإنتاج' },
  manufacturing_mes: { en: 'Manufacturing & MES', ar: 'التصنيع والإنتاج' },
  boutique: { en: 'Boutique & Dress Rental', ar: 'بوتيك وتأجير الفساتين' },
  boutique_rental: { en: 'Boutique & Dress Rental', ar: 'بوتيك وتأجير الفساتين' },
  car_workshop: { en: 'Car Workshop & Garage', ar: 'مركز صيانة السيارات' },
  workshop: { en: 'Car Workshop & Garage', ar: 'مركز صيانة السيارات' },
  bookstore: { en: 'Bookstore & Stationery', ar: 'المكتبة والقرطاسية' },
  bookstore_stationery: { en: 'Bookstore & Stationery', ar: 'المكتبة والقرطاسية' },
  furniture_shop: { en: 'Furniture Shop', ar: 'معرض الأثاث والمفروشات' },
  furniture: { en: 'Furniture Shop', ar: 'معرض الأثاث والمفروشات' },
};

// ─── Trading ─────────────────────────────────────────────────────────────────
async function buildTrading({ tenantFilter, startDate, endDate }) {
  const sellMatch = { ...tenantFilter, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled', 'credited'] } };

  const [productStats, topProducts, lowStock, byCategory] = await Promise.all([
    safeAggregate(Product, [
      { $match: { ...tenantFilter, isActive: true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          stockValueCost: { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, { $ifNull: ['$totalStock', 0] }] } },
          stockValueRetail: { $sum: { $multiply: [{ $ifNull: ['$sellingPrice', 0] }, { $ifNull: ['$totalStock', 0] }] } },
          lowStock: { $sum: { $cond: [{ $lte: ['$totalStock', { $ifNull: ['$reorderPoint', 10] }] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$totalStock', 0] }, 1, 0] } },
        },
      },
    ]),
    safeAggregate(Invoice, [
      { $match: sellMatch },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: { $ifNull: ['$lineItems.description', 'Unknown'] },
          quantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(Product, [
      { $match: { ...tenantFilter, isActive: true, $expr: { $lte: ['$totalStock', { $ifNull: ['$reorderPoint', 10] }] } } },
      { $project: { name: { $ifNull: ['$nameEn', '$nameAr'] }, sku: 1, totalStock: 1, reorderPoint: { $ifNull: ['$reorderPoint', 10] } } },
      { $sort: { totalStock: 1 } },
      { $limit: 20 },
    ]),
    safeAggregate(Product, [
      { $match: { ...tenantFilter, isActive: true } },
      {
        $group: {
          _id: { $ifNull: ['$category', 'Uncategorized'] },
          products: { $sum: 1 },
          stockValueCost: { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, { $ifNull: ['$totalStock', 0] }] } },
        },
      },
      { $sort: { stockValueCost: -1 } },
    ]),
  ]);

  const stats = first(productStats);

  return {
    key: 'trading',
    label: SECTION_LABELS.trading,
    kpis: [
      { key: 'activeProducts', label: { en: 'Active Products', ar: 'المنتجات النشطة' }, value: num(stats.count), format: 'number' },
      { key: 'stockValueCost', label: { en: 'Stock Value (Cost)', ar: 'قيمة المخزون (التكلفة)' }, value: num(stats.stockValueCost), format: 'money' },
      { key: 'stockValueRetail', label: { en: 'Stock Value (Retail)', ar: 'قيمة المخزون (البيع)' }, value: num(stats.stockValueRetail), format: 'money' },
      { key: 'lowStock', label: { en: 'Low Stock Items', ar: 'أصناف منخفضة' }, value: num(stats.lowStock), format: 'number' },
      { key: 'outOfStock', label: { en: 'Out of Stock', ar: 'نفدت الكمية' }, value: num(stats.outOfStock), format: 'number' },
    ],
    tables: [
      {
        key: 'topProducts',
        title: { en: 'Top Selling Products', ar: 'المنتجات الأكثر مبيعًا' },
        columns: [
          { key: 'name', label: { en: 'Product', ar: 'المنتج' }, format: 'text' },
          { key: 'quantity', label: { en: 'Qty Sold', ar: 'الكمية المباعة' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topProducts || []).map((row) => ({ name: row._id, quantity: num(row.quantity), revenue: num(row.revenue) })),
      },
      {
        key: 'lowStock',
        title: { en: 'Low Stock Products', ar: 'منتجات منخفضة المخزون' },
        columns: [
          { key: 'name', label: { en: 'Product', ar: 'المنتج' }, format: 'text' },
          { key: 'sku', label: { en: 'SKU', ar: 'الرمز' }, format: 'text' },
          { key: 'totalStock', label: { en: 'In Stock', ar: 'المتوفر' }, format: 'number' },
          { key: 'reorderPoint', label: { en: 'Reorder At', ar: 'حد إعادة الطلب' }, format: 'number' },
        ],
        rows: (lowStock || []).map((row) => ({ name: row.name, sku: row.sku, totalStock: num(row.totalStock), reorderPoint: num(row.reorderPoint) })),
      },
      {
        key: 'byCategory',
        title: { en: 'Inventory by Category', ar: 'المخزون حسب التصنيف' },
        columns: [
          { key: 'category', label: { en: 'Category', ar: 'التصنيف' }, format: 'text' },
          { key: 'products', label: { en: 'Products', ar: 'المنتجات' }, format: 'number' },
          { key: 'stockValueCost', label: { en: 'Stock Value (Cost)', ar: 'قيمة المخزون' }, format: 'money' },
        ],
        rows: (byCategory || []).map((row) => ({ category: row._id, products: num(row.products), stockValueCost: num(row.stockValueCost) })),
      },
    ],
  };
}

// ─── Construction ────────────────────────────────────────────────────────────
async function buildConstruction({ tenantFilter, startDate, endDate }) {
  const sellMatch = { ...tenantFilter, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled', 'credited'] } };
  const expenseMatch = { ...tenantFilter, expenseDate: { $gte: startDate, $lte: endDate }, status: 'paid', isActive: true };

  const [projectStats, projects, billed, expenses] = await Promise.all([
    safeAggregate(Project, [
      { $match: tenantFilter },
      {
        $facet: {
          totals: [{ $group: { _id: null, total: { $sum: 1 }, budget: { $sum: { $ifNull: ['$budget', 0] } }, active: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, budget: { $sum: { $ifNull: ['$budget', 0] } } } }, { $sort: { count: -1 } }],
        },
      },
    ]),
    safeAggregate(Project, [
      { $match: tenantFilter },
      { $project: { code: 1, name: { $ifNull: ['$nameEn', '$nameAr'] }, status: 1, progress: { $ifNull: ['$progress', 0] }, budget: { $ifNull: ['$budget', 0] } } },
      { $sort: { budget: -1 } },
      { $limit: 25 },
    ]),
    safeAggregate(Invoice, [
      { $match: sellMatch },
      { $group: { _id: null, count: { $sum: 1 }, taxable: { $sum: { $ifNull: ['$taxableAmount', 0] } }, tax: { $sum: { $ifNull: ['$totalTax', 0] } }, total: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
    ]),
    safeAggregate(Expense, [
      { $match: expenseMatch },
      { $group: { _id: { $ifNull: ['$category', 'other'] }, count: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      { $sort: { totalAmount: -1 } },
    ]),
  ]);

  const stats = first(projectStats);
  const totals = first(stats.totals);
  const billedTotals = first(billed);

  return {
    key: 'construction',
    label: SECTION_LABELS.construction,
    kpis: [
      { key: 'activeProjects', label: { en: 'Active Projects', ar: 'المشاريع النشطة' }, value: num(totals.active), format: 'number' },
      { key: 'totalProjects', label: { en: 'Total Projects', ar: 'إجمالي المشاريع' }, value: num(totals.total), format: 'number' },
      { key: 'totalBudget', label: { en: 'Total Budget', ar: 'إجمالي الميزانية' }, value: num(totals.budget), format: 'money' },
      { key: 'billed', label: { en: 'Billed (Period)', ar: 'المفوتر (الفترة)' }, value: num(billedTotals.total), format: 'money' },
    ],
    tables: [
      {
        key: 'projects',
        title: { en: 'Projects', ar: 'المشاريع' },
        columns: [
          { key: 'code', label: { en: 'Code', ar: 'الرمز' }, format: 'text' },
          { key: 'name', label: { en: 'Project', ar: 'المشروع' }, format: 'text' },
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'progress', label: { en: 'Progress', ar: 'الإنجاز' }, format: 'percent' },
          { key: 'budget', label: { en: 'Budget', ar: 'الميزانية' }, format: 'money' },
        ],
        rows: (projects || []).map((row) => ({ code: row.code, name: row.name, status: row.status, progress: num(row.progress), budget: num(row.budget) })),
      },
      {
        key: 'byStatus',
        title: { en: 'Projects by Status', ar: 'المشاريع حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'budget', label: { en: 'Budget', ar: 'الميزانية' }, format: 'money' },
        ],
        rows: (stats.byStatus || []).map((row) => ({ status: row._id, count: num(row.count), budget: num(row.budget) })),
      },
      {
        key: 'expensesByCategory',
        title: { en: 'Costs by Category', ar: 'التكاليف حسب التصنيف' },
        columns: [
          { key: 'category', label: { en: 'Category', ar: 'التصنيف' }, format: 'text' },
          { key: 'count', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'totalAmount', label: { en: 'Total', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (expenses || []).map((row) => ({ category: row._id, count: num(row.count), totalAmount: num(row.totalAmount) })),
      },
    ],
  };
}

// ─── Travel Agency ───────────────────────────────────────────────────────────
async function buildTravelAgency({ tenantFilter, startDate, endDate }) {
  const bookingMatch = { ...tenantFilter, isActive: true, createdAt: { $gte: startDate, $lte: endDate } };

  const [bookingStats, byServiceType, byAirline, recent, margin] = await Promise.all([
    safeAggregate(TravelBooking, [
      { $match: bookingMatch },
      { $group: { _id: null, total: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } }, open: { $sum: { $cond: [{ $in: ['$status', ['draft', 'confirmed', 'ticketed']] }, 1, 0] } } } },
    ]),
    safeAggregate(TravelBooking, [
      { $match: bookingMatch },
      { $group: { _id: { $ifNull: ['$serviceType', 'other'] }, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { revenue: -1 } },
    ]),
    safeAggregate(TravelBooking, [
      { $match: { ...bookingMatch, airlineName: { $nin: [null, ''] } } },
      { $group: { _id: '$airlineName', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(TravelBooking, [
      { $match: bookingMatch },
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
      { $project: { bookingNumber: 1, customerName: 1, serviceType: 1, status: 1, grandTotal: { $ifNull: ['$grandTotal', 0] }, createdAt: 1 } },
    ]),
    safeAggregate(Invoice, [
      { $match: { ...tenantFilter, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled', 'credited'] } } },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.isTravelMargin': true } },
      { $group: { _id: null, marginTaxable: { $sum: { $ifNull: ['$lineItems.marginTaxable', 0] } }, vatOnMargin: { $sum: { $ifNull: ['$lineItems.taxAmount', 0] } } } },
    ]),
  ]);

  const stats = first(bookingStats);
  const marginStats = first(margin);

  return {
    key: 'travel_agency',
    label: SECTION_LABELS.travel_agency,
    kpis: [
      { key: 'bookings', label: { en: 'Bookings', ar: 'الحجوزات' }, value: num(stats.total), format: 'number' },
      { key: 'revenue', label: { en: 'Gross Billing', ar: 'إجمالي الفوترة' }, value: num(stats.revenue), format: 'money' },
      { key: 'margin', label: { en: 'Margin (Taxable)', ar: 'الهامش (الخاضع)' }, value: num(marginStats.marginTaxable), format: 'money' },
      { key: 'vatOnMargin', label: { en: 'VAT on Margin', ar: 'ضريبة الهامش' }, value: num(marginStats.vatOnMargin), format: 'money' },
      { key: 'open', label: { en: 'Open Bookings', ar: 'حجوزات مفتوحة' }, value: num(stats.open), format: 'number' },
    ],
    tables: [
      {
        key: 'byServiceType',
        title: { en: 'Bookings by Service Type', ar: 'الحجوزات حسب نوع الخدمة' },
        columns: [
          { key: 'type', label: { en: 'Service', ar: 'الخدمة' }, format: 'text' },
          { key: 'count', label: { en: 'Bookings', ar: 'الحجوزات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byServiceType || []).map((row) => ({ type: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
      {
        key: 'byAirline',
        title: { en: 'Bookings by Airline', ar: 'الحجوزات حسب شركة الطيران' },
        columns: [
          { key: 'airline', label: { en: 'Airline', ar: 'شركة الطيران' }, format: 'text' },
          { key: 'count', label: { en: 'Bookings', ar: 'الحجوزات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byAirline || []).map((row) => ({ airline: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
      {
        key: 'recent',
        title: { en: 'Recent Bookings', ar: 'أحدث الحجوزات' },
        columns: [
          { key: 'bookingNumber', label: { en: 'Booking #', ar: 'رقم الحجز' }, format: 'text' },
          { key: 'customerName', label: { en: 'Customer', ar: 'العميل' }, format: 'text' },
          { key: 'serviceType', label: { en: 'Service', ar: 'الخدمة' }, format: 'text' },
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'grandTotal', label: { en: 'Total', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (recent || []).map((row) => ({ bookingNumber: row.bookingNumber, customerName: row.customerName, serviceType: row.serviceType, status: row.status, grandTotal: num(row.grandTotal) })),
      },
    ],
  };
}

// ─── Restaurant ──────────────────────────────────────────────────────────────
async function buildRestaurant({ tenantFilter, startDate, endDate }) {
  const orderMatch = { ...tenantFilter, isActive: true, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['cancelled'] } };

  const [orderStats, byOrderType, topItems, byPayment] = await Promise.all([
    safeAggregate(RestaurantOrder, [
      { $match: orderMatch },
      { $group: { _id: null, total: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } }, tax: { $sum: { $ifNull: ['$totalTax', 0] } } } },
    ]),
    safeAggregate(RestaurantOrder, [
      { $match: orderMatch },
      { $group: { _id: { $ifNull: ['$orderType', 'dine_in'] }, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { revenue: -1 } },
    ]),
    safeAggregate(RestaurantOrder, [
      { $match: orderMatch },
      { $unwind: '$lineItems' },
      { $group: { _id: { $ifNull: ['$lineItems.name', 'Unknown'] }, quantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(RestaurantOrder, [
      { $match: orderMatch },
      { $group: { _id: { $ifNull: ['$paymentMethod', 'cash'] }, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const stats = first(orderStats);
  const avgOrder = num(stats.total) > 0 ? num(stats.revenue) / num(stats.total) : 0;

  return {
    key: 'restaurant',
    label: SECTION_LABELS.restaurant,
    kpis: [
      { key: 'orders', label: { en: 'Orders', ar: 'الطلبات' }, value: num(stats.total), format: 'number' },
      { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, value: num(stats.revenue), format: 'money' },
      { key: 'tax', label: { en: 'VAT', ar: 'الضريبة' }, value: num(stats.tax), format: 'money' },
      { key: 'avgOrder', label: { en: 'Avg Order Value', ar: 'متوسط الطلب' }, value: avgOrder, format: 'money' },
    ],
    tables: [
      {
        key: 'byOrderType',
        title: { en: 'Sales by Order Type', ar: 'المبيعات حسب نوع الطلب' },
        columns: [
          { key: 'type', label: { en: 'Type', ar: 'النوع' }, format: 'text' },
          { key: 'count', label: { en: 'Orders', ar: 'الطلبات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byOrderType || []).map((row) => ({ type: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
      {
        key: 'topItems',
        title: { en: 'Top Menu Items', ar: 'الأصناف الأكثر طلبًا' },
        columns: [
          { key: 'name', label: { en: 'Item', ar: 'الصنف' }, format: 'text' },
          { key: 'quantity', label: { en: 'Qty', ar: 'الكمية' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topItems || []).map((row) => ({ name: row._id, quantity: num(row.quantity), revenue: num(row.revenue) })),
      },
      {
        key: 'byPayment',
        title: { en: 'Sales by Payment Method', ar: 'المبيعات حسب طريقة الدفع' },
        columns: [
          { key: 'method', label: { en: 'Method', ar: 'الطريقة' }, format: 'text' },
          { key: 'count', label: { en: 'Orders', ar: 'الطلبات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byPayment || []).map((row) => ({ method: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
    ],
  };
}

// ─── Car Rental ──────────────────────────────────────────────────────────────
async function buildCarRental({ tenantFilter, startDate, endDate }) {
  const contractMatch = { ...tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['CANCELLED'] } };

  const [contractStats, byStatus, recent] = await Promise.all([
    safeAggregate(RentalContract, [
      { $match: contractMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          vat: { $sum: { $ifNull: ['$totalVat', 0] } },
          open: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
          baseCharge: { $sum: { $ifNull: ['$baseCharge', 0] } },
          extraMileage: { $sum: { $ifNull: ['$extraMileageCharge', 0] } },
          fuelPenalty: { $sum: { $ifNull: ['$fuelPenalty', 0] } },
          latePenalty: { $sum: { $ifNull: ['$latePenalty', 0] } },
          damageCharge: { $sum: { $ifNull: ['$damageCharge', 0] } },
        },
      },
    ]),
    safeAggregate(RentalContract, [
      { $match: contractMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$subtotal', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(RentalContract, [
      { $match: contractMatch },
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
      { $project: { contractNumber: 1, status: 1, rentedDays: { $ifNull: ['$rentedDays', 0] }, subtotal: { $ifNull: ['$subtotal', 0] }, grandTotal: { $ifNull: ['$grandTotal', 0] } } },
    ]),
  ]);

  const stats = first(contractStats);
  const extraCharges = num(stats.extraMileage) + num(stats.fuelPenalty) + num(stats.latePenalty) + num(stats.damageCharge);

  return {
    key: 'car_rental',
    label: SECTION_LABELS.car_rental,
    kpis: [
      { key: 'contracts', label: { en: 'Contracts', ar: 'العقود' }, value: num(stats.total), format: 'number' },
      { key: 'revenue', label: { en: 'Revenue (ex-VAT)', ar: 'الإيراد (بدون ضريبة)' }, value: num(stats.subtotal), format: 'money' },
      { key: 'vat', label: { en: 'VAT', ar: 'الضريبة' }, value: num(stats.vat), format: 'money' },
      { key: 'open', label: { en: 'Open Contracts', ar: 'العقود المفتوحة' }, value: num(stats.open), format: 'number' },
      { key: 'extraCharges', label: { en: 'Extra Charges', ar: 'رسوم إضافية' }, value: extraCharges, format: 'money' },
    ],
    tables: [
      {
        key: 'chargeBreakdown',
        title: { en: 'Revenue Breakdown', ar: 'تفصيل الإيرادات' },
        columns: [
          { key: 'charge', label: { en: 'Charge', ar: 'الرسوم' }, format: 'text' },
          { key: 'amount', label: { en: 'Amount', ar: 'المبلغ' }, format: 'money' },
        ],
        rows: [
          { charge: 'Base Charge', amount: num(stats.baseCharge) },
          { charge: 'Extra Mileage', amount: num(stats.extraMileage) },
          { charge: 'Fuel Penalty', amount: num(stats.fuelPenalty) },
          { charge: 'Late Penalty', amount: num(stats.latePenalty) },
          { charge: 'Damage Charge', amount: num(stats.damageCharge) },
        ],
      },
      {
        key: 'byStatus',
        title: { en: 'Contracts by Status', ar: 'العقود حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({ status: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
      {
        key: 'recent',
        title: { en: 'Recent Contracts', ar: 'أحدث العقود' },
        columns: [
          { key: 'contractNumber', label: { en: 'Contract #', ar: 'رقم العقد' }, format: 'text' },
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'rentedDays', label: { en: 'Days', ar: 'الأيام' }, format: 'number' },
          { key: 'grandTotal', label: { en: 'Total', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (recent || []).map((row) => ({ contractNumber: row.contractNumber, status: row.status, rentedDays: num(row.rentedDays), grandTotal: num(row.grandTotal) })),
      },
    ],
  };
}

// ─── Laundry ─────────────────────────────────────────────────────────────────
async function buildLaundry({ tenantFilter, startDate, endDate }) {
  const orderMatch = { ...tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['cancelled'] } };

  const [orderStats, byStatus, byTreatment, byPayment] = await Promise.all([
    safeAggregate(LaundryOrder, [
      { $match: orderMatch },
      { $group: { _id: null, total: { $sum: 1 }, subtotal: { $sum: { $ifNull: ['$subtotal', 0] } }, vat: { $sum: { $ifNull: ['$totalVat', 0] } }, grandTotal: { $sum: { $ifNull: ['$grandTotal', 0] } }, urgentCount: { $sum: { $cond: ['$isUrgent', 1, 0] } }, urgentFee: { $sum: { $ifNull: ['$urgentFee', 0] } } } },
    ]),
    safeAggregate(LaundryOrder, [
      { $match: orderMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$subtotal', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(LaundryOrder, [
      { $match: orderMatch },
      { $unwind: '$items' },
      { $group: { _id: { $ifNull: ['$items.treatment', 'None'] }, quantity: { $sum: { $ifNull: ['$items.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$items.total', 0] } } } },
      { $sort: { revenue: -1 } },
    ]),
    safeAggregate(LaundryOrder, [
      { $match: orderMatch },
      { $group: { _id: { $ifNull: ['$paymentStatus', 'unpaid'] }, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const stats = first(orderStats);
  const avgOrder = num(stats.total) > 0 ? num(stats.grandTotal) / num(stats.total) : 0;

  return {
    key: 'laundry',
    label: SECTION_LABELS.laundry,
    kpis: [
      { key: 'orders', label: { en: 'Orders', ar: 'الطلبات' }, value: num(stats.total), format: 'number' },
      { key: 'revenue', label: { en: 'Revenue (ex-VAT)', ar: 'الإيراد (بدون ضريبة)' }, value: num(stats.subtotal), format: 'money' },
      { key: 'vat', label: { en: 'VAT', ar: 'الضريبة' }, value: num(stats.vat), format: 'money' },
      { key: 'urgent', label: { en: 'Urgent Orders', ar: 'طلبات عاجلة' }, value: num(stats.urgentCount), format: 'number' },
      { key: 'avgOrder', label: { en: 'Avg Order Value', ar: 'متوسط الطلب' }, value: avgOrder, format: 'money' },
    ],
    tables: [
      {
        key: 'byStatus',
        title: { en: 'Orders by Status', ar: 'الطلبات حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Orders', ar: 'الطلبات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({ status: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
      {
        key: 'byTreatment',
        title: { en: 'Revenue by Treatment', ar: 'الإيراد حسب المعالجة' },
        columns: [
          { key: 'treatment', label: { en: 'Treatment', ar: 'المعالجة' }, format: 'text' },
          { key: 'quantity', label: { en: 'Qty', ar: 'الكمية' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byTreatment || []).map((row) => ({ treatment: row._id, quantity: num(row.quantity), revenue: num(row.revenue) })),
      },
      {
        key: 'byPayment',
        title: { en: 'Orders by Payment Status', ar: 'الطلبات حسب حالة الدفع' },
        columns: [
          { key: 'status', label: { en: 'Payment Status', ar: 'حالة الدفع' }, format: 'text' },
          { key: 'count', label: { en: 'Orders', ar: 'الطلبات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Total', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (byPayment || []).map((row) => ({ status: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
    ],
  };
}

// ─── Saloon ──────────────────────────────────────────────────────────────────
async function buildSaloon({ tenantFilter, startDate, endDate }) {
  const orderMatch = { ...tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['cancelled'] } };

  const [orderStats, byStatus, topServices, byStaff] = await Promise.all([
    safeAggregate(SaloonOrder, [
      { $match: orderMatch },
      { $group: { _id: null, total: { $sum: 1 }, subtotal: { $sum: { $ifNull: ['$subtotal', 0] } }, vat: { $sum: { $ifNull: ['$totalVat', 0] } }, grandTotal: { $sum: { $ifNull: ['$grandTotal', 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]),
    safeAggregate(SaloonOrder, [
      { $match: orderMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(SaloonOrder, [
      { $match: orderMatch },
      { $unwind: '$items' },
      { $group: { _id: { $ifNull: ['$items.nameEn', 'Unknown'] }, quantity: { $sum: { $ifNull: ['$items.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$items.total', 0] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(SaloonOrder, [
      { $match: orderMatch },
      { $unwind: '$items' },
      { $match: { 'items.staff': { $nin: [null, ''] } } },
      { $group: { _id: '$items.staff', services: { $sum: { $ifNull: ['$items.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$items.total', 0] } } } },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const stats = first(orderStats);
  const avgOrder = num(stats.total) > 0 ? num(stats.grandTotal) / num(stats.total) : 0;

  return {
    key: 'saloon',
    label: SECTION_LABELS.saloon,
    kpis: [
      { key: 'orders', label: { en: 'Tickets', ar: 'الطلبات' }, value: num(stats.total), format: 'number' },
      { key: 'revenue', label: { en: 'Revenue (ex-VAT)', ar: 'الإيراد (بدون ضريبة)' }, value: num(stats.subtotal), format: 'money' },
      { key: 'vat', label: { en: 'VAT', ar: 'الضريبة' }, value: num(stats.vat), format: 'money' },
      { key: 'avgOrder', label: { en: 'Avg Ticket', ar: 'متوسط الطلب' }, value: avgOrder, format: 'money' },
    ],
    tables: [
      {
        key: 'topServices',
        title: { en: 'Top Services', ar: 'أكثر الخدمات' },
        columns: [
          { key: 'service', label: { en: 'Service', ar: 'الخدمة' }, format: 'text' },
          { key: 'quantity', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topServices || []).map((row) => ({ service: row._id, quantity: num(row.quantity), revenue: num(row.revenue) })),
      },
      {
        key: 'byStaff',
        title: { en: 'Revenue by Staff', ar: 'الإيراد حسب الموظف' },
        columns: [
          { key: 'staff', label: { en: 'Staff', ar: 'الموظف' }, format: 'text' },
          { key: 'services', label: { en: 'Services', ar: 'الخدمات' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byStaff || []).map((row) => ({ staff: row._id, services: num(row.services), revenue: num(row.revenue) })),
      },
      {
        key: 'byStatus',
        title: { en: 'Tickets by Status', ar: 'الطلبات حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({ status: row._id, count: num(row.count), revenue: num(row.revenue) })),
      },
    ],
  };
}

// ─── Tailor / Khayyat ────────────────────────────────────────────────────────
async function buildKhayyat({ tenantFilter, startDate, endDate }) {
  const orderMatch = { ...tenantFilter, createdAt: { $gte: startDate, $lte: endDate } };

  const [orderStats, byStatus] = await Promise.all([
    safeAggregate(KhayyatStitching, [
      { $match: orderMatch },
      { $group: { _id: null, total: { $sum: 1 }, price: { $sum: { $ifNull: ['$price', 0] } }, paid: { $sum: { $ifNull: ['$paidAmount', 0] } }, delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'done']] }, 1, 0] } } } },
    ]),
    safeAggregate(KhayyatStitching, [
      { $match: orderMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, price: { $sum: { $ifNull: ['$price', 0] } } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const stats = first(orderStats);
  const outstanding = num(stats.price) - num(stats.paid);

  return {
    key: 'khayyat',
    label: SECTION_LABELS.khayyat,
    kpis: [
      { key: 'orders', label: { en: 'Orders', ar: 'الطلبات' }, value: num(stats.total), format: 'number' },
      { key: 'price', label: { en: 'Total Value', ar: 'إجمالي القيمة' }, value: num(stats.price), format: 'money' },
      { key: 'paid', label: { en: 'Collected', ar: 'المحصل' }, value: num(stats.paid), format: 'money' },
      { key: 'outstanding', label: { en: 'Outstanding', ar: 'المتبقي' }, value: outstanding, format: 'money' },
      { key: 'delivered', label: { en: 'Delivered', ar: 'تم التسليم' }, value: num(stats.delivered), format: 'number' },
    ],
    tables: [
      {
        key: 'byStatus',
        title: { en: 'Orders by Status', ar: 'الطلبات حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Orders', ar: 'الطلبات' }, format: 'number' },
          { key: 'price', label: { en: 'Value', ar: 'القيمة' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({ status: row._id, count: num(row.count), price: num(row.price) })),
      },
    ],
  };
}

// ─── Manpower ────────────────────────────────────────────────────────────────
async function buildManpower({ tenantFilter, startDate, endDate }) {
  const assignmentMatch = { ...tenantFilter, isActive: true, startDate: { $lte: endDate }, $or: [{ endDate: null }, { endDate: { $gte: startDate } }] };

  const [assignmentStats, byStatus, byClient, workersByTrade, workerStats] = await Promise.all([
    safeAggregate(ManpowerAssignment, [
      { $match: { ...tenantFilter, isActive: true } },
      { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }, totalBilled: { $sum: { $ifNull: ['$totalBilled', 0] } } } },
    ]),
    safeAggregate(ManpowerAssignment, [
      { $match: { ...tenantFilter, isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 }, billed: { $sum: { $ifNull: ['$totalBilled', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(ManpowerAssignment, [
      { $match: { ...tenantFilter, isActive: true } },
      { $group: { _id: { $ifNull: ['$clientName', 'Unknown'] }, count: { $sum: 1 }, billed: { $sum: { $ifNull: ['$totalBilled', 0] } } } },
      { $sort: { billed: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(ManpowerWorker, [
      { $match: { ...tenantFilter, isActive: true } },
      { $group: { _id: { $ifNull: ['$trade', 'other'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(ManpowerWorker, [
      { $match: { ...tenantFilter, isActive: true } },
      { $group: { _id: null, total: { $sum: 1 }, available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } }, assigned: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } } } },
    ]),
  ]);

  const stats = first(assignmentStats);
  const workers = first(workerStats);
  // Touch assignmentMatch so period filtering remains available for future refinement without unused-var lint noise.
  void assignmentMatch;

  return {
    key: 'manpower',
    label: SECTION_LABELS.manpower,
    kpis: [
      { key: 'assignments', label: { en: 'Assignments', ar: 'الإسنادات' }, value: num(stats.total), format: 'number' },
      { key: 'active', label: { en: 'Active', ar: 'النشطة' }, value: num(stats.active), format: 'number' },
      { key: 'totalBilled', label: { en: 'Total Billed', ar: 'إجمالي الفوترة' }, value: num(stats.totalBilled), format: 'money' },
      { key: 'workers', label: { en: 'Workers', ar: 'العمال' }, value: num(workers.total), format: 'number' },
      { key: 'available', label: { en: 'Available', ar: 'المتاحون' }, value: num(workers.available), format: 'number' },
    ],
    tables: [
      {
        key: 'byStatus',
        title: { en: 'Assignments by Status', ar: 'الإسنادات حسب الحالة' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Count', ar: 'العدد' }, format: 'number' },
          { key: 'billed', label: { en: 'Billed', ar: 'المفوتر' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({ status: row._id, count: num(row.count), billed: num(row.billed) })),
      },
      {
        key: 'byClient',
        title: { en: 'Billing by Client', ar: 'الفوترة حسب العميل' },
        columns: [
          { key: 'client', label: { en: 'Client', ar: 'العميل' }, format: 'text' },
          { key: 'count', label: { en: 'Assignments', ar: 'الإسنادات' }, format: 'number' },
          { key: 'billed', label: { en: 'Billed', ar: 'المفوتر' }, format: 'money' },
        ],
        rows: (byClient || []).map((row) => ({ client: row._id, count: num(row.count), billed: num(row.billed) })),
      },
      {
        key: 'workersByTrade',
        title: { en: 'Workers by Trade', ar: 'العمال حسب المهنة' },
        columns: [
          { key: 'trade', label: { en: 'Trade', ar: 'المهنة' }, format: 'text' },
          { key: 'count', label: { en: 'Workers', ar: 'العمال' }, format: 'number' },
        ],
        rows: (workersByTrade || []).map((row) => ({ trade: row._id, count: num(row.count) })),
      },
    ],
  };
}

// ─── Bakala / Supermarket ────────────────────────────────────────────────────
async function buildBakala({ tenantFilter, startDate, endDate }) {
  const saleMatch = { ...tenantFilter, businessContext: 'bakala', flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled', 'credited'] } };
  const shiftMatch = { ...tenantFilter, openedAt: { $gte: startDate, $lte: endDate } };

  const [saleStats, byPayment, topProducts, shiftStats, lowStock] = await Promise.all([
    safeAggregate(Invoice, [
      { $match: saleMatch },
      { $group: { _id: null, receipts: { $sum: 1 }, taxable: { $sum: { $ifNull: ['$taxableAmount', 0] } }, tax: { $sum: { $ifNull: ['$totalTax', 0] } }, total: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
    ]),
    safeAggregate(Invoice, [
      { $match: saleMatch },
      { $group: { _id: { $ifNull: ['$paymentMethod', 'cash'] }, count: { $sum: 1 }, total: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
      { $sort: { total: -1 } },
    ]),
    safeAggregate(Invoice, [
      { $match: saleMatch },
      { $unwind: '$lineItems' },
      { $group: { _id: { $ifNull: ['$lineItems.description', 'Unknown'] }, quantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(PosSession, [
      { $match: shiftMatch },
      { $group: { _id: null, shifts: { $sum: 1 }, totalSales: { $sum: { $ifNull: ['$totalSales', 0] } }, discrepancy: { $sum: { $ifNull: ['$cashDiscrepancy', 0] } } } },
    ]),
    safeAggregate(BakalaProduct, [
      { $match: { ...tenantFilter, isActive: true, $expr: { $lte: ['$stockQuantity', { $ifNull: ['$minimumStockAlertLevel', 10] }] } } },
      { $project: { name: 1, primaryBarcode: 1, stockQuantity: 1, minimumStockAlertLevel: { $ifNull: ['$minimumStockAlertLevel', 10] } } },
      { $sort: { stockQuantity: 1 } },
      { $limit: 20 },
    ]),
  ]);

  const stats = first(saleStats);
  const shifts = first(shiftStats);
  const avgBasket = num(stats.receipts) > 0 ? num(stats.total) / num(stats.receipts) : 0;

  return {
    key: 'bakala',
    label: SECTION_LABELS.bakala,
    kpis: [
      { key: 'receipts', label: { en: 'Receipts', ar: 'الإيصالات' }, value: num(stats.receipts), format: 'number' },
      { key: 'grossSales', label: { en: 'Gross Sales', ar: 'إجمالي المبيعات' }, value: num(stats.total), format: 'money' },
      { key: 'vat', label: { en: 'VAT', ar: 'الضريبة' }, value: num(stats.tax), format: 'money' },
      { key: 'avgBasket', label: { en: 'Avg Basket', ar: 'متوسط السلة' }, value: avgBasket, format: 'money' },
      { key: 'shifts', label: { en: 'Shifts', ar: 'الورديات' }, value: num(shifts.shifts), format: 'number' },
    ],
    tables: [
      {
        key: 'byPayment',
        title: { en: 'Sales by Payment Method', ar: 'المبيعات حسب طريقة الدفع' },
        columns: [
          { key: 'method', label: { en: 'Method', ar: 'الطريقة' }, format: 'text' },
          { key: 'count', label: { en: 'Receipts', ar: 'الإيصالات' }, format: 'number' },
          { key: 'total', label: { en: 'Total', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (byPayment || []).map((row) => ({ method: row._id, count: num(row.count), total: num(row.total) })),
      },
      {
        key: 'topProducts',
        title: { en: 'Top Selling Products', ar: 'المنتجات الأكثر مبيعًا' },
        columns: [
          { key: 'name', label: { en: 'Product', ar: 'المنتج' }, format: 'text' },
          { key: 'quantity', label: { en: 'Qty Sold', ar: 'الكمية' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topProducts || []).map((row) => ({ name: row._id, quantity: num(row.quantity), revenue: num(row.revenue) })),
      },
      {
        key: 'lowStock',
        title: { en: 'Low Stock Products', ar: 'منتجات منخفضة المخزون' },
        columns: [
          { key: 'name', label: { en: 'Product', ar: 'المنتج' }, format: 'text' },
          { key: 'primaryBarcode', label: { en: 'Barcode', ar: 'الباركود' }, format: 'text' },
          { key: 'stockQuantity', label: { en: 'In Stock', ar: 'المتوفر' }, format: 'number' },
          { key: 'minimumStockAlertLevel', label: { en: 'Alert At', ar: 'حد التنبيه' }, format: 'number' },
        ],
        rows: (lowStock || []).map((row) => ({ name: row.name, primaryBarcode: row.primaryBarcode, stockQuantity: num(row.stockQuantity), minimumStockAlertLevel: num(row.minimumStockAlertLevel) })),
      },
    ],
  };
}

// ─── Manufacturing & MES ───────────────────────────────────────────────────
async function buildManufacturing({ tenantFilter, startDate, endDate }) {
  const dateMatch = {
    ...tenantFilter,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [orderStats, topWorkOrders, stageWip] = await Promise.all([
    safeAggregate(ManufacturingWorkOrder, [
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          qtyPlanned: { $sum: { $ifNull: ['$quantityPlanned', 0] } },
          qtyProduced: { $sum: { $ifNull: ['$quantityProduced', 0] } },
          qtyScrapped: { $sum: { $ifNull: ['$quantityScrapped', 0] } },
          totalStandardCost: { $sum: { $ifNull: ['$standardCostEstimated', 0] } },
          totalActualCost: { $sum: { $ifNull: ['$totalActualCost', 0] } },
          totalVariance: { $sum: { $ifNull: ['$costVariance', 0] } },
        },
      },
    ]),
    safeAggregate(ManufacturingWorkOrder, [
      { $match: dateMatch },
      {
        $group: {
          _id: '$orderNumber',
          status: { $first: '$status' },
          stage: { $first: '$wipStage' },
          planned: { $first: '$quantityPlanned' },
          produced: { $first: '$quantityProduced' },
          scrapped: { $first: '$quantityScrapped' },
          actualCost: { $first: '$totalActualCost' },
        },
      },
      { $sort: { planned: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(ManufacturingWorkOrder, [
      { $match: { ...tenantFilter, status: { $in: ['in_progress', 'quality_check', 'released'] } } },
      {
        $group: {
          _id: '$wipStage',
          ordersCount: { $sum: 1 },
          wipCost: { $sum: { $ifNull: ['$totalActualCost', 0] } },
        },
      },
      { $sort: { wipCost: -1 } },
    ]),
  ]);

  const stats = first(orderStats);
  const planned = num(stats.qtyPlanned);
  const produced = num(stats.qtyProduced);
  const scrapped = num(stats.qtyScrapped);
  const scrapRate = planned > 0 ? ((scrapped / planned) * 100).toFixed(1) : '0.0';
  const completionRate = planned > 0 ? ((produced / planned) * 100).toFixed(1) : '0.0';

  return {
    key: 'manufacturing',
    label: SECTION_LABELS.manufacturing,
    kpis: [
      { key: 'totalOrders', label: { en: 'Total Work Orders', ar: 'إجمالي أوامر الإنتاج' }, value: num(stats.totalOrders), format: 'number' },
      { key: 'qtyProduced', label: { en: 'Units Produced', ar: 'الوحدات المصنعة' }, value: produced, format: 'number' },
      { key: 'completionRate', label: { en: 'Completion Rate', ar: 'نسبة الإنجاز' }, value: completionRate, format: 'percent' },
      { key: 'scrapRate', label: { en: 'Scrap Rate', ar: 'نسبة الهدر والتالف' }, value: scrapRate, format: 'percent' },
      { key: 'totalActualCost', label: { en: 'Total Actual Production Cost', ar: 'إجمالي تكلفة الإنتاج الفعلية' }, value: num(stats.totalActualCost), format: 'money' },
      { key: 'totalVariance', label: { en: 'Cost Variance (Actual - Std)', ar: 'انحراف التكاليف' }, value: num(stats.totalVariance), format: 'money' },
    ],
    tables: [
      {
        key: 'workOrders',
        title: { en: 'Work Orders Progress & Cost Variance', ar: 'تقدم أوامر الإنتاج والتكلفة الفعلية' },
        columns: [
          { key: 'orderNumber', label: { en: 'WO #', ar: 'رقم الأمر' }, format: 'text' },
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'stage', label: { en: 'WIP Stage', ar: 'المرحلة' }, format: 'text' },
          { key: 'planned', label: { en: 'Planned', ar: 'المخطط' }, format: 'number' },
          { key: 'produced', label: { en: 'Produced', ar: 'المنجز' }, format: 'number' },
          { key: 'scrapped', label: { en: 'Scrapped', ar: 'التالف' }, format: 'number' },
          { key: 'actualCost', label: { en: 'Actual Cost', ar: 'التكلفة الفعلية' }, format: 'money' },
        ],
        rows: (topWorkOrders || []).map((row) => ({
          orderNumber: row._id,
          status: row.status,
          stage: row.stage,
          planned: num(row.planned),
          produced: num(row.produced),
          scrapped: num(row.scrapped),
          actualCost: num(row.actualCost),
        })),
      },
      {
        key: 'wipStages',
        title: { en: 'WIP Valuation by Production Stage', ar: 'تقييم الإنتاج تحت التشغيل حسب المرحلة' },
        columns: [
          { key: 'stage', label: { en: 'Stage', ar: 'المرحلة' }, format: 'text' },
          { key: 'ordersCount', label: { en: 'Active Orders', ar: 'الأوامر النشطة' }, format: 'number' },
          { key: 'wipCost', label: { en: 'WIP Value', ar: 'قيمة المخزون التشغيلي' }, format: 'money' },
        ],
        rows: (stageWip || []).map((row) => ({
          stage: row._id || 'General',
          ordersCount: num(row.ordersCount),
          wipCost: num(row.wipCost),
        })),
      },
    ],
  };
}

// ─── Boutique & Dress Rental ───────────────────────────────────────────────
async function buildBoutique({ tenantFilter, startDate, endDate }) {
  const matchRentals = {
    ...tenantFilter,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [rentalStats, topDresses, byStatus] = await Promise.all([
    safeAggregate(BoutiqueRental, [
      { $match: matchRentals },
      {
        $group: {
          _id: null,
          totalRentals: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$totalAmount', 0] }] } },
          totalDeposits: { $sum: { $ifNull: ['$pricing.depositAmount', 0] } },
          lateFees: { $sum: { $ifNull: ['$pricing.lateFee', 0] } },
          damageFees: { $sum: { $ifNull: ['$pricing.damageFee', 0] } },
        },
      },
    ]),
    safeAggregate(BoutiqueRental, [
      { $match: matchRentals },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$items.productName', 'Dress Item'] },
          rentalCount: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$items.lineTotal', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(BoutiqueRental, [
      { $match: matchRentals },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: { $ifNull: ['$pricing.totalAmount', 0] } } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const stats = first(rentalStats);

  return {
    key: 'boutique',
    label: SECTION_LABELS.boutique,
    kpis: [
      { key: 'totalRentals', label: { en: 'Total Dress Bookings', ar: 'إجمالي حجوزات الفساتين' }, value: num(stats.totalRentals), format: 'number' },
      { key: 'totalRevenue', label: { en: 'Total Rental Revenue', ar: 'إجمالي إيرادات التأجير' }, value: num(stats.totalRevenue), format: 'money' },
      { key: 'totalDeposits', label: { en: 'Security Deposits Held', ar: 'التأمينات المحصلة' }, value: num(stats.totalDeposits), format: 'money' },
      { key: 'damageLateFees', label: { en: 'Late & Damage Fees', ar: 'رسوم التأخير والأضرار' }, value: num(stats.lateFees) + num(stats.damageFees), format: 'money' },
    ],
    tables: [
      {
        key: 'topDresses',
        title: { en: 'Top Rented Boutique Items & Collections', ar: 'الفساتين والقطع الأكثر طلباً' },
        columns: [
          { key: 'productName', label: { en: 'Dress / Item', ar: 'القطعة / الفستان' }, format: 'text' },
          { key: 'rentalCount', label: { en: 'Times Rented', ar: 'مرات التأجير' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topDresses || []).map((row) => ({
          productName: row._id,
          rentalCount: num(row.rentalCount),
          revenue: num(row.revenue),
        })),
      },
      {
        key: 'byStatus',
        title: { en: 'Rentals by Reservation Status', ar: 'حالة عقود وحجوزات التأجير' },
        columns: [
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'count', label: { en: 'Contracts', ar: 'العقود' }, format: 'number' },
          { key: 'total', label: { en: 'Total Value', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (byStatus || []).map((row) => ({
          status: row._id || 'Unknown',
          count: num(row.count),
          total: num(row.total),
        })),
      },
    ],
  };
}

// ─── Car Workshop & Garage ─────────────────────────────────────────────────
async function buildWorkshop({ tenantFilter, startDate, endDate }) {
  const matchJobs = {
    ...tenantFilter,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [jobStats, statusList, recentJobs] = await Promise.all([
    safeAggregate(WorkshopJobCard, [
      { $match: matchJobs },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          completedJobs: { $sum: { $cond: [{ $in: ['$status', ['completed', 'delivered', 'invoiced']] }, 1, 0] } },
          totalRevenue: { $sum: { $ifNull: ['$totalCost', { $ifNull: ['$estimatedCost', 0] }] } },
          laborRevenue: { $sum: { $ifNull: ['$laborCost', 0] } },
          partsRevenue: { $sum: { $ifNull: ['$partsCost', 0] } },
        },
      },
    ]),
    safeAggregate(WorkshopJobCard, [
      { $match: matchJobs },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: { $ifNull: ['$totalCost', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    safeAggregate(WorkshopJobCard, [
      { $match: matchJobs },
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
      {
        $project: {
          jobCardNumber: 1,
          status: 1,
          customerComplaints: 1,
          totalCost: { $ifNull: ['$totalCost', '$estimatedCost'] },
          laborCost: { $ifNull: ['$laborCost', 0] },
          partsCost: { $ifNull: ['$partsCost', 0] },
        },
      },
    ]),
  ]);

  const stats = first(jobStats);

  return {
    key: 'car_workshop',
    label: SECTION_LABELS.car_workshop,
    kpis: [
      { key: 'totalJobs', label: { en: 'Total Job Cards', ar: 'إجمالي بطاقات الإصلاح' }, value: num(stats.totalJobs), format: 'number' },
      { key: 'completedJobs', label: { en: 'Completed Repairs', ar: 'الإصلاحات المنجزة' }, value: num(stats.completedJobs), format: 'number' },
      { key: 'totalRevenue', label: { en: 'Total Service Revenue', ar: 'إجمالي إيراد الصيانة' }, value: num(stats.totalRevenue), format: 'money' },
      { key: 'laborRevenue', label: { en: 'Labor Revenue', ar: 'إيراد أجور اليد' }, value: num(stats.laborRevenue), format: 'money' },
      { key: 'partsRevenue', label: { en: 'Parts Revenue', ar: 'إيراد قطع الغيار' }, value: num(stats.partsRevenue), format: 'money' },
    ],
    tables: [
      {
        key: 'recentJobs',
        title: { en: 'Workshop Job Cards & Repair Billing', ar: 'بطاقات الإصلاح وفواتير الصيانة' },
        columns: [
          { key: 'jobCardNumber', label: { en: 'Job Card #', ar: 'رقم البطاقة' }, format: 'text' },
          { key: 'status', label: { en: 'Status', ar: 'الحالة' }, format: 'text' },
          { key: 'complaints', label: { en: 'Diagnosis / Complaint', ar: 'الشكوى / الفحص' }, format: 'text' },
          { key: 'laborCost', label: { en: 'Labor (SAR)', ar: 'أجور اليد' }, format: 'money' },
          { key: 'partsCost', label: { en: 'Parts (SAR)', ar: 'قطع الغيار' }, format: 'money' },
          { key: 'totalCost', label: { en: 'Total (SAR)', ar: 'الإجمالي' }, format: 'money' },
        ],
        rows: (recentJobs || []).map((row) => ({
          jobCardNumber: row.jobCardNumber || '—',
          status: row.status || 'open',
          complaints: Array.isArray(row.customerComplaints) ? row.customerComplaints.join(', ') || 'Standard Service' : 'Standard Service',
          laborCost: num(row.laborCost),
          partsCost: num(row.partsCost),
          totalCost: num(row.totalCost),
        })),
      },
      {
        key: 'statusSummary',
        title: { en: 'Job Cards by Stage & Bay Status', ar: 'توزيع البطاقات حسب الحالة ومسار العمل' },
        columns: [
          { key: 'status', label: { en: 'Stage', ar: 'المرحلة' }, format: 'text' },
          { key: 'count', label: { en: 'Vehicles', ar: 'المركبات' }, format: 'number' },
          { key: 'total', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (statusList || []).map((row) => ({
          status: row._id || 'open',
          count: num(row.count),
          total: num(row.total),
        })),
      },
    ],
  };
}

// ─── Bookstore & Stationery ────────────────────────────────────────────────
async function buildBookstore({ tenantFilter, startDate, endDate }) {
  const matchRentals = {
    ...tenantFilter,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [bookStats, rentalStats, topBooks, lowStock] = await Promise.all([
    safeAggregate(BookStoreProduct, [
      { $match: { ...tenantFilter, isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: { $ifNull: ['$stockQuantity', 0] } },
          inventoryValue: { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, { $ifNull: ['$stockQuantity', 0] }] } },
          retailValue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$stockQuantity', 0] }] } },
        },
      },
    ]),
    safeAggregate(BookRental, [
      { $match: matchRentals },
      {
        $group: {
          _id: null,
          totalRentals: { $sum: 1 },
          activeRentals: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          rentalFees: { $sum: { $ifNull: ['$rentalFee', 0] } },
          lateFees: { $sum: { $ifNull: ['$lateFee', 0] } },
          depositsHeld: { $sum: { $cond: [{ $eq: ['$depositRefunded', false] }, { $ifNull: ['$depositAmount', 0] }, 0] } },
        },
      },
    ]),
    safeAggregate(BookStoreProduct, [
      { $match: { ...tenantFilter, isActive: { $ne: false } } },
      { $sort: { stockQuantity: -1 } },
      { $limit: 15 },
    ]),
    safeAggregate(BookStoreProduct, [
      { $match: { ...tenantFilter, isActive: { $ne: false }, stockQuantity: { $lte: 5 } } },
      { $sort: { stockQuantity: 1 } },
      { $limit: 10 },
    ]),
  ]);

  const bStats = first(bookStats);
  const rStats = first(rentalStats);

  return {
    key: 'bookstore',
    label: SECTION_LABELS.bookstore,
    kpis: [
      { key: 'totalTitles', label: { en: 'Total Book Titles / SKU', ar: 'إجمالي عناوين الكتب والقرطاسية' }, value: num(bStats.totalTitles), format: 'number' },
      { key: 'totalCopies', label: { en: 'In-Stock Copies', ar: 'النسخ المتوفرة بالمخزون' }, value: num(bStats.totalCopies), format: 'number' },
      { key: 'inventoryValue', label: { en: 'Inventory Cost Value', ar: 'قيمة المخزون بالتكلفة' }, value: num(bStats.inventoryValue), format: 'money' },
      { key: 'retailValue', label: { en: 'Inventory Retail Value', ar: 'القيمة السوقية للبيع' }, value: num(bStats.retailValue), format: 'money' },
      { key: 'activeRentals', label: { en: 'Active Book Rentals', ar: 'الكتب المستعارة حالياً' }, value: num(rStats.activeRentals), format: 'number' },
      { key: 'rentalRevenue', label: { en: 'Book Rental Income', ar: 'إيرادات الإعارة والتأجير' }, value: num(rStats.rentalFees) + num(rStats.lateFees), format: 'money' },
    ],
    tables: [
      {
        key: 'topBooks',
        title: { en: 'Books & Stationery Inventory Valuation', ar: 'عناوين الكتب وتقييم المخزون' },
        columns: [
          { key: 'title', label: { en: 'Title', ar: 'العنوان' }, format: 'text' },
          { key: 'isbn', label: { en: 'ISBN / Barcode', ar: 'الرقم المعياري' }, format: 'text' },
          { key: 'category', label: { en: 'Category', ar: 'التصنيف' }, format: 'text' },
          { key: 'stock', label: { en: 'In Stock', ar: 'المتوفر' }, format: 'number' },
          { key: 'price', label: { en: 'Price', ar: 'السعر' }, format: 'money' },
        ],
        rows: (topBooks || []).map((row) => ({
          title: row.titleEn || row.titleAr || row.name || 'Book Title',
          isbn: row.isbn || row.barcode || '—',
          category: row.category || 'General',
          stock: num(row.stockQuantity),
          price: num(row.price),
        })),
      },
      {
        key: 'lowStock',
        title: { en: 'Low Stock Books & Reorder Alerts', ar: 'تنبيهات انخفاض مخزون الكتب والقرطاسية' },
        columns: [
          { key: 'title', label: { en: 'Title', ar: 'العنوان' }, format: 'text' },
          { key: 'isbn', label: { en: 'ISBN', ar: 'الرقم المعياري' }, format: 'text' },
          { key: 'stock', label: { en: 'Current Stock', ar: 'المتوفر' }, format: 'number' },
        ],
        rows: (lowStock || []).map((row) => ({
          title: row.titleEn || row.titleAr || row.name || 'Book Title',
          isbn: row.isbn || '—',
          stock: num(row.stockQuantity),
        })),
      },
    ],
  };
}

// ─── Furniture Shop ────────────────────────────────────────────────────────
async function buildFurniture({ tenantFilter, startDate, endDate }) {
  const matchOrders = {
    ...tenantFilter,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [orderStats, stockStats, topFurniture] = await Promise.all([
    safeAggregate(FurnitureOrder, [
      { $match: matchOrders },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: { $ifNull: ['$totalAmount', 0] } },
          totalVat: { $sum: { $ifNull: ['$vatAmount', 0] } },
          customMadeOrders: { $sum: { $cond: [{ $eq: ['$isCustomOrder', true] }, 1, 0] } },
        },
      },
    ]),
    safeAggregate(FurnitureProduct, [
      { $match: { ...tenantFilter, isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          showroomPieces: { $sum: { $ifNull: ['$stockQuantity', 0] } },
          stockCost: { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, { $ifNull: ['$stockQuantity', 0] }] } },
          stockRetail: { $sum: { $multiply: [{ $ifNull: ['$sellingPrice', 0] }, { $ifNull: ['$stockQuantity', 0] }] } },
        },
      },
    ]),
    safeAggregate(FurnitureOrder, [
      { $match: matchOrders },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.productName', 'Furniture Piece'] },
          qtySold: { $sum: { $ifNull: ['$items.quantity', 1] } },
          revenue: { $sum: { $ifNull: ['$items.lineTotal', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]),
  ]);

  const oStats = first(orderStats);
  const sStats = first(stockStats);

  return {
    key: 'furniture_shop',
    label: SECTION_LABELS.furniture_shop,
    kpis: [
      { key: 'totalOrders', label: { en: 'Furniture Orders', ar: 'إجمالي طلبات الأثاث' }, value: num(oStats.totalOrders), format: 'number' },
      { key: 'totalSales', label: { en: 'Total Furniture Sales', ar: 'إجمالي مبيعات الأثاث' }, value: num(oStats.totalSales), format: 'money' },
      { key: 'showroomPieces', label: { en: 'Showroom Stock Pieces', ar: 'قطع الأثاث بالمعرض' }, value: num(sStats.showroomPieces), format: 'number' },
      { key: 'stockCost', label: { en: 'Showroom Inventory Cost', ar: 'تكلفة مخزون المعرض' }, value: num(sStats.stockCost), format: 'money' },
      { key: 'stockRetail', label: { en: 'Showroom Retail Value', ar: 'القيمة البيعية للمعرض' }, value: num(sStats.stockRetail), format: 'money' },
    ],
    tables: [
      {
        key: 'topFurniture',
        title: { en: 'Top Selling Furniture & Collections', ar: 'أطقم وقطع الأثاث الأكثر مبيعاً' },
        columns: [
          { key: 'name', label: { en: 'Collection / Piece', ar: 'القطعة / الطقم' }, format: 'text' },
          { key: 'qty', label: { en: 'Quantity Sold', ar: 'الكمية المباعة' }, format: 'number' },
          { key: 'revenue', label: { en: 'Revenue', ar: 'الإيراد' }, format: 'money' },
        ],
        rows: (topFurniture || []).map((row) => ({
          name: row._id,
          qty: num(row.qtySold),
          revenue: num(row.revenue),
        })),
      },
    ],
  };
}

const BUILDERS = {
  trading: buildTrading,
  construction: buildConstruction,
  construction_projects: buildConstruction,
  travel_agency: buildTravelAgency,
  restaurant: buildRestaurant,
  restaurant_cafe: buildRestaurant,
  car_rental: buildCarRental,
  laundry: buildLaundry,
  laundry_cleaning: buildLaundry,
  saloon: buildSaloon,
  saloon_barber: buildSaloon,
  khayyat: buildKhayyat,
  tailor_khayyat: buildKhayyat,
  boutique: buildBoutique,
  boutique_rental: buildBoutique,
  manpower: buildManpower,
  manpower_supply: buildManpower,
  bakala: buildBakala,
  bakala_supermarket: buildBakala,
  pharmacy: buildBakala,
  manufacturing: buildManufacturing,
  manufacturing_mes: buildManufacturing,
  car_workshop: buildWorkshop,
  workshop: buildWorkshop,
  bookstore: buildBookstore,
  bookstore_stationery: buildBookstore,
  furniture_shop: buildFurniture,
  furniture: buildFurniture,
};

export async function buildBusinessReports({ tenant, tenantFilter, startDate, endDate, only }) {
  const businessTypes = only ? [only] : getTenantBusinessTypes(tenant);
  const sections = [];

  for (const type of businessTypes) {
    const builder = BUILDERS[type];
    if (!builder) continue;
    try {
      sections.push(await builder({ tenantFilter, startDate, endDate }));
    } catch (error) {
      sections.push({ key: type, label: SECTION_LABELS[type] || { en: type, ar: type }, kpis: [], tables: [], error: error.message });
    }
  }

  return { businessTypes, sections };
}
