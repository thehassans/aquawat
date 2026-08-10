import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Quotation from '../models/Quotation.js';
import Tenant from '../models/Tenant.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { protect, tenantFilter, checkPermission } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../utils/businessTypes.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';
import { clampTemplateId } from '../utils/premiumTemplates.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePdfTemplateId(requestedTemplateId, tenant, businessContext = 'trading') {
  const normalizedContext = ['trading', 'construction', 'travel_agency', 'restaurant'].includes(businessContext) ? businessContext : 'trading';
  const contextTemplateId = tenant?.settings?.invoiceBranding?.contextProfiles?.[normalizedContext]?.templateId;
  const value = requestedTemplateId || contextTemplateId || tenant?.settings?.invoicePdfTemplate || 1;
  return clampTemplateId(tenant, value);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getUserDisplayNames(user = {}) {
  const createdByName = [normalizeText(user?.firstName), normalizeText(user?.lastName)].filter(Boolean).join(' ');
  const createdByNameAr = [normalizeText(user?.firstNameAr), normalizeText(user?.lastNameAr)].filter(Boolean).join(' ');

  return {
    createdByName: createdByName || undefined,
    createdByNameAr: createdByNameAr || undefined,
  };
}

function buildCustomerPayloadFromBuyer(buyer = {}) {
  const name = normalizeText(buyer?.name);
  if (!name || name.toLowerCase() === 'cash customer') return null;

  const email = normalizeText(buyer?.contactEmail).toLowerCase();
  const phone = normalizeText(buyer?.contactPhone);
  const vatNumber = normalizeText(buyer?.vatNumber);
  const crNumber = normalizeText(buyer?.crNumber);

  return {
    type: vatNumber || crNumber ? 'business' : 'individual',
    name,
    nameAr: normalizeText(buyer?.nameAr),
    email: email || undefined,
    phone: phone || undefined,
    mobile: phone || undefined,
    vatNumber: vatNumber || undefined,
    crNumber: crNumber || undefined,
    address: {
      ...(buyer?.address || {}),
      country: normalizeText(buyer?.address?.country) || 'SA',
    },
  };
}

async function ensureCustomerRecord(tenantId, buyer = {}, existingCustomer = null) {
  const payload = buildCustomerPayloadFromBuyer(buyer);
  if (!payload) return existingCustomer || null;

  let customer = existingCustomer;

  if (!customer) {
    const lookupCandidates = [
      payload.vatNumber ? { vatNumber: payload.vatNumber } : null,
      payload.email ? { email: payload.email } : null,
      payload.phone ? { phone: payload.phone } : null,
      payload.name ? { name: payload.name } : null,
    ].filter(Boolean);

    for (const candidate of lookupCandidates) {
      customer = await Customer.findOne({ tenantId, isActive: true, ...candidate });
      if (customer) break;
    }
  }

  if (customer) {
    customer.type = payload.type || customer.type;
    customer.name = payload.name || customer.name;
    customer.nameAr = payload.nameAr || customer.nameAr;
    customer.email = payload.email || customer.email;
    customer.phone = payload.phone || customer.phone;
    customer.mobile = payload.mobile || customer.mobile;
    customer.vatNumber = payload.vatNumber || customer.vatNumber;
    customer.crNumber = payload.crNumber || customer.crNumber;
    customer.address = {
      ...(customer.address?.toObject?.() || customer.address || {}),
      ...(payload.address || {}),
    };
    await customer.save();
    return customer;
  }

  return await Customer.create({ tenantId, ...payload });
}

function resolveQuotationStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['draft', 'sent', 'accepted', 'approved', 'rejected', 'expired', 'cancelled', 'converted'].includes(value) ? value : 'draft';
}

function isEditableQuotationStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['draft', 'sent', 'rejected'].includes(value);
}

function resolveEditableQuotationStatus(status, existingStatus = 'draft') {
  const value = String(status || existingStatus || '').trim().toLowerCase();
  if (value === 'rejected') return 'draft';
  return ['draft', 'sent'].includes(value) ? value : 'draft';
}

function canApproveQuotation(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return ['draft', 'sent', 'accepted', 'rejected'].includes(status) && !quotation?.convertedInvoiceId;
}

function canRejectQuotation(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return ['draft', 'sent', 'accepted', 'approved'].includes(status) && !quotation?.convertedInvoiceId;
}

function canConvertQuotationToInvoice(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return status === 'approved' && !quotation?.convertedInvoiceId;
}

async function generateInvoiceNumber(tenantId) {
  const lastInvoice = await Invoice.findOne({ tenantId })
    .sort({ createdAt: -1 })
    .select('invoiceNumber');

  const invoiceCount = lastInvoice
    ? parseInt(String(lastInvoice.invoiceNumber || '').split('-').pop(), 10) + 1
    : 1;

  return `INV-${new Date().getFullYear()}-${String(invoiceCount).padStart(6, '0')}`;
}

async function buildInvoiceFromQuotation({ quotation, tenant, user }) {
  let customer = null;
  if (quotation?.customerId) {
    customer = await Customer.findOne({ _id: quotation.customerId, tenantId: quotation.tenantId, isActive: true });
  }

  if (!customer && quotation?.businessContext === 'travel_agency') {
    customer = await ensureCustomerRecord(quotation.tenantId, quotation?.buyer || {});
  }

  const buyer = {
    ...(quotation?.buyer?.toObject?.() || quotation?.buyer || {}),
  };

  if (customer) {
    buyer.name = buyer.name || customer.name;
    buyer.nameAr = buyer.nameAr || customer.nameAr;
    buyer.vatNumber = buyer.vatNumber || customer.vatNumber;
    buyer.crNumber = buyer.crNumber || customer.crNumber;
    buyer.contactEmail = buyer.contactEmail || customer.email;
    buyer.contactPhone = buyer.contactPhone || customer.phone || customer.mobile;
    buyer.address = { ...(customer.address?.toObject?.() || customer.address || {}), ...(buyer.address || {}) };
  }

  if (!buyer.name || !String(buyer.name).trim()) {
    buyer.name = 'Cash Customer';
    buyer.nameAr = buyer.nameAr || 'عميل نقدي';
  }

  const businessContext = quotation?.businessContext || 'trading';
  const transactionType = businessContext === 'travel_agency'
    ? 'B2C'
    : (quotation?.transactionType === 'B2B' ? 'B2B' : 'B2C');
  const invoiceSubtype = businessContext === 'travel_agency' ? 'travel_ticket' : 'standard';
  const invoiceTypeCode = businessContext === 'travel_agency'
    ? '0200000'
    : (transactionType === 'B2C' ? '0200000' : '0100000');
  const invoiceNumber = await generateInvoiceNumber(quotation.tenantId);
  const lineItems = (quotation?.lineItems || []).map((line, index) => ({
    ...(line?.toObject?.() || line),
    lineNumber: line?.lineNumber || index + 1,
    taxCategory: line?.taxCategory || 'S',
  }));
  const invoiceData = {
    tenantId: quotation.tenantId,
    flow: 'sell',
    businessContext,
    invoiceNumber,
    invoiceSubtype,
    pdfTemplateId: resolvePdfTemplateId(quotation?.pdfTemplateId, tenant, businessContext),
    invoiceTypeCode,
    transactionType,
    issueDate: new Date(),
    buyer,
    customerId: customer?._id || quotation?.customerId || undefined,
    seller: {
      name: tenant.business.legalNameEn,
      nameAr: tenant.business.legalNameAr,
      vatNumber: tenant.business.vatNumber,
      crNumber: tenant.business.crNumber,
      address: tenant.business.address,
      contactPhone: tenant.business.contactPhone,
      contactEmail: tenant.business.contactEmail,
    },
    lineItems,
    subtotal: toNumber(quotation?.subtotal, 0),
    invoiceDiscount: Math.max(0, toNumber(quotation?.invoiceDiscount, 0)),
    totalDiscount: toNumber(quotation?.totalDiscount, 0),
    taxableAmount: toNumber(quotation?.taxableAmount, 0),
    totalTax: toNumber(quotation?.totalTax, 0),
    grandTotal: toNumber(quotation?.grandTotal, 0),
    currency: quotation?.currency || 'SAR',
    paymentStatus: 'pending',
    status: 'draft',
    notes: quotation?.notes,
    internalNotes: quotation?.internalNotes,
    sourceQuotationId: quotation._id,
    createdBy: user._id,
    ...getUserDisplayNames(user),
  };

  if (quotation?.travelDetails) {
    invoiceData.travelDetails = quotation.travelDetails;
  }

  const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
  return await Invoice.create(enrichedInvoiceData);
}

function resolveRecipient(customer, quotation, fallbackRecipient = '') {
  const directRecipient = String(fallbackRecipient || '').trim().toLowerCase();
  if (directRecipient) return directRecipient;
  const customerEmail = String(customer?.email || '').trim().toLowerCase();
  if (customerEmail) return customerEmail;
  const contactEmail = String(customer?.contactPerson?.email || '').trim().toLowerCase();
  if (contactEmail) return contactEmail;
  return String(quotation?.buyer?.contactEmail || '').trim().toLowerCase();
}

function buildQuotationEmailHtml({ quotation, customerName = '' }) {
  const safeName = normalizeText(customerName) || normalizeText(quotation?.buyer?.name) || 'Customer';
  const quotationNumber = normalizeText(quotation?.quotationNumber) || 'Quotation';
  const validUntil = quotation?.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-US') : '';
  const validUntilAr = quotation?.validUntil ? new Date(quotation.validUntil).toLocaleDateString('ar-SA') : '';
  const total = toNumber(quotation?.grandTotal, 0).toFixed(2);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
      <div style="max-width:720px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px -36px rgba(15,23,42,0.25);">
        <div style="height:6px; background:#0f172a;"></div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 8px; font-size:28px;">Quotation ${quotationNumber}</h1>
          <p style="margin:0 0 24px; color:#475569;">Please find your quotation attached. You can review the offer and reply with any updates or approval.</p>
          <div style="padding:20px; border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc; margin-bottom:24px;">
            <p style="margin:0 0 8px;"><strong>Customer:</strong> ${safeName}</p>
            <p style="margin:0 0 8px;"><strong>Quotation #:</strong> ${quotationNumber}</p>
            <p style="margin:0 0 8px;"><strong>Total:</strong> ${total} ${normalizeText(quotation?.currency) || 'SAR'}</p>
            ${validUntil ? `<p style="margin:0;"><strong>Valid Until:</strong> ${validUntil}</p>` : ''}
          </div>
          <div dir="rtl" style="padding:20px; border:1px solid #e2e8f0; border-radius:18px; background:#ffffff;">
            <p style="margin:0 0 8px; font-weight:700;">عرض السعر ${quotationNumber}</p>
            <p style="margin:0 0 8px; color:#475569;">مرفق لكم عرض السعر. يمكنكم مراجعة العرض والرد بالموافقة أو طلب التعديلات.</p>
            <p style="margin:0 0 8px;"><strong>العميل:</strong> ${safeName}</p>
            <p style="margin:0 0 8px;"><strong>الإجمالي:</strong> ${total} ${normalizeText(quotation?.currency) || 'SAR'}</p>
            ${validUntilAr ? `<p style="margin:0;"><strong>ساري حتى:</strong> ${validUntilAr}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', businessContext = '' } = req.query;
    const query = { ...req.tenantFilter };

    if (status) query.status = status;
    if (businessContext) query.businessContext = businessContext;
    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { 'buyer.name': { $regex: search, $options: 'i' } },
        { 'buyer.nameAr': { $regex: search, $options: 'i' } },
        { 'buyer.vatNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Math.min(200, Number(limit) || 20));

    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        .populate('createdBy', 'firstName lastName firstNameAr lastNameAr')
        .sort({ issueDate: -1, createdAt: -1 })
        .skip((currentPage - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      Quotation.countDocuments(query),
    ]);

    res.json({
      quotations,
      pagination: {
        page: currentPage,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('customerId', 'name nameAr email phone mobile vatNumber crNumber address')
      .populate('createdBy', 'firstName lastName firstNameAr lastNameAr')
      .populate('convertedInvoiceId', 'invoiceNumber');

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(quotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function resolveQuotationPayload(req, existingQuotation = null) {
  const tenantBusinessTypes = getTenantBusinessTypes(req.tenant);
  const primaryBusinessType = getPrimaryBusinessType(req.tenant);
  const tenant = await Tenant.findById(req.user.tenantId);

  const businessContext = tenantBusinessTypes.includes(req.body?.businessContext)
    ? req.body.businessContext
    : (existingQuotation?.businessContext || primaryBusinessType);

  let customer = null;
  if (req.body.customerId) {
    if (!mongoose.Types.ObjectId.isValid(req.body.customerId)) {
      throw new Error('Invalid customerId');
    }
    customer = await Customer.findOne({ _id: req.body.customerId, ...req.tenantFilter });
    if (!customer) {
      throw new Error('Customer not found');
    }
  } else if (req.body?.buyer?.vatNumber) {
    const vatNumber = String(req.body.buyer.vatNumber || '').trim();
    if (vatNumber) {
      customer = await Customer.findOne({ tenantId: req.user.tenantId, vatNumber });
    }
  }

  const buyer = { ...(req.body.buyer || {}) };
  if (customer) {
    buyer.name = buyer.name || customer.name;
    buyer.nameAr = buyer.nameAr || customer.nameAr;
    buyer.vatNumber = buyer.vatNumber || customer.vatNumber;
    buyer.crNumber = buyer.crNumber || customer.crNumber;
    buyer.address = { ...(customer.address || {}), ...(buyer.address || {}) };
    buyer.contactEmail = buyer.contactEmail || customer.email;
    buyer.contactPhone = buyer.contactPhone || customer.phone || customer.mobile;
  }

  if (!buyer.name || !String(buyer.name).trim()) {
    buyer.name = 'Cash Customer';
    buyer.nameAr = buyer.nameAr || 'عميل نقدي';
  }

  if (!customer && businessContext === 'travel_agency') {
    customer = await ensureCustomerRecord(req.user.tenantId, buyer);
  }

  const lineItems = (req.body.lineItems || []).map((line, index) => ({
    ...line,
    lineNumber: line.lineNumber || index + 1,
    taxCategory: line.taxCategory || 'S',
  }));

  const productIds = lineItems
    .map((line) => line.productId)
    .filter(Boolean)
    .map((id) => id.toString());
  const uniqueProductIds = [...new Set(productIds)];
  if (businessContext === 'trading' && uniqueProductIds.length > 0) {
    const existingCount = await Product.countDocuments({ _id: { $in: uniqueProductIds }, ...req.tenantFilter });
    if (existingCount !== uniqueProductIds.length) {
      throw new Error('Invalid product in line items');
    }
  }

  const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);
  const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : (existingQuotation?.issueDate || new Date());
  const validUntil = req.body.validUntil ? new Date(req.body.validUntil) : undefined;
  const editableStatus = existingQuotation
    ? resolveEditableQuotationStatus(req.body?.status, existingQuotation?.status)
    : 'draft';

  return {
    tenant,
    customer,
    payload: {
      ...req.body,
      businessContext,
      pdfTemplateId,
      issueDate,
      validUntil,
      buyer,
      customerId: customer?._id,
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: tenant.business.vatNumber,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address,
        contactPhone: tenant.business.contactPhone,
        contactEmail: tenant.business.contactEmail,
      },
      transactionType: req.body.transactionType === 'B2B' ? 'B2B' : 'B2C',
      invoiceDiscount: Math.max(0, toNumber(req.body?.invoiceDiscount, 0)),
      lineItems,
      status: editableStatus,
      ...getUserDisplayNames(req.user),
    },
  };
}

router.post('/', checkTrialLimits('quotations'), checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const { payload } = await resolveQuotationPayload(req);
    const lastQuotation = await Quotation.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('quotationNumber');

    const quotationCount = lastQuotation
      ? parseInt(String(lastQuotation.quotationNumber || '').split('-').pop(), 10) + 1
      : 1;

    const quotationData = {
      ...payload,
      tenantId: req.user.tenantId,
      quotationNumber: `QUO-${new Date().getFullYear()}-${String(quotationCount).padStart(6, '0')}`,
      createdBy: req.user._id,
    };

    const enrichedQuotationData = await enrichInvoiceArabicFields(quotationData);
    const quotation = await Quotation.create(enrichedQuotationData);
    res.status(201).json(quotation);
  } catch (error) {
    const statusCode = /invalid|not found/i.test(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (!isEditableQuotationStatus(quotation.status)) {
      return res.status(400).json({ error: 'This quotation cannot be edited' });
    }

    const { payload } = await resolveQuotationPayload(req, quotation);
    const enrichedQuotationData = await enrichInvoiceArabicFields({
      ...quotation.toObject(),
      ...payload,
      quotationNumber: quotation.quotationNumber,
      createdBy: quotation.createdBy,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    });

    if (enrichedQuotationData.status !== 'approved') {
      enrichedQuotationData.approvedAt = undefined;
      enrichedQuotationData.approvedBy = undefined;
      enrichedQuotationData.approvedByName = undefined;
      enrichedQuotationData.approvedByNameAr = undefined;
    }

    if (enrichedQuotationData.status !== 'rejected') {
      enrichedQuotationData.rejectedAt = undefined;
      enrichedQuotationData.rejectedBy = undefined;
      enrichedQuotationData.rejectedByName = undefined;
      enrichedQuotationData.rejectedByNameAr = undefined;
    }

    Object.assign(quotation, enrichedQuotationData);
    await quotation.save();

    res.json(quotation);
  } catch (error) {
    const statusCode = /invalid|not found/i.test(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

router.post('/:id/approve', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (!canApproveQuotation(quotation)) {
      return res.status(400).json({ error: 'This quotation cannot be approved' });
    }

    quotation.status = 'approved';
    quotation.approvedAt = new Date();
    quotation.approvedBy = req.user._id;
    quotation.approvedByName = getUserDisplayNames(req.user).createdByName;
    quotation.approvedByNameAr = getUserDisplayNames(req.user).createdByNameAr;
    quotation.rejectedAt = undefined;
    quotation.rejectedBy = undefined;
    quotation.rejectedByName = undefined;
    quotation.rejectedByNameAr = undefined;
    await quotation.save();

    res.json({ success: true, quotation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (!canRejectQuotation(quotation)) {
      return res.status(400).json({ error: 'This quotation cannot be rejected' });
    }

    quotation.status = 'rejected';
    quotation.rejectedAt = new Date();
    quotation.rejectedBy = req.user._id;
    quotation.rejectedByName = getUserDisplayNames(req.user).createdByName;
    quotation.rejectedByNameAr = getUserDisplayNames(req.user).createdByNameAr;
    quotation.approvedAt = undefined;
    quotation.approvedBy = undefined;
    quotation.approvedByName = undefined;
    quotation.approvedByNameAr = undefined;
    await quotation.save();

    res.json({ success: true, quotation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/convert-to-invoice', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (quotation.convertedInvoiceId) {
      return res.status(409).json({
        error: 'Quotation has already been converted to an invoice',
        invoiceId: quotation.convertedInvoiceId,
      });
    }

    if (!canConvertQuotationToInvoice(quotation)) {
      return res.status(400).json({ error: 'Quotation must be approved before it can be converted to an invoice' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const invoice = await buildInvoiceFromQuotation({ quotation, tenant, user: req.user });

    quotation.status = 'converted';
    quotation.convertedInvoiceId = invoice._id;
    quotation.convertedAt = new Date();
    await quotation.save();

    res.status(201).json({
      success: true,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
    });
  } catch (error) {
    const statusCode = /invalid|not found/i.test(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

router.post('/:id/send-email', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
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

    const customer = quotation.customerId
      ? await Customer.findOne({ _id: quotation.customerId, tenantId: quotation.tenantId }).select('name nameAr email contactPerson')
      : null;
    const recipient = resolveRecipient(customer, quotation, req.body?.to);
    if (!recipient) {
      return res.status(400).json({ error: 'Customer email is missing' });
    }

    const attachment = req.body?.attachment && typeof req.body.attachment === 'object'
      ? {
          filename: String(req.body.attachment.filename || `${quotation.quotationNumber || 'quotation'}.pdf`).trim(),
          contentBase64: String(req.body.attachment.contentBase64 || '').trim(),
          contentType: String(req.body.attachment.contentType || 'application/pdf').trim() || 'application/pdf',
          size: Number(req.body.attachment.size || 0),
        }
      : null;

    if (!attachment?.contentBase64) {
      return res.status(400).json({ error: 'Quotation PDF attachment is required' });
    }

    const subject = `${quotation.quotationNumber} Quotation | عرض سعر ${quotation.quotationNumber}`;
    const html = buildQuotationEmailHtml({
      quotation,
      customerName: customer?.name || customer?.nameAr || quotation?.buyer?.name || quotation?.buyer?.nameAr,
    });

    const delivery = await sendTenantEmail({
      tenant,
      to: recipient,
      subject,
      html,
      attachments: [attachment],
      metadata: { purpose: 'manual_quotation', quotationNumber: quotation.quotationNumber },
    });

    if (quotation.status === 'draft') {
      quotation.status = 'sent';
      quotation.rejectedAt = undefined;
      quotation.rejectedBy = undefined;
      quotation.rejectedByName = undefined;
      quotation.rejectedByNameAr = undefined;
      await quotation.save();
    } else if (quotation.status === 'rejected') {
      quotation.status = 'sent';
      quotation.rejectedAt = undefined;
      quotation.rejectedBy = undefined;
      quotation.rejectedByName = undefined;
      quotation.rejectedByNameAr = undefined;
      await quotation.save();
    }

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
