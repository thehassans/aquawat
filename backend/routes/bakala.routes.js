import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';
import { isFbrCurrency } from '../utils/fbrCurrency.js';
import { applyFbrToInvoice } from '../utils/fbr/FbrService.js';
import mongoose from 'mongoose';
import BakalaProduct from '../models/BakalaProduct.js';
import PosSession from '../models/PosSession.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

/**
 * Get all Bakala products for offline sync
 * GET /api/bakala/products
 */
router.get('/products', protect, async (req, res) => {
  try {
    const products = await BakalaProduct.find({ tenantId: req.user.tenantId, isActive: true })
      .select('name nameAr primaryBarcode retailPrice taxRate unit')
      .lean();
    res.json({ success: true, products });
  } catch (error) {
    console.error('Fetch Bakala Products Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync offline Bakala invoices to the server
 * POST /api/bakala/sync
 */
router.post('/sync', protect, async (req, res) => {
  try {
    const { invoices } = req.body; // Array of offline invoices
    const tenantId = req.user.tenantId;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ success: false, message: 'No invoices provided' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const zatcaConfig = tenant.zatca || {};
    const zatcaService = new ZatcaService({
      privateKey: zatcaConfig.privateKey,
      certificate: zatcaConfig.certificateSerialNumber, // Should be actual certificate in real scenario
      csid: zatcaConfig.productionCsid || zatcaConfig.complianceCsid,
      previousInvoiceHash: zatcaConfig.lastInvoiceHash
    });

    const syncedInvoices = [];
    const errors = [];

    // Process sequentially to maintain ZATCA chain hash
    for (const offlineInvoice of invoices) {
      try {
        // Prepare Invoice document
        const cleanedInvoice = {
          ...offlineInvoice,
          paymentMethod: offlineInvoice.paymentMethod === 'split' ? 'split' : (['mada', 'apple_pay'].includes(offlineInvoice.paymentMethod) ? 'card' : (offlineInvoice.paymentMethod || 'cash')),
          payments: offlineInvoice.payments || [],
          lineItems: offlineInvoice.lineItems?.map(line => {
            const l = { ...line };
            if (l.productId && !mongoose.Types.ObjectId.isValid(l.productId)) {
              delete l.productId;
            }
            return l;
          }) || []
        };

        // Determine initial status based on ZATCA phase (same logic as regular invoices)
        const requestedStatus = cleanedInvoice.status;
        const isDraft = String(requestedStatus || '').trim().toLowerCase() === 'draft';
        const initialStatus = isDraft
          ? 'draft'
          : (tenant.zatca?.phase === 1 ? 'approved' : 'pending');

        const newInvoice = new Invoice({
          ...cleanedInvoice,
          tenantId,
          flow: 'sell',
          businessContext: 'bakala',
          transactionType: 'B2C',
          invoiceTypeCode: '0200000', // Simplified tax invoice
          status: initialStatus,
          createdBy: req.user._id,
        });

        // Generate Invoice Number if missing
        if (!newInvoice.invoiceNumber) {
          const lastInvoice = await Invoice.findOne({ tenantId, invoiceNumber: { $regex: '^BAKALA-' } })
            .sort({ createdAt: -1 })
            .select('invoiceNumber');
          
          let seq = 1;
          if (lastInvoice && lastInvoice.invoiceNumber) {
            const parts = lastInvoice.invoiceNumber.split('-');
            const lastSeq = parseInt(parts[1], 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
          }
          newInvoice.invoiceNumber = `BAKALA-${seq}`;
        }

        // Apply ZATCA processing (SAR-only)
        if (zatcaConfig.isOnboarded && zatcaConfig.privateKey && isZatcaCurrency(tenant)) {
          const processed = await zatcaService.processInvoice(
            newInvoice.toObject(),
            tenant.business,
            true // isB2C
          );
          
          newInvoice.zatca = {
            ...processed,
            submissionStatus: 'pending' // Queued for background reporting worker
          };

          // Update tenant's last hash for chain
          tenant.zatca.lastInvoiceHash = processed.invoiceHash;
          tenant.zatca.invoiceCounter = processed.invoiceCounter;
        }

        if (isFbrCurrency(tenant)) {
          await applyFbrToInvoice(newInvoice, tenant, tenant.business);
        }

        await newInvoice.save();

        // FIFO Inventory Deduction
        for (const line of newInvoice.lineItems) {
          if (line.productId) {
            const bp = await BakalaProduct.findOne({ tenantId, _id: line.productId });
            if (bp) {
              let remainingQtyToDeduct = line.quantity;
              
              // Sort batches by expiryDate ascending (FIFO)
              if (bp.batches && bp.batches.length > 0) {
                bp.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                
                for (let i = 0; i < bp.batches.length && remainingQtyToDeduct > 0; i++) {
                  const batch = bp.batches[i];
                  if (batch.quantity > 0) {
                    const deduct = Math.min(batch.quantity, remainingQtyToDeduct);
                    batch.quantity -= deduct;
                    remainingQtyToDeduct -= deduct;
                  }
                }
              }
              
              // Deduct from overall stock
              bp.stockQuantity = (bp.stockQuantity || 0) - line.quantity;
              await bp.save();
            }
          }
        }

        syncedInvoices.push({ offlineId: offlineInvoice.offlineId, uuid: newInvoice.zatca?.uuid || newInvoice._id });
        
      } catch (err) {
        console.error('Invoice Sync Error for offlineId', offlineInvoice.offlineId, ':', err);
        errors.push({ offlineId: offlineInvoice.offlineId, error: err.message });
      }
    }

    if (zatcaConfig.isOnboarded && zatcaConfig.privateKey) {
      await tenant.save();
    }

    res.status(201).json({
      success: true,
      syncedInvoices,
      errors
    });
  } catch (error) {
    console.error('Bakala Sync Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

// --- POS Session / Shift Management ---

router.get('/shift/current', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    const requireShift = tenant?.settings?.bakala?.requireShift !== false;

    if (!requireShift) {
      // Return a mock session so POS works without forcing shift open
      return res.json({
        success: true,
        session: {
          _id: 'auto',
          tenantId: req.user.tenantId,
          userId: req.user._id,
          status: 'open',
          openingBalance: 0,
          openedAt: new Date(),
          cashDrops: []
        }
      });
    }

    const session = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open'
    });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/open', protect, async (req, res) => {
  try {
    const existing = await PosSession.findOne({ 
      tenantId: req.user.tenantId, 
      userId: req.user._id, 
      status: 'open' 
    });
    if (existing) return res.status(400).json({ success: false, message: 'Shift already open' });

    const session = new PosSession({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      openingBalance: req.body.openingBalance || 0
    });
    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/drop', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({ 
      tenantId: req.user.tenantId, 
      userId: req.user._id, 
      status: 'open' 
    });
    if (!session) return res.status(400).json({ success: false, message: 'No open shift' });

    session.cashDrops.push({
      amount: req.body.amount,
      reason: req.body.reason
    });
    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/close', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({ 
      tenantId: req.user.tenantId, 
      userId: req.user._id, 
      status: 'open' 
    });
    if (!session) return res.status(400).json({ success: false, message: 'No open shift' });

    session.closedAt = new Date();
    session.actualClosingBalance = req.body.actualClosingBalance || 0;
    session.totalSales = req.body.totalSales || 0;
    session.totalCash = req.body.totalCash || 0;
    session.totalCard = req.body.totalCard || 0;
    
    // Calculate expected (opening float + total cash - cash drops)
    const dropsTotal = session.cashDrops.reduce((acc, d) => acc + d.amount, 0);
    session.expectedClosingBalance = session.openingBalance + session.totalCash - dropsTotal;
    session.cashDiscrepancy = session.actualClosingBalance - session.expectedClosingBalance;
    
    session.status = 'closed';
    await session.save();
    
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
