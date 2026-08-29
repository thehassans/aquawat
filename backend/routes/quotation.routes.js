import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Quotation from '../models/Quotation.js';
import Tenant from '../models/Tenant.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../utils/businessTypes.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';
import { clampTemplateId } from '../utils/premiumTemplates.js';
import { buildPremiumEmailShell, getTenantLoginUrl, getTenantWorkspaceHost, getTenantWorkspaceUrl } from '../utils/premiumEmailShell.js';
import { tenantHasEmailAddon } from '../middleware/auth.js';
import { normalizeProductType, stampLineProductTypes } from '../utils/productType.js';
import { sendRestaurantWhatsApp } from '../services/restaurantWhatsAppService.js';
import { getWhatsAppConfig } from '../services/whatsappCloudService.js';
import { recordUserActivity } from '../utils/auditLogger.js';
import { syncMarqueeBookingFromDocument } from '../utils/marqueeSync.js';
import { computeQuotationValidUntil, getSalesSettings, resolveSaleWarnings } from '../services/sales/salesLifecycle.js';
import QuotationTemplate from '../models/sales/QuotationTemplate.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { nextDailyDocNumber } from '../services/inventory/sequence.js';
import { computePurchaseLineTotals } from '../services/purchasesLogic.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

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
  return ['draft', 'sent', 'accepted', 'rejected'].includes(status) && !quotation?.convertedInvoiceId && !quotation?.convertedOrderId;
}

function canRejectQuotation(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return ['draft', 'sent', 'accepted', 'approved'].includes(status) && !quotation?.convertedInvoiceId && !quotation?.convertedOrderId;
}

function canConvertQuotationToInvoice(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return status === 'approved' && !quotation?.convertedInvoiceId && !quotation?.convertedOrderId;
}

function canConvertQuotationToSalesOrder(quotation) {
  const status = String(quotation?.status || '').trim().toLowerCase();
  return status === 'approved' && !quotation?.convertedOrderId && !quotation?.convertedInvoiceId;
}

async function createSalesOrderFromQuotation(quotation, user) {
  if (!quotation.customerId) {
    throw new Error('Quotation customer is required to create a sales order');
  }

  const poNumber = await nextDailyDocNumber(quotation.tenantId, 'SO', { padding: 3 });
  const rawLines = (quotation.lineItems || []).map((line) => {
    const li = line?.toObject?.() || line || {};
    return {
      productId: li.productId || undefined,
      variantId: li.variantId || undefined,
      manualName: li.productName || li.manualName || '',
      description: li.description || '',
      productType: normalizeProductType(li.productType),
      quantityOrdered: toNumber(li.quantity, 1),
      unitCost: toNumber(li.unitPrice, 0),
      taxRate: toNumber(li.taxRate, 15),
      uom: li.unitCode || li.uom || '',
    };
  });

  if (!rawLines.length) {
    throw new Error('Quotation has no line items');
  }

  const totals = computePurchaseLineTotals(rawLines);
  const normalized = rawLines.map((li, index) => {
    const computed = totals.lines[index] || { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
    return {
      ...li,
      quantityReceived: 0,
      quantityReturned: 0,
      lineSubtotal: computed.lineSubtotal,
      lineTax: computed.lineTax,
      lineTotal: computed.lineTotal,
    };
  });

  // Quotation approval = sales-order validation: create already confirmed.
  const order = await PurchaseOrder.create({
    tenantId: quotation.tenantId,
    flow: 'sell',
    poNumber,
    customerId: quotation.customerId,
    status: 'approved',
    orderDate: new Date(),
    currency: quotation.currency || 'SAR',
    lineItems: normalized,
    subtotal: totals.subtotal,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    paidAmount: 0,
    balanceDue: totals.grandTotal,
    paymentStatus: 'pending',
    salesTeamId: quotation.salesTeamId || null,
    salespersonId: quotation.salespersonId || null,
    notes: quotation.notes || '',
    sourceQuotationId: quotation._id,
    createdBy: user._id,
    approvedBy: user._id,
    approvedAt: new Date(),
  });

  try {
    const settings = await getSalesSettings(quotation.tenantId);
    if (settings?.lockConfirmedOrders !== false) {
      order.isLocked = true;
      await order.save();
    }
  } catch {
    /* lock settings optional */
  }

  try {
    const { fulfillSellOrderStockOut } = await import('../services/inventory/documentLinks.js');
    const populated = await PurchaseOrder.findById(order._id)
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice')
      .populate('customerId', 'name nameAr nameEn');
    const result = await fulfillSellOrderStockOut({
      tenantId: quotation.tenantId,
      userId: user._id,
      purchaseOrder: populated || order,
      tenantFilter: { tenantId: quotation.tenantId },
    });
    if (result.error) {
      console.warn('[quotation→SO] stock-out failed:', result.error);
    }
  } catch (dnErr) {
    console.warn('[quotation→SO] stock fulfillment failed:', dnErr.message);
  }

  try {
    const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
    await appendDocumentMessage({
      tenantId: quotation.tenantId,
      docType: 'sales_order',
      docId: order._id,
      userId: user._id,
      body: `Confirmed from quotation ${quotation.quotationNumber || quotation._id}`,
      kind: 'system',
    });
  } catch {
    /* chatter optional */
  }

  return order;
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

function buildQuotationEmailHtml({ quotation, customerName = '', tenant }) {
  const safeName = normalizeText(customerName) || normalizeText(quotation?.buyer?.name) || 'Customer';
  const quotationNumber = normalizeText(quotation?.quotationNumber) || 'Quotation';
  const validUntil = quotation?.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-GB') : '';
  const total = `${toNumber(quotation?.grandTotal, 0).toFixed(2)} ${normalizeText(quotation?.currency) || 'SAR'}`;
  const companyName = normalizeText(tenant?.business?.legalNameEn || tenant?.name) || 'Maqder';
  const loginUrl = getTenantLoginUrl(tenant);

  return buildPremiumEmailShell({
    brandName: companyName,
    title: `Quotation ${quotationNumber}`,
    body: `Dear ${safeName},\n\nPlease find your quotation attached. Review the offer and reply with approval or any requested changes.`,
    secondaryLines: [
      { label: 'Customer', value: safeName },
      { label: 'Quotation', value: quotationNumber },
      { label: 'Total', value: total },
      validUntil ? { label: 'Valid until', value: validUntil } : null,
      { label: 'Workspace', value: getTenantWorkspaceHost(tenant), href: loginUrl },
    ].filter(Boolean),
    workspaceUrl: getTenantWorkspaceUrl(tenant),
    workspaceHost: getTenantWorkspaceHost(tenant),
    cta: { href: loginUrl, label: 'Open workspace' },
    dir: 'ltr',
  });
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
      .populate('convertedInvoiceId', 'invoiceNumber')
      .populate('convertedOrderId', 'poNumber status');

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
    productType: normalizeProductType(line.productType),
    variantId: line.variantId || undefined,
  }));

  const productIds = lineItems
    .map((line) => line.productId)
    .filter(Boolean)
    .map((id) => id.toString());
  const uniqueProductIds = [...new Set(productIds)];
  let productById = new Map();
  if (businessContext === 'trading' && uniqueProductIds.length > 0) {
    const existing = await Product.find({ _id: { $in: uniqueProductIds }, ...req.tenantFilter }).select('_id productType').lean();
    if (existing.length !== uniqueProductIds.length) {
      throw new Error('Invalid product in line items');
    }
    productById = new Map(existing.map((p) => [String(p._id), p]));
  }

  const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);
  const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : (existingQuotation?.issueDate || new Date());
  let validUntil = req.body.validUntil ? new Date(req.body.validUntil) : undefined;
  const settings = await getSalesSettings(req.user.tenantId);
  if (!validUntil && !existingQuotation) {
    validUntil = computeQuotationValidUntil(issueDate, settings.quotationValidityDays);
  }

  let termsAndConditions = req.body.termsAndConditions;
  let notes = req.body.notes;
  if (!existingQuotation) {
    if (!String(termsAndConditions || '').trim() && settings.quotationDefaultTerms) {
      termsAndConditions = settings.quotationDefaultTerms;
    }
    if (!String(notes || '').trim() && settings.quotationDefaultNotes) {
      notes = settings.quotationDefaultNotes;
    }
  }

  let editableStatus = existingQuotation
    ? resolveEditableQuotationStatus(req.body?.status, existingQuotation?.status)
    : 'draft';
  if (!existingQuotation && settings.quotationAutoSendOnCreate && editableStatus === 'draft') {
    editableStatus = 'sent';
  }

  return {
    tenant,
    customer,
    payload: {
      ...req.body,
      businessContext,
      pdfTemplateId,
      issueDate,
      validUntil,
      termsAndConditions,
      notes,
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
      lineItems: stampLineProductTypes(lineItems, productById),
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

    recordUserActivity(req, {
      action: 'create',
      module: 'quotations',
      resourceType: 'Quotation',
      resourceId: quotation._id,
      resourceName: quotation.quotationNumber,
      description: `Created quotation ${quotation.quotationNumber} (${quotation.grandTotal} SAR)`,
      descriptionAr: `أنشأ عرض سعر رقم ${quotation.quotationNumber} بقيمة ${quotation.grandTotal} ريال`,
      details: {
        total: quotation.grandTotal,
        customerName: quotation.buyer?.name || quotation.buyer?.nameAr,
      },
    }).catch(() => {});

    syncMarqueeBookingFromDocument({
      tenant: req.tenant,
      user: req.user,
      documentType: 'quotation',
      document: quotation,
      body: req.body,
    }).catch(() => {});

    res.status(201).json(quotation);
  } catch (error) {
    const statusCode = /invalid|not found/i.test(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/sale-warnings', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const productIds = String(req.query.productIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await resolveSaleWarnings({
      tenantId: req.user.tenantId,
      customerId: req.query.customerId,
      productIds,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/apply-template/:templateId', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const template = await QuotationTemplate.findOne({ _id: req.params.templateId, ...req.tenantFilter }).lean();
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({
      quotationTemplateId: template._id,
      headerHtml: template.headerHtml || '',
      footerHtml: template.footerHtml || '',
      terms: template.terms || '',
      lineItems: template.lines || template.lineItems || [],
      notes: template.notes || '',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
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

    if (quotation.convertedOrderId) {
      return res.json({
        success: true,
        alreadyConverted: true,
        orderId: quotation.convertedOrderId,
        quotation,
      });
    }

    if (!canApproveQuotation(quotation)) {
      return res.status(400).json({ error: 'This quotation cannot be approved' });
    }

    const names = getUserDisplayNames(req.user);
    quotation.approvedAt = new Date();
    quotation.approvedBy = req.user._id;
    quotation.approvedByName = names.createdByName;
    quotation.approvedByNameAr = names.createdByNameAr;
    quotation.rejectedAt = undefined;
    quotation.rejectedBy = undefined;
    quotation.rejectedByName = undefined;
    quotation.rejectedByNameAr = undefined;

    const order = await createSalesOrderFromQuotation(quotation, req.user);
    quotation.status = 'converted';
    quotation.convertedOrderId = order._id;
    quotation.convertedAt = new Date();
    await quotation.save();

    let emailDelivery = { sent: false, reason: 'disabled' };
    try {
      const tenant = await Tenant.findById(req.user.tenantId);
      const emailSettings = tenant?.settings?.communication?.email || {};
      if (tenant && tenantHasEmailAddon(tenant) && emailSettings.enabled && emailSettings.autoSendQuotations) {
        const customer = quotation.customerId
          ? await Customer.findOne({ _id: quotation.customerId, tenantId: quotation.tenantId }).select('name nameAr email contactPerson')
          : null;
        const recipient = resolveRecipient(customer, quotation);
        if (recipient) {
          emailDelivery = await sendTenantEmail({
            tenant,
            to: recipient,
            subject: `${quotation.quotationNumber} Quotation | عرض سعر ${quotation.quotationNumber}`,
            html: buildQuotationEmailHtml({
              quotation,
              tenant,
              customerName: customer?.name || customer?.nameAr || quotation?.buyer?.name || quotation?.buyer?.nameAr,
            }),
            metadata: { purpose: 'auto_quotation', quotationNumber: quotation.quotationNumber },
          });
        } else {
          emailDelivery = { sent: false, reason: 'missing_recipient' };
        }
      }
    } catch (emailError) {
      emailDelivery = { sent: false, reason: emailError.message };
    }

    res.json({
      success: true,
      quotation,
      orderId: order._id,
      orderNumber: order.poNumber,
      emailDelivery,
    });
  } catch (error) {
    const statusCode = /invalid|not found|required|no line/i.test(error.message) ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
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

router.post('/:id/convert-to-invoice', checkPermission('invoicing', 'create'), async (_req, res) => {
  return res.status(410).json({
    error: 'Quotations no longer convert to invoices. Approve the quotation to create a sales order; invoice from Accounting after fulfillment.',
  });
});

router.post('/:id/convert-to-sales-order', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (quotation.convertedOrderId) {
      return res.status(409).json({
        error: 'Quotation has already been converted to a sales order',
        orderId: quotation.convertedOrderId,
      });
    }

    if (quotation.convertedInvoiceId) {
      return res.status(409).json({
        error: 'Quotation was already converted to an invoice',
        invoiceId: quotation.convertedInvoiceId,
      });
    }

    // Legacy: allow converting already-approved quotes that never got an SO
    const status = String(quotation.status || '').toLowerCase();
    if (!['approved', 'draft', 'sent', 'accepted'].includes(status)) {
      return res.status(400).json({ error: 'Quotation cannot be converted to a sales order' });
    }

    if (!quotation.approvedAt) {
      const names = getUserDisplayNames(req.user);
      quotation.approvedAt = new Date();
      quotation.approvedBy = req.user._id;
      quotation.approvedByName = names.createdByName;
      quotation.approvedByNameAr = names.createdByNameAr;
    }

    const order = await createSalesOrderFromQuotation(quotation, req.user);
    quotation.status = 'converted';
    quotation.convertedOrderId = order._id;
    quotation.convertedAt = new Date();
    await quotation.save();

    res.status(201).json({
      success: true,
      orderId: order._id,
      orderNumber: order.poNumber,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
    });
  } catch (error) {
    const statusCode = /invalid|not found|required|no line/i.test(error.message) ? 400 : 500;
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

    const hasEmailAddon = tenantHasEmailAddon(tenant);
    if (!hasEmailAddon) {
      return res.status(403).json({ error: 'Email Marketing is not installed for this tenant' });
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
      tenant,
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

// @route   POST /api/quotations/:id/send-whatsapp
// @desc    Send quotation via WhatsApp with wa.me link fallback
router.post('/:id/send-whatsapp', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    let customer = null;
    if (quotation.customerId) {
      customer = await Customer.findOne({ _id: quotation.customerId, tenantId: tenant._id });
    }

    const phone = req.body?.phone || customer?.phone || customer?.mobile || quotation?.buyer?.contactPhone || quotation?.buyer?.phone;
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${tenant.domain || 'app.maqder.com'}`;
    const link = `${baseUrl}/app/dashboard/quotations/${quotation._id}`;
    const amountLabel = `${Number(quotation.grandTotal || 0).toFixed(2)} ${quotation.currency || 'SAR'}`;
    const customerName = customer?.name || customer?.nameAr || quotation?.buyer?.name || quotation?.buyer?.nameAr || 'Customer';

    const textEn = `Dear ${customerName}, quotation ${quotation.quotationNumber} (${amountLabel}) from ${tenant?.name || 'us'} is ready: ${link}`;
    const textAr = `عزيزي ${customerName}، عرض السعر رقم ${quotation.quotationNumber} بقيمة (${amountLabel}) من ${tenant?.nameAr || tenant?.name || 'مؤسستنا'} متاح عبر الرابط: ${link}`;
    const messageText = req.body?.language === 'ar' ? textAr : textEn;
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    // Try sending directly if WhatsApp service is connected
    if (cleanPhone) {
      try {
        const sendResult = await sendRestaurantWhatsApp({
          tenantId: tenant._id,
          phone: cleanPhone,
          messageEn: textEn,
          messageAr: textAr,
          replacements: { quotationNumber: quotation.quotationNumber, total: quotation.grandTotal, link, customer_name: customerName }
        });
        if (sendResult?.sent) {
          return res.json({ success: true, channel: 'direct_whatsapp', message: 'Quotation sent via WhatsApp successfully', waLink });
        }
      } catch (e) {
        console.warn('[Quotation] Direct WhatsApp send failed, returning wa.me fallback:', e.message);
      }
    }

    res.json({
      success: true,
      channel: 'web_link',
      message: 'WhatsApp Web link prepared',
      waLink
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Pro-forma from quotations is retired — invoice only from Accounting / sales orders */
router.post('/:id/send-proforma', checkPermission('invoicing', 'create'), async (_req, res) => {
  return res.status(410).json({
    error: 'Pro-forma from quotations is no longer available. Create invoices from Accounting after the sales order.',
  });
});

export default router;
