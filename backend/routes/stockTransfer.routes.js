import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import StockTransfer from '../models/StockTransfer.js';
import { adjustProductStock } from '../services/inventoryAdjust.js';

const router = express.Router();
router.use(requireAuth);

// Get all transfers
router.get('/', async (req, res) => {
  try {
    const transfers = await StockTransfer.find({ tenantId: req.user.tenantId })
      .populate('sourceWarehouseId', 'nameEn nameAr')
      .populate('destinationWarehouseId', 'nameEn nameAr')
      .populate('shippedBy', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create transfer
router.post('/', async (req, res) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, notes, expectedArrivalDate, lines } = req.body;
    
    // Generate transfer number
    const count = await StockTransfer.countDocuments({ tenantId: req.user.tenantId });
    const transferNumber = `ST-${String(count + 1).padStart(5, '0')}`;

    const transfer = new StockTransfer({
      tenantId: req.user.tenantId,
      transferNumber,
      sourceWarehouseId,
      destinationWarehouseId,
      status: 'In Transit', // Auto in-transit for now
      shippedBy: req.user.id,
      notes,
      expectedArrivalDate,
      lines
    });

    // Deduct from source warehouse
    for (const line of lines) {
      await adjustProductStock({
        tenantId: req.user.tenantId,
        productId: line.productId,
        delta: -Math.abs(line.quantity),
        warehouseId: sourceWarehouseId
      });
    }

    await transfer.save();
    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Receive transfer
router.post('/:id/receive', async (req, res) => {
  try {
    const transfer = await StockTransfer.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Completed') return res.status(400).json({ error: 'Transfer already completed' });

    transfer.status = 'Completed';
    transfer.receivedBy = req.user.id;

    // Add to destination warehouse
    for (const line of transfer.lines) {
      await adjustProductStock({
        tenantId: req.user.tenantId,
        productId: line.productId,
        delta: Math.abs(line.quantity),
        warehouseId: transfer.destinationWarehouseId
      });
    }

    await transfer.save();
    res.json(transfer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
