import express from 'express';
import mongoose from 'mongoose';
import Warehouse from '../models/Warehouse.js';
import Product from '../models/Product.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading', 'bakala', 'pharmacy', 'furniture_shop', 'construction', 'manufacturing'));

// @route   GET /api/warehouses
router.get('/', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ ...req.tenantFilter, isActive: true })
      .sort({ isPrimary: -1, nameEn: 1 });
    
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/warehouses/stock-summary/stats
router.get('/stock-summary/stats', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const summary = await Product.aggregate([
      { $match: req.tenantFilter },
      { $unwind: "$stocks" },
      { $group: {
          _id: "$stocks.warehouseId",
          totalSKUs: { $sum: 1 },
          totalQuantity: { $sum: "$stocks.quantity" },
          totalValue: { $sum: { $multiply: ["$stocks.quantity", { $ifNull: ["$costPrice", 0] }] } }
      }}
    ]);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/warehouses/:id
router.get('/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/warehouses/:id/dashboard
router.get('/:id/dashboard', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
    
    const products = await Product.find({
      ...req.tenantFilter,
      'stocks.warehouseId': req.params.id,
      'stocks.quantity': { $gt: 0 }
    }).select('sku nameEn nameAr stocks category').lean();
    
    const inventory = products.map(p => {
      const stock = p.stocks.find(s => s.warehouseId?.toString() === req.params.id);
      return { product: p, quantity: stock?.quantity || 0, availableQuantity: (stock?.quantity || 0) - (stock?.reservedQuantity || 0) };
    });

    const PurchaseOrder = (await import('../models/PurchaseOrder.js')).default;
    const upcomingPOs = await PurchaseOrder.find({
      ...req.tenantFilter,
      'lineItems.receiveWarehouseId': req.params.id,
      status: { $in: ['issued', 'partially_received'] }
    }).sort({ expectedDate: 1 }).limit(10).lean();

    const GRN = (await import('../models/GRN.js')).default;
    const recentGRNs = await GRN.find({
      ...req.tenantFilter,
      warehouseId: req.params.id
    }).sort({ createdAt: -1 }).limit(10).lean();

    const PurchaseReturn = (await import('../models/PurchaseReturn.js')).default;
    const Invoice = (await import('../models/Invoice.js')).default;

    const recentReturns = await PurchaseReturn.find({
      ...req.tenantFilter,
      warehouseId: req.params.id
    }).sort({ createdAt: -1 }).limit(10).lean();

    const soldAggregation = await Invoice.aggregate([
      { $match: { ...req.tenantFilter, warehouseId: new mongoose.Types.ObjectId(req.params.id), status: { $in: ['issued', 'paid', 'partially_paid'] } } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.productId", totalSold: { $sum: "$lines.quantity" } } }
    ]);
    const soldMap = soldAggregation.reduce((acc, curr) => ({ ...acc, [curr._id?.toString()]: curr.totalSold }), {});

    const returnedAggregation = await PurchaseReturn.aggregate([
      { $match: { ...req.tenantFilter, warehouseId: new mongoose.Types.ObjectId(req.params.id), status: { $in: ['completed'] } } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.productId", totalReturned: { $sum: "$lines.quantityReturned" } } }
    ]);
    const returnedMap = returnedAggregation.reduce((acc, curr) => ({ ...acc, [curr._id?.toString()]: curr.totalReturned }), {});

    const enrichedInventory = inventory.map(item => ({
      ...item,
      totalSold: soldMap[item.product._id.toString()] || 0,
      totalReturned: returnedMap[item.product._id.toString()] || 0
    }));

    res.json({ warehouse, inventory: enrichedInventory, upcomingPOs, recentGRNs, recentReturns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/warehouses/:id/inventory
router.get('/:id/inventory', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const products = await Product.find({
      ...req.tenantFilter,
      'stocks.warehouseId': req.params.id
    })
      .select('sku nameEn nameAr barcode stocks category sellingPrice costPrice')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const inventoryItems = products.map(p => {
      const stock = p.stocks.find(s => s.warehouseId.toString() === req.params.id);
      return {
        product: {
          _id: p._id,
          sku: p.sku,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          barcode: p.barcode,
          category: p.category,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice
        },
        quantity: stock?.quantity || 0,
        reservedQuantity: stock?.reservedQuantity || 0,
        availableQuantity: (stock?.quantity || 0) - (stock?.reservedQuantity || 0),
        reorderPoint: stock?.reorderPoint || 0,
        location: stock?.location
      };
    });
    
    res.json({
      inventory: inventoryItems,
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/warehouses
router.post('/', checkTrialLimits('warehouses'), checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const warehouseData = {
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };
    
    const warehouse = await Warehouse.create(warehouseData);
    res.status(201).json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/warehouses/:id
router.put('/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/warehouses/:id
router.delete('/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    // Check if warehouse has stock
    const productsWithStock = await Product.countDocuments({
      ...req.tenantFilter,
      'stocks.warehouseId': req.params.id,
      'stocks.quantity': { $gt: 0 }
    });
    
    if (productsWithStock > 0) {
      return res.status(400).json({ error: 'Cannot delete warehouse with existing stock' });
    }
    
    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    res.json({ message: 'Warehouse deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
