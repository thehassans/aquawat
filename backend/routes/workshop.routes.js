import express from 'express';
import WorkshopVehicle from '../models/WorkshopVehicle.js';
import WorkshopJobCard from '../models/WorkshopJobCard.js';
import WorkshopEstimate from '../models/WorkshopEstimate.js';
import WorkshopInventoryItem from '../models/WorkshopInventoryItem.js';
import WorkshopPurchaseOrder from '../models/WorkshopPurchaseOrder.js';
import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

/* ═════════════════════════════════════════════════════════════
   HELPERS
   ═════════════════════════════════════════════════════════════ */

const VALID_TRANSITIONS = {
  checkin: ['legal_verification'],
  legal_verification: ['estimation'],
  estimation: ['waiting_approval'],
  waiting_approval: ['approved', 'rejected'],
  approved: ['in_progress'],
  rejected: ['estimation', 'cancelled'],
  in_progress: ['waiting_parts', 'quality_control'],
  waiting_parts: ['in_progress'],
  quality_control: ['ready_pickup'],
  ready_pickup: ['invoiced', 'delivered'],
  invoiced: ['delivered'],
  delivered: [],
  cancelled: [],
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

function computeJobCardTotals(body) {
  const laborItems = Array.isArray(body.assignedMechanics) ? body.assignedMechanics : [];
  const partsItems = Array.isArray(body.partsUsed) ? body.partsUsed : [];
  const laborTotal = laborItems.reduce((s, l) => s + ((l.actualHours || l.estimatedHours || 0) * (l.hourlyRate || 100)), 0);
  const partsTotal = partsItems.reduce((s, p) => s + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
  const subtotal = laborTotal + partsTotal - (body.discount || 0);
  const vatRate = body.vatRate ?? 15;
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;
  return { laborTotal, partsTotal, subtotal, vatRate, vatAmount, grandTotal };
}

/* ═════════════════════════════════════════════════════════════
   VEHICLES
   ═════════════════════════════════════════════════════════════ */

router.get('/vehicles', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { ...req.tenantFilter };
    if (search) {
      filter.$or = [
        { plateNumber: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }
    const vehicles = await WorkshopVehicle.find(filter).sort({ createdAt: -1 }).lean();
    res.json(vehicles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vehicles/:id/history', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const history = await WorkshopJobCard.find({ vehicleId: req.params.id, ...req.tenantFilter })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 }).lean();
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vehicles', checkPermission('workshop', 'create'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId };
    const vehicle = await WorkshopVehicle.create(data);
    res.status(201).json(vehicle);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/vehicles/:id', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const vehicle = await WorkshopVehicle.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter }, req.body, { new: true }
    );
    if (!vehicle) return res.status(404).json({ error: 'Not found' });
    res.json(vehicle);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/vehicles/:id', checkPermission('workshop', 'delete'), async (req, res) => {
  try {
    const vehicle = await WorkshopVehicle.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!vehicle) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═════════════════════════════════════════════════════════════
   JOB CARDS
   ═════════════════════════════════════════════════════════════ */

router.get('/job-cards', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const { status, vehicleId, customerId } = req.query;
    const filter = { ...req.tenantFilter };
    if (status) filter.status = status;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (customerId) filter.customerId = customerId;
    const cards = await WorkshopJobCard.find(filter)
      .populate('customerId', 'name phone email')
      .populate('vehicleId', 'plateNumber make model year color')
      .populate('assignedMechanics.employeeId', 'name')
      .populate('partsUsed.inventoryItemId', 'sku name')
      .sort({ createdAt: -1 }).lean();
    res.json(cards);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/job-cards/:id', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const card = await WorkshopJobCard.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('customerId', 'name phone email')
      .populate('vehicleId', 'plateNumber make model year color vin')
      .populate('assignedMechanics.employeeId', 'name')
      .populate('partsUsed.inventoryItemId', 'sku name quantityOnHand')
      .lean();
    if (!card) return res.status(404).json({ error: 'Not found' });
    res.json(card);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/job-cards', checkPermission('workshop', 'create'), async (req, res) => {
  try {
    const count = await WorkshopJobCard.countDocuments({ ...req.tenantFilter });
    const jobCardNumber = `JC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const totals = computeJobCardTotals(req.body);
    const data = { ...req.body, ...totals, tenantId: req.user.tenantId, jobCardNumber, createdBy: req.user._id };
    const card = await WorkshopJobCard.create(data);
    res.status(201).json(card);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/job-cards/:id', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const totals = computeJobCardTotals(req.body);
    const card = await WorkshopJobCard.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { ...req.body, ...totals },
      { new: true }
    );
    if (!card) return res.status(404).json({ error: 'Not found' });
    res.json(card);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/job-cards/:id', checkPermission('workshop', 'delete'), async (req, res) => {
  try {
    const card = await WorkshopJobCard.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!card) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─── STATUS TRANSITION (with guards + stock + invoice linkage) ─── */

router.post('/job-cards/:id/transition', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const { status: nextStatus } = req.body;
    const card = await WorkshopJobCard.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!card) return res.status(404).json({ error: 'Not found' });

    if (!canTransition(card.status, nextStatus)) {
      return res.status(400).json({ error: `Invalid transition from ${card.status} to ${nextStatus}` });
    }

    const updates = { status: nextStatus };

    // When moving to approved: verify estimate exists and customer approval
    if (nextStatus === 'approved') {
      if (card.repairPermit?.required && card.repairPermit.verificationStatus !== 'verified') {
        return res.status(400).json({ error: 'Repair permit must be verified before approval' });
      }
      if (!card.customerApproval?.approvedAt) {
        return res.status(400).json({ error: 'Customer approval is required before proceeding' });
      }
      updates.approvedAt = new Date();
    }

    // When moving to in_progress: deduct stock for partsUsed
    if (nextStatus === 'in_progress') {
      for (const part of (card.partsUsed || [])) {
        if (part.isFromStock && part.inventoryItemId && part.quantity > 0) {
          await WorkshopInventoryItem.updateOne(
            { _id: part.inventoryItemId, ...req.tenantFilter },
            { $inc: { quantityOnHand: -part.quantity } }
          );
        }
      }
      updates.workStartedAt = new Date();
    }

    // When moving to invoiced: create a linked invoice
    if (nextStatus === 'invoiced' && !card.invoiceId) {
      const invoiceNumber = `INV-${Date.now()}`;
      const invoice = await Invoice.create({
        tenantId: req.user.tenantId,
        invoiceType: 'sell',
        invoiceNumber,
        customerId: card.customerId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'unpaid',
        lineItems: [
          ...(card.assignedMechanics || []).map(m => ({
            description: m.taskDescription || 'Labor',
            quantity: m.actualHours || m.estimatedHours || 1,
            unitPrice: m.hourlyRate || 100,
            total: (m.actualHours || m.estimatedHours || 1) * (m.hourlyRate || 100),
          })),
          ...(card.partsUsed || []).map(p => ({
            description: p.description || 'Part',
            quantity: p.quantity || 1,
            unitPrice: p.unitPrice || 0,
            total: (p.quantity || 1) * (p.unitPrice || 0),
          })),
        ],
        subtotal: card.subtotal,
        vatRate: card.vatRate,
        vatAmount: card.vatAmount,
        grandTotal: card.grandTotal,
        discount: card.discount,
        notes: card.notes,
      });
      updates.invoiceId = invoice._id;
    }

    // When moving to delivered: close repair permit if required
    if (nextStatus === 'delivered' && card.repairPermit?.required) {
      updates.repairPermitClosed = true;
      updates.repairPermitClosedAt = new Date();
    }

    const updated = await WorkshopJobCard.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updates,
      { new: true }
    );
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─── CUSTOMER LOOKUP ─── */

router.get('/customers/lookup', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { ...req.tenantFilter };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    const customers = await Customer.find(filter).select('name phone email').limit(20).lean();
    res.json(customers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═════════════════════════════════════════════════════════════
   ESTIMATES
   ═════════════════════════════════════════════════════════════ */

router.get('/estimates', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    const estimates = await WorkshopEstimate.find(filter).sort({ createdAt: -1 }).lean();
    res.json(estimates);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/estimates', checkPermission('workshop', 'create'), async (req, res) => {
  try {
    const count = await WorkshopEstimate.countDocuments({ ...req.tenantFilter });
    const estimateNumber = `EST-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const data = { ...req.body, tenantId: req.user.tenantId, estimateNumber, createdBy: req.user._id };
    const estimate = await WorkshopEstimate.create(data);
    res.status(201).json(estimate);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/estimates/:id', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const estimate = await WorkshopEstimate.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter }, req.body, { new: true }
    );
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json(estimate);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ═════════════════════════════════════════════════════════════
   INVENTORY
   ═════════════════════════════════════════════════════════════ */

router.get('/inventory', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const { search, category } = req.query;
    const filter = { ...req.tenantFilter };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { oemPartNumbers: { $regex: search, $options: 'i' } },
      ];
    }
    const items = await WorkshopInventoryItem.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/inventory', checkPermission('workshop', 'create'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId };
    const item = await WorkshopInventoryItem.create(data);
    res.status(201).json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/inventory/:id', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const item = await WorkshopInventoryItem.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter }, req.body, { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/inventory/:id', checkPermission('workshop', 'delete'), async (req, res) => {
  try {
    const item = await WorkshopInventoryItem.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─── STOCK ADJUSTMENT ─── */

router.post('/inventory/:id/adjust-stock', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const { quantityChange, reason } = req.body;
    if (typeof quantityChange !== 'number') return res.status(400).json({ error: 'quantityChange must be a number' });
    const item = await WorkshopInventoryItem.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $inc: { quantityOnHand: quantityChange } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    // Push a stock movement log (stored inline since no separate model yet)
    item.stockMovements = item.stockMovements || [];
    item.stockMovements.push({
      type: quantityChange > 0 ? 'in' : 'out',
      quantity: Math.abs(quantityChange),
      reason: reason || 'Manual adjustment',
      adjustedBy: req.user._id,
      adjustedAt: new Date(),
    });
    await item.save();
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ═════════════════════════════════════════════════════════════
   PURCHASE ORDERS
   ═════════════════════════════════════════════════════════════ */

router.get('/purchase-orders', checkPermission('workshop', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    const pos = await WorkshopPurchaseOrder.find(filter).sort({ createdAt: -1 }).lean();
    res.json(pos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/purchase-orders', checkPermission('workshop', 'create'), async (req, res) => {
  try {
    const count = await WorkshopPurchaseOrder.countDocuments({ ...req.tenantFilter });
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const data = { ...req.body, tenantId: req.user.tenantId, poNumber, createdBy: req.user._id };
    const po = await WorkshopPurchaseOrder.create(data);
    res.status(201).json(po);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/purchase-orders/:id', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const po = await WorkshopPurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter }, req.body, { new: true }
    );
    if (!po) return res.status(404).json({ error: 'Not found' });
    res.json(po);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─── RECEIVE PO (add stock) ─── */

router.post('/purchase-orders/:id/receive', checkPermission('workshop', 'update'), async (req, res) => {
  try {
    const po = await WorkshopPurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!po) return res.status(404).json({ error: 'Not found' });
    if (po.status === 'received') return res.status(400).json({ error: 'Already received' });

    // Add stock for each line item
    for (const line of (po.lineItems || [])) {
      if (line.inventoryItemId) {
        await WorkshopInventoryItem.updateOne(
          { _id: line.inventoryItemId, ...req.tenantFilter },
          { $inc: { quantityOnHand: line.quantity } }
        );
      }
    }

    po.status = 'received';
    po.receivedAt = new Date();
    await po.save();
    res.json(po);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
