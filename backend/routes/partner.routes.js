import express from 'express';
import sharp from 'sharp';
import Partner from '../models/Partner.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { createImageUpload } from '../utils/uploadMime.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';
import {
  fromPartnerBody,
  toPartnerDto,
  nextCustomerCode,
  nextSupplierCode,
  validateSaVat,
  inheritFromParentCompany,
  PARTNER_POPULATE,
} from '../services/partnerService.js';

const router = express.Router();
const logoUpload = createImageUpload({ fileSize: 512 * 1024 });

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function canReadPartners(user) {
  return user?.role === 'super_admin'
    || user?.role === 'admin'
    || user?.hasPermission?.('invoicing', 'read')
    || user?.hasPermission?.('supply_chain', 'read');
}

function canWritePartners(user) {
  return user?.role === 'super_admin'
    || user?.role === 'admin'
    || user?.hasPermission?.('invoicing', 'create')
    || user?.hasPermission?.('invoicing', 'update')
    || user?.hasPermission?.('supply_chain', 'create')
    || user?.hasPermission?.('supply_chain', 'update');
}

// @route   GET /api/partners/search
router.get('/search', async (req, res) => {
  try {
    if (!canReadPartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim();
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 15));

    const match = { ...req.tenantFilter, isActive: { $ne: false }, mergedIntoId: null };
    if (type === 'business' || type === 'company') match.type = 'business';
    if (type === 'individual') match.type = 'individual';
    if (q) {
      match.$or = [
        { name: { $regex: q, $options: 'i' } },
        { nameEn: { $regex: q, $options: 'i' } },
        { nameAr: { $regex: q, $options: 'i' } },
        { customerCode: { $regex: q, $options: 'i' } },
        { supplierCode: { $regex: q, $options: 'i' } },
        { vatNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const rows = await Partner.find(match)
      .select('name nameEn nameAr type customerCode supplierCode vatNumber address receivableAccountId payableAccountId paymentTermsCustomer paymentTermsVendor crNumber')
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    res.json({ partners: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/partners/export
router.post('/export', async (req, res) => {
  try {
    if (!canReadPartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { ids = [] } = req.body || {};
    const query = { ...req.tenantFilter };
    if (Array.isArray(ids) && ids.length) {
      query._id = { $in: ids.map(String).filter(Boolean) };
    } else {
      query.$or = [{ isCustomer: true }, { isVendor: true }, { isEmployee: true }];
    }

    const rows = await Partner.find(query)
      .select('-landedCostHistory -khayyatMeasurements -khayyatRelations')
      .sort({ name: 1 })
      .limit(ids.length ? Math.min(500, ids.length) : 10000)
      .lean();

    res.json({ partners: rows.map((r) => toPartnerDto(r)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/partners/upload-logo
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!canWritePartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const tenantId = String(req.user.tenantId);
    const key = `partners/${tenantId}/logo-${Date.now()}.webp`;
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const { url } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });

    res.json({ logoUrl: url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/partners/:id
router.get('/:id', async (req, res) => {
  try {
    if (!canReadPartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const partner = await Partner.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate(PARTNER_POPULATE);

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(toPartnerDto(partner));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/partners
router.post('/', async (req, res) => {
  try {
    if (!canWritePartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    let data = fromPartnerBody({ ...req.body, tenantId: req.user.tenantId });

    if (!data.isCustomer && !data.isVendor && !data.isEmployee) {
      return res.status(400).json({ error: 'Select at least one role: customer, vendor, or employee' });
    }

    const country = data.address?.country || 'SA';
    if (data.type === 'business' && data.vatNumber) {
      const vatCheck = validateSaVat(data.vatNumber, country);
      if (!vatCheck.ok) return res.status(400).json({ error: vatCheck.error });
    }

    if (data.parentCompanyId) {
      const parent = await Partner.findOne({ _id: data.parentCompanyId, tenantId: req.user.tenantId });
      if (!parent || parent.type !== 'business') {
        return res.status(400).json({ error: 'Parent must be a company partner' });
      }
      data = await inheritFromParentCompany(data, req.user.tenantId);
    }

    if (data.vatNumber) {
      const dup = await Partner.findOne({ tenantId: req.user.tenantId, vatNumber: data.vatNumber });
      if (dup) return res.status(400).json({ error: 'Partner with this VAT number already exists' });
    }

    if (data.isCustomer && !data.customerCode) {
      data.customerCode = await nextCustomerCode(req.user.tenantId);
    }
    if (data.isVendor && !data.supplierCode) {
      data.supplierCode = await nextSupplierCode(req.user.tenantId);
    }

    const partner = new Partner(data);
    await partner.save();
    const populated = await Partner.findById(partner._id).populate(PARTNER_POPULATE);
    res.status(201).json(toPartnerDto(populated));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors).map((e) => e.message).join(', ') });
    }
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/partners/:id
router.put('/:id', async (req, res) => {
  try {
    if (!canWritePartners(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existing = await Partner.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const tenantId = existing.tenantId;
    let patch = fromPartnerBody(req.body);
    delete patch.tenantId;

    if (patch.isCustomer === false && patch.isVendor === false && patch.isEmployee === false) {
      return res.status(400).json({ error: 'Select at least one role: customer, vendor, or employee' });
    }

    const country = patch.address?.country || existing.address?.country || 'SA';
    const vat = patch.vatNumber ?? existing.vatNumber;
    const pType = patch.type ?? existing.type;
    if (pType === 'business' && vat) {
      const vatCheck = validateSaVat(vat, country);
      if (!vatCheck.ok) return res.status(400).json({ error: vatCheck.error });
    }

    if (patch.parentCompanyId) {
      const parent = await Partner.findOne({ _id: patch.parentCompanyId, tenantId });
      if (!parent || parent.type !== 'business') {
        return res.status(400).json({ error: 'Parent must be a company partner' });
      }
      patch = await inheritFromParentCompany({ ...existing.toObject(), ...patch }, tenantId);
    }

    if (patch.vatNumber && patch.vatNumber !== existing.vatNumber) {
      const dup = await Partner.findOne({
        tenantId,
        vatNumber: patch.vatNumber,
        _id: { $ne: req.params.id },
      });
      if (dup) return res.status(400).json({ error: 'Partner with this VAT number already exists' });
    }

    if (patch.isCustomer && !existing.customerCode && !patch.customerCode) {
      patch.customerCode = await nextCustomerCode(tenantId);
    }
    if (patch.isVendor && !existing.supplierCode && !patch.supplierCode) {
      patch.supplierCode = await nextSupplierCode(tenantId);
    }

    Object.assign(existing, patch);
    await existing.save();
    const populated = await Partner.findById(existing._id).populate(PARTNER_POPULATE);
    res.json(toPartnerDto(populated));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors).map((e) => e.message).join(', ') });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
