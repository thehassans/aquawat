import express from 'express';
import Shipment from '../models/Shipment.js';
import Tenant from '../models/Tenant.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import DeliveryNote from '../models/DeliveryNote.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';
import { buildPremiumEmailShell, getTenantLoginUrl, getTenantWorkspaceHost, getTenantWorkspaceUrl } from '../utils/premiumEmailShell.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading', 'bakala', 'pharmacy', 'furniture_shop'));

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function sanitizeDeliveryRecipient(value = {}) {
  const address = value?.address || {};

  return {
    name: normalizeText(value?.name) || undefined,
    nameAr: normalizeText(value?.nameAr) || undefined,
    company: normalizeText(value?.company) || undefined,
    phone: normalizeText(value?.phone) || undefined,
    email: normalizeText(value?.email).toLowerCase() || undefined,
    referenceNumber: normalizeText(value?.referenceNumber) || undefined,
    instructions: normalizeText(value?.instructions) || undefined,
    address: {
      street: normalizeText(address?.street) || undefined,
      district: normalizeText(address?.district) || undefined,
      city: normalizeText(address?.city) || undefined,
      postalCode: normalizeText(address?.postalCode) || undefined,
      country: normalizeText(address?.country) || 'SA',
      buildingNumber: normalizeText(address?.buildingNumber) || undefined,
      additionalNumber: normalizeText(address?.additionalNumber) || undefined,
    },
  };
}

function buildShipmentEmailHtml({ shipment, language = 'en', tenant }) {
  const recipient = shipment?.deliveryRecipient || {};
  const customerName = normalizeText(recipient?.name)
    || normalizeText(recipient?.nameAr)
    || normalizeText(recipient?.company)
    || 'Customer';
  const shipmentNumber = normalizeText(shipment?.shipmentNumber) || 'Shipment';
  const trackingNumber = normalizeText(shipment?.trackingNumber);
  const carrier = normalizeText(shipment?.carrier);
  const expectedDelivery = shipment?.expectedDelivery
    ? new Date(shipment.expectedDelivery).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')
    : '';
  const companyName = normalizeText(tenant?.business?.legalNameEn || tenant?.name) || 'Maqder';
  const loginUrl = getTenantLoginUrl(tenant);
  const isAr = language === 'ar';

  return buildPremiumEmailShell({
    brandName: companyName,
    title: isAr ? `إذن التسليم ${shipmentNumber}` : `Delivery note ${shipmentNumber}`,
    body: isAr
      ? `مرحباً ${customerName}،\n\nمرفق لكم إذن التسليم الخاص بالشحنة.`
      : `Dear ${customerName},\n\nPlease find the delivery note attached for your shipment.`,
    secondaryLines: [
      { label: isAr ? 'المستلم' : 'Recipient', value: customerName },
      { label: isAr ? 'الشحنة' : 'Shipment', value: shipmentNumber },
      carrier ? { label: isAr ? 'شركة الشحن' : 'Carrier', value: carrier } : null,
      trackingNumber ? { label: isAr ? 'التتبع' : 'Tracking', value: trackingNumber } : null,
      expectedDelivery ? { label: isAr ? 'التسليم المتوقع' : 'Expected delivery', value: expectedDelivery } : null,
      { label: isAr ? 'مساحة العمل' : 'Workspace', value: getTenantWorkspaceHost(tenant), href: loginUrl },
    ].filter(Boolean),
    workspaceUrl: getTenantWorkspaceUrl(tenant),
    workspaceHost: getTenantWorkspaceHost(tenant),
    cta: { href: loginUrl, label: isAr ? 'فتح مساحة العمل' : 'Open workspace' },
    dir: isAr ? 'rtl' : 'ltr',
  });
}

async function generateShipmentNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `SHP-${y}${m}${d}`;

  const last = await Shipment.findOne({
    ...tenantFilterValue,
    shipmentNumber: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('shipmentNumber');

  let seq = 1;
  if (last?.shipmentNumber) {
    const parts = last.shipmentNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      type,
      supplierId,
      purchaseOrderId,
      warehouseId,
      search
    } = req.query;

    const query = { ...req.tenantFilter, isActive: true };

    if (status) query.status = status;
    if (type) query.type = type;
    if (supplierId) query.supplierId = supplierId;
    if (purchaseOrderId) query.purchaseOrderId = purchaseOrderId;
    if (warehouseId) query.warehouseId = warehouseId;

    if (search) {
      query.$or = [
        { shipmentNumber: { $regex: search, $options: 'i' } },
        { trackingNumber: { $regex: search, $options: 'i' } },
        { carrier: { $regex: search, $options: 'i' } },
        { 'deliveryRecipient.name': { $regex: search, $options: 'i' } },
        { 'deliveryRecipient.company': { $regex: search, $options: 'i' } },
        { 'deliveryRecipient.referenceNumber': { $regex: search, $options: 'i' } }
      ];
    }

    const shipments = await Shipment.find(query)
      .populate('supplierId', 'supplierCode name nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort({ shippedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Shipment.countDocuments(query);

    res.json({
      shipments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const stats = await Shipment.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          totals: [{ $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }, inTransit: { $sum: { $cond: [{ $eq: ['$status', 'in_transit'] }, 1, 0] } } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          recent: [
            { $sort: { shippedAt: -1, createdAt: -1 } },
            { $limit: 5 },
            { $project: { shipmentNumber: 1, status: 1, type: 1, shippedAt: 1, expectedDelivery: 1 } }
          ]
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true })
      .populate('supplierId', 'supplierCode name nameEn nameAr phone email')
      .populate('purchaseOrderId', 'poNumber status')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('lineItems.productId', 'sku nameEn nameAr barcode');

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('shipments'), checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    if (req.body.supplierId) {
      const supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
      if (!supplier) {
        return res.status(400).json({ error: 'Invalid supplier' });
      }
    }

    if (req.body.purchaseOrderId) {
      const po = await PurchaseOrder.findOne({ _id: req.body.purchaseOrderId, ...req.tenantFilter });
      if (!po) {
        return res.status(400).json({ error: 'Invalid purchase order' });
      }
    }

    if (req.body.warehouseId) {
      const wh = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
      if (!wh) {
        return res.status(400).json({ error: 'Invalid warehouse' });
      }
    }

    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const productIds = lineItems
      .map((li) => li.productId)
      .filter(Boolean)
      .map((id) => id.toString());

    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length) {
      const existingCount = await Product.countDocuments({ _id: { $in: uniqueProductIds }, ...req.tenantFilter });
      if (existingCount !== uniqueProductIds.length) {
        return res.status(400).json({ error: 'Invalid product in line items' });
      }
    }

    const shipmentNumber = req.body.shipmentNumber || (await generateShipmentNumber(req.tenantFilter));
    const deliveryRecipient = sanitizeDeliveryRecipient(req.body.deliveryRecipient || {});

    const data = {
      ...req.body,
      shipmentNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      deliveryRecipient,
      lineItems: lineItems.map((li) => ({
        productId: li.productId,
        description: li.description,
        quantity: toNumber(li.quantity, 0)
      }))
    };

    const shipment = await Shipment.create(data);
    res.status(201).json(shipment);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate shipment number' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const existing = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!existing) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (['delivered', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot update this shipment' });
    }

    if (req.body.supplierId) {
      const supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
      if (!supplier) {
        return res.status(400).json({ error: 'Invalid supplier' });
      }
    }

    if (req.body.purchaseOrderId) {
      const po = await PurchaseOrder.findOne({ _id: req.body.purchaseOrderId, ...req.tenantFilter });
      if (!po) {
        return res.status(400).json({ error: 'Invalid purchase order' });
      }
    }

    if (req.body.warehouseId) {
      const wh = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
      if (!wh) {
        return res.status(400).json({ error: 'Invalid warehouse' });
      }
    }

    const updateData = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'deliveryRecipient')) {
      updateData.deliveryRecipient = sanitizeDeliveryRecipient(req.body.deliveryRecipient || {});
    }

    if (Array.isArray(req.body.lineItems)) {
      updateData.lineItems = req.body.lineItems.map((li) => ({
        productId: li.productId,
        description: li.description,
        quantity: toNumber(li.quantity, 0)
      }));
    }

    const shipment = await Shipment.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, isActive: true },
      updateData,
      { new: true, runValidators: true }
    );

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/send-email', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (shipment.type !== 'outbound') {
      return res.status(400).json({ error: 'Only outbound shipments can send a delivery note' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true
      || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'));
    if (!hasEmailAddon) {
      return res.status(403).json({ error: 'Email automation add-on is not enabled for this tenant' });
    }

    const recipient = normalizeText(req.body?.to || shipment?.deliveryRecipient?.email).toLowerCase();
    if (!recipient) {
      return res.status(400).json({ error: 'Delivery recipient email is missing' });
    }

    const attachment = req.body?.attachment && typeof req.body.attachment === 'object'
      ? {
          filename: String(req.body.attachment.filename || `${shipment.shipmentNumber || 'delivery-note'}.png`).trim(),
          contentBase64: String(req.body.attachment.contentBase64 || '').trim(),
          contentType: String(req.body.attachment.contentType || 'image/png').trim() || 'image/png',
          size: Number(req.body.attachment.size || 0),
        }
      : null;

    if (!attachment?.contentBase64) {
      return res.status(400).json({ error: 'Delivery note attachment is required' });
    }

    const subject = `${shipment.shipmentNumber} Delivery Note | إذن تسليم ${shipment.shipmentNumber}`;
    const html = buildShipmentEmailHtml({
      shipment,
      tenant,
      language: req.body?.language === 'ar' ? 'ar' : 'en',
    });

    const delivery = await sendTenantEmail({
      tenant,
      to: recipient,
      subject,
      html,
      attachments: [attachment],
      metadata: { purpose: 'manual_delivery_note', shipmentNumber: shipment.shipmentNumber },
    });

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/mark-in-transit', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (shipment.status === 'cancelled' || shipment.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot change status' });
    }

    shipment.status = 'in_transit';
    if (!shipment.shippedAt) shipment.shippedAt = new Date();
    await shipment.save();

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/mark-delivered', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (shipment.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot deliver a cancelled shipment' });
    }

    shipment.status = 'delivered';
    shipment.deliveredAt = new Date();
    await shipment.save();

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/cancel', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (shipment.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel a delivered shipment' });
    }

    shipment.status = 'cancelled';
    await shipment.save();

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('supply_chain', 'delete'), async (req, res) => {
  try {
    const shipment = await Shipment.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ message: 'Shipment deactivated', shipment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/link-delivery-notes', checkPermission('supply_chain', 'update'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const shipment = await Shipment.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true }).session(session);
    if (!shipment) throw new Error('Shipment not found');
    
    if (shipment.type !== 'outbound') throw new Error('Only outbound shipments can carry Delivery Notes');
    
    const deliveryNoteIds = req.body.deliveryNoteIds || [];
    if (!deliveryNoteIds.length) throw new Error('No Delivery Note IDs provided');

    // Find all DNs
    const dns = await DeliveryNote.find({ _id: { $in: deliveryNoteIds }, tenantId: req.user.tenantId }).session(session);
    if (dns.length !== deliveryNoteIds.length) throw new Error('One or more Delivery Notes not found');

    for (const dn of dns) {
      if (dn.shipmentId && dn.shipmentId.toString() !== shipment._id.toString()) {
        throw new Error(`Delivery Note ${dn.dnNumber} is already linked to another shipment`);
      }
      dn.shipmentId = shipment._id;
      await dn.save({ session });
    }

    // Merge into shipment's deliveryNoteIds array
    const existingIds = shipment.deliveryNoteIds.map(id => id.toString());
    const newIds = deliveryNoteIds.filter(id => !existingIds.includes(id.toString()));
    shipment.deliveryNoteIds.push(...newIds);

    await shipment.save({ session });
    
    await session.commitTransaction();
    res.json({ message: 'Delivery Notes successfully linked to Shipment', shipment });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

export default router;
