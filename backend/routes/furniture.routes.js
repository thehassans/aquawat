import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import sharp from 'sharp';
import FurnitureProduct from '../models/FurnitureProduct.js';
import FurnitureOrder from '../models/FurnitureOrder.js';
import Customer from '../models/Customer.js';
import { generateBoutiqueThermalInvoice, queueZatcaReporting } from '../services/boutiqueZatcaService.js';
import { sendPaymentConfirmation } from '../services/boutiqueWhatsAppService.js';
import { generateZatcaQr } from '../lib/zatcaQr.js';
import QRCode from 'qrcode';
import { protect, checkPermission, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
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

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

router.use((req, res, next) => {
  if (req.user?.tenantId) {
    req.tenantFilter = { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
  }
  next();
});

/* ─────── PRODUCTS ─────── */

router.get('/products', checkPermission('furniture_shop', 'read'), async (req, res) => {
  try {
    const { search, category, isActive, page = 1, limit = 50 } = req.query;

    const filter = { ...req.tenantFilter };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      FurnitureProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      FurnitureProduct.countDocuments(filter),
    ]);

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', checkPermission('furniture_shop', 'write'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId };
    const product = await FurnitureProduct.create(data);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', checkPermission('furniture_shop', 'update'), async (req, res) => {
  try {
    const product = await FurnitureProduct.findOneAndUpdate(
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

router.delete('/products/:id', checkPermission('furniture_shop', 'delete'), async (req, res) => {
  try {
    const product = await FurnitureProduct.findOneAndUpdate(
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

router.post('/upload-image', checkPermission('furniture_shop', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `furniture-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `furniture/${tenantIdStr}/${filename}`;

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
    console.error('Furniture image upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Seed demo data with categories and images
router.post('/seed-demo', checkPermission('furniture_shop', 'write'), async (req, res) => {
  try {
    // Clean up old demo items
    await FurnitureProduct.deleteMany({
      ...req.tenantFilter,
      sku: { $regex: /^DEMO-/i }
    });

    const demoItems = [
      {
        tenantId: req.user.tenantId,
        name: 'Luxury Modern Sofa',
        nameAr: 'كنبة مودرن فاخرة',
        sku: 'DEMO-SOFA-002',
        category: 'Sofa',
        size: '3 Seater',
        color: 'Grey',
        salePrice: 0,
        primaryImage: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
        description: 'A luxurious 3-seater modern sofa in premium grey fabric.',
        isActive: true,
      },
      {
        tenantId: req.user.tenantId,
        name: 'King Size Oak Bed',
        nameAr: 'سرير خشب بلوط مقاس كينج',
        sku: 'DEMO-BED-002',
        category: 'Bed',
        size: 'King',
        color: 'Oak',
        salePrice: 0,
        primaryImage: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=800',
        description: 'Sturdy king size bed frame made from solid oak.',
        isActive: true,
      },
      {
        tenantId: req.user.tenantId,
        name: 'Persian Style Carpet',
        nameAr: 'سجادة بتصميم فارسي',
        sku: 'DEMO-CARPET-002',
        category: 'Carpet',
        size: '2x3m',
        color: 'Red/Gold',
        salePrice: 0,
        primaryImage: 'https://images.unsplash.com/photo-1600166898405-da9535204843?auto=format&fit=crop&q=80&w=800',
        description: 'Elegant persian style carpet with intricate red and gold patterns.',
        isActive: true,
      },
      {
        tenantId: req.user.tenantId,
        name: 'Traditional Majlis Set',
        nameAr: 'طقم مجلس تقليدي',
        sku: 'DEMO-MAJLIS-002',
        category: 'Majlis',
        size: '5 pieces',
        color: 'Beige',
        salePrice: 0,
        primaryImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=800',
        description: 'Comfortable 5-piece traditional floor seating majlis set.',
        isActive: true,
      }
    ];

    await FurnitureProduct.insertMany(demoItems);

    res.status(201).json({ message: 'Demo data created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────── ORDERS (POS) ─────── */

router.get('/orders', checkPermission('furniture_shop', 'read'), async (req, res) => {
  try {
    const { customerPhone, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (customerPhone) filter.customerPhone = { $regex: customerPhone };

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      FurnitureOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      FurnitureOrder.countDocuments(filter),
    ]);

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders', checkPermission('furniture_shop', 'write'), async (req, res) => {
  try {
    try {
      await mongoose.connection.collection('furnitureorders').dropIndex('tenantId_1_rentalNumber_1');
    } catch (e) {}

    const {
      customerName, customerNameAr, customerPhone, customerEmail, customerIdType,
      customerIdNumber, lineItems, staffNotes, discount = 0, vatApplicable = true,
      paymentMethod = 'cash', amountPaid = 0
    } = req.body;

    // lineItems: [{ productId, productName, sku, quantity, unitPrice }]

    let subtotal = 0;
    const enrichedItems = lineItems.map(item => {
      const lineTotal = Number(item.unitPrice) * Number(item.quantity);
      subtotal += lineTotal;
      return {
        productId: item.productId,
        productName: item.productName,
        productNameAr: item.productNameAr,
        sku: item.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal
      };
    });

    const vatRate = vatApplicable === false ? 0 : 15;
    const appliedDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
    const taxableBase = Math.max(0, subtotal - appliedDiscount);
    const totalTax = Math.round(taxableBase * (vatRate / 100) * 100) / 100;
    const grandTotal = Math.round((taxableBase + totalTax) * 100) / 100;
    const paidAmount = Math.max(0, Number(amountPaid) || 0);
    const paymentStatus = paidAmount >= grandTotal ? 'paid' : 'pending';

    const count = await FurnitureOrder.countDocuments(req.tenantFilter);
    const orderNumber = `FUR-${String(count + 1).padStart(5, '0')}`;

    let order = await FurnitureOrder.create({
      tenantId: req.user.tenantId,
      orderNumber,
      customerName,
      customerNameAr,
      customerPhone,
      customerEmail,
      customerIdType,
      customerIdNumber,
      paymentMethod,
      paymentStatus,
      amountPaid: paidAmount,
      lineItems: enrichedItems,
      subtotal,
      discount: appliedDiscount,
      vatApplicable,
      totalTax,
      grandTotal,
      createdBy: req.user._id,
      staffNotes,
    });

    // Customer sync
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
        order.customerId = customer._id;
        await order.save();
      }
    } catch (customerErr) {
      console.error('Customer sync failed:', customerErr.message);
    }

    // Auto-generate ZATCA thermal invoice
    let invoice = null;
    let qrDataUrl = '';
    let qrPayload = '';
    if (req.tenant) {
      const tenant = req.tenant;
      const sellerName = tenant.business?.legalNameAr || tenant.business?.legalNameEn || tenant.name || 'Furniture Shop';
      const vatNumber = tenant.business?.vatNumber || '000000000000000';
      const issueDate = order.createdAt || new Date();

      qrPayload = generateZatcaQr({
        sellerName,
        vatNumber,
        invoiceDate: issueDate,
        totalAmount: order.grandTotal,
        vatAmount: order.totalTax,
      });

      try {
        qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrErr) {
        console.error('QR image generation failed:', qrErr.message);
      }

      try {
        order.businessContext = 'furniture';
        const result = await generateBoutiqueThermalInvoice(order, tenant);
        invoice = result.invoice;
        await queueZatcaReporting(invoice._id);
        
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
              $inc: { totalInvoices: 1, totalRevenue: order.grandTotal || 0 },
              $set: { lastInvoiceDate: invoice.issueDate || new Date() },
            }
          );
        }
        if (result.qrDataUrl) qrDataUrl = result.qrDataUrl;
      } catch (invoiceErr) {
        console.error('Invoice persistence failed:', invoiceErr.message);
      }
    }

    res.status(201).json({ ...order.toObject(), invoice, qrDataUrl, qrPayload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
