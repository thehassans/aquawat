import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

router.get('/', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    const searchRegex = new RegExp(query, 'i');
    const filter = { ...req.tenantFilter };

    const [invoices, customers, suppliers, purchaseOrders] = await Promise.all([
      Invoice.find({
        ...filter,
        $or: [
          { invoiceNumber: searchRegex },
          { 'buyer.name': searchRegex },
          { 'buyer.nameAr': searchRegex }
        ]
      }).limit(5).select('invoiceNumber buyer.name buyer.nameAr grandTotal status issueDate').lean(),
      
      Customer.find({
        ...filter,
        $or: [
          { name: searchRegex },
          { nameAr: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      }).limit(5).select('name nameAr phone email').lean(),
      
      Supplier.find({
        ...filter,
        $or: [
          { nameEn: searchRegex },
          { nameAr: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      }).limit(3).select('nameEn nameAr phone email').lean(),
      
      PurchaseOrder.find({
        ...filter,
        $or: [
          { poNumber: searchRegex },
          { 'supplier.nameEn': searchRegex }
        ]
      }).limit(3).select('poNumber supplier.nameEn totalAmount status').lean()
    ]);

    const results = [];

    invoices.forEach(i => {
      results.push({
        type: 'invoice',
        id: i._id,
        title: `${i.invoiceNumber} - ${i.buyer?.name || i.buyer?.nameAr || 'Unknown'}`,
        subtitle: `${i.grandTotal.toFixed(2)} SAR`,
        badge: i.status
      });
    });

    customers.forEach(c => {
      results.push({
        type: 'customer',
        id: c._id,
        title: c.name || c.nameAr,
        subtitle: c.phone || c.email || 'Customer',
      });
    });

    suppliers.forEach(s => {
      results.push({
        type: 'supplier',
        id: s._id,
        title: s.nameEn || s.nameAr,
        subtitle: s.phone || s.email || 'Supplier',
      });
    });

    purchaseOrders.forEach(p => {
      results.push({
        type: 'purchase_order',
        id: p._id,
        title: `${p.poNumber} - ${p.supplier?.nameEn || 'Unknown'}`,
        subtitle: `${p.totalAmount?.toFixed(2)} SAR`,
        badge: p.status
      });
    });

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
