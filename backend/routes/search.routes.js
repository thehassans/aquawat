import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import GRN from '../models/GRN.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Quotation from '../models/Quotation.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const SHORTCUTS = [
  {
    keys: ['po', 'purchase order', 'purchase orders', 'أمر شراء', 'طلبات الشراء'],
    type: 'shortcut',
    title: 'Purchase Orders',
    titleAr: 'طلبات الشراء',
    subtitle: 'Open purchases orders',
    subtitleAr: 'فتح طلبات الشراء',
    path: '/app/dashboard/purchases/orders',
    badge: 'PO',
  },
  {
    keys: ['grn', 'goods receipt', 'receipt', 'receipts', 'إشعار استلام', 'استلام'],
    type: 'shortcut',
    title: 'Goods Receipt Notes',
    titleAr: 'إشعارات الاستلام',
    subtitle: 'Open GRN list',
    subtitleAr: 'فتح قائمة إشعارات الاستلام',
    path: '/app/dashboard/purchases/grn',
    badge: 'GRN',
  },
  {
    keys: ['product', 'products', 'منتج', 'منتجات'],
    type: 'shortcut',
    title: 'Products',
    titleAr: 'المنتجات',
    subtitle: 'Open inventory products',
    subtitleAr: 'فتح منتجات المخزون',
    path: '/app/dashboard/inventory/products',
    badge: 'Product',
  },
  {
    keys: ['supplier', 'suppliers', 'vendor', 'مورد', 'موردون'],
    type: 'shortcut',
    title: 'Suppliers',
    titleAr: 'الموردون',
    subtitle: 'Open suppliers',
    subtitleAr: 'فتح الموردين',
    path: '/app/dashboard/suppliers',
    badge: 'Supplier',
  },
  {
    keys: ['customer', 'customers', 'عميل', 'عملاء'],
    type: 'shortcut',
    title: 'Customers',
    titleAr: 'العملاء',
    subtitle: 'Open customers',
    subtitleAr: 'فتح العملاء',
    path: '/app/dashboard/customers',
    badge: 'Customer',
  },
  {
    keys: ['warehouse', 'warehouses', 'مستودع', 'مستودعات'],
    type: 'shortcut',
    title: 'Warehouses',
    titleAr: 'المستودعات',
    subtitle: 'Open warehouses',
    subtitleAr: 'فتح المستودعات',
    path: '/app/dashboard/inventory/warehouses',
    badge: 'Warehouse',
  },
  {
    keys: ['invoice', 'invoices', 'فاتورة', 'فواتير'],
    type: 'shortcut',
    title: 'Invoices',
    titleAr: 'الفواتير',
    subtitle: 'Open accounting invoices',
    subtitleAr: 'فتح فواتير المحاسبة',
    path: '/app/dashboard/accounting/invoices',
    badge: 'Invoice',
  },
  {
    keys: ['quotation', 'quotations', 'quote', 'quotes', 'عرض سعر', 'عروض الأسعار'],
    type: 'shortcut',
    title: 'Quotations',
    titleAr: 'عروض الأسعار',
    subtitle: 'Open quotations',
    subtitleAr: 'فتح عروض الأسعار',
    path: '/app/dashboard/quotations',
    badge: 'Quotation',
  },
];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 1) {
      return res.json({ results: [] });
    }

    const searchRegex = new RegExp(escapeRegex(query), 'i');
    const filter = { ...req.tenantFilter };
    const qLower = query.toLowerCase();
    const isAr = String(req.query.lang || '').toLowerCase() === 'ar';

    const [
      invoices,
      customers,
      suppliers,
      purchaseOrders,
      grns,
      products,
      warehouses,
      quotations,
    ] = await Promise.all([
      Invoice.find({
        ...filter,
        $or: [
          { invoiceNumber: searchRegex },
          { 'buyer.name': searchRegex },
          { 'buyer.nameAr': searchRegex },
        ],
      })
        .limit(5)
        .select('invoiceNumber buyer.name buyer.nameAr grandTotal status issueDate')
        .lean(),

      Customer.find({
        ...filter,
        $or: [
          { name: searchRegex },
          { nameAr: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
        ],
      })
        .limit(5)
        .select('name nameAr phone email')
        .lean(),

      Supplier.find({
        ...filter,
        $or: [
          { nameEn: searchRegex },
          { nameAr: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
        ],
      })
        .limit(3)
        .select('nameEn nameAr phone email')
        .lean(),

      PurchaseOrder.find({
        ...filter,
        $or: [
          { poNumber: searchRegex },
          { 'supplier.nameEn': searchRegex },
          { 'supplier.nameAr': searchRegex },
        ],
      })
        .limit(5)
        .select('poNumber supplier.nameEn supplier.nameAr totalAmount status')
        .lean(),

      GRN.find({
        ...filter,
        $or: [
          { grnNumber: searchRegex },
          { referenceNumber: searchRegex },
          { 'lines.productName': searchRegex },
          { 'lines.barcode': searchRegex },
        ],
      })
        .limit(5)
        .select('grnNumber referenceNumber status dateReceived purchaseOrderId')
        .populate({ path: 'purchaseOrderId', select: 'poNumber' })
        .lean(),

      Product.find({
        ...filter,
        $or: [
          { nameEn: searchRegex },
          { nameAr: searchRegex },
          { sku: searchRegex },
          { barcode: searchRegex },
          { productId: searchRegex },
          { brand: searchRegex },
        ],
      })
        .limit(5)
        .select('nameEn nameAr sku barcode productId sellingPrice')
        .lean(),

      Warehouse.find({
        ...filter,
        $or: [
          { code: searchRegex },
          { nameEn: searchRegex },
          { nameAr: searchRegex },
          { 'address.city': searchRegex },
        ],
      })
        .limit(5)
        .select('code nameEn nameAr type isActive')
        .lean(),

      Quotation.find({
        ...filter,
        $or: [
          { quotationNumber: searchRegex },
          { subject: searchRegex },
          { subjectAr: searchRegex },
          { 'buyer.name': searchRegex },
          { 'buyer.nameAr': searchRegex },
        ],
      })
        .limit(5)
        .select('quotationNumber subject buyer.name buyer.nameAr grandTotal status issueDate')
        .lean(),
    ]);

    const results = [];

    SHORTCUTS.forEach((shortcut) => {
      if (shortcut.keys.some((key) => key.includes(qLower) || qLower.includes(key))) {
        results.push({
          type: shortcut.type,
          id: shortcut.path,
          path: shortcut.path,
          title: isAr ? shortcut.titleAr : shortcut.title,
          subtitle: isAr ? shortcut.subtitleAr : shortcut.subtitle,
          badge: shortcut.badge,
        });
      }
    });

    invoices.forEach((i) => {
      results.push({
        type: 'invoice',
        id: i._id,
        title: `${i.invoiceNumber} - ${i.buyer?.name || i.buyer?.nameAr || 'Unknown'}`,
        subtitle: `${Number(i.grandTotal || 0).toFixed(2)} SAR`,
        badge: i.status,
      });
    });

    quotations.forEach((q) => {
      results.push({
        type: 'quotation',
        id: q._id,
        title: `${q.quotationNumber} - ${q.buyer?.name || q.buyer?.nameAr || q.subject || 'Quotation'}`,
        subtitle: q.subject || `${Number(q.grandTotal || 0).toFixed(2)} SAR`,
        badge: q.status,
      });
    });

    customers.forEach((c) => {
      results.push({
        type: 'customer',
        id: c._id,
        title: c.name || c.nameAr,
        subtitle: c.phone || c.email || 'Customer',
      });
    });

    suppliers.forEach((s) => {
      results.push({
        type: 'supplier',
        id: s._id,
        title: s.nameEn || s.nameAr,
        subtitle: s.phone || s.email || 'Supplier',
      });
    });

    purchaseOrders.forEach((p) => {
      results.push({
        type: 'purchase_order',
        id: p._id,
        title: `${p.poNumber} - ${p.supplier?.nameEn || p.supplier?.nameAr || 'Unknown'}`,
        subtitle: `${Number(p.totalAmount || 0).toFixed(2)} SAR`,
        badge: p.status,
      });
    });

    grns.forEach((g) => {
      const poLabel = g.purchaseOrderId?.poNumber ? ` · ${g.purchaseOrderId.poNumber}` : '';
      results.push({
        type: 'grn',
        id: g._id,
        title: g.grnNumber,
        subtitle: `${g.referenceNumber || 'GRN'}${poLabel}`,
        badge: g.status,
      });
    });

    products.forEach((p) => {
      results.push({
        type: 'product',
        id: p._id,
        title: p.nameEn || p.nameAr,
        subtitle: [p.sku, p.barcode, p.productId].filter(Boolean).join(' · ') || 'Product',
        badge: p.sellingPrice != null ? `${Number(p.sellingPrice).toFixed(2)} SAR` : undefined,
      });
    });

    warehouses.forEach((w) => {
      results.push({
        type: 'warehouse',
        id: w._id,
        title: w.nameEn || w.nameAr || w.code,
        subtitle: [w.code, w.type].filter(Boolean).join(' · ') || 'Warehouse',
        badge: w.isActive === false ? 'inactive' : 'active',
      });
    });

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
