import express from 'express';
import mongoose from 'mongoose';
import BoutiqueRental from '../models/BoutiqueRental.js';
import BoutiqueProduct from '../models/BoutiqueProduct.js';
import BoutiqueAlteration from '../models/BoutiqueAlteration.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/boutique/calendar?month=YYYY-MM
router.get('/calendar', async (req, res) => {
  try {
    const { month } = req.query;
    const targetDate = month ? new Date(month + '-01') : new Date();
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    const rentals = await BoutiqueRental.find({
      ...getTenantFilter(req),
      status: { $nin: ['cancelled', 'draft'] },
      $or: [
        { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
      ],
    })
      .select('rentalNumber customerName customerPhone startDate endDate status lineItems.productName lineItems.sku lineItems.size lineItems.color totalDeposit grandTotal')
      .lean();

    // Group by date for calendar
    const calendarData = {};
    rentals.forEach(r => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      for (let d = new Date(Math.max(start, startOfMonth)); d <= end && d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        if (!calendarData[dateKey]) calendarData[dateKey] = [];
        calendarData[dateKey].push({
          rentalId: r._id,
          rentalNumber: r.rentalNumber,
          customerName: r.customerName,
          status: r.status,
          items: r.lineItems?.map(li => ({ name: li.productName, sku: li.sku, size: li.size, color: li.color })) || [],
        });
      }
    });

    // Check for overdue
    const now = new Date();
    const overdue = rentals.filter(r => r.status === 'picked_up' && new Date(r.endDate) < now);

    res.json({
      month: targetDate.toISOString(),
      calendar: calendarData,
      totalRentals: rentals.length,
      overdueCount: overdue.length,
      overdue: overdue.map(r => ({ rentalId: r._id, rentalNumber: r.rentalNumber, customerName: r.customerName, customerPhone: r.customerPhone, endDate: r.endDate, daysLate: Math.ceil((now - new Date(r.endDate)) / (1000 * 60 * 60 * 24)) })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/boutique/alterations
router.get('/alterations', async (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const query = { ...getTenantFilter(req) };
    if (status) query.status = status;

    const [alterations, total] = await Promise.all([
      BoutiqueAlteration.find(query).sort({ dueDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      BoutiqueAlteration.countDocuments(query),
    ]);

    res.json({ alterations, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/boutique/alterations
router.post('/alterations', async (req, res) => {
  try {
    const { productId } = req.body;
    let productData = {};
    if (productId) {
      const product = await BoutiqueProduct.findOne({ _id: productId, ...getTenantFilter(req) });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      productData = { productName: product.name, sku: product.sku };
    }

    const alteration = await BoutiqueAlteration.create({
      ...req.body,
      ...productData,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(alteration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/boutique/alterations/:id
router.put('/alterations/:id', async (req, res) => {
  try {
    const alteration = await BoutiqueAlteration.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!alteration) return res.status(404).json({ error: 'Alteration not found' });
    res.json(alteration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/boutique/alterations/:id/status
router.put('/alterations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const alteration = await BoutiqueAlteration.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!alteration) return res.status(404).json({ error: 'Alteration not found' });

    alteration.status = status;
    if (status === 'completed') alteration.completedAt = new Date();
    await alteration.save();
    res.json(alteration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/boutique/alterations/:id
router.delete('/alterations/:id', async (req, res) => {
  try {
    const alteration = await BoutiqueAlteration.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!alteration) return res.status(404).json({ error: 'Alteration not found' });
    res.json({ message: 'Alteration deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/boutique/availability?productId=...&startDate=...&endDate=...
router.get('/availability', async (req, res) => {
  try {
    const { productId, startDate, endDate } = req.query;
    if (!productId || !startDate || !endDate) return res.status(400).json({ error: 'productId, startDate, endDate required' });

    const conflicts = await BoutiqueRental.find({
      ...getTenantFilter(req),
      'lineItems.productId': new mongoose.Types.ObjectId(productId),
      status: { $nin: ['cancelled', 'draft', 'closed'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
      ],
    }).select('rentalNumber customerName startDate endDate status');

    res.json({ available: conflicts.length === 0, conflicts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
