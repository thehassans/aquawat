import express from 'express';
import Invoice from '../models/Invoice.js';
import Employee from '../models/Employee.js';
import Product from '../models/Product.js';
import Payroll from '../models/Payroll.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import TravelBooking from '../models/TravelBooking.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import RestaurantTable from '../models/RestaurantTable.js';
import RentalContract from '../models/RentalContract.js';
import RentalCar from '../models/RentalCar.js';
import LaundryOrder from '../models/LaundryOrder.js';
import SaloonOrder from '../models/SaloonOrder.js';
import SaloonAppointment from '../models/SaloonAppointment.js';
import KhayyatStitching from '../models/khayyat/KhayyatStitching.js';
import ManpowerWorker from '../models/ManpowerWorker.js';
import ManpowerAssignment from '../models/ManpowerAssignment.js';
import BakalaProduct from '../models/BakalaProduct.js';
import { ManufacturingWorkOrder, ManufacturingJobCard } from '../models/Manufacturing.js';
import BoutiqueRental from '../models/BoutiqueRental.js';
import BoutiqueProduct from '../models/BoutiqueProduct.js';
import WorkshopJobCard from '../models/WorkshopJobCard.js';
import WorkshopVehicle from '../models/WorkshopVehicle.js';
import BookStoreProduct from '../models/BookStoreProduct.js';
import BookRental from '../models/BookRental.js';
import FurnitureOrder from '../models/FurnitureOrder.js';
import FurnitureProduct from '../models/FurnitureProduct.js';
import Project from '../models/Project.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { getTenantBusinessTypes, normalizeBusinessTypes } from '../utils/businessTypes.js';
import { DEFAULT_APP_CATALOG } from './appStore.routes.js';
import { cacheAside } from '../lib/redis.js';
import { shouldScopeInvoicesToSelf, applyCreatedByScope } from '../utils/accessScope.js';
import { statsRead } from '../utils/mongoReadPreference.js';

// Dashboard aggregates ~24 collections per request (see below) — this is the
// single most expensive endpoint tenants hit on every page load. Values are
// cached for a short window per-tenant (cache-aside via Redis, gracefully
// falling back to a live computation when Redis is unavailable) to absorb
// repeated navigation/refresh hits without serving meaningfully stale data.
const DASHBOARD_CACHE_TTL_SECONDS = 120;
const DASHBOARD_STALE_TTL_SECONDS = 600;

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const safeAggregate = async (model, pipeline) => {
  try {
    return await statsRead(model.aggregate(pipeline));
  } catch (error) {
    return [];
  }
};

const safeCount = async (model, filter) => {
  try {
    return await statsRead(model.countDocuments(filter));
  } catch (error) {
    return 0;
  }
};

// @route   GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const cacheKey = `dashboard:v1:${req.tenant?._id || req.tenantFilter?.tenantId || 'unknown'}:${shouldScopeInvoicesToSelf(req.user) ? `u:${req.user._id}` : 'all'}`;
    const payload = await cacheAside(
      cacheKey,
      DASHBOARD_CACHE_TTL_SECONDS,
      () => buildDashboardPayload(req),
      { staleTtlSeconds: DASHBOARD_STALE_TTL_SECONDS, fetchTimeoutMs: 18_000 }
    );
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function buildDashboardPayload(req) {
    const businessTypes = getTenantBusinessTypes(req.tenant);
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const ownerInvoiceFilter = { ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(ownerInvoiceFilter, req.user._id);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const topProductsSince = new Date();
    topProductsSince.setMonth(topProductsSince.getMonth() - 6);

    const tenantInstalled = req.tenant?.settings?.installedApps || {};
    const hasBiz = (...types) => types.some((type) => businessTypes.includes(type));
    const skipAgg = Promise.resolve([]);

    const [
      invoiceStats,
      employeeStats,
      productStats,
      payrollStats,
      recentInvoices,
      expiringDocuments,
      recentCustomers,
      topProducts,
      todayStats,
      travelStats,
      restaurantStats,
      // Operational app stats
      rentalStats,
      laundryStats,
      saloonStats,
      khayyatStats,
      manpowerStats,
      bakalaStats,
      mfgStats,
      boutiqueStats,
      workshopStats,
      bookstoreStats,
      furnitureStats,
      projectStats
    ] = await Promise.all([
      // 1. Invoice stats
      safeAggregate(Invoice, [
        { $match: ownerInvoiceFilter },
        {
          $facet: {
            total: [
              { $match: { status: { $nin: ['draft', 'cancelled', 'credited'] } } },
              { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$taxableAmount' }, tax: { $sum: '$totalTax' }, discount: { $sum: { $ifNull: ['$totalDiscount', 0] } } } }
            ],
            thisMonth: [
              {
                $match: {
                  issueDate: { $gte: new Date(currentYear, currentMonth - 1, 1) },
                  status: { $nin: ['draft', 'cancelled', 'credited'] }
                }
              },
              { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$taxableAmount' }, discount: { $sum: { $ifNull: ['$totalDiscount', 0] } } } }
            ],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            zatcaStatus: [{ $group: { _id: '$zatca.submissionStatus', count: { $sum: 1 } } }]
          }
        }
      ]),
      
      // 2. Employee stats
      safeAggregate(Employee, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byNationality: [{ $group: { _id: '$nationality', count: { $sum: 1 } } }]
          }
        }
      ]),
      
      // 3. Product stats (Trading)
      safeAggregate(Product, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            totalValue: [{ $group: { _id: null, value: { $sum: { $multiply: ['$costPrice', '$totalStock'] } } } }],
            lowStock: [
              { $match: { $expr: { $lte: ['$totalStock', 10] } } },
              { $count: 'count' }
            ]
          }
        }
      ]),
      
      // 4. Payroll stats for current month
      safeAggregate(Payroll, [
        { $match: { ...req.tenantFilter, periodMonth: currentMonth, periodYear: currentYear } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalNet: { $sum: '$netPay' },
            totalGross: { $sum: '$grossPay' }
          }
        }
      ]),
      
      // 5. Recent invoices
      Invoice.find(ownerInvoiceFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('invoiceNumber buyer.name grandTotal status issueDate zatca.submissionStatus')
        .lean()
        .catch(() => []),
      
      // 6. Expiring documents
      safeAggregate(Employee, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $project: {
            employeeId: 1,
            firstNameEn: 1,
            lastNameEn: 1,
            expiryCandidates: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ['$documents', []] },
                    as: 'doc',
                    in: {
                      documentType: '$$doc.type',
                      documentNumber: '$$doc.number',
                      expiryDate: '$$doc.expiryDate'
                    }
                  }
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$nationalIdType', 'iqama'] },
                        { $ne: ['$nationalIdExpiry', null] }
                      ]
                    },
                    [{ documentType: 'iqama', documentNumber: '$nationalId', expiryDate: '$nationalIdExpiry' }],
                    []
                  ]
                }
              ]
            }
          }
        },
        { $unwind: '$expiryCandidates' },
        {
          $match: {
            'expiryCandidates.expiryDate': {
              $lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
              $gte: new Date()
            }
          }
        },
        {
          $project: {
            employeeId: 1,
            fullName: { $concat: ['$firstNameEn', ' ', '$lastNameEn'] },
            documentType: '$expiryCandidates.documentType',
            documentNumber: '$expiryCandidates.documentNumber',
            expiryDate: '$expiryCandidates.expiryDate'
          }
        },
        { $limit: 10 }
      ]),

      // 7. Recent customers
      Customer.find(ownerInvoiceFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name nameAr email phone type createdAt')
        .lean()
        .catch(() => []),

      // 8. Top products
      safeAggregate(Invoice, [
        { $match: { ...ownerInvoiceFilter, issueDate: { $gte: topProductsSince }, status: { $nin: ['draft', 'cancelled', 'credited'] } } },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productName',
            name: { $first: '$lineItems.productName' },
            nameAr: { $first: '$lineItems.productNameAr' },
            totalQty: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
            totalRevenue: {
              $sum: {
                $ifNull: [
                  '$lineItems.lineTotalWithTax',
                  { $multiply: ['$lineItems.quantity', '$lineItems.unitPrice'] }
                ]
              }
            }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]),

      // 9. Today's stats
      safeAggregate(Invoice, [
        {
          $match: {
            ...ownerInvoiceFilter,
            issueDate: { $gte: today, $lt: tomorrow },
            status: { $nin: ['draft', 'cancelled', 'credited'] }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$taxableAmount' }
          }
        }
      ]),

      // 10. Travel Agency
      hasBiz('travel_agency') ? safeAggregate(TravelBooking, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  revenue: { $sum: '$grandTotal' },
                  open: {
                    $sum: {
                      $cond: [{ $in: ['$status', ['draft', 'confirmed', 'ticketed']] }, 1, 0]
                    }
                  },
                  ticketed: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'ticketed'] }, 1, 0]
                    }
                  }
                }
              }
            ],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { bookingNumber: 1, status: 1, customerName: 1, grandTotal: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 11. Restaurant
      hasBiz('restaurant') ? safeAggregate(RestaurantOrder, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  revenue: { $sum: '$grandTotal' },
                  open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
                  preparing: { $sum: { $cond: [{ $eq: ['$status', 'in_kitchen'] }, 1, 0] } },
                  todayRevenue: {
                    $sum: {
                      $cond: [{ $gte: ['$createdAt', today] }, '$grandTotal', 0]
                    }
                  }
                }
              }
            ],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { orderNumber: 1, status: 1, tableNumber: 1, grandTotal: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 12. Car Rental
      hasBiz('car_rental') ? safeAggregate(RentalContract, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                  completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  revenue: { $sum: { $ifNull: ['$totalAmount', '$grandTotal'] } }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { contractNumber: 1, status: 1, customerName: 1, totalAmount: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 13. Laundry
      hasBiz('laundry') ? safeAggregate(LaundryOrder, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  received: { $sum: { $cond: [{ $eq: ['$status', 'received'] }, 1, 0] } },
                  inWash: { $sum: { $cond: [{ $in: ['$status', ['washing', 'drying', 'ironing']] }, 1, 0] } },
                  ready: { $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] } },
                  revenue: { $sum: '$grandTotal' }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { orderNumber: 1, status: 1, customerName: 1, grandTotal: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 14. Saloon & Barber
      hasBiz('saloon') ? safeAggregate(SaloonOrder, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  revenue: { $sum: '$grandTotal' },
                  todayOrders: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { orderNumber: 1, status: 1, customerName: 1, grandTotal: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 15. Tailor & Khayyat
      hasBiz('khayyat') ? safeAggregate(KhayyatStitching, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  inProgress: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'cutting', 'stitching']] }, 1, 0] } },
                  readyForFitting: { $sum: { $cond: [{ $eq: ['$status', 'ready_for_trial'] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { orderNumber: 1, customerName: 1, status: 1, deliveryDate: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 16. Manpower & Labor Supply
      hasBiz('manpower') ? safeAggregate(ManpowerWorker, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  deployed: { $sum: { $cond: [{ $eq: ['$status', 'deployed'] }, 1, 0] } },
                  available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } }
                }
              }
            ]
          }
        }
      ]) : skipAgg,

      // 17. Bakala & Supermarket
      hasBiz('bakala') || hasBiz('pharmacy') ? safeAggregate(BakalaProduct, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  lowStock: { $sum: { $cond: [{ $lte: ['$stock', 10] }, 1, 0] } },
                  totalStock: { $sum: '$stock' }
                }
              }
            ]
          }
        }
      ]) : skipAgg,

      // 18. Manufacturing & MES
      hasBiz('manufacturing') ? safeAggregate(ManufacturingWorkOrder, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  active: { $sum: { $cond: [{ $in: ['$status', ['released', 'in_progress']] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { workOrderNumber: 1, status: 1, plannedQty: 1, completedQty: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 19. Boutique & Dress Rental
      hasBiz('boutique') ? safeAggregate(BoutiqueRental, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  activeRentals: { $sum: { $cond: [{ $in: ['$status', ['reserved', 'picked_up']] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } }
                }
              }
            ]
          }
        }
      ]) : skipAgg,

      // 20. Car Workshop & Garage
      hasBiz('car_workshop') ? safeAggregate(WorkshopJobCard, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  openCards: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in_progress', 'quality_check']] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  revenue: { $sum: '$grandTotal' }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { jobCardNumber: 1, status: 1, grandTotal: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg,

      // 21. Bookstore & Stationery
      hasBiz('bookstore') ? safeAggregate(BookStoreProduct, [
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  lowStock: { $sum: { $cond: [{ $lte: ['$stock', 5] }, 1, 0] } }
                }
              }
            ]
          }
        }
      ]) : skipAgg,

      // 23. Furniture Showroom
      hasBiz('furniture_shop') ? safeAggregate(FurnitureOrder, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  inProduction: { $sum: { $cond: [{ $in: ['$status', ['in_production', 'confirmed']] }, 1, 0] } },
                  delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                  revenue: { $sum: '$grandTotal' }
                }
              }
            ]
          }
        }
      ]) : skipAgg,

      // 24. Construction & Contracting Projects
      hasBiz('construction') ? safeAggregate(Project, [
        { $match: { ...req.tenantFilter } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  active: { $sum: { $cond: [{ $in: ['$status', ['planned', 'in_progress']] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  avgProgress: { $avg: '$progress' },
                  totalBudget: { $sum: '$budget' }
                }
              }
            ],
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { code: 1, nameEn: 1, nameAr: 1, progress: 1, budget: 1, status: 1, createdAt: 1 } }
            ]
          }
        }
      ]) : skipAgg
    ]);

    // Build Active Installed Apps Catalog List
    const defaultCatalogMap = new Map(DEFAULT_APP_CATALOG.map(a => [a.appId, a]));
    const installedAppsList = DEFAULT_APP_CATALOG.map(app => {
      const explicit = tenantInstalled[app.appId];
      const isGrantedByBusinessType = app.businessTypeGrant && businessTypes.includes(app.businessTypeGrant);
      const isInstalled = !!explicit?.isInstalled || !!isGrantedByBusinessType;
      const isEnabled = explicit?.isEnabled !== false;
      return {
        appId: app.appId,
        nameEn: app.nameEn,
        nameAr: app.nameAr,
        category: app.category,
        appType: app.appType,
        icon: app.icon,
        badge: app.badge,
        defaultRoute: app.defaultRoute,
        businessTypeGrant: app.businessTypeGrant,
        isInstalled,
        isEnabled
      };
    });

    const appsOverview = {
      trading: {
        totalProducts: productStats[0]?.total[0]?.count || 0,
        stockValue: productStats[0]?.totalValue[0]?.value || 0,
        lowStock: productStats[0]?.lowStock[0]?.count || 0
      },
      travel_agency: travelStats[0] || { totals: [{ total: 0, revenue: 0, open: 0, ticketed: 0 }], byStatus: [], recent: [] },
      restaurant: restaurantStats[0] || { totals: [{ total: 0, revenue: 0, open: 0, preparing: 0, todayRevenue: 0 }], byStatus: [], recent: [] },
      car_rental: rentalStats[0] || { totals: [{ total: 0, activeCount: 0, completedCount: 0, revenue: 0 }], recent: [] },
      laundry: laundryStats[0] || { totals: [{ total: 0, received: 0, inWash: 0, ready: 0, revenue: 0 }], recent: [] },
      saloon: saloonStats[0] || { totals: [{ total: 0, revenue: 0, todayOrders: 0 }], recent: [] },
      khayyat: khayyatStats[0] || { totals: [{ total: 0, inProgress: 0, readyForFitting: 0, completed: 0 }], recent: [] },
      manpower: manpowerStats[0] || { totals: [{ total: 0, deployed: 0, available: 0 }] },
      bakala: bakalaStats[0] || { totals: [{ total: 0, lowStock: 0, totalStock: 0 }] },
      pharmacy: bakalaStats[0] || { totals: [{ total: 0, lowStock: 0, totalStock: 0 }] },
      manufacturing: mfgStats[0] || { totals: [{ total: 0, active: 0, completed: 0 }], recent: [] },
      boutique: boutiqueStats[0] || { totals: [{ total: 0, activeRentals: 0, completed: 0 }] },
      car_workshop: workshopStats[0] || { totals: [{ total: 0, openCards: 0, completed: 0, revenue: 0 }], recent: [] },
      bookstore: bookstoreStats[0] || { totals: [{ total: 0, lowStock: 0 }] },
      furniture_shop: furnitureStats[0] || { totals: [{ total: 0, inProduction: 0, delivered: 0, revenue: 0 }] },
      construction: projectStats[0] || { totals: [{ total: 0, active: 0, completed: 0, avgProgress: 0, totalBudget: 0 }], recent: [] },
      saudi_compliance: {
        zatcaStatuses: invoiceStats[0]?.zatcaStatus || [],
        expiringDocumentsCount: expiringDocuments?.length || 0,
        isPhase2Ready: req.tenant?.zatca?.isOnboarded || false
      }
    };
    
    return {
      invoices: {
        total: invoiceStats[0]?.total[0] || { count: 0, revenue: 0, tax: 0, discount: 0 },
        thisMonth: invoiceStats[0]?.thisMonth[0] || { count: 0, revenue: 0, discount: 0 },
        byStatus: invoiceStats[0]?.byStatus || [],
        zatcaStatus: invoiceStats[0]?.zatcaStatus || []
      },
      employees: {
        total: employeeStats[0]?.total[0]?.count || 0,
        byStatus: employeeStats[0]?.byStatus || [],
        byNationality: employeeStats[0]?.byNationality || []
      },
      products: {
        total: productStats[0]?.total[0]?.count || 0,
        totalValue: productStats[0]?.totalValue[0]?.value || 0,
        lowStock: productStats[0]?.lowStock[0]?.count || 0
      },
      payroll: {
        currentMonth: { month: currentMonth, year: currentYear },
        stats: payrollStats
      },
      recentInvoices,
      expiringDocuments,
      recentCustomers,
      topProducts,
      todayStats: todayStats[0] || { count: 0, revenue: 0 },
      travel: travelStats?.[0] || { totals: [{ total: 0, revenue: 0, open: 0 }], byStatus: [], recent: [] },
      restaurant: restaurantStats?.[0] || { totals: [{ total: 0, revenue: 0, open: 0 }], byStatus: [], recent: [] },
      appsOverview,
      installedApps: installedAppsList,
      activeBusinessTypes: businessTypes
    };
}

// @route   GET /api/dashboard/charts/revenue
router.get('/charts/revenue', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const cacheKey = `dashboard:v1:charts:revenue:${req.tenant?._id || req.tenantFilter?.tenantId || 'unknown'}:${months}:${shouldScopeInvoicesToSelf(req.user) ? `u:${req.user._id}` : 'all'}`;
    const merged = await cacheAside(cacheKey, DASHBOARD_CACHE_TTL_SECONDS, () => buildRevenueChart(req, months));
    return res.json(merged);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function buildRevenueChart(req, months) {
    const businessTypes = getTenantBusinessTypes(req.tenant);
    const ownerInvoiceFilter = { ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(ownerInvoiceFilter, req.user._id);
    }
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    
    const byKey = new Map();

    const addRevenue = (year, month, revenue, tax, count) => {
      const key = `${year}-${month}`;
      const existing = byKey.get(key) || { _id: { year, month }, revenue: 0, tax: 0, count: 0 };
      byKey.set(key, {
        _id: existing._id,
        revenue: existing.revenue + (revenue || 0),
        tax: existing.tax + (tax || 0),
        count: existing.count + (count || 0)
      });
    };
    
    // 1. Invoices (Trading, General ERP, Travel Agency, Construction)
    const invoiceRevenue = await safeAggregate(Invoice, [
      {
        $match: {
          ...ownerInvoiceFilter,
          issueDate: { $gte: startDate },
          status: { $nin: ['draft', 'cancelled', 'credited'] },
          flow: 'sell'
        }
      },
      {
        $facet: {
          standard: [
            {
              $group: {
                _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
                revenue: { $sum: { $ifNull: ['$taxableAmount', 0] } },
                tax: { $sum: { $ifNull: ['$totalTax', 0] } },
                count: { $sum: 1 }
              }
            }
          ],
          travelMargin: [
            { $unwind: '$lineItems' },
            { $match: { 'lineItems.isTravelMargin': true } },
            {
              $group: {
                _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
                revenue: { $sum: { $ifNull: ['$lineItems.marginTaxable', 0] } },
                tax: { $sum: { $ifNull: ['$lineItems.taxAmount', 0] } },
                count: { $sum: 0 }
              }
            }
          ]
        }
      }
    ]);

    invoiceRevenue[0]?.standard?.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    if (businessTypes.includes('travel_agency')) {
       invoiceRevenue[0]?.travelMargin?.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    }

    // 2. Car Rental
    if (businessTypes.includes('car_rental')) {
      const rentalRevenue = await safeAggregate(RentalContract, [
        {
          $match: {
            ...req.tenantFilter,
            createdAt: { $gte: startDate },
            status: { $in: ['active', 'completed'] }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: { $ifNull: ['$subtotal', 0] } },
            tax: { $sum: { $ifNull: ['$totalVat', 0] } },
            count: { $sum: 1 }
          }
        }
      ]);
      rentalRevenue.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    }

    // 3. Laundry
    if (businessTypes.includes('laundry')) {
      const laundryRevenue = await safeAggregate(LaundryOrder, [
        {
          $match: {
            ...req.tenantFilter,
            createdAt: { $gte: startDate },
            status: { $nin: ['cancelled'] }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: { $ifNull: ['$subtotal', 0] } },
            tax: { $sum: { $ifNull: ['$totalVat', 0] } },
            count: { $sum: 1 }
          }
        }
      ]);
      laundryRevenue.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    }

    // 4. Restaurant
    if (businessTypes.includes('restaurant')) {
      const restaurantRevenue = await safeAggregate(RestaurantOrder, [
        {
          $match: {
            ...req.tenantFilter,
            createdAt: { $gte: startDate },
            status: { $nin: ['cancelled'] }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: { $ifNull: ['$subtotal', 0] } },
            tax: { $sum: { $ifNull: ['$totalVat', 0] } },
            count: { $sum: 1 }
          }
        }
      ]);
      restaurantRevenue.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    }

    // 6. Car Workshop
    if (businessTypes.includes('car_workshop')) {
      const workshopRevenue = await safeAggregate(WorkshopJobCard, [
        {
          $match: {
            ...req.tenantFilter,
            createdAt: { $gte: startDate },
            status: { $in: ['completed', 'in_progress'] }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
            tax: { $sum: 0 },
            count: { $sum: 1 }
          }
        }
      ]);
      workshopRevenue.forEach(r => addRevenue(r._id.year, r._id.month, r.revenue, r.tax, r.count));
    }
    
    return Array.from(byKey.values()).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });
}

// @route   GET /api/dashboard/charts/expenses
router.get('/charts/expenses', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const cacheKey = `dashboard:v1:charts:expenses:${req.tenant?._id || req.tenantFilter?.tenantId || 'unknown'}:${months}`;
    const merged = await cacheAside(cacheKey, DASHBOARD_CACHE_TTL_SECONDS, () => buildExpensesChart(req, months));
    return res.json(merged);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function buildExpensesChart(req, months) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    
    const payrollExpenses = await safeAggregate(Payroll, [
      {
        $match: {
          ...req.tenantFilter,
          periodStart: { $gte: startDate },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: { year: '$periodYear', month: '$periodMonth' },
          salaries: { $sum: '$netPay' },
          gosi: { $sum: '$gosi.totalContribution' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const otherExpenses = await safeAggregate(Expense, [
      {
        $match: {
          ...req.tenantFilter,
          expenseDate: { $gte: startDate },
          status: 'paid',
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$expenseDate' },
            month: { $month: '$expenseDate' }
          },
          other: { $sum: { $ifNull: ['$amount', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const byKey = new Map();

    for (const row of payrollExpenses || []) {
      const key = `${row?._id?.year}-${row?._id?.month}`;
      byKey.set(key, {
        _id: row._id,
        salaries: row.salaries || 0,
        gosi: row.gosi || 0,
        other: 0
      });
    }

    for (const row of otherExpenses || []) {
      const key = `${row?._id?.year}-${row?._id?.month}`;
      const existing = byKey.get(key) || { _id: row._id, salaries: 0, gosi: 0, other: 0 };
      byKey.set(key, {
        _id: existing._id || row._id,
        salaries: existing.salaries || 0,
        gosi: existing.gosi || 0,
        other: (existing.other || 0) + (row.other || 0)
      });
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const ay = a?._id?.year || 0;
      const by = b?._id?.year || 0;
      if (ay !== by) return ay - by;
      const am = a?._id?.month || 0;
      const bm = b?._id?.month || 0;
      return am - bm;
    });
}

export default router;
