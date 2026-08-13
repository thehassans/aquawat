import express from 'express';
import KhayyatStitching from '../../models/khayyat/KhayyatStitching.js';
import Customer from '../../models/Customer.js';
import KhayyatWorker from '../../models/khayyat/KhayyatWorker.js';
import User from '../../models/User.js';
import KhayyatEmbroideryDesign from '../../models/khayyat/KhayyatEmbroideryDesign.js';
import KhayyatFabric from '../../models/khayyat/KhayyatFabric.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';
import { checkTrialLimits } from '../../middleware/trialLimits.js';
import multer from 'multer';
import sharp from 'sharp';
import Tenant from '../../models/Tenant.js';
import whatsappService from '../../services/whatsappService.js';
import { saveUploadBuffer } from '../../utils/objectStorage.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });


const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

async function saveMeasurementImage(tenantId, buffer) {
  const tenantIdStr = String(tenantId);
  const filename = `measurement-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
  const key = `khayyat/${tenantIdStr}/measurements/${filename}`;
  const webp = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const { url } = await saveUploadBuffer({
    buffer: webp,
    key,
    contentType: 'image/webp',
    publicUrlPath: `/uploads/${key}`,
  });
  return url;
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, workerId, customerId } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 20));
    const query = { tenantId: req.user.tenantId };
    
    if (status) query.status = status;
    if (workerId) query.workerId = workerId;
    if (customerId) query.customerId = customerId;
    if (search) {
      const matchingCustomers = await Customer.find({
        tenantId: req.user.tenantId,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { khayyatReceiptNumbers: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').limit(20);
      const customerIds = matchingCustomers.map(c => c._id);

      query.$or = [
        { receiptNumber: { $regex: search, $options: 'i' } },
        { oldInvoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        ...(customerIds.length > 0 ? [{ customerId: { $in: customerIds } }] : [])
      ];
    }
    
    const [stitchings, total] = await Promise.all([
      KhayyatStitching.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .populate('customerId', 'name nameI18n phone khayyatReceiptNumbers khayyatHijriDate')
        .populate('workerId', 'name phone')
        .populate('fabricId', 'name madeIn pricePerRoll rollsInStock')
        .lean(),
      KhayyatStitching.countDocuments(query)
    ]);
    
    res.json({
      stitchings,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/khayyat/stitchings/search
router.get('/search', async (req, res) => {
  try {
    const { q, phone } = req.query;

    if (!q || String(q).trim().length < 1) {
      return res.json({ stitchings: [] });
    }

    const cleanQ = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = { tenantId: req.user.tenantId };

    const customerOrConditions = [
      { name: { $regex: cleanQ, $options: 'i' } },
      { phone: { $regex: cleanQ, $options: 'i' } },
      { khayyatReceiptNumbers: { $regex: cleanQ, $options: 'i' } },
    ];

    if (phone) {
      const phoneClean = String(phone).replace(/\D/g, '');
      if (phoneClean.length >= 3) {
        customerOrConditions.push({ phone: { $regex: phoneClean, $options: 'i' } });
      }
    }

    const matchingCustomers = await Customer.find({
      tenantId: req.user.tenantId,
      $or: customerOrConditions,
    }).select('_id').limit(20);
    const customerIds = matchingCustomers.map(c => c._id);

    query.$or = [
      { receiptNumber: { $regex: cleanQ, $options: 'i' } },
      { oldInvoiceNumber: { $regex: cleanQ, $options: 'i' } },
      { customerName: { $regex: cleanQ, $options: 'i' } },
      { customerPhone: { $regex: cleanQ, $options: 'i' } },
      ...(customerIds.length > 0 ? [{ customerId: { $in: customerIds } }] : []),
    ];

    const stitchings = await KhayyatStitching.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customerId', 'name nameI18n phone khayyatReceiptNumbers khayyatHijriDate')
      .populate('workerId', 'name phone')
      .lean();

    res.json({ stitchings });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/khayyat/stitchings/customer/:customerId
// Returns all stitchings for a specific customer (for customer profile page)
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 50));

    const query = {
      tenantId: req.user.tenantId,
      customerId,
    };

    const [stitchings, total] = await Promise.all([
      KhayyatStitching.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .populate('workerId', 'name phone')
        .populate('fabricId', 'name madeIn pricePerRoll')
        .lean(),
      KhayyatStitching.countDocuments(query),
    ]);

    res.json({
      stitchings,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const stitching = await KhayyatStitching.findOne({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId 
    })
      .populate('customerId')
      .populate('workerId', 'name phone')
      .populate('fabricId', 'name madeIn pricePerRoll rollsInStock');
    
    if (!stitching) {
      return res.status(404).json({ error: 'Stitching not found' });
    }

    if (!stitching.trackToken) {
      await stitching.save();
    }
    
    res.json({ stitching });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', checkTrialLimits('khayyatStitchings'), upload.single('measurementImage'), async (req, res) => {
  try {
    let { 
      customerId, 
      customerName,
      customerPhone,
      quantity, 
      price, 
      paidAmount,
      description, 
      dueDate,
      receiptNumber,
      orderNumber,
      thawbType,
      fabricColor,
      fabricId,
      customFabricName,
      rollsUsed,
      measurements,
      styleOptions,
      orderFor,
      orderForAr,
      orderForPhone
    } = req.body;

    if (typeof measurements === 'string') {
      try { measurements = JSON.parse(measurements); } catch (e) {}
    }
    if (typeof styleOptions === 'string') {
      try { styleOptions = JSON.parse(styleOptions); } catch (e) {}
    }

    let customer;
    if (customerId) {
      customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    } else {
      customer = new Customer({
        tenantId: req.user.tenantId,
        name: customerName,
        nameI18n: {
          en: customerName,
          ar: req.body.customerNameAr || customerName
        },
        phone: customerPhone,
      });
      await customer.save();
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (fabricId && rollsUsed > 0) {
      await KhayyatFabric.findOneAndUpdate(
        { _id: fabricId, tenantId: req.user.tenantId },
        { $inc: { rollsInStock: -rollsUsed } }
      );
    }

    let generatedReceiptNumber = receiptNumber;
    if (!generatedReceiptNumber) {
      const tenant = await Tenant.findOneAndUpdate(
        { _id: req.user.tenantId },
        { $inc: { 'settings.invoiceSequenceCounter': 1 } },
        { new: true }
      );
      let pattern = tenant?.settings?.invoiceSequencePattern || 'RCPT-{N}';
      const counterStr = String(tenant?.settings?.invoiceSequenceCounter || 1).padStart(4, '0');
      
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      
      pattern = pattern.replace(/{N}/g, counterStr)
                       .replace(/{YY}/g, yy)
                       .replace(/{MM}/g, mm);
                       
      generatedReceiptNumber = pattern;
    }

    const stitching = new KhayyatStitching({
      tenantId: req.user.tenantId,
      customerId: customer._id,
      customerName: customerName || customer.name,
      customerPhone: customerPhone || customer.phone,
      receiptNumber: generatedReceiptNumber,
      orderNumber: orderNumber || null,
      thawbType: thawbType || 'saudi',
      fabricColor: fabricColor || null,
      fabricId: fabricId || null,
      customFabricName: customFabricName || '',
      rollsUsed: rollsUsed || 0,
      measurements: measurements || {},
      styleOptions: styleOptions || {},
      quantity: quantity || 1,
      price: price || 0,
      paidAmount: paidAmount || 0,
      description: description || '',
      orderFor: orderFor || null,
      orderForAr: orderForAr || null,
      orderForPhone: orderForPhone || null,
      dueDate: dueDate || null
    });

    if (req.file) {
      stitching.measurementImage = await saveMeasurementImage(req.user.tenantId, req.file.buffer);
      stitching.measurementImageUpdatedAt = Date.now();
    }

    await stitching.save();

    try {
      const existingReceipts = (customer.khayyatReceiptNumbers || '').trim();
      const newReceipt = generatedReceiptNumber;
      let updatedReceipts;
      if (existingReceipts) {
        const receiptList = existingReceipts.split(',').map(r => r.trim()).filter(Boolean);
        if (!receiptList.includes(newReceipt)) {
          receiptList.push(newReceipt);
        }
        updatedReceipts = receiptList.join(', ');
      } else {
        updatedReceipts = newReceipt;
      }
      await Customer.updateOne(
        { _id: customer._id },
        { $set: { khayyatReceiptNumbers: updatedReceipts } }
      );
    } catch (e) {
      console.error('Failed to append receipt number to customer:', e);
    }

    res.status(201).json({ message: 'Stitching created successfully', stitching });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/:id', upload.single('measurementImage'), async (req, res) => {
  try {
    const stitching = await KhayyatStitching.findOne({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId 
    });
    
    if (!stitching) {
      return res.status(404).json({ error: 'Stitching not found' });
    }

    let { status, workerId, measurements, styleOptions, removeMeasurementImage, customerName, customerPhone, orderFor, orderForAr, orderForPhone } = req.body;

    if (typeof measurements === 'string') {
      try { measurements = JSON.parse(measurements); } catch (e) {}
    }
    if (typeof styleOptions === 'string') {
      try { styleOptions = JSON.parse(styleOptions); } catch (e) {}
    }

    if (status) stitching.status = status;
    if (workerId !== undefined) stitching.workerId = workerId || null;
    if (measurements) stitching.measurements = measurements;
    if (styleOptions) stitching.styleOptions = styleOptions;
    if (customerName) stitching.customerName = customerName;
    if (customerPhone) stitching.customerPhone = customerPhone;
    if (orderFor !== undefined) stitching.orderFor = orderFor || null;
    if (orderForAr !== undefined) stitching.orderForAr = orderForAr || null;
    if (orderForPhone !== undefined) stitching.orderForPhone = orderForPhone || null;

    if (removeMeasurementImage === 'true') {
      stitching.measurementImage = '';
      stitching.measurementImageUpdatedAt = Date.now();
    }

    if (req.file) {
      stitching.measurementImage = await saveMeasurementImage(req.user.tenantId, req.file.buffer);
      stitching.measurementImageUpdatedAt = Date.now();
    }

    await stitching.save();
    res.json({ message: 'Stitching updated successfully', stitching });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/complete-by-receipt', async (req, res) => {
  try {
    const { receiptNumber } = req.body;
    if (!receiptNumber) {
      return res.status(400).json({ error: 'Receipt number is required' });
    }

    const stitchings = await KhayyatStitching.find({
      tenantId: req.user.tenantId,
      $or: [
        { receiptNumber: { $regex: new RegExp(`^${receiptNumber}$`, 'i') } },
        { orderNumber: { $regex: new RegExp(`^${receiptNumber}$`, 'i') } }
      ]
    }).populate('customerId');

    if (!stitchings || stitchings.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let updatedCount = 0;
    let mainStitching = stitchings[0];

    for (const stitching of stitchings) {
      if (stitching.status !== 'completed' && stitching.status !== 'delivered') {
        stitching.status = 'completed';
        stitching.completedDate = Date.now();
        await stitching.save();
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return res.status(400).json({ error: 'Order(s) already completed or delivered' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    const lang = tenant?.settings?.khayyat?.whatsappLanguage || 'both';
    const tenantNameAr = tenant?.nameAr || tenant?.name || '';
    const tenantNameEn = tenant?.name || tenant?.nameAr || '';

    const phone = mainStitching.customerPhone || mainStitching.customerId?.phone;
    if (phone) {
      const msgAr = `مرحباً، طلبك رقم ${receiptNumber} جاهز للاستلام الآن من ${tenantNameAr}. شكراً لثقتكم بنا!`;
      const msgEn = `Hello, your order #${receiptNumber} is now ready for pickup from ${tenantNameEn}. Thank you for choosing us!`;
      
      let message = '';
      if (lang === 'ar') message = msgAr;
      else if (lang === 'en') message = msgEn;
      else message = `${msgAr}\n\n${msgEn}`;

      try {
        await whatsappService.sendText(req.user.tenantId, phone, message);
      } catch (waErr) {
        console.error('[WhatsApp] Failed to send order completion message:', waErr);
        // We do not fail the request if WhatsApp fails, just log it.
      }
    }

    res.json({ message: `Marked ${updatedCount} item(s) as completed`, stitchings });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
