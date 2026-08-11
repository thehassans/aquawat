import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import * as xlsx from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import TravelBooking from '../models/TravelBooking.js';
import EmailMessage from '../models/EmailMessage.js';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../utils/businessTypes.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { buildDraftInvoiceQr } from '../utils/zatca/draftInvoiceQr.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { autoSendInvoice, sendInvoiceToRecipient } from '../utils/tenantEmailService.js';
import { buildInvoicePdfAttachment } from '../utils/invoicePdfService.js';
import { createInvoiceFromMultipleDNs } from '../controllers/invoiceController.js';
import { sendRestaurantWhatsApp } from '../services/restaurantWhatsAppService.js';
import { clampTemplateId } from '../utils/premiumTemplates.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
router.use(tenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePdfTemplateId(requestedTemplateId, tenant, businessContext = 'trading') {
  const normalizedContext = ['trading', 'construction', 'travel_agency'].includes(businessContext) ? businessContext : 'trading';
  const contextTemplateId = tenant?.settings?.invoiceBranding?.contextProfiles?.[normalizedContext]?.templateId;
  const value = requestedTemplateId || contextTemplateId || tenant?.settings?.invoicePdfTemplate || 1;
  return clampTemplateId(tenant, value);
}

function resolvePaymentStatus(invoiceData) {
  const method = invoiceData.paymentMethod || 'cash';
  const grandTotal = Number(invoiceData.grandTotal) || 0;
  
  if (method === 'cash' || method === 'card' || method === 'bank_transfer') {
    invoiceData.paidAmount = grandTotal;
    invoiceData.paymentStatus = 'paid';
  } else if (method === 'credit' || method === 'split') {
    const paid = Number(invoiceData.paidAmount) || 0;
    invoiceData.paidAmount = Math.min(Math.max(0, paid), grandTotal); // Prevent overpaying and negative
    if (invoiceData.paidAmount >= grandTotal && grandTotal > 0) {
      invoiceData.paymentStatus = 'paid';
    } else if (invoiceData.paidAmount > 0) {
      invoiceData.paymentStatus = 'partial';
    } else {
      invoiceData.paymentStatus = 'pending';
    }
  } else {
    invoiceData.paidAmount = grandTotal;
    invoiceData.paymentStatus = 'paid';
  }
}

function cleanObjectId(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return undefined;
  if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val)) return val;
  if (val instanceof mongoose.Types.ObjectId) return val;
  return undefined;
}

function sanitizeInvoicePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const cleaned = { ...payload };
  const objectIdKeys = [
    'warehouseId',
    'supplierId',
    'customerId',
    'sourcePurchaseOrderId',
    'originalInvoiceId',
    'proformaSourceId',
    'sourceQuotationId',
    'restaurantOrderId',
    'travelBookingId',
    'rentalId',
    'manpowerAssignmentId'
  ];

  for (const key of objectIdKeys) {
    if (key in cleaned) {
      const sanitized = cleanObjectId(cleaned[key]);
      if (sanitized) {
        cleaned[key] = sanitized;
      } else {
        delete cleaned[key];
      }
    }
  }

  if (cleaned.inventory && typeof cleaned.inventory === 'object') {
    const invWh = cleanObjectId(cleaned.inventory.warehouseId);
    if (invWh) {
      cleaned.inventory.warehouseId = invWh;
    } else {
      delete cleaned.inventory.warehouseId;
    }
  }

  if (Array.isArray(cleaned.lineItems)) {
    cleaned.lineItems = cleaned.lineItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const cleanItem = { ...item };
      const prodId = cleanObjectId(cleanItem.productId);
      if (prodId) {
        cleanItem.productId = prodId;
      } else {
        delete cleanItem.productId;
      }
      const dnId = cleanObjectId(cleanItem.sourceDnItemId);
      if (dnId) {
        cleanItem.sourceDnItemId = dnId;
      } else {
        delete cleanItem.sourceDnItemId;
      }
      const poId = cleanObjectId(cleanItem.sourcePoItemId);
      if (poId) {
        cleanItem.sourcePoItemId = poId;
      } else {
        delete cleanItem.sourcePoItemId;
      }
      return cleanItem;
    });
  }

  return cleaned;
}

function sanitizeTravelDetails(travelDetails = {}, fallbackTravelerName = '') {
  const passengers = Array.isArray(travelDetails?.passengers) ? travelDetails.passengers : [];
  const segments = Array.isArray(travelDetails?.segments) ? travelDetails.segments : [];
  const sanitizedSegments = segments
    .map((segment) => ({
      from: String(segment?.from || '').trim(),
      to: String(segment?.to || '').trim(),
      fromAr: String(segment?.fromAr || '').trim(),
      toAr: String(segment?.toAr || '').trim(),
    }))
    .filter((segment) => segment.from || segment.to || segment.fromAr || segment.toAr);
  const firstSegment = sanitizedSegments[0];
  const lastSegment = sanitizedSegments[sanitizedSegments.length - 1];
  const hasReturnDate = Boolean(travelDetails?.hasReturnDate && travelDetails?.returnDate);

  return {
    passengerTitle: ['mr', 'mrs', 'ms'].includes(travelDetails?.passengerTitle) ? travelDetails.passengerTitle : 'mr',
    travelerName: String(travelDetails?.travelerName || fallbackTravelerName || '').trim(),
    travelerNameAr: String(travelDetails?.travelerNameAr || '').trim(),
    passportNumber: String(travelDetails?.passportNumber || '').trim(),
    ticketNumber: String(travelDetails?.ticketNumber || '').trim(),
    pnr: String(travelDetails?.pnr || '').trim(),
    airlineName: String(travelDetails?.airlineName || '').trim(),
    airlineNameAr: String(travelDetails?.airlineNameAr || '').trim(),
    routeFrom: String(travelDetails?.routeFrom || firstSegment?.from || '').trim(),
    routeFromAr: String(travelDetails?.routeFromAr || firstSegment?.fromAr || '').trim(),
    routeTo: String(travelDetails?.routeTo || lastSegment?.to || '').trim(),
    routeToAr: String(travelDetails?.routeToAr || lastSegment?.toAr || '').trim(),
    segments: sanitizedSegments,
    departureDate: travelDetails?.departureDate || undefined,
    hasReturnDate,
    returnDate: hasReturnDate ? travelDetails?.returnDate : undefined,
    layoverStay: String(travelDetails?.layoverStay || '').trim(),
    layoverStayAr: String(travelDetails?.layoverStayAr || '').trim(),
    passengers: passengers
      .map((passenger) => ({
        title: ['mr', 'mrs', 'ms'].includes(passenger?.title) ? passenger.title : 'mr',
        name: String(passenger?.name || '').trim(),
        nameAr: String(passenger?.nameAr || '').trim(),
        passportNumber: String(passenger?.passportNumber || '').trim(),
      }))
      .filter((passenger) => passenger.name || passenger.nameAr || passenger.passportNumber),
  };
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

  return await Customer.create({
    tenantId,
    ...payload,
  });
}

async function generateTravelBookingNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `TB-${y}${m}${d}`;

  const last = await TravelBooking.findOne({
    ...tenantFilterValue,
    bookingNumber: { $regex: `^${prefix}-` },
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .select('bookingNumber');

  let seq = 1;
  if (last?.bookingNumber) {
    const parts = last.bookingNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

async function syncTravelBookingFromInvoice({ invoice, tenantFilterValue, userId, existingBooking = null }) {
  if (invoice?.businessContext !== 'travel_agency') return existingBooking;

  const travelDetails = invoice?.travelDetails || {};
  const nextStatus = ['completed', 'cancelled'].includes(existingBooking?.status)
    ? existingBooking.status
    : 'ticketed';

  const bookingPayload = {
    customerName: normalizeText(invoice?.buyer?.name) || normalizeText(travelDetails?.travelerName) || 'Cash Customer',
    customerEmail: normalizeText(invoice?.buyer?.contactEmail) || undefined,
    customerPhone: normalizeText(invoice?.buyer?.contactPhone) || undefined,
    passportNumber: normalizeText(travelDetails?.passportNumber) || undefined,
    travelerName: normalizeText(travelDetails?.travelerName) || normalizeText(invoice?.buyer?.name) || undefined,
    ticketNumber: normalizeText(travelDetails?.ticketNumber) || undefined,
    pnr: normalizeText(travelDetails?.pnr) || undefined,
    airlineName: normalizeText(travelDetails?.airlineName) || undefined,
    routeFrom: normalizeText(travelDetails?.routeFrom) || undefined,
    routeTo: normalizeText(travelDetails?.routeTo) || undefined,
    segments: Array.isArray(travelDetails?.segments) ? travelDetails.segments : [],
    serviceType: 'flight',
    departureDate: travelDetails?.departureDate || undefined,
    hasReturnDate: Boolean(travelDetails?.hasReturnDate && travelDetails?.returnDate),
    returnDate: travelDetails?.hasReturnDate ? travelDetails?.returnDate : undefined,
    layoverStay: normalizeText(travelDetails?.layoverStay) || undefined,
    currency: invoice?.currency || 'SAR',
    subtotal: toNumber(invoice?.subtotal, 0),
    totalTax: toNumber(invoice?.totalTax, 0),
    grandTotal: toNumber(invoice?.grandTotal, 0),
    notes: invoice?.notes,
    invoiceId: invoice?._id,
    invoiceNumber: invoice?.invoiceNumber,
    invoicedAt: new Date(),
    status: nextStatus,
    isActive: true,
  };

  if (existingBooking?._id) {
    return await TravelBooking.findOneAndUpdate(
      { _id: existingBooking._id, ...tenantFilterValue },
      bookingPayload,
      { new: true, runValidators: true }
    );
  }

  const bookingNumber = await generateTravelBookingNumber(tenantFilterValue);
  return await TravelBooking.create({
    tenantId: invoice.tenantId,
    bookingNumber,
    createdBy: userId,
    ...bookingPayload,
  });
}

function resolveInitialSellInvoiceStatus(requestedStatus, tenant) {
  if (normalizeText(requestedStatus).toLowerCase() === 'draft') return 'draft';
  // Non-SAR tenants skip the ZATCA sign/clearance workflow entirely, so
  // there is nothing to wait on - finalize immediately like Phase 1.
  if (!isZatcaCurrency(tenant)) return 'approved';
  // ZATCA Phase 1: auto-finalize since only QR code is required (no XML signing/clearance)
  if (tenant?.zatca?.phase === 1) return 'approved';
  return 'pending';
}

async function attachDraftQr(invoice, seller, tenant) {
  // ZATCA only applies to SAR-denominated invoices. Skip the Saudi TLV QR
  // entirely for tenants configured with a different default currency.
  if (!isZatcaCurrency(tenant)) return invoice;

  const qr = await buildDraftInvoiceQr({
    seller,
    issueDate: invoice.issueDate,
    grandTotal: invoice.grandTotal,
    totalTax: invoice.totalTax,
  });

  invoice.zatca = {
    ...(invoice.zatca || {}),
    ...qr,
  };

  await invoice.save();
  return invoice;
}

function resolveInvoiceRecipient(customer, invoice, fallbackRecipient = '') {
  const directRecipient = normalizeText(fallbackRecipient).toLowerCase();
  if (directRecipient) return directRecipient;

  const customerEmail = normalizeText(customer?.email).toLowerCase();
  if (customerEmail) return customerEmail;

  const customerContactEmail = normalizeText(customer?.contactPerson?.email).toLowerCase();
  if (customerContactEmail) return customerContactEmail;

  const buyerEmail = normalizeText(invoice?.buyer?.contactEmail).toLowerCase();
  if (buyerEmail) return buyerEmail;

  return '';
}

async function autoEmailInvoiceIfEnabled({ tenant, invoice, customer = null, fallbackRecipient = '', language }) {
  const emailSettings = tenant?.settings?.communication?.email || {};
  const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true
    || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'));
  if (!hasEmailAddon || !emailSettings.enabled || !emailSettings.autoSendInvoices || invoice?.flow === 'purchase') {
    return { sent: false, reason: 'disabled' };
  }

  const recipient = resolveInvoiceRecipient(customer, invoice, fallbackRecipient);
  if (!recipient) {
    return { sent: false, reason: 'missing_recipient' };
  }

  return await autoSendInvoice(invoice._id, tenant._id, {
    recipient,
    language,
  });
}

async function autoWhatsAppInvoiceIfEnabled({ tenant, invoice, customer = null, language }) {
  if (!tenant?.settings?.invoiceWhatsappAutoSend) {
    return { sent: false, reason: 'disabled' };
  }
  
  const phone = customer?.phone || customer?.mobile || invoice?.buyer?.phone;
  if (!phone) return { sent: false, reason: 'no_customer_phone' };

  try {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${tenant.domain || 'app.maqder.com'}`;
    const link = `${baseUrl}/app/dashboard/invoices/${invoice._id}`;

    const replacements = {
      invoiceNumber: invoice.invoiceNumber || '',
      total: invoice.grandTotal || 0,
      link: link,
      customer_name: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr || '',
    };

    const messageEn = tenant.settings.invoiceWhatsappMessageEn || 'Dear customer, your invoice {{invoiceNumber}} is ready. Amount: {{total}} SAR. Link: {{link}}';
    const messageAr = tenant.settings.invoiceWhatsappMessageAr || 'عزيزي العميل، فاتورتك رقم {{invoiceNumber}} جاهزة. المبلغ: {{total}} ريال. الرابط: {{link}}';

    const waRes = await sendRestaurantWhatsApp({
      tenantId: tenant._id,
      phone,
      messageEn,
      messageAr,
      replacements
    });
    return waRes;
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

async function postInventoryForInvoice(invoice, tenantFilterValue) {
  const warehouseId = invoice.warehouseId || invoice?.inventory?.warehouseId;
  if (!warehouseId) {
    return invoice;
  }

  const warehouse = await Warehouse.findOne({ _id: warehouseId, ...tenantFilterValue, isActive: true });
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  if (invoice.inventory?.postedAt) {
    return invoice;
  }

  const lines = (invoice.lineItems || []).filter((line) => {
    const productId = line.productId;
    const qty = toNumber(line.quantity, 0);
    return Boolean(productId) && qty > 0;
  });

  const productIds = [...new Set(lines.map((line) => String(line.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, ...tenantFilterValue })
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  let tenantAllowNegative = null;

  for (const line of lines) {
    const product = productById.get(String(line.productId));
    if (!product) {
      throw new Error('Product not found');
    }

    const qty = toNumber(line.quantity, 0);
    const sign = invoice.flow === 'sell' ? -1 : 1;
    if (sign < 0) {
      const stock = product.stocks.find((s) => s.warehouseId?.toString() === warehouseId.toString());
      const available = toNumber(stock?.quantity, 0) - toNumber(stock?.reservedQuantity, 0);

      let allowNegative = Boolean(product.allowNegativeStock);
      if (!allowNegative && invoice.tenantId) {
        if (tenantAllowNegative === null) {
          const Tenant = mongoose.model('Tenant');
          const tenantDoc = await Tenant.findById(invoice.tenantId).select('settings.inventory').lean();
          tenantAllowNegative = Boolean(tenantDoc?.settings?.inventory?.allowNegativeStock);
        }
        if (tenantAllowNegative) {
          allowNegative = true;
        }
      }

      if (!allowNegative && available < qty) {
        throw new Error(`Insufficient stock in selected warehouse for item "${product.sku || product.nameEn || 'Item'}"`);
      }
    }

    product.updateStock(warehouseId, sign * qty);

    if (invoice.flow === 'purchase' && toNumber(line.unitPrice, 0) > 0) {
      product.calculateLandedCost({
        purchasePrice: toNumber(line.unitPrice, 0),
        quantity: qty,
        notes: `Invoice ${invoice.invoiceNumber}`
      });
    }
  }

  await Promise.all(products.map((product) => product.save()));

  invoice.inventory = {
    ...(invoice.inventory || {}),
    warehouseId,
    postedAt: new Date(),
    reversedAt: null
  };

  await invoice.save();
  return invoice;
}

async function reverseInventoryForDeletedInvoice(invoice, tenantFilterValue) {
  const warehouseId = invoice.warehouseId || invoice?.inventory?.warehouseId;
  if (!warehouseId || !invoice?.inventory?.postedAt) return;

  const lines = (invoice.lineItems || []).filter((line) => {
    const productId = line.productId;
    const qty = toNumber(line.quantity, 0);
    return Boolean(productId) && qty > 0;
  });

  const productIds = [...new Set(lines.map((line) => String(line.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, ...tenantFilterValue })
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  for (const line of lines) {
    const product = productById.get(String(line.productId));
    if (!product) continue;

    const qty = toNumber(line.quantity, 0);
    const reverseSign = invoice.flow === 'sell' ? 1 : -1;
    product.updateStock(warehouseId, reverseSign * qty);
  }

  await Promise.all(products.map((product) => product.save()));
}

async function syncCustomerStats(tenantId, customerId) {
  try {
    if (!tenantId || !customerId) return;
    if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(customerId)) return;

    const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));
    const customerObjectId = new mongoose.Types.ObjectId(String(customerId));

    const mongoose = (await import('mongoose')).default;
    const Voucher = mongoose.model('Voucher');
    const voucherStats = await Voucher.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          partyId: customerObjectId,
          type: 'receive',
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: null,
          totalReceived: { $sum: '$amount' }
        }
      }
    ]);
    const totalReceived = voucherStats[0]?.totalReceived || 0;

    const stats = await Invoice.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          customerId: customerObjectId,
          status: { $nin: ['draft', 'cancelled', 'credited'] },
          flow: 'sell'
        }
      },
      {
        $group: {
          _id: '$customerId',
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          totalPaidOnInvoices: { $sum: { $ifNull: ['$paidAmount', 0] } },
          lastInvoiceDate: { $max: '$issueDate' }
        }
      }
    ]);

    const doc = stats[0] || { totalInvoices: 0, totalRevenue: 0, totalPaidOnInvoices: 0, lastInvoiceDate: null };
    const currentBalance = doc.totalRevenue - doc.totalPaidOnInvoices - totalReceived;

    await Customer.updateOne(
      { _id: customerObjectId, tenantId: tenantObjectId },
      {
        totalInvoices: doc.totalInvoices,
        totalRevenue: doc.totalRevenue,
        lastInvoiceDate: doc.lastInvoiceDate,
        currentBalance: Math.max(0, currentBalance)
      }
    );
  } catch (error) {
    console.error('Failed to sync customer stats', error);
  }
}

async function ensureProductsExist(tenantId, userId, lineItems, flow) {
  if (!Array.isArray(lineItems)) return [];
  const processedLines = [];
  
  for (let i = 0; i < lineItems.length; i++) {
    const line = lineItems[i];
    let productId = line.productId;
    
    if (!productId && line.productName) {
      const sku = `SKU-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`;
      const unitPrice = toNumber(line.unitPrice, 0);
      
      const newProduct = new Product({
        tenantId,
        sku,
        nameEn: line.productName,
        nameAr: line.productNameAr || line.productName,
        sellingPrice: flow === 'sell' ? unitPrice : unitPrice * 1.2,
        costPrice: flow === 'purchase' ? unitPrice : 0,
        taxRate: toNumber(line.taxRate, 15),
        unitOfMeasure: line.unitCode || 'PCE',
        createdBy: userId,
        isActive: true,
        status: 'active'
      });
      await newProduct.save();
      productId = newProduct._id.toString();
    }
    
    processedLines.push({
      ...line,
      productId: productId || undefined,
      lineNumber: line.lineNumber || i + 1,
      taxCategory: line.taxCategory || 'S'
    });
  }
  
  return processedLines;
}

// @route   GET /api/invoices
router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, transactionType, businessContext, search, startDate, endDate, zatcaFilter, flow } = req.query;
    
    const query = { ...req.tenantFilter };
    if (status) query.status = status;
    if (flow) query.flow = flow;
    if (transactionType) query.transactionType = transactionType;
    if (businessContext) query.businessContext = businessContext;
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }
    if (search) {
      const re = { $regex: search, $options: 'i' };
      query.$or = [
        { invoiceNumber: re },
        { contractNumber: re },
        { 'buyer.name': re },
        { 'buyer.nameAr': re },
        { 'buyer.vatNumber': re },
        { 'buyer.crNumber': re },
        { 'buyer.contactPhone': re },
        { 'buyer.contactEmail': re },
        { 'seller.name': re },
        { 'seller.nameAr': re },
        { 'seller.vatNumber': re },
        { 'seller.crNumber': re },
        { 'seller.contactPhone': re },
        { 'seller.contactEmail': re },
        { 'travelDetails.pnr': re },
        { 'travelDetails.travelerName': re },
        { 'travelDetails.ticketNumber': re },
        { 'travelDetails.passengers.pnr': re },
        { 'travelDetails.passengers.travelerName': re },
        { 'travelDetails.passengers.ticketNumber': re },
      ];
    }
    if (zatcaFilter === 'signed') {
      query['zatca.signedXml'] = { $exists: true, $nin: [null, ''] };
    } else if (zatcaFilter === 'unsigned') {
      query.$and = (query.$and || []).concat([{
        $or: [{ 'zatca.signedXml': { $exists: false } }, { 'zatca.signedXml': null }, { 'zatca.signedXml': '' }]
      }]);
    } else if (zatcaFilter === 'submitted') {
      query['zatca.submittedAt'] = { $exists: true, $ne: null };
    }
   
   const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .select('-zatca.signedXml -zatca.qrCodeData -travelDetails.passengers -travelDetails.segments')
        .populate('createdBy', 'firstName lastName firstNameAr lastNameAr email')
        .sort({ issueDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Invoice.countDocuments(query)
    ]);

    const toNumber = (value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    };

    const normalizedInvoices = (invoices || []).map((invoice) => {
      const customerPriceTotal = Array.isArray(invoice?.lineItems)
        ? invoice.lineItems.reduce((sum, line) => {
            if (!line?.isTravelMargin) return sum;
            const finalCustomerAmount = Math.max(0, Number(line.lineTotalWithTax) || 0);
            if (finalCustomerAmount > 0) return sum + finalCustomerAmount;
            const customerPrice = Math.max(0, Number(line.customerPrice) || 0);
            const quantity = Math.max(0, Number(line.quantity) || 0);
            return sum + (customerPrice * quantity);
          }, 0)
        : 0;

      const effectiveVat = Array.isArray(invoice?.lineItems)
        ? invoice.lineItems.reduce((sum, line) => {
            if (line?.isTravelMargin) {
              const taxCategory = String(line?.taxCategory || '').trim().toUpperCase();
              if (taxCategory === 'S') {
                return sum + (toNumber(line?.marginTaxable) * 0.15);
              }
            }

            return sum + toNumber(line?.taxAmount);
          }, 0)
        : toNumber(invoice?.totalTax);

      return {
        ...invoice,
        customerPriceTotal,
        effectiveVat,
        lineItems: undefined,
      };
    });
    
    res.json({
      invoices: normalizedInvoices,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/stats
router.get('/stats', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      { $match: req.tenantFilter },
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }],
          byZatcaStatus: [{ $group: { _id: '$zatca.submissionStatus', count: { $sum: 1 } } }],
          byTransactionType: [
            { $match: { status: { $nin: ['draft', 'cancelled', 'credited'] } } },
            { $group: { _id: '$transactionType', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }
          ],
          monthly: [
            { $match: { status: { $nin: ['draft', 'cancelled', 'credited'] } } },
            {
              $group: {
                _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
                count: { $sum: 1 },
                total: { $sum: '$grandTotal' },
                tax: { $sum: '$totalTax' }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ],
          totals: [
            { $match: { status: { $nin: ['draft', 'cancelled', 'credited'] } } },
            {
              $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalRevenue: { $sum: '$grandTotal' },
                totalTax: { $sum: '$totalTax' }
              }
            }
          ]
        }
      }
    ]);
    
    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pdf', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr')
      : null;

    const attachment = await buildInvoicePdfAttachment({
      invoice,
      tenant,
      customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr,
      language: 'bilingual',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${String(attachment.filename || 'invoice.pdf').replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(attachment.content);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/:id
router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('createdBy', 'firstName lastName firstNameAr lastNameAr email')
      .populate('sourceQuotationId', 'quotationNumber');
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices
// @route   POST /api/invoices/bulk-upload
router.post('/bulk-upload', checkTrialLimits('invoices'), checkPermission('invoicing', 'create'), upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { businessContext = 'trading', transactionType = 'B2C', flow = 'sell', supplierId = null } = req.body;
    let records = [];

    if (file.originalname.match(/\.csv$/i)) {
      await new Promise((resolve, reject) => {
        Readable.from(file.buffer.toString('utf8'))
          .pipe(csv())
          .on('data', (data) => records.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (file.originalname.match(/\.xlsx?$|\.xls$/i)) {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      records = xlsx.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload CSV or Excel.' });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    // Group records by Invoice ID or just create one invoice per row if no grouping ID is provided.
    // For simplicity, we assume each row is a separate invoice unless they share an 'Invoice Reference' column
    const invoicesMap = new Map();
    
    for (const record of records) {
      const ref = record['Invoice Reference'] || `TEMP-${Math.random()}`;
      if (!invoicesMap.has(ref)) {
        const partyName = record['Vendor Name'] || record['Customer Name'] || record['Name'] || (flow === 'purchase' ? 'Cash Vendor' : 'Cash Customer');
        const partyNameAr = record['Vendor Name Arabic'] || record['Customer Name Arabic'] || record['Name Arabic'] || '';
        const partyVat = record['Vendor VAT'] || record['Customer VAT'] || record['VAT'] || '';
        const street = record['Street'] || '';
        const city = record['City'] || '';
        const district = record['District'] || '';
        const postalCode = record['Postal Code'] || '';
        
        const partyData = {
          name: partyName,
          nameAr: partyNameAr,
          vatNumber: partyVat,
          address: { street, city, district, postalCode }
        };

        invoicesMap.set(ref, {
          tenantId: req.user.tenantId,
          createdBy: req.user._id,
          businessContext,
          transactionType: flow === 'purchase' ? 'B2B' : transactionType,
          invoiceTypeCode: (flow === 'purchase' || transactionType === 'B2B') ? '0100000' : '0200000',
          flow,
          ...(supplierId && flow === 'purchase' ? { supplierId } : {}),
          ...(flow === 'sell' ? { buyer: partyData } : { seller: partyData }),
          lineItems: [],
          issueDate: record['Issue Date'] ? new Date(record['Issue Date']) : new Date(),
          status: 'draft',
          subtotal: 0,
          totalTax: 0,
          grandTotal: 0
        });
      }

      const inv = invoicesMap.get(ref);
      const qty = toNumber(record['Quantity'], 1);
      const unitPrice = toNumber(record['Unit Price'], 0);
      const lineTotal = qty * unitPrice;
      const taxRate = toNumber(record['Tax Rate'], 15) / 100;
      const taxAmount = lineTotal * taxRate;
      const lineTotalWithTax = lineTotal + taxAmount;

      if (unitPrice > 0 || record['Item Name']) {
        inv.lineItems.push({
          name: record['Item Name'] || 'Item',
          nameAr: record['Item Name Arabic'] || '',
          quantity: qty,
          unitPrice,
          taxRate: taxRate * 100,
          taxAmount,
          lineTotal,
          lineTotalWithTax,
          unitCode: record['UOM'] || record['Unit'] || 'PCE'
        });

        inv.subtotal += lineTotal;
        inv.totalTax += taxAmount;
        inv.grandTotal += lineTotalWithTax;
      }
    }

    const createdInvoices = [];
    let successCount = 0;
    let failCount = 0;

    for (const invData of invoicesMap.values()) {
      try {
        const tenant = await Tenant.findById(req.user.tenantId);
        // Generate invoice number
        const lastInvoice = await Invoice.findOne({ 
          tenantId: req.user.tenantId, 
          businessContext: invData.businessContext,
          transactionType: invData.transactionType,
          flow: invData.flow 
        }).sort({ createdAt: -1 });

        let nextInvoiceNumber = '';
        if (lastInvoice && lastInvoice.invoiceNumber) {
          const parts = lastInvoice.invoiceNumber.split('-');
          const lastNum = parseInt(parts.pop(), 10) || 0;
          const paddedNextNum = String(lastNum + 1).padStart(6, '0');
          nextInvoiceNumber = parts.length > 0 ? `${parts.join('-')}-${paddedNextNum}` : paddedNextNum;
        } else {
          const prefix = invData.businessContext === 'trading' ? 'TRD' : invData.businessContext === 'construction' ? 'CON' : 'INV';
          nextInvoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(1).padStart(6, '0')}`;
        }
        
        // Temporarily save the last invoice in memory for sequential processing in bulk upload
        const dummyLastInvoice = new Invoice({ invoiceNumber: nextInvoiceNumber, createdAt: new Date() });
        // The findOne above will not see the uncommitted ones, wait!
        // We need to keep track of the last generated invoice number per context.
        
        enrichInvoiceArabicFields(invData);
        
        await ensureProductsExist(req.user.tenantId, req.user._id, invData.lineItems, invData.flow);
        
        invData.invoiceNumber = nextInvoiceNumber;
        const invoice = new Invoice(invData);
        
        const isB2C = invoice.transactionType === 'B2C';
        const isPhase1 = tenant?.zatca?.phase === 1;
        if (isB2C && isPhase1 && isZatcaCurrency(tenant)) {
          invoice.zatca = {
            ...invoice.zatca,
            qrCode: buildDraftInvoiceQr(invoice, tenant)
          };
        }
        
        await invoice.save();
        createdInvoices.push(invoice._id);
        successCount++;
      } catch (err) {
        failCount++;
        console.error('Failed to create invoice in bulk upload:', err);
      }
    }

    res.json({
      success: true,
      successCount,
      failCount,
      message: `Successfully created ${successCount} invoices. Failed: ${failCount}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('invoices'), checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const tenant = await Tenant.findById(req.user.tenantId);

    const tenantId = req.user.tenantId;
    let customer = null;

    if (req.body.customerId && cleanObjectId(req.body.customerId)) {
      if (!mongoose.Types.ObjectId.isValid(req.body.customerId)) {
        return res.status(400).json({ error: 'Invalid customerId' });
      }

      customer = await Customer.findOne({ _id: req.body.customerId, ...req.tenantFilter });
      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }
    } else if (req.body?.buyer?.vatNumber) {
      const vatNumber = String(req.body.buyer.vatNumber || '').trim();
      if (vatNumber) {
        customer = await Customer.findOne({ tenantId, vatNumber });
      }
    }

    const buyer = { ...(req.body.buyer || {}) };

    if (customer) {
      buyer.name = buyer.name || customer.name;
      buyer.nameAr = buyer.nameAr || customer.nameAr;
      buyer.vatNumber = buyer.vatNumber || customer.vatNumber;
      buyer.crNumber = buyer.crNumber || customer.crNumber;
      buyer.address = { ...(customer.address || {}), ...(buyer.address || {}) };
    }

    if (!buyer.name || !String(buyer.name).trim()) {
      buyer.name = 'Cash Customer';
      buyer.nameAr = buyer.nameAr || 'عميل نقدي';
    }
    
    // Generate invoice number
    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');
    
    let invoiceNumber = '';
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastPart = parts.pop();
      if (lastPart && !isNaN(parseInt(lastPart))) {
        const nextNum = parseInt(lastPart) + 1;
        const paddedNextNum = String(nextNum).padStart(lastPart.length, '0');
        invoiceNumber = parts.length > 0 ? `${parts.join('-')}-${paddedNextNum}` : paddedNextNum;
      }
    }
    
    if (!invoiceNumber) {
      invoiceNumber = `INV-${new Date().getFullYear()}-${String(1).padStart(6, '0')}`;
    }

    const transactionType = req.body.transactionType || 'B2C';
    const invoiceTypeCode = req.body.invoiceTypeCode || (transactionType === 'B2C' ? '0200000' : '0100000');
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    req.body.lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, 'sell');
    
    resolvePaymentStatus(req.body);

    const invoiceData = {
      ...req.body,
      tenantId: req.user.tenantId,
      invoiceNumber,
      transactionType,
      invoiceTypeCode,
      issueDate,
      buyer,
      customerId: cleanObjectId(customer?._id || req.body.customerId),
      status: resolveInitialSellInvoiceStatus(req.body?.status, tenant),
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: tenant.business.vatNumber,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address
      },
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user)
    };

    if (!cleanObjectId(invoiceData.warehouseId)) {
      delete invoiceData.warehouseId;
    }

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const invoice = await Invoice.create(enrichedInvoiceData);

    if (invoice.customerId) {
      await syncCustomerStats(invoice.tenantId, invoice.customerId);
    }

    let emailDelivery = { sent: false, reason: 'disabled' };
    if (invoice.flow === 'sell' && (invoice.status === 'approved' || invoice.zatca?.signedXml)) {
      try {
        emailDelivery = await autoSendInvoice(invoice._id, invoice.tenantId, {
          language: req.tenant?.settings?.language,
        });
      } catch {
        emailDelivery = { sent: false, reason: 'error' };
      }
    }

    res.status(201).json({
      ...invoice.toJSON(),
      emailDelivery,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/consolidated
router.post('/consolidated', checkPermission('invoicing', 'create'), createInvoiceFromMultipleDNs);

// @route   POST /api/invoices/sell
router.post('/sell', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const tenantBusinessTypes = getTenantBusinessTypes(req.tenant);
    const primaryBusinessType = getPrimaryBusinessType(req.tenant);
    const tenant = await Tenant.findById(req.user.tenantId);

    const businessContext = tenantBusinessTypes.includes(req.body?.businessContext)
      ? req.body.businessContext
      : primaryBusinessType;

    const restaurantOrderId = cleanObjectId(req.body?.restaurantOrderId);
    const travelBookingId = cleanObjectId(req.body?.travelBookingId);
    let restaurantOrder = null;
    let travelBooking = null;

    if (restaurantOrderId) {
      if (!tenantBusinessTypes.includes('restaurant')) {
        return res.status(403).json({ error: 'Not available for this business type' });
      }
      if (!mongoose.Types.ObjectId.isValid(restaurantOrderId)) {
        return res.status(400).json({ error: 'Invalid restaurantOrderId' });
      }
      restaurantOrder = await RestaurantOrder.findOne({ _id: restaurantOrderId, ...req.tenantFilter, isActive: true });
      if (!restaurantOrder) {
        return res.status(400).json({ error: 'Restaurant order not found' });
      }
    }

    if (travelBookingId) {
      if (!tenantBusinessTypes.includes('travel_agency')) {
        return res.status(403).json({ error: 'Not available for this business type' });
      }
      if (!mongoose.Types.ObjectId.isValid(travelBookingId)) {
        return res.status(400).json({ error: 'Invalid travelBookingId' });
      }
      travelBooking = await TravelBooking.findOne({ _id: travelBookingId, ...req.tenantFilter, isActive: true });
      if (!travelBooking) {
        return res.status(400).json({ error: 'Travel booking not found' });
      }
    }

    if (businessContext === 'trading') {
      if (req.body.warehouseId && cleanObjectId(req.body.warehouseId)) {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
        if (!warehouse) {
          return res.status(400).json({ error: 'Warehouse not found' });
        }
      }
    }

    const tenantId = req.user.tenantId;
    let customer = null;

    if (req.body.customerId && cleanObjectId(req.body.customerId)) {
      if (!mongoose.Types.ObjectId.isValid(req.body.customerId)) {
        return res.status(400).json({ error: 'Invalid customerId' });
      }

      customer = await Customer.findOne({ _id: req.body.customerId, ...req.tenantFilter });
      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }
    } else if (req.body?.buyer?.vatNumber) {
      const vatNumber = String(req.body.buyer.vatNumber || '').trim();
      if (vatNumber) {
        customer = await Customer.findOne({ tenantId, vatNumber });
      }
    }

    const buyer = { ...(req.body.buyer || {}) };

    if (customer) {
      buyer.name = buyer.name || customer.name;
      buyer.nameAr = buyer.nameAr || customer.nameAr;
      buyer.vatNumber = buyer.vatNumber || customer.vatNumber;
      buyer.crNumber = buyer.crNumber || customer.crNumber;
      buyer.address = { ...(customer.address || {}), ...(buyer.address || {}) };
    }

    if (!buyer.name || !String(buyer.name).trim()) {
      buyer.name = 'Cash Customer';
      buyer.nameAr = buyer.nameAr || 'عميل نقدي';
    }

    if (!customer && businessContext === 'travel_agency') {
      customer = await ensureCustomerRecord(req.user.tenantId, buyer);
      if (customer) {
        buyer.name = buyer.name || customer.name;
        buyer.nameAr = buyer.nameAr || customer.nameAr;
        buyer.vatNumber = buyer.vatNumber || customer.vatNumber;
        buyer.crNumber = buyer.crNumber || customer.crNumber;
        buyer.contactEmail = buyer.contactEmail || customer.email;
        buyer.contactPhone = buyer.contactPhone || customer.phone || customer.mobile;
        buyer.address = { ...(customer.address || {}), ...(buyer.address || {}) };
      }
    }

    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');

    let invoiceNumber = '';
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastPart = parts.pop();
      if (lastPart && !isNaN(parseInt(lastPart))) {
        const nextNum = parseInt(lastPart) + 1;
        const paddedNextNum = String(nextNum).padStart(lastPart.length, '0');
        invoiceNumber = parts.length > 0 ? `${parts.join('-')}-${paddedNextNum}` : paddedNextNum;
      }
    }
    
    if (!invoiceNumber) {
      invoiceNumber = `INV-${new Date().getFullYear()}-${String(1).padStart(6, '0')}`;
    }

    const transactionType = req.body.transactionType === 'B2B' ? 'B2B' : 'B2C';
    const invoiceSubtype = businessContext === 'travel_agency'
      ? (req.body.invoiceSubtype === 'proforma' ? 'proforma' : 'travel_ticket')
      : (req.body.invoiceSubtype === 'travel_ticket' ? 'travel_ticket' : (req.body.invoiceSubtype === 'proforma' ? 'proforma' : 'standard'));
    const invoiceTypeCode = req.body.invoiceTypeCode || (transactionType === 'B2C' ? '0200000' : '0100000');
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);

    const lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, 'sell');
    const invoiceDiscount = Math.max(0, toNumber(req.body?.invoiceDiscount, 0));

    const productIds = lineItems
      .map((li) => li.productId)
      .filter(Boolean)
      .map((id) => id.toString());
    const uniqueProductIds = [...new Set(productIds)];
    if (businessContext === 'trading' && uniqueProductIds.length) {
      const existingCount = await Product.countDocuments({ _id: { $in: uniqueProductIds }, ...req.tenantFilter });
      if (existingCount !== uniqueProductIds.length) {
        return res.status(400).json({ error: 'Invalid product in line items' });
      }
    }

    const invoiceData = {
      ...req.body,
      tenantId: req.user.tenantId,
      flow: 'sell',
      businessContext,
      invoiceNumber,
      transactionType,
      invoiceSubtype,
      sourcePurchaseOrderId: cleanObjectId(req.body.sourcePurchaseOrderId),
      pdfTemplateId,
      invoiceTypeCode,
      issueDate,
      buyer,
      customerId: cleanObjectId(customer?._id || req.body.customerId),
      status: resolveInitialSellInvoiceStatus(req.body?.status, tenant),
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: tenant.business.vatNumber,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address,
        contactPhone: tenant.business.contactPhone,
        contactEmail: tenant.business.contactEmail,
      },
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      invoiceDiscount,
      lineItems,
    };

    if (businessContext !== 'trading' || !cleanObjectId(invoiceData.warehouseId)) {
      delete invoiceData.warehouseId;
    }

    const requestTravelDetails = sanitizeTravelDetails(req.body?.travelDetails, buyer.name || travelBooking?.travelerName || travelBooking?.customerName || '');

    if (travelBooking) {
      invoiceData.travelDetails = sanitizeTravelDetails({
        ...requestTravelDetails,
        travelerName: requestTravelDetails.travelerName || travelBooking.travelerName || travelBooking.customerName,
        passportNumber: requestTravelDetails.passportNumber || travelBooking.passportNumber,
        ticketNumber: requestTravelDetails.ticketNumber || travelBooking.ticketNumber,
        pnr: requestTravelDetails.pnr || travelBooking.pnr,
        airlineName: requestTravelDetails.airlineName || travelBooking.airlineName,
        routeFrom: requestTravelDetails.routeFrom || travelBooking.routeFrom,
        routeTo: requestTravelDetails.routeTo || travelBooking.routeTo,
        departureDate: requestTravelDetails.departureDate || travelBooking.departureDate,
        returnDate: requestTravelDetails.returnDate || travelBooking.returnDate,
      }, buyer.name || travelBooking.travelerName || travelBooking.customerName || '');
    } else if (req.body?.travelDetails || businessContext === 'travel_agency') {
      invoiceData.travelDetails = requestTravelDetails;
    }

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const createdInvoice = await Invoice.create(enrichedInvoiceData);
    const invoice = await attachDraftQr(createdInvoice, tenant.business, tenant);

    if (restaurantOrder) {
      await RestaurantOrder.updateOne(
        { _id: restaurantOrder._id, ...req.tenantFilter },
        { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber, invoicedAt: new Date() }
      );
    }

    if (travelBooking) {
      await syncTravelBookingFromInvoice({
        invoice,
        tenantFilterValue: req.tenantFilter,
        userId: req.user._id,
        existingBooking: travelBooking,
      });
    } else if (businessContext === 'travel_agency') {
      const syncedBooking = await syncTravelBookingFromInvoice({
        invoice,
        tenantFilterValue: req.tenantFilter,
        userId: req.user._id,
      });

      if (syncedBooking?._id) {
        invoice.travelBookingId = syncedBooking._id;
        if (!invoice.contractNumber) {
          invoice.contractNumber = syncedBooking.bookingNumber;
        }
        await invoice.save();
      }
    }

    if (invoice.customerId) {
      await syncCustomerStats(invoice.tenantId, invoice.customerId);
    }

    const invoiceCustomer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email contactPerson')
      : customer;

    let emailDelivery = { sent: false, reason: 'disabled' };
    let whatsappDelivery = { sent: false, reason: 'disabled' };
    if (invoice.status === 'approved' || invoice.zatca?.signedXml) {
      try {
        emailDelivery = await autoEmailInvoiceIfEnabled({
          tenant,
          invoice,
          customer: invoiceCustomer,
          language: tenant?.settings?.language,
        });
      } catch (emailError) {
        emailDelivery = { sent: false, reason: emailError.message };
      }

      try {
        whatsappDelivery = await autoWhatsAppInvoiceIfEnabled({
          tenant,
          invoice,
          customer: invoiceCustomer,
          language: tenant?.settings?.language,
        });
      } catch (waError) {
        whatsappDelivery = { sent: false, reason: waError.message };
      }
    }

    res.status(201).json({ ...invoice.toObject(), emailDelivery, whatsappDelivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/purchase
router.post('/purchase', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const tenantBusinessTypes = getTenantBusinessTypes(req.tenant);
    const primaryBusinessType = getPrimaryBusinessType(req.tenant);
    if (!tenantBusinessTypes.some((type) => ['trading', 'construction', 'travel_agency'].includes(type))) {
      return res.status(403).json({ error: 'Not available for this business type' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    const businessContext = tenantBusinessTypes.includes(req.body?.businessContext)
      ? req.body.businessContext
      : (tenantBusinessTypes.includes(primaryBusinessType) ? primaryBusinessType : 'trading');

    if (businessContext === 'trading') {
      if (req.body.warehouseId && cleanObjectId(req.body.warehouseId)) {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
        if (!warehouse) {
          return res.status(400).json({ error: 'Warehouse not found' });
        }
      }
    }

    let supplier = null;
    if (req.body.supplierId && cleanObjectId(req.body.supplierId)) {
      if (!mongoose.Types.ObjectId.isValid(req.body.supplierId)) {
        return res.status(400).json({ error: 'Invalid supplierId' });
      }

      supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' });
      }
    }

    const seller = { ...(req.body.seller || {}) };
    if (supplier) {
      seller.name = seller.name || supplier.nameEn;
      seller.nameAr = seller.nameAr || supplier.nameAr;
      seller.vatNumber = seller.vatNumber || supplier.vatNumber;
      seller.crNumber = seller.crNumber || supplier.crNumber;
      seller.address = { ...(supplier.address || {}), ...(seller.address || {}) };
      seller.contactPhone = seller.contactPhone || supplier.phone;
      seller.contactEmail = seller.contactEmail || supplier.email;
    }

    if (!seller.name || !String(seller.name).trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');

    const invoiceCount = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop()) + 1
      : 1;

    const invoiceNumber = `PINV-${new Date().getFullYear()}-${String(invoiceCount).padStart(6, '0')}`;

    const transactionType = req.body.transactionType || 'B2B';
    const invoiceSubtype = req.body.invoiceSubtype === 'travel_ticket' ? 'travel_ticket' : 'standard';
    const invoiceTypeCode = req.body.invoiceTypeCode || '0100000';
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);

    const lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, 'purchase');

    const productIds = lineItems
      .map((li) => li.productId)
      .filter(Boolean)
      .map((id) => id.toString());
    const uniqueProductIds = [...new Set(productIds)];
    if (businessContext === 'trading' && uniqueProductIds.length) {
      const existingCount = await Product.countDocuments({ _id: { $in: uniqueProductIds }, ...req.tenantFilter });
      if (existingCount !== uniqueProductIds.length) {
        return res.status(400).json({ error: 'Invalid product in line items' });
      }
    }

    const invoiceData = {
      ...req.body,
      tenantId: req.user.tenantId,
      flow: 'purchase',
      businessContext,
      invoiceNumber,
      transactionType,
      invoiceSubtype,
      pdfTemplateId,
      invoiceTypeCode,
      issueDate,
      seller,
      supplierId: cleanObjectId(supplier?._id || req.body.supplierId),
      buyer: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: tenant.business.vatNumber,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address,
        contactPhone: tenant.business.contactPhone,
        contactEmail: tenant.business.contactEmail,
      },
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      lineItems,
    };

    if (businessContext !== 'trading' || !cleanObjectId(invoiceData.warehouseId)) {
      delete invoiceData.warehouseId;
    }

    if (req.body?.travelDetails) {
      invoiceData.travelDetails = req.body.travelDetails;
    }

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const createdInvoice = await Invoice.create(enrichedInvoiceData);
    const invoice = await attachDraftQr(createdInvoice, seller, tenant);

    if (businessContext === 'trading') {
      const posted = await postInventoryForInvoice(invoice, req.tenantFilter);
      return res.status(201).json(posted);
    }

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/post-inventory
router.post('/:id/post-inventory', requireBusinessType('trading'), checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!['draft', 'pending', 'approved'].includes(invoice.status)) {
      return res.status(400).json({ error: 'Inventory cannot be posted for this invoice status' });
    }

    if (req.body?.warehouseId && mongoose.Types.ObjectId.isValid(req.body.warehouseId)) {
      invoice.warehouseId = req.body.warehouseId;
    }

    if (!invoice.warehouseId) {
      return res.status(400).json({ error: 'warehouseId is required' });
    }

    const result = await postInventoryForInvoice(invoice, req.tenantFilter);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/invoices/:id
router.put('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const tenant = await Tenant.findById(req.user.tenantId);
    const isPhase1 = tenant?.zatca?.phase === 1;
    
    if (!isPhase1 && (!['draft', 'pending'].includes(invoice.status) || invoice.zatca?.signedXml)) {
      return res.status(400).json({ error: 'Only unsigned draft or pending invoices can be modified' });
    }
    
    if (req.body.lineItems) {
      req.body.lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, invoice.flow);
    }
    
    // Only resolve payment status for manually edited fields (not auto-triggered updates without payment info)
    if (req.body.paymentMethod || req.body.grandTotal !== undefined) {
      resolvePaymentStatus(req.body);
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    if (invoice.flow === 'sell' && (invoice.status === 'approved' || invoice.zatca?.signedXml)) {
      try {
        await autoSendInvoice(invoice._id, invoice.tenantId, {
          language: req.tenant?.settings?.language,
        });
      } catch {
      }
    }
    
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins can delete invoices' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tenantId = invoice.tenantId;
    const customerId = invoice.customerId;
    const invoiceId = invoice._id;
    const invoiceNumber = invoice.invoiceNumber;

    await reverseInventoryForDeletedInvoice(invoice, req.tenantFilter);
    await invoice.deleteOne();

    await Promise.all([
      TravelBooking.updateMany(
        {
          ...req.tenantFilter,
          $or: [
            { invoiceId },
            { invoiceNumber },
            ...(invoice.travelBookingId ? [{ _id: invoice.travelBookingId }] : []),
          ],
        },
        { $set: { invoiceId: null, invoiceNumber: '', invoicedAt: null } }
      ),
      RestaurantOrder.updateMany(
        {
          ...req.tenantFilter,
          $or: [
            { invoiceId },
            { invoiceNumber },
            ...(invoice.restaurantOrderId ? [{ _id: invoice.restaurantOrderId }] : []),
          ],
        },
        { $set: { invoiceId: null, invoiceNumber: '', invoicedAt: null } }
      ),
      EmailMessage.updateMany(
        { ...req.tenantFilter, relatedInvoiceId: invoiceId },
        { $set: { relatedInvoiceId: null } }
      ),
      syncCustomerStats(tenantId, customerId),
    ]);

    res.json({ success: true, deletedInvoiceId: invoiceId, invoiceNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/sign', checkPermission('invoicing', 'approve'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.flow === 'purchase') {
      return res.status(400).json({ error: 'Cannot sign purchase invoices' });
    }
    
    if (invoice.zatca?.submissionStatus !== 'pending' && invoice.zatca?.signedXml) {
      return res.status(400).json({ error: 'Invoice already signed' });
    }

    if ((invoice.businessContext || getPrimaryBusinessType(req.tenant)) === 'trading' && invoice.flow === 'sell' && !invoice.inventory?.postedAt) {
      try {
        await postInventoryForInvoice(invoice, req.tenantFilter);
      } catch (err) {
        return res.status(400).json({ error: err.message || 'Failed to post inventory' });
      }
    }
    
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!isZatcaCurrency(tenant)) {
      return res.status(400).json({ error: 'ZATCA e-invoicing only applies to SAR-denominated invoices. Set your tenant currency to SAR to enable ZATCA signing and submission.' });
    }

    let privateKey = tenant.zatca?.privateKey;
    if (!privateKey) {
      const generatedKeys = ZatcaService.generateKeyPair();
      tenant.zatca = {
        ...(tenant.zatca?.toObject?.() || tenant.zatca || {}),
        privateKey: generatedKeys.privateKey,
      };
      tenant.markModified('zatca');
      await tenant.save();
      privateKey = generatedKeys.privateKey;
    }
    
    const zatcaService = new ZatcaService({
      privateKey,
      certificate: tenant.zatca.certificate,
      csid: tenant.zatca.productionCsid,
      previousInvoiceHash: tenant.zatca.lastInvoiceHash
    });
    
    const isB2C = invoice.transactionType === 'B2C';
    const zatcaResult = await zatcaService.processInvoice(invoice.toObject(), tenant.business, isB2C);
    
    invoice.zatca = {
      ...invoice.zatca,
      ...zatcaResult,
      signedXml: zatcaResult.xml
    };
    
    invoice.status = tenant.zatca?.phase === 1 ? 'approved' : 'pending';
    await invoice.save();
    
    // Update tenant's invoice counter and hash
    await Tenant.findByIdAndUpdate(tenant._id, {
      'zatca.invoiceCounter': zatcaResult.invoiceCounter,
      'zatca.lastInvoiceHash': zatcaResult.invoiceHash
    });
    
    // For B2B, immediately submit for clearance
    if (!isB2C && tenant.zatca.isOnboarded && tenant.zatca?.phase !== 1) {
      const clearanceResult = await zatcaService.submitForClearance(
        zatcaResult.xml,
        zatcaResult.invoiceHash,
        zatcaResult.uuid
      );
      
      invoice.zatca.submissionStatus = clearanceResult.success ? 'cleared' : 'rejected';
      invoice.zatca.clearanceStatus = clearanceResult.clearanceStatus;
      invoice.zatca.zatcaResponse = clearanceResult;
      invoice.zatca.submittedAt = new Date();
      
      if (clearanceResult.success) {
        invoice.zatca.clearedAt = new Date();
        invoice.status = 'approved';
      } else {
        invoice.zatca.lastError = clearanceResult.errors?.join(', ') || clearanceResult.error;
      }
      
      await invoice.save();
    }

    if (isB2C && tenant.zatca.isOnboarded && tenant.zatca?.phase !== 1) {
      const reportingResult = await zatcaService.submitForReporting(
        zatcaResult.xml,
        zatcaResult.invoiceHash,
        zatcaResult.uuid
      );

      invoice.zatca.submissionStatus = reportingResult.success ? 'reported' : 'rejected';
      invoice.zatca.reportingStatus = reportingResult.reportingStatus;
      invoice.zatca.zatcaResponse = reportingResult;
      invoice.zatca.submittedAt = new Date();

      if (reportingResult.success) {
        invoice.status = 'approved';
      } else {
        invoice.zatca.lastError = reportingResult.errors?.join(', ') || reportingResult.error;
      }

      await invoice.save();
    }

    if (invoice.customerId) {
      await syncCustomerStats(invoice.tenantId, invoice.customerId);
    }

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email contactPerson')
      : null;

    let emailDelivery = { sent: false, reason: 'disabled' };
    try {
      emailDelivery = await autoEmailInvoiceIfEnabled({
        tenant,
        invoice,
        customer,
        language: tenant?.settings?.language,
      });
    } catch (emailError) {
      emailDelivery = { sent: false, reason: emailError.message };
    }
    
    res.json({ ...invoice.toObject(), emailDelivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/send-email', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.flow === 'purchase') {
      return res.status(400).json({ error: 'Purchase invoices cannot be emailed to customers' });
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

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email contactPerson')
      : null;
    const recipient = resolveInvoiceRecipient(customer, invoice, req.body?.to);
    if (!recipient) {
      return res.status(400).json({ error: 'Customer email is missing' });
    }

    const attachment = req.body?.attachment && typeof req.body.attachment === 'object'
      ? {
          filename: String(req.body.attachment.filename || `${invoice.invoiceNumber || 'invoice'}.pdf`).trim(),
          contentBase64: String(req.body.attachment.contentBase64 || '').trim(),
          contentType: String(req.body.attachment.contentType || 'application/pdf').trim() || 'application/pdf',
          size: Number(req.body.attachment.size || 0),
        }
      : null;

    const delivery = await sendInvoiceToRecipient({
      tenant,
      invoice,
      recipient,
      customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr,
      language: req.body?.language || tenant?.settings?.language,
      purpose: 'manual_invoice',
      attachment,
    });

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/:id/qr
router.get('/:id/qr', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter })
      .select('zatca.qrCodeImage zatca.qrCodeData');
    
    if (!invoice || !invoice.zatca?.qrCodeImage) {
      return res.status(404).json({ error: 'QR code not found' });
    }
    
    res.json({
      qrCodeImage: invoice.zatca.qrCodeImage,
      qrCodeData: invoice.zatca.qrCodeData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/:id/xml
router.get('/:id/xml', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter })
      .select('invoiceNumber zatca.signedXml');
    
    if (!invoice || !invoice.zatca?.signedXml) {
      return res.status(404).json({ error: 'XML not found' });
    }
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xml"`);
    res.send(invoice.zatca.signedXml);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/cancel
router.post('/:id/cancel', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: { $nin: ['cancelled', 'credited'] } },
      { status: 'cancelled', internalNotes: `Cancelled: ${reason}` },
      { new: true }
    );
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or cannot be cancelled' });
    }

    if (invoice.customerId) {
      await syncCustomerStats(invoice.tenantId, invoice.customerId);
    }
    
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/credit-note
router.post('/:id/credit-note', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const originalInvoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!originalInvoice) {
      return res.status(404).json({ error: 'Original invoice not found' });
    }
    if (originalInvoice.invoiceType !== '388') {
      return res.status(400).json({ error: 'Credit notes can only be issued from a standard tax invoice' });
    }
    if (['cancelled', 'credited'].includes(originalInvoice.status)) {
      return res.status(400).json({ error: 'This invoice cannot receive a credit note' });
    }
    if (originalInvoice.invoiceSubtype === 'proforma') {
      return res.status(400).json({ error: 'Cannot issue a credit note from a proforma invoice' });
    }

    const existingCn = await Invoice.findOne({
      tenantId: originalInvoice.tenantId,
      originalInvoiceId: originalInvoice._id,
      invoiceType: '381',
    }).select('_id invoiceNumber');
    if (existingCn) {
      return res.status(400).json({
        error: `A credit note already exists (${existingCn.invoiceNumber})`,
        creditNoteId: existingCn._id,
      });
    }

    const creditNoteNumber = `CN-${originalInvoice.invoiceNumber}`;
    const source = originalInvoice.toObject();
    delete source._id;
    delete source.__v;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.zatca;
    delete source.proformaSourceId;

    // ZATCA credit notes reverse the original document (negative quantities).
    const reversedLines = (Array.isArray(source.lineItems) ? source.lineItems : []).map((line) => {
      const qty = Number(line.quantity || 0);
      const unitPrice = Number(line.unitPrice || 0);
      const taxRate = Number(line.taxRate || 0);
      const quantity = -Math.abs(qty || 0);
      const lineExtensionAmount = Number((quantity * unitPrice).toFixed(2));
      const taxAmount = Number((lineExtensionAmount * (taxRate / 100)).toFixed(2));
      return {
        ...line,
        _id: undefined,
        quantity,
        lineExtensionAmount,
        taxAmount,
        allowanceAmount: line.allowanceAmount ? -Math.abs(Number(line.allowanceAmount)) : 0,
      };
    });

    const subtotal = Number(reversedLines.reduce((sum, line) => sum + Number(line.lineExtensionAmount || 0), 0).toFixed(2));
    const taxAmount = Number(reversedLines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0).toFixed(2));
    const grandTotal = Number((subtotal + taxAmount).toFixed(2));

    const creditNote = await Invoice.create({
      ...source,
      invoiceNumber: creditNoteNumber,
      invoiceType: '381',
      invoiceTypeCode: originalInvoice.transactionType === 'B2C' ? '0200100' : '0100100',
      originalInvoiceId: originalInvoice._id,
      lineItems: reversedLines,
      subtotal,
      taxAmount,
      grandTotal,
      paidAmount: 0,
      status: 'draft',
      zatca: {},
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      issueDate: new Date(),
    });

    originalInvoice.status = 'credited';
    await originalInvoice.save();

    if (originalInvoice.customerId) {
      await syncCustomerStats(originalInvoice.tenantId, originalInvoice.customerId);
    }
    
    res.status(201).json(creditNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/debit-note
router.post('/:id/debit-note', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const originalInvoice = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!originalInvoice) {
      return res.status(404).json({ error: 'Original invoice not found' });
    }
    if (originalInvoice.invoiceType !== '388') {
      return res.status(400).json({ error: 'Debit notes can only be issued from a standard tax invoice' });
    }
    if (['cancelled', 'credited'].includes(originalInvoice.status)) {
      return res.status(400).json({ error: 'This invoice cannot receive a debit note' });
    }
    if (originalInvoice.invoiceSubtype === 'proforma') {
      return res.status(400).json({ error: 'Cannot issue a debit note from a proforma invoice' });
    }

    const debitNoteNumber = `DN-${originalInvoice.invoiceNumber}-${Date.now().toString(36).slice(-4)}`;
    const source = originalInvoice.toObject();
    delete source._id;
    delete source.__v;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.zatca;
    delete source.proformaSourceId;

    // Debit notes start as a linked draft copy — amounts stay editable for extra charges.
    const lineItems = (Array.isArray(source.lineItems) ? source.lineItems : []).map((line) => ({
      ...line,
      _id: undefined,
    }));

    const debitNote = await Invoice.create({
      ...source,
      invoiceNumber: debitNoteNumber,
      invoiceType: '383',
      invoiceTypeCode: originalInvoice.transactionType === 'B2C' ? '0200200' : '0100200',
      originalInvoiceId: originalInvoice._id,
      lineItems,
      paidAmount: 0,
      status: 'draft',
      zatca: {},
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      issueDate: new Date(),
      notes: [
        String(source.notes || '').trim(),
        `Debit note linked to ${originalInvoice.invoiceNumber}`,
      ].filter(Boolean).join('\n'),
    });

    res.status(201).json(debitNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/convert-proforma
// @desc    Convert a proforma invoice to a standard invoice
router.post('/:id/convert-proforma', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const proforma = await Invoice.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!proforma) return res.status(404).json({ error: 'Proforma invoice not found' });
    if (proforma.invoiceSubtype !== 'proforma') return res.status(400).json({ error: 'Invoice is not a proforma' });
    if (proforma.status === 'cancelled') return res.status(400).json({ error: 'Cannot convert a cancelled proforma' });

    const tenant = await Tenant.findById(req.user.tenantId);
    
    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId, invoiceSubtype: { $ne: 'proforma' } })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');

    const invoiceCount = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop()) + 1
      : 1;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount).padStart(6, '0')}`;

    // Create a deep copy of the invoice data to make a new real invoice
    const invoiceData = proforma.toObject();
    delete invoiceData._id;
    delete invoiceData.createdAt;
    delete invoiceData.updatedAt;
    delete invoiceData.__v;
    delete invoiceData.zatca;
    
    // Switch subtype and link back
    invoiceData.invoiceSubtype = invoiceData.businessContext === 'travel_agency' ? 'travel_ticket' : 'standard';
    invoiceData.proformaSourceId = proforma._id;
    invoiceData.invoiceNumber = invoiceNumber;
    invoiceData.issueDate = new Date();
    invoiceData.status = 'draft';

    const createdInvoice = await Invoice.create(invoiceData);
    const invoice = await attachDraftQr(createdInvoice, tenant.business, tenant);

    // Update proforma status to avoid double conversion
    proforma.status = 'sent';
    await proforma.save();

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
