import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import sharp from 'sharp';
import BoutiqueProduct from '../models/BoutiqueProduct.js';
import BoutiqueRental from '../models/BoutiqueRental.js';
import Customer from '../models/Customer.js';
import {
  isProductAvailable,
  checkAvailabilityBatch,
  calculateRentalPrice,
  computeRentalTotals,
  enrichRentalLineItems,
  transitionRentalStatus,
} from '../services/boutiqueCalendarService.js';
import { generateBoutiqueThermalInvoice, queueZatcaReporting } from '../services/boutiqueZatcaService.js';
import { sendPaymentConfirmation } from '../services/boutiqueWhatsAppService.js';
import { generateZatcaQr } from '../lib/zatcaQr.js';
import QRCode from 'qrcode';
import { protect, checkPermission } from '../middleware/auth.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only image uploads are allowed'), ok);
  },
});

// All routes require authentication
router.use(protect);

/**
 * Helper: inject tenant filter from auth middleware into req.tenantFilter
 */
router.use((req, res, next) => {
  if (req.user?.tenantId) {
    req.tenantFilter = { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
  }
  next();
});

/* ─────── PRODUCTS ─────── */

// GET /api/boutique/products — list boutique products
router.get('/products', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const {
      search, category, mode, rentalStatus, isActive, page = 1, limit = 50,
    } = req.query;

    const filter = { ...req.tenantFilter };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (category) filter.category = category;
    if (mode === 'sale') filter.mode = { $in: ['FOR_SALE', 'BOTH'] };
    else if (mode === 'rental') filter.mode = { $in: ['FOR_RENT', 'BOTH'] };
    else if (mode) filter.mode = mode;
    if (rentalStatus) filter.rentalStatus = rentalStatus;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      BoutiqueProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      BoutiqueProduct.countDocuments(filter),
    ]);

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/products — create product
router.post('/products', checkPermission('boutique', 'write'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId };
    const product = await BoutiqueProduct.create(data);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/boutique/products/:id — update product
router.put('/products/:id', checkPermission('boutique', 'update'), async (req, res) => {
  try {
    const product = await BoutiqueProduct.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boutique/products/:id — soft delete
router.delete('/products/:id', checkPermission('boutique', 'delete'), async (req, res) => {
  try {
    const product = await BoutiqueProduct.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/upload-image — upload dress image
router.post('/upload-image', checkPermission('boutique', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `dress-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `boutique/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });
    res.json({ imageUrl });
  } catch (error) {
    console.error('Boutique image upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// POST /api/boutique/seed-demo — create demo dress
router.post('/seed-demo', checkPermission('boutique', 'write'), async (req, res) => {
  try {
    const existing = await BoutiqueProduct.findOne({ ...req.tenantFilter, sku: 'DEMO-SUIT-001' });
    if (existing) return res.status(409).json({ error: 'Demo dress already exists' });

    const demo = await BoutiqueProduct.create({
      tenantId: req.user.tenantId,
      name: 'Classic Black Evening Gown',
      nameAr: 'فستان سهرة أسود كلاسيكي',
      sku: 'DEMO-SUIT-001',
      category: 'Evening',
      size: 'M / 38',
      color: 'Black',
      mode: 'BOTH',
      dailyRate: 150,
      salePrice: 2500,
      rentalRates: [
        { days: 3, rate: 400 },
        { days: 7, rate: 800 },
        { days: 14, rate: 1400 },
      ],
      securityDeposit: 500,
      turnaroundHours: 24,
      rentalQuantity: 1,
      rentalStatus: 'available',
      description: 'Elegant floor-length black evening gown. Perfect for formal events, weddings, and galas. Dry-cleaned after every rental.',
      tags: ['evening', 'black', 'elegant', 'formal'],
      careInstructions: 'Dry clean only. Do not bleach. Store in garment bag.',
      isActive: true,
    });

    res.status(201).json({ message: 'Demo dress created', product: demo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────── AVAILABILITY ─────── */

// POST /api/boutique/availability — check if products are available for dates
router.post('/availability', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, startDate, endDate }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }

    const requests = items.map((i) => ({
      productId: new mongoose.Types.ObjectId(i.productId),
      startDate: new Date(i.startDate),
      endDate: new Date(i.endDate),
    }));

    const results = await checkAvailabilityBatch(requests);
    const mapped = Object.fromEntries(results);
    res.json({ available: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/availability/:productId — single product check
router.post('/availability/:productId', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const available = await isProductAvailable(
      new mongoose.Types.ObjectId(req.params.productId),
      new Date(startDate),
      new Date(endDate)
    );
    res.json({ available });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────── RENTALS ─────── */

// GET /api/boutique/rentals — list rentals
router.get('/rentals', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const { status, customerPhone, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (status) filter.status = status;
    if (customerPhone) filter.customerPhone = { $regex: customerPhone };

    const skip = (Number(page) - 1) * Number(limit);
    const [rentals, total] = await Promise.all([
      BoutiqueRental.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      BoutiqueRental.countDocuments(filter),
    ]);

    res.json({ rentals, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/boutique/rentals/pending-returns — rentals that are out and due back
router.get('/rentals/pending-returns', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const { overdue = 'false', page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter, transactionType: 'rental' };

    if (overdue === 'true') {
      filter.status = { $in: ['picked_up', 'late_return'] };
      filter.endDate = { $lt: new Date() };
    } else {
      filter.status = { $in: ['reserved', 'picked_up', 'late_return'] };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rentals, total] = await Promise.all([
      BoutiqueRental.find(filter)
        .sort({ endDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BoutiqueRental.countDocuments(filter),
    ]);

    res.json({ rentals, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/boutique/rentals/:id — single rental
router.get('/rentals/:id', checkPermission('boutique', 'read'), async (req, res) => {
  try {
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/rentals — create rental or sale (checkout)
router.post('/rentals', checkPermission('boutique', 'write'), async (req, res) => {
  try {
    const {
      customerName, customerNameAr, customerPhone, customerEmail, customerIdType,
      customerIdNumber,
      startDate, endDate, lineItems, staffNotes, transactionType = 'rental',
      discount = 0, vatApplicable = true,
      paymentMethod = 'cash',
      amountPaid = 0,
      securityDeposit
    } = req.body;

    const isSale = transactionType === 'sale';

    // 1. Enrich line items with pricing
    const enriched = await enrichRentalLineItems(lineItems, req.user.tenantId, transactionType);

    // 2. Verify availability for every item (rentals only)
    if (!isSale) {
      for (const item of enriched) {
        const available = await isProductAvailable(item.productId, new Date(startDate), new Date(endDate));
        if (!available) {
          return res.status(409).json({ error: `Product ${item.sku} is not available for the selected dates` });
        }
      }
    }

    // 3. Compute totals and apply discount
    const vatRate = vatApplicable === false ? 0 : 15;
    let totals = computeRentalTotals(enriched, vatRate);
    const appliedDiscount = Math.max(0, Math.min(Number(discount) || 0, totals.rentalSubtotal));
    totals.discount = appliedDiscount;
    const taxableBase = Math.max(0, totals.rentalSubtotal - appliedDiscount);
    totals.totalTax = Math.round(taxableBase * (vatRate / 100) * 100) / 100;
    // Allow manual override of security deposit from the POS
    if (securityDeposit !== undefined && securityDeposit !== null) {
      totals.totalDeposit = Math.max(0, Number(securityDeposit) || 0);
    }
    totals.grandTotal = Math.round((taxableBase + totals.totalTax + totals.totalDeposit) * 100) / 100;
    const paidAmount = Math.max(0, Number(amountPaid) || 0);
    const derivedPaymentStatus = paidAmount >= totals.grandTotal ? 'paid' : 'pending';

    // 4. Generate rental number
    const count = await BoutiqueRental.countDocuments(req.tenantFilter);
    const prefix = isSale ? 'SALE' : 'REN';
    const rentalNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;

    // 5. Create rental document
    const now = new Date();
    let rental = await BoutiqueRental.create({
      tenantId: req.user.tenantId,
      rentalNumber,
      customerName,
      customerNameAr,
      customerPhone,
      customerEmail,
      customerIdType,
      customerIdNumber,
      paymentMethod,
      paymentStatus: derivedPaymentStatus,
      amountPaid: paidAmount,
      transactionType,
      startDate: isSale ? now : new Date(startDate),
      endDate: isSale ? now : new Date(endDate),
      lineItems: enriched,
      ...totals,
      vatApplicable,
      status: isSale ? 'closed' : 'reserved',
      createdBy: req.user._id,
      staffNotes,
    });

    // 6. Ensure customer record exists and link it
    let customer = null;
    try {
      const phone = String(customerPhone || '').trim();
      if (phone) {
        customer = await Customer.findOne({ tenantId: req.user.tenantId, phone }).lean();
        if (!customer) {
          customer = await Customer.create({
            tenantId: req.user.tenantId,
            name: customerName,
            nameAr: customerNameAr,
            phone,
            email: customerEmail,
            vatNumber: customerIdNumber,
            type: 'individual',
          });
        } else {
          await Customer.findByIdAndUpdate(customer._id, {
            $set: {
              name: customerName || customer.name,
              nameAr: customerNameAr || customer.nameAr,
              email: customerEmail || customer.email,
              vatNumber: customerIdNumber || customer.vatNumber,
            },
          });
        }
        rental.customerId = customer._id;
        await rental.save();
      }
    } catch (customerErr) {
      console.error('Customer sync failed:', customerErr.message);
    }

    // 7. Auto-generate ZATCA invoice for receipt
    let invoice = null;
    let qrDataUrl = '';
    let qrPayload = '';
    if (req.tenant) {
      const tenant = req.tenant;
      const sellerName = tenant.business?.legalNameAr || tenant.business?.legalNameEn || tenant.name || 'Boutique';
      const vatNumber = tenant.business?.vatNumber || '000000000000000';
      const issueDate = rental.createdAt || new Date();

      // Always generate QR payload (never fails)
      qrPayload = generateZatcaQr({
        sellerName,
        vatNumber,
        invoiceDate: issueDate,
        totalAmount: rental.grandTotal,
        vatAmount: rental.totalTax,
      });

      // Always generate QR image data URL
      try {
        qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrErr) {
        console.error('QR image generation failed:', qrErr.message);
      }

      // Try to persist invoice (optional — must not fail the sale)
      try {
        const result = await generateBoutiqueThermalInvoice(rental, tenant);
        invoice = result.invoice;
        await queueZatcaReporting(invoice._id);
        // Link customer to invoice
        if (customer && invoice) {
          invoice.customerId = customer._id;
          invoice.buyer = {
            ...(invoice.buyer || {}),
            name: customerName,
            nameAr: customerNameAr,
            vatNumber: customerIdNumber || '',
          };
          await invoice.save();
          await Customer.updateOne(
            { _id: customer._id, tenantId: req.user.tenantId },
            {
              $inc: { totalInvoices: 1, totalRevenue: rental.grandTotal || 0 },
              $set: { lastInvoiceDate: invoice.issueDate || new Date() },
            }
          );
        }
        // Prefer the service-generated QR if available
        if (result.qrDataUrl) qrDataUrl = result.qrDataUrl;
      } catch (invoiceErr) {
        console.error('Invoice persistence failed:', invoiceErr.message);
      }
    }

    res.status(201).json({ ...rental.toObject(), invoice, qrDataUrl, qrPayload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/boutique/rentals/:id/status — transition status
router.patch('/rentals/:id/status', checkPermission('boutique', 'update'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    await transitionRentalStatus(rental, status, req.user._id, note || '');
    res.json(rental);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/boutique/rentals/:id/payment — record payment
router.post('/rentals/:id/payment', checkPermission('boutique', 'update'), async (req, res) => {
  try {
    const { method, amount, reference } = req.body;
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    rental.payments = rental.payments || [];
    rental.payments.push({ method, amount: Number(amount), reference, paidAt: new Date() });
    rental.amountPaid = (rental.amountPaid || 0) + Number(amount);

    // If fully paid, auto-transition reserved -> picked_up
    if (rental.status === 'reserved' && rental.amountPaid >= rental.grandTotal) {
      await transitionRentalStatus(rental, 'picked_up', req.user._id, 'Auto: payment received');
    } else {
      await rental.save();
    }

    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/rentals/:id/invoice — generate ZATCA invoice
router.post('/rentals/:id/invoice', checkPermission('boutique', 'write'), async (req, res) => {
  try {
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    if (rental.invoiceId) return res.status(409).json({ error: 'Invoice already generated for this rental' });

    const tenant = req.tenant; // set by auth middleware if available
    const result = await generateBoutiqueThermalInvoice(rental, tenant);
    await queueZatcaReporting(result.invoice._id);

    res.json({ invoice: result.invoice, qrDataUrl: result.qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/rentals/:id/whatsapp — send payment confirmation WhatsApp
router.post('/rentals/:id/whatsapp', checkPermission('boutique', 'write'), async (req, res) => {
  try {
    const { language, invoicePdfUrl } = req.body;
    await sendPaymentConfirmation(req.params.id, invoicePdfUrl, language || 'ar');
    res.json({ message: 'WhatsApp message queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/rentals/:id/inspection — record inspection
router.post('/rentals/:id/inspection', checkPermission('boutique', 'update'), async (req, res) => {
  try {
    const { condition, notes, photos, cleaningRequired, repairRequired, damageFeeApplied } = req.body;
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    rental.inspection = {
      inspectedAt: new Date(),
      inspectedBy: req.user._id,
      condition,
      notes,
      photos: photos || [],
      cleaningRequired: cleaningRequired || false,
      repairRequired: repairRequired || false,
      damageFeeApplied: Number(damageFeeApplied) || 0,
    };

    // Apply damage fee to totals
    if (damageFeeApplied > 0) {
      rental.totalDamageFee = (rental.totalDamageFee || 0) + Number(damageFeeApplied);
      const totals = computeRentalTotals(rental.lineItems, 15);
      rental.totalTax = totals.totalTax;
      rental.grandTotal = totals.grandTotal;
    }

    await rental.save();
    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boutique/rentals/:id/refund-deposit — refund security deposit
router.post('/rentals/:id/refund-deposit', checkPermission('boutique', 'update'), async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    const rental = await BoutiqueRental.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    const refundAmount = Number(amount) || rental.totalDeposit;
    rental.amountRefunded = (rental.amountRefunded || 0) + refundAmount;

    // Determine deposit status
    if (rental.amountRefunded >= rental.totalDeposit) {
      rental.depositStatus = 'fully_refunded';
    } else if (rental.amountRefunded > 0) {
      rental.depositStatus = 'partially_refunded';
    }

    rental.updateHistory.push({
      updatedAt: new Date(),
      updatedBy: req.user._id,
      fromStatus: rental.status,
      toStatus: rental.status,
      note: `Deposit refund: SAR ${refundAmount.toFixed(2)}. ${note || ''}`,
    });

    await rental.save();
    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
