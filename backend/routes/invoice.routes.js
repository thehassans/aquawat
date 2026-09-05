import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
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
import { protect, tenantFilter, requireTenantFilter, checkPermission, requireBusinessType, tenantHasEmailAddon } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getPrimaryBusinessType, getTenantBusinessTypes } from '../utils/businessTypes.js';
import {
  shouldScopeInvoicesToSelf,
  applyCreatedByScope,
  isElevatedRole,
  scopedInvoiceFilter,
} from '../utils/accessScope.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { buildDraftInvoiceQr } from '../utils/zatca/draftInvoiceQr.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { autoSendInvoice, sendInvoiceToRecipient } from '../utils/tenantEmailService.js';
import { autoSmsInvoiceIfEnabled } from './sms.routes.js';
import { getOrBuildInvoicePdfAttachment, getCachedInvoicePdfAttachment, enqueueInvoicePdf } from '../services/invoicePdfQueue.js';
import { afterInvoiceWrite } from '../utils/invoiceLifecycle.js';
import { emitPlatformEvent } from '../utils/platformEvents.js';
import { createInvoiceFromMultipleDNs } from '../controllers/invoiceController.js';
import { sendRestaurantWhatsApp } from '../services/restaurantWhatsAppService.js';
import { sendInvoiceOnWhatsApp, getWhatsAppConfig } from '../services/whatsappCloudService.js';
import { assertThreeWayMatchOrThrow } from '../services/inventory/threeWayMatch.js';
import { InventoryError } from '../services/inventory/errors.js';
import { clampTemplateId } from '../utils/premiumTemplates.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';
import { isFbrCurrency } from '../utils/fbrCurrency.js';
import { applyFbrToInvoice } from '../utils/fbr/FbrService.js';
import { applyCountryComplianceToInvoice } from '../utils/compliance/CountryComplianceService.js';
import { ensureInvoiceDueDate, applyInvoicePaymentTerms, computePaymentSettlement } from '../utils/invoicePaymentTerms.js';
import { cacheAside } from '../lib/redis.js';
import { applyInvoiceListSearch } from '../utils/invoiceSearch.js';
import { statsRead } from '../utils/mongoReadPreference.js';
import { resolvePaymentStatus, applyPaidAmountStatus, isOverpay, paymentExceedsRemaining, canRecordPayment } from '../utils/invoicePaymentStatus.js';
import { makeRateLimitStore } from '../utils/hybridRateLimitStore.js';
import { isStockTrackedProductType, normalizeProductType, stampLineProductTypes } from '../utils/productType.js';
import { recordUserActivity } from '../utils/auditLogger.js';
import { syncMarqueeBookingFromDocument } from '../utils/marqueeSync.js';
import { applyDeliveredInvoicingPolicy } from '../services/sales/invoicingPolicy.js';
import { deliverDigitalProductsByEmail } from '../services/sales/digitalFulfillment.js';
import { assertSellerAddressReady } from '../services/sales/creditLimit.js';
import {
  evaluateInvoicePrePost,
  assertInvoicePrePostReady,
} from '../services/sales/invoicePrePostValidation.js';
import { isValidSaudiVat, normalizeSaudiVatDigits } from '../utils/saudiVat.js';
import { zatcaInvoiceKindForTransaction } from '../utils/transactionType.js';
import {
  ensureDefaultTaxes,
  resolveTaxByIdOrCode,
  vatTreatmentFromTax,
} from '../services/accountingService.js';

function syncZatcaInvoiceType(target, transactionType) {
  if (!target || typeof target !== 'object') return;
  const kind = zatcaInvoiceKindForTransaction(transactionType);
  const prev = target.zatca && typeof target.zatca === 'object'
    ? (target.zatca.toObject?.() || { ...target.zatca })
    : {};
  target.zatca = { ...prev, invoiceType: kind };
}

function appendTransactionTypeOverride(req, invoice, { from, to, reason }) {
  const trimmed = String(reason || '').trim();
  if (!trimmed) return null;
  const entry = {
    from: from === 'B2B' ? 'B2B' : 'B2C',
    to: to === 'B2B' ? 'B2B' : 'B2C',
    reason: trimmed,
    changedBy: req.user?._id,
    changedByName:
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ')
      || req.user?.email
      || 'User',
    changedAt: new Date(),
  };
  if (!Array.isArray(invoice.transactionTypeOverrides)) {
    invoice.transactionTypeOverrides = [];
  }
  invoice.transactionTypeOverrides.push(entry);
  recordUserActivity(req, {
    action: 'update',
    module: 'invoicing',
    resourceType: 'Invoice',
    resourceId: invoice._id,
    resourceName: invoice.invoiceNumber,
    description: `Changed invoice type ${entry.from} → ${entry.to}: ${entry.reason}`,
    descriptionAr: `تغيير نوع الفاتورة من ${entry.from} إلى ${entry.to}: ${entry.reason}`,
    details: {
      field: 'transactionType',
      from: entry.from,
      to: entry.to,
      reason: entry.reason,
      changedAt: entry.changedAt,
    },
  }).catch(() => {});
  return entry;
}

function requireOverrideReasonIfNeeded(req) {
  if (!req.body?.transactionTypeOverridden) return null;
  const reason = String(req.body.transactionTypeOverrideReason || '').trim();
  if (!reason) {
    const err = new Error('Reason is required when manually changing invoice type (B2B/B2C)');
    err.status = 400;
    err.code = 'TYPE_OVERRIDE_REASON_REQUIRED';
    return err;
  }
  return null;
}

function takeTransactionTypeOverrideMeta(body = {}) {
  if (!body || typeof body !== 'object') return null;
  const reason = String(body.transactionTypeOverrideReason || '').trim();
  const meta = body.transactionTypeOverridden && reason
    ? {
        reason,
        from: body.transactionTypeOverrideFrom === 'B2B' ? 'B2B' : (body.transactionTypeOverrideFrom === 'B2C' ? 'B2C' : null),
        to: body.transactionTypeOverrideTo === 'B2B' ? 'B2B' : (body.transactionTypeOverrideTo === 'B2C' ? 'B2C' : null),
      }
    : null;
  delete body.transactionTypeOverridden;
  delete body.transactionTypeOverrideReason;
  delete body.transactionTypeOverrideFrom;
  delete body.transactionTypeOverrideTo;
  return meta;
}

/**
 * Stamp purchase bill lines with tax master (mandatory tax code) and ZATCA category.
 * Rejects recoverable input VAT without a valid 15-digit supplier VAT (starts/ends with 3).
 */
async function enrichAndValidatePurchaseBillTaxes({
  tenantId,
  lineItems = [],
  seller = {},
  supplier = null,
  requireSupplierVat = true,
  strictTaxCode = true,
}) {
  await ensureDefaultTaxes(tenantId);
  const lines = Array.isArray(lineItems) ? lineItems : [];
  if (!lines.length) {
    const err = new Error('At least one bill line is required');
    err.status = 400;
    err.code = 'BILL_LINES_REQUIRED';
    throw err;
  }

  const enriched = [];
  let claimsRecoverableInputVat = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const taxId = line.taxId || null;
    let taxCode = String(line.taxCode || '').trim().toUpperCase();
    if (!taxId && !taxCode) {
      if (strictTaxCode) {
        const err = new Error(`Line ${i + 1}: tax code is required`);
        err.status = 400;
        err.code = 'TAX_CODE_REQUIRED';
        throw err;
      }
      taxCode = Number(line.taxRate) > 0 ? 'VAT15-IN' : 'VAT0-IN';
    }
    const taxDoc = await resolveTaxByIdOrCode(tenantId, {
      taxId,
      taxCode,
      type: 'purchase',
    });
    if (!taxDoc) {
      const err = new Error(`Line ${i + 1}: unknown purchase tax code ${taxCode || taxId}`);
      err.status = 400;
      err.code = 'TAX_CODE_INVALID';
      throw err;
    }

    const zatcaCategory = ['S', 'Z', 'E', 'O'].includes(String(taxDoc.zatcaCategory || '').toUpperCase())
      ? String(taxDoc.zatcaCategory).toUpperCase()
      : (Number(taxDoc.rate) > 0 ? 'S' : 'Z');
    const vatTreatment = vatTreatmentFromTax(taxDoc);
    const taxRate = Number(taxDoc.rate) || 0;

    if (
      (vatTreatment === 'recoverable' || vatTreatment === 'reverse_charge')
      && taxRate > 0
    ) {
      claimsRecoverableInputVat = true;
    }

    enriched.push({
      ...line,
      taxId: taxDoc._id,
      taxCode: taxDoc.code,
      taxCategory: zatcaCategory,
      taxRate,
      vatTreatment,
    });
  }

  if (requireSupplierVat && claimsRecoverableInputVat) {
    const supplierVat = normalizeSaudiVatDigits(
      seller?.vatNumber || supplier?.vatNumber || '',
    );
    if (!isValidSaudiVat(supplierVat)) {
      const err = new Error(
        'Supplier VAT number is required to claim recoverable input VAT (15 digits, must start and end with 3)',
      );
      err.status = 400;
      err.code = 'SUPPLIER_VAT_REQUIRED';
      throw err;
    }
  }

  return enriched;
}

async function runSellPrePostGate(req, {
  payload,
  excludeInvoiceId = null,
  statusHint = null,
} = {}) {
  const status = String(statusHint || payload?.status || '').toLowerCase();
  if (status === 'draft') return null;
  try {
    return await assertInvoicePrePostReady({
      tenantId: req.user.tenantId,
      payload: {
        ...payload,
        customerId: payload.customerId || req.body?.customerId,
        buyer: payload.buyer || req.body?.buyer,
        lineItems: payload.lineItems || req.body?.lineItems,
        transactionType: payload.transactionType || req.body?.transactionType,
        issueDate: payload.issueDate || req.body?.issueDate,
        grandTotal: payload.grandTotal ?? req.body?.grandTotal,
      },
      excludeInvoiceId,
      allowDuplicate: true,
    });
  } catch (err) {
    if (err.code === 'INVOICE_PRE_POST_FAILED') {
      const e = new Error(err.message);
      e.status = 400;
      e.code = err.code;
      e.checks = err.checks;
      e.blockingFailed = err.blockingFailed;
      throw e;
    }
    throw err;
  }
}

function prepareSellInvoiceTermsAndSeller(invoiceData, {
  customer,
  tenant,
  bodyPaymentTerms,
  bodyDueDate,
  dueDateOverride = false,
  skipSellerCheck = false,
} = {}) {
  applyInvoicePaymentTerms(invoiceData, {
    customer,
    companyDefault: 'net30',
    bodyPaymentTerms,
    bodyDueDate,
    dueDateOverride,
  });

  if (!skipSellerCheck && isZatcaCurrency(tenant) && (invoiceData.flow || 'sell') === 'sell') {
    const tenantVat = normalizeSaudiVatDigits(tenant?.business?.vatNumber);
    const sellerVat = normalizeSaudiVatDigits(invoiceData.seller?.vatNumber);
    const pickVat = isValidSaudiVat(tenantVat) ? tenantVat : (sellerVat || tenantVat);
    if (invoiceData.seller) {
      invoiceData.seller.vatNumber = pickVat || '';
    }
    const sellerCheck = assertSellerAddressReady(
      invoiceData.seller?.address || tenant?.business?.address,
      {
        requireVat: true,
        vatNumber: pickVat,
      },
    );
    if (!sellerCheck.ok) {
      const err = new Error(sellerCheck.error);
      err.status = 400;
      err.code = sellerCheck.code;
      err.missing = sellerCheck.missing;
      throw err;
    }
  }

  return invoiceData;
}

/** B2C / simplified: drop invalid buyer tax IDs so mongoose party validators don't block posting. */
function sanitizeBuyerForTransactionType(buyer = {}, transactionType = 'B2C') {
  const next = { ...(buyer || {}) };
  const txn = String(transactionType || '').toUpperCase() === 'B2B' ? 'B2B' : 'B2C';
  if (txn === 'B2C') {
    const vat = normalizeSaudiVatDigits(next.vatNumber);
    if (!vat || !isValidSaudiVat(vat)) {
      next.vatNumber = '';
    } else {
      next.vatNumber = vat;
    }
  } else {
    const vat = normalizeSaudiVatDigits(next.vatNumber);
    if (vat) next.vatNumber = vat;
  }
  return next;
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const invoiceWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.INVOICE_CREATE_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('invoice-write'),
  keyGenerator: (req) => `invoice-write:${req.user?.tenantId || req.ip || 'unknown'}`,
  message: { error: 'Too many invoices created. Please wait a moment.' },
});

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

function rejectOverpay(req, res) {
  if (isOverpay(req.body?.paidAmount, req.body?.grandTotal)) {
    res.status(400).json({ error: 'paidAmount cannot exceed grandTotal' });
    return true;
  }
  return false;
}

async function applyResolvedPayment(invoice) {
  resolvePaymentStatus(invoice);
  if (invoice.isModified?.('paidAmount') || invoice.isModified?.('paymentStatus')) {
    await invoice.save();
  }
  return invoice;
}

async function postSellInvoiceLedgers(invoice, req, tenant) {
  if (
    invoice.flow === 'purchase' ||
    !['388', '381'].includes(String(invoice.invoiceType || '')) ||
    invoice.invoiceSubtype === 'proforma' ||
    ['draft', 'cancelled'].includes(invoice.status)
  ) {
    return;
  }

  // Accounting journals only — stock never moves from sell/purchase invoices.
  // Sell stock: Delivery Notes. Purchase stock: GRNs.
  try {
    const {
      postSalesInvoiceJournal,
      postInvoicePaymentJournal,
      postCreditNoteJournal,
      postCreditNoteRefundJournal,
    } = await import('../services/accountingService.js');

    const currency = invoice.currency || tenant?.settings?.currency || 'SAR';

    if (String(invoice.invoiceType) === '381') {
      await postCreditNoteJournal({
        tenantId: invoice.tenantId,
        userId: req.user._id,
        creditNote: invoice,
        currency,
      });
      const refundAmt = Number(invoice.paidAmount || 0);
      if (refundAmt > 0) {
        await postCreditNoteRefundJournal({
          tenantId: invoice.tenantId,
          userId: req.user._id,
          creditNote: invoice,
          amount: Math.abs(refundAmt),
          paymentMethod: invoice.paymentMethod || 'cash',
          paymentDate: invoice.issueDate || new Date(),
          reference: `refund-${invoice.invoiceNumber}`,
          currency,
        });
      }
      if (invoice.originalInvoiceId) {
        const originalInvoice = await Invoice.findOne({
          _id: invoice.originalInvoiceId,
          tenantId: invoice.tenantId,
        });
        if (originalInvoice) {
          await accounting.reconcileCreditNoteWithInvoice({
            tenantId: invoice.tenantId,
            userId: req.user._id,
            creditNote: invoice,
            originalInvoice,
          });
        }
      }
      return;
    }

    await postSalesInvoiceJournal({
      tenantId: invoice.tenantId,
      userId: req.user._id,
      invoice,
      currency,
    });
    try {
      const { postSalesInvoiceCogsJournal } = await import('../services/accountingService.js');
      await postSalesInvoiceCogsJournal({
        tenantId: invoice.tenantId,
        userId: req.user._id,
        invoice,
        currency,
      });
    } catch (cogsErr) {
      console.warn('[accounting] invoice COGS journal failed:', cogsErr.message);
    }
    if (Number(invoice.paidAmount || 0) > 0) {
      await postInvoicePaymentJournal({
        tenantId: invoice.tenantId,
        userId: req.user._id,
        invoice,
        amount: invoice.paidAmount,
        paymentMethod: invoice.paymentMethod || 'bank_transfer',
        paymentDate: invoice.issueDate || new Date(),
        reference: `initial-${invoice.invoiceNumber}`,
        currency,
      });
    }
  } catch (glError) {
    console.warn('[accounting] invoice journal failed:', glError.message);
  }
}

async function postPurchaseInvoiceLedgers(invoice, req, tenant) {
  if (invoice.flow !== 'purchase') return;
  if (['draft', 'cancelled'].includes(invoice.status)) return;

  const currency = invoice.currency || tenant?.settings?.currency || 'SAR';

  try {
    const accounting = await import('../services/accountingService.js');

    if (String(invoice.invoiceType) === '381') {
      await accounting.postVendorRefundJournal({
        tenantId: invoice.tenantId,
        userId: req.user._id,
        creditNote: invoice,
        currency,
      });

      if (invoice.originalInvoiceId) {
        const originalBill = await Invoice.findOne({
          _id: invoice.originalInvoiceId,
          tenantId: invoice.tenantId,
        });
        if (originalBill) {
          await accounting.reconcileVendorRefundWithBill({
            tenantId: invoice.tenantId,
            userId: req.user._id,
            refund: invoice,
            originalBill,
          });
        }
      }
      return;
    }

    if (String(invoice.invoiceType) === '388') {
      const { postPurchaseInvoiceJournal } = await import('../services/inventory/stockAccounting.js');
      const entry = await postPurchaseInvoiceJournal({
        tenantId: invoice.tenantId,
        userId: req.user._id,
        invoice,
        currency,
      });
      if (!entry) {
        console.warn('[accounting] purchase invoice journal returned null for', invoice.invoiceNumber);
      }
    }
  } catch (glError) {
    console.error('[accounting] purchase invoice journal failed:', glError.message);
    throw glError;
  }
}

/** After invoice create: post accounting journals only (no stock). */
async function postSellLedgersOrConflict(res, invoice, req, tenant) {
  try {
    await postSellInvoiceLedgers(invoice, req, tenant);
    if ((invoice.businessContext || getPrimaryBusinessType(tenant)) === 'trading') {
      try {
        await postInventoryForInvoice(invoice, req.tenantFilter);
      } catch (skipErr) {
        console.warn('[invoice] stock skip mark failed:', skipErr?.message || skipErr);
      }
    }
    return null;
  } catch (err) {
    const status = err instanceof InventoryError ? (err.status || 409) : 409;
    res.status(status).json({
      error: err.message || 'Ledger post failed',
      code: err.code || 'LEDGER_POST_FAILED',
      invoice: typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice,
    });
    return err;
  }
}

function cleanObjectId(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return undefined;
  if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val)) return val;
  if (val instanceof mongoose.Types.ObjectId) return val;
  return undefined;
}

function buildReversedBillLines(lineItems = [], refundLines = null) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const refundMap = new Map();
  if (Array.isArray(refundLines) && refundLines.length) {
    for (const row of refundLines) {
      const qty = Math.abs(Number(row.quantity || 0));
      if (qty <= 0) continue;
      if (row.lineNumber != null) refundMap.set(`n:${row.lineNumber}`, qty);
      if (row.productId) refundMap.set(`p:${String(row.productId)}`, qty);
    }
  }

  const reversed = items.map((line, index) => {
    const lineNumber = line.lineNumber || index + 1;
    let refundQty = null;
    if (refundMap.size) {
      refundQty = refundMap.get(`n:${lineNumber}`) ?? refundMap.get(`p:${String(line.productId || '')}`);
      if (!refundQty) return null;
    }
    const origQty = Math.abs(Number(line.quantity || 0));
    const qty = refundQty != null ? -Math.min(refundQty, origQty) : -origQty;
    if (!qty) return null;
    const unitPrice = Number(line.unitPrice || 0);
    const taxRate = Number(line.taxRate || 0);
    const lineExtensionAmount = Number((qty * unitPrice).toFixed(2));
    const taxAmount = Number((lineExtensionAmount * (taxRate / 100)).toFixed(2));
    return {
      ...line,
      _id: undefined,
      lineNumber,
      quantity: qty,
      lineExtensionAmount,
      taxAmount,
      lineTotal: lineExtensionAmount,
      lineTotalWithTax: Number((lineExtensionAmount + taxAmount).toFixed(2)),
      allowanceAmount: line.allowanceAmount ? -Math.abs(Number(line.allowanceAmount)) : 0,
    };
  }).filter(Boolean);

  return reversed;
}

function sanitizeInvoicePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const cleaned = { ...payload };
  const objectIdKeys = [
    'warehouseId',
    'supplierId',
    'customerId',
    'sourcePurchaseOrderId',
    'sourceDeliveryNoteId',
    'originalInvoiceId',
    'proformaSourceId',
    'sourceQuotationId',
    'restaurantOrderId',
    'travelBookingId',
    'rentalId',
    'manpowerAssignmentId',
    'salespersonId',
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

  if (Array.isArray(cleaned.deliveryNoteIds)) {
    cleaned.deliveryNoteIds = cleaned.deliveryNoteIds.map(cleanObjectId).filter(Boolean);
  }
  if (Array.isArray(cleaned.sourceGrnIds)) {
    cleaned.sourceGrnIds = cleaned.sourceGrnIds.map(cleanObjectId).filter(Boolean);
  }
  if (Array.isArray(cleaned.documentReferences)) {
    cleaned.documentReferences = cleaned.documentReferences
      .map((ref) => {
        if (!ref || typeof ref !== 'object') return null;
        const docId = cleanObjectId(ref.docId);
        const kind = ['sales_order', 'purchase_order', 'delivery_note', 'grn', 'other'].includes(ref.kind)
          ? ref.kind
          : 'other';
        if (!docId && !String(ref.number || '').trim()) return null;
        return {
          kind,
          docId: docId || undefined,
          number: String(ref.number || '').trim(),
          label: String(ref.label || '').trim(),
        };
      })
      .filter(Boolean);
  }
  if (Array.isArray(cleaned.accountingLines)) {
    cleaned.accountingLines = cleaned.accountingLines
      .map((line) => {
        if (!line || typeof line !== 'object') return null;
        const accountId = cleanObjectId(line.accountId);
        const debit = Math.max(0, Number(line.debit) || 0);
        const credit = Math.max(0, Number(line.credit) || 0);
        if (!accountId || (debit <= 0 && credit <= 0)) return null;
        return {
          accountId,
          accountCode: String(line.accountCode || '').trim(),
          accountName: String(line.accountName || '').trim(),
          debit,
          credit,
          description: String(line.description || '').trim(),
          role: String(line.role || '').trim(),
        };
      })
      .filter(Boolean);
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
      const variantId = cleanObjectId(cleanItem.variantId);
      if (variantId) {
        cleanItem.variantId = variantId;
      } else {
        delete cleanItem.variantId;
      }
      const expenseAccountId = cleanObjectId(cleanItem.expenseAccountId);
      if (expenseAccountId) {
        cleanItem.expenseAccountId = expenseAccountId;
      } else {
        delete cleanItem.expenseAccountId;
      }
      const analyticAccountId = cleanObjectId(cleanItem.analyticAccountId);
      if (analyticAccountId) {
        cleanItem.analyticAccountId = analyticAccountId;
      } else {
        delete cleanItem.analyticAccountId;
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

async function ensureCustomerRecord(tenantId, buyer = {}, existingCustomer = null, createdBy = null) {
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
    if (!customer.createdBy && createdBy) customer.createdBy = createdBy;
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
    ...(createdBy ? { createdBy } : {}),
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

/** Draft placeholders (DR-*) must not consume official INV/BILL/VR sequences. */
function isPlaceholderSellInvoiceNumber(invoiceNumber) {
  const n = String(invoiceNumber || '').trim();
  if (!n) return true;
  if (/^DR[-_]/i.test(n)) return true;
  if (/^DRAFT/i.test(n)) return true;
  return false;
}

async function allocateSellSeriesNumber(tenantId, { prefix }) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lastInvoice = await Invoice.findOne({
    tenantId,
    invoiceNumber: new RegExp(`^${escaped}`),
  })
    .sort({ createdAt: -1 })
    .select('invoiceNumber')
    .lean();

  let nextNum = 1;
  let pad = 6;
  if (lastInvoice?.invoiceNumber) {
    const lastPart = String(lastInvoice.invoiceNumber).split('-').pop();
    const parsed = parseInt(lastPart, 10);
    if (!Number.isNaN(parsed)) {
      nextNum = parsed + 1;
      pad = Math.max(6, String(lastPart).length);
    }
  }
  return `${prefix}${String(nextNum).padStart(pad, '0')}`;
}

async function allocateSellDraftNumber(tenantId) {
  const year = new Date().getFullYear();
  return allocateSellSeriesNumber(tenantId, { prefix: `DR-${year}-` });
}

async function allocateSellInvoiceNumber(tenantId) {
  const year = new Date().getFullYear();
  return allocateSellSeriesNumber(tenantId, { prefix: `INV-${year}-` });
}

async function allocatePurchaseDraftNumber(tenantId, invoiceType = '388') {
  const year = new Date().getFullYear();
  const prefix = String(invoiceType) === '381' ? `DR-VR-${year}-` : `DR-BILL-${year}-`;
  return allocateSellSeriesNumber(tenantId, { prefix });
}

async function allocatePurchaseInvoiceNumber(tenantId, invoiceType = '388') {
  const year = new Date().getFullYear();
  const prefix = String(invoiceType) === '381' ? `VR-${year}-` : `BILL-${year}-`;
  return allocateSellSeriesNumber(tenantId, { prefix });
}

async function attachDraftQr(invoice, seller, tenant) {
  // ZATCA only applies to SAR-denominated invoices. Skip the Saudi TLV QR
  // entirely for tenants configured with a different default currency.
  if (isZatcaCurrency(tenant)) {
    const qr = await buildDraftInvoiceQr({
      seller,
      issueDate: invoice.issueDate,
      issueTime: invoice.issueTime,
      grandTotal: invoice.grandTotal,
      totalTax: invoice.totalTax,
    });

    invoice.zatca = {
      ...(invoice.zatca || {}),
    };
    if (qr.qrCodeData && qr.qrCodeImage) {
      invoice.zatca.qrCodeData = qr.qrCodeData;
      invoice.zatca.qrCodeImage = qr.qrCodeImage;
      invoice.zatca.submissionStatus = qr.submissionStatus || invoice.zatca.submissionStatus || 'pending';
      if (invoice.zatca.qrBlockedReason) delete invoice.zatca.qrBlockedReason;
    } else {
      // Do not keep a previous/invalid QR that ZATCA would reject on scan.
      invoice.zatca.qrCodeData = undefined;
      invoice.zatca.qrCodeImage = undefined;
      if (qr.qrBlockedReason) invoice.zatca.qrBlockedReason = qr.qrBlockedReason;
    }

    await invoice.save();
    return invoice;
  }

  if (isFbrCurrency(tenant)) {
    await applyFbrToInvoice(invoice, tenant, seller);
    await invoice.save();
    return invoice;
  }

  // Regional GCC and South Asia country compliance (UAE FTA, Oman OTA, Bahrain NBR, Kuwait MOF, Qatar GTA, BD NBR)
  await applyCountryComplianceToInvoice(invoice, tenant, seller);
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
  const hasEmailAddon = tenantHasEmailAddon(tenant);
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
  const app = tenant?.settings?.installedApps?.whatsapp_cloud_auto;
  const appOn = Boolean(app?.isInstalled && app?.isEnabled !== false);
  const config = await getWhatsAppConfig(tenant?._id);
  const cloudReady = Boolean(config?.isActive && config?.accessToken && config?.phoneNumberId);
  const autoFromCloud = cloudReady && config?.autoSendInvoices !== false && (appOn ? app?.config?.autoSendInvoices !== false : true);
  const autoFromLegacy = Boolean(tenant?.settings?.invoiceWhatsappAutoSend);

  if (!autoFromCloud && !autoFromLegacy) {
    return { sent: false, reason: 'disabled' };
  }

  const phone = customer?.phone || customer?.mobile || invoice?.buyer?.phone;
  if (!phone) return { sent: false, reason: 'no_customer_phone' };

  if (cloudReady) {
    try {
      return await sendInvoiceOnWhatsApp({ tenant, invoice, customer, language });
    } catch (error) {
      if (!autoFromLegacy) return { sent: false, reason: error.message };
    }
  }

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

    return await sendRestaurantWhatsApp({
      tenantId: tenant._id,
      phone,
      messageEn,
      messageAr,
      replacements
    });
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

async function postInventoryForInvoice(invoice, tenantFilterValue) {
  // Product rule: commercial invoices never add/deduct warehouse quantity.
  // Sell stock moves only via Delivery Notes; purchase stock only via GRNs.
  const warehouseId = invoice.warehouseId || invoice?.inventory?.warehouseId || undefined;
  const skipReason = invoice.flow === 'purchase'
    ? 'invoice_no_stock_use_grn'
    : 'invoice_no_stock_use_delivery_note';

  if (!invoice.inventory?.skippedAt && !invoice.inventory?.postedAt) {
    invoice.inventory = {
      ...(invoice.inventory?.toObject?.() || invoice.inventory || {}),
      ...(warehouseId ? { warehouseId } : {}),
      skippedAt: new Date(),
      skipReason,
    };
    await invoice.save();
  }

  // Best-effort: mark PO billed when a purchase invoice is linked
  if (invoice.flow === 'purchase' && invoice.sourcePurchaseOrderId) {
    try {
      const PurchaseOrder = mongoose.model('PurchaseOrder');
      const po = await PurchaseOrder.findOne({ _id: invoice.sourcePurchaseOrderId, ...tenantFilterValue });
      if (po && ['received', 'partially_received', 'approved'].includes(String(po.status || ''))) {
        po.status = 'billed';
        po.billedInvoiceId = invoice._id;
        await po.save();
      }
    } catch {
      /* billing status is best-effort */
    }
  }

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

    const lineType = normalizeProductType(line.productType || product.productType);
    if (!isStockTrackedProductType(lineType)) continue;

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

    const stats = await statsRead(Invoice.aggregate([
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
    ]));

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
  const catalogIds = [];
  const {
    nextReadableSku,
    assignDefaultProductAccounts,
    isAutoGeneratedTimestampSku,
  } = await import('../services/inventory/productAccounting.js');
  
  for (let i = 0; i < lineItems.length; i++) {
    const line = lineItems[i];
    let productId = line.productId;
    const productType = normalizeProductType(line.productType);
    
    if (!productId && line.productName) {
      let sku = String(line.sku || '').trim();
      if (!sku || isAutoGeneratedTimestampSku(sku)) {
        sku = await nextReadableSku(tenantId, { categoryId: line.categoryId || null });
      }
      const unitPrice = toNumber(line.unitPrice, 0);
      const taxCategory = ['S', 'Z', 'E', 'O'].includes(String(line.taxCategory || '').toUpperCase())
        ? String(line.taxCategory).toUpperCase()
        : 'S';
      const saleTaxRate = taxCategory === 'S' ? toNumber(line.taxRate, 15) : 0;
      
      const productData = {
        tenantId,
        sku,
        nameEn: line.productName,
        nameAr: line.productNameAr || line.productName,
        productType,
        sellingPrice: flow === 'sell' ? unitPrice : unitPrice * 1.2,
        costPrice: flow === 'purchase' ? unitPrice : toNumber(line.costPrice, 0),
        taxRate: saleTaxRate,
        saleTaxRate,
        taxCategory,
        unitOfMeasure: line.unitCode || 'PCE',
        createdBy: userId,
        isActive: true,
        status: 'active',
        canBeSold: flow !== 'purchase',
        canBePurchased: flow === 'purchase',
        incomeAccountId: line.incomeAccountId || undefined,
        expenseAccountId: line.expenseAccountId || line.cogsAccountId || undefined,
      };
      await assignDefaultProductAccounts(tenantId, productData);
      const newProduct = new Product(productData);
      await newProduct.save();
      productId = newProduct._id.toString();
    }

    if (productId) catalogIds.push(String(productId));
    
    processedLines.push({
      ...line,
      productId: productId || undefined,
      productType,
      lineNumber: line.lineNumber || i + 1,
      taxCategory: line.taxCategory || 'S'
    });
  }

  const uniqueIds = [...new Set(catalogIds)];
  const catalog = uniqueIds.length
    ? await Product.find({ _id: { $in: uniqueIds }, tenantId }).select('_id productType').lean()
    : [];
  const productById = new Map(catalog.map((p) => [String(p._id), p]));
  return stampLineProductTypes(processedLines, productById);
}

// @route   GET /api/invoices
router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus, transactionType, businessContext, search, startDate, endDate, dateFrom, dateTo, zatcaFilter, flow, invoiceType, cursor, supplierId, customerId, productId, sortBy, sortDir, createdBy } = req.query;
    
    const query = { ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(query, req.user._id);
    } else if (createdBy && isElevatedRole(req.user)) {
      const createdByFilter = cleanObjectId(createdBy);
      if (createdByFilter) query.createdBy = createdByFilter;
    } else if (createdBy && !shouldScopeInvoicesToSelf(req.user)) {
      // Users with invoiceVisibility=all may still filter by creator
      const createdByFilter = cleanObjectId(createdBy);
      if (createdByFilter) query.createdBy = createdByFilter;
    }
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (flow) query.flow = flow;
    if (invoiceType) query.invoiceType = String(invoiceType);
    if (transactionType) query.transactionType = transactionType;
    if (businessContext) query.businessContext = businessContext;
    const supplierFilter = cleanObjectId(supplierId);
    if (supplierFilter) query.supplierId = supplierFilter;
    const customerFilter = cleanObjectId(customerId);
    if (customerFilter) query.customerId = customerFilter;
    const productFilter = cleanObjectId(productId);
    if (productFilter) query['lineItems.productId'] = productFilter;
    const fromDate = startDate || dateFrom;
    const toDate = endDate || dateTo;
    if (fromDate || toDate) {
      query.issueDate = {};
      if (fromDate) query.issueDate.$gte = new Date(fromDate);
      if (toDate) query.issueDate.$lte = new Date(toDate);
    }
    const searchTerm = String(search || '').trim();
    if (searchTerm) {
      await applyInvoiceListSearch(query, searchTerm, req.tenantFilter?.tenantId || req.user?.tenantId);
    }
    if (zatcaFilter === 'signed') {
      query['zatca.signedXml'] = { $exists: true, $nin: [null, ''] };
    } else if (zatcaFilter === 'unsigned') {
      query.$and = (query.$and || []).concat([{
        $or: [{ 'zatca.signedXml': { $exists: false } }, { 'zatca.signedXml': null }, { 'zatca.signedXml': '' }]
      }]);
    } else if (zatcaFilter === 'submitted') {
      query['zatca.submittedAt'] = { $exists: true, $ne: null };
    } else if (zatcaFilter === 'cleared') {
      query['zatca.submissionStatus'] = 'cleared';
    } else if (zatcaFilter === 'reported') {
      query['zatca.submissionStatus'] = 'reported';
    } else if (zatcaFilter === 'failed' || zatcaFilter === 'rejected') {
      query['zatca.submissionStatus'] = 'rejected';
    } else if (zatcaFilter === 'not_submitted') {
      query.$and = (query.$and || []).concat([{
        $or: [
          { 'zatca.submissionStatus': { $exists: false } },
          { 'zatca.submissionStatus': null },
          { 'zatca.submissionStatus': 'pending' },
          { 'zatca.submissionStatus': '' },
        ],
      }]);
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    let cursorDate = null;
    let cursorId = null;
    if (cursor) {
      try {
        const decoded = Buffer.from(String(cursor), 'base64url').toString('utf8');
        const [iso, id] = decoded.split('|');
        cursorDate = new Date(iso);
        if (id && mongoose.Types.ObjectId.isValid(id) && !Number.isNaN(cursorDate.getTime())) {
          cursorId = id;
          query.$and = (query.$and || []).concat([{
            $or: [
              { issueDate: { $lt: cursorDate } },
              { issueDate: cursorDate, _id: { $lt: id } },
            ],
          }]);
        }
      } catch {
        cursorDate = null;
      }
    }

    const sortFieldMap = {
      issueDate: 'issueDate',
      dueDate: 'dueDate',
      invoiceNumber: 'invoiceNumber',
      grandTotal: 'grandTotal',
      status: 'status',
      paymentStatus: 'paymentStatus',
      createdAt: 'createdAt',
    };
    const sortField = sortFieldMap[String(sortBy || '')] || 'issueDate';
    const sortDirection = String(sortDir || '').toLowerCase() === 'asc' ? 1 : -1;
    const sortSpec = cursorId
      ? { issueDate: -1, _id: -1 }
      : { [sortField]: sortDirection, _id: -1 };
   
   const findQuery = Invoice.find(query)
        .select([
          'invoiceNumber', 'status', 'paymentStatus', 'paymentMethod', 'paidAmount',
          'issueDate', 'dueDate', 'createdAt', 'updatedAt',
          'subtotal', 'taxableAmount', 'totalTax', 'grandTotal', 'totalDiscount', 'invoiceDiscount',
          'flow', 'transactionType', 'invoiceType', 'invoiceTypeCode', 'invoiceSubtype',
          'businessContext', 'currency',
          'buyer.name', 'buyer.nameAr', 'buyer.vatNumber', 'buyer.crNumber',
          'seller.name', 'seller.nameAr',
          'customerId', 'supplierId',
          'contractNumber', 'vendorInvoiceNumber', 'vendorInvoiceDate',
          'zatca.submissionStatus', 'zatca.reportingStatus', 'zatca.clearedAt', 'zatca.reportedAt',
          'createdByName', 'createdByNameAr', 'createdBy',
          'sourcePurchaseOrderId', 'pdfTemplateId', 'printFormat',
          // Minimal line fields for travel VAT list display only (avoid shipping full line payloads)
          'lineItems.isTravelMargin', 'lineItems.lineTotalWithTax', 'lineItems.customerPrice',
          'lineItems.quantity', 'lineItems.taxCategory', 'lineItems.taxRate',
          'lineItems.marginTaxable', 'lineItems.taxAmount',
        ].join(' '))
        .sort(sortSpec)
        .limit(pageSize)
        .lean()
        .maxTimeMS(12_000);
    if (!cursorId) {
      findQuery.skip((pageNumber - 1) * pageSize);
    }

   const [invoices, total] = await Promise.all([
      findQuery,
      cursorId ? Promise.resolve(null) : Invoice.countDocuments(query)
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
                const rate = toNumber(line?.taxRate, 15);
                return sum + (toNumber(line?.marginTaxable) * (rate / 100));
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
    
    const last = invoices?.length ? invoices[invoices.length - 1] : null;
    const nextCursor = last && invoices.length === pageSize && last.issueDate
      ? Buffer.from(`${new Date(last.issueDate).toISOString()}|${last._id}`).toString('base64url')
      : null;

    res.json({
      invoices: normalizedInvoices,
      nextCursor,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: total == null ? undefined : total,
        pages: total == null ? undefined : Math.ceil(total / pageSize),
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/stats
router.get('/stats', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const match = { ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(match, req.user._id);
    } else if (req.query.createdBy) {
      const createdByFilter = cleanObjectId(req.query.createdBy);
      if (createdByFilter) match.createdBy = createdByFilter;
    }
    if (req.query.from || req.query.to) {
      match.issueDate = {};
      if (req.query.from) match.issueDate.$gte = new Date(req.query.from);
      if (req.query.to) match.issueDate.$lte = new Date(req.query.to);
    }

    const tenantKey = String(req.tenantFilter?.tenantId || 'none');
    const fromKey = req.query.from || 'all';
    const toKey = req.query.to || 'all';
    const scopeKey = shouldScopeInvoicesToSelf(req.user)
      ? `user:${req.user._id}`
      : (req.query.createdBy ? `by:${req.query.createdBy}` : 'all');
    const cacheKey = `invoices:stats:${tenantKey}:${fromKey}:${toKey}:${scopeKey}`;

    const stats = await cacheAside(cacheKey, 60, async () => {
      const rows = await Invoice.statsAggregate([
        { $match: match },
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }],
            byPaymentStatus: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }],
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
      return rows[0];
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pdf', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const scopeQuery = { _id: req.params.id, ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(scopeQuery, req.user._id);
    }
    const invoice = await Invoice.findOne(scopeQuery);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tenant = await Tenant.findById(invoice.tenantId || req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr')
      : null;

    const sendPdf = (attachment) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${String(attachment.filename || 'invoice.pdf').replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(attachment.content);
    };

    const cached = await getCachedInvoicePdfAttachment(invoice);
    if (cached) return sendPdf(cached);

    const wantAsync = String(req.query.async || '') === '1';
    const wantSync = String(req.query.sync || '') === '1';
    if (wantAsync && !wantSync) {
      enqueueInvoicePdf(invoice._id);
      res.setHeader('Retry-After', '1');
      return res.status(202).json({
        status: 'queued',
        invoiceId: String(invoice._id),
        retryAfter: 1,
      });
    }

    const attachment = await getOrBuildInvoicePdfAttachment({
      invoice,
      tenant,
      customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr,
      language: 'bilingual',
    });

    return sendPdf(attachment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/attachments — supplier invoice PDF/photo (vendor bills)
router.post('/:id/attachments', checkPermission('invoicing', 'update'), upload.single('file'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'File is required' });

    const { saveUploadBuffer } = await import('../utils/objectStorage.js');
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `vendor-bill-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext || 'bin'}`;
    const key = `invoices/${req.user.tenantId}/${invoice._id}/${filename}`;
    const { url } = await saveUploadBuffer({
      buffer: req.file.buffer,
      key,
      contentType: req.file.mimetype,
      publicUrlPath: `/uploads/${key}`,
    });

    const attachment = {
      name: req.file.originalname || filename,
      url,
      type: req.file.mimetype || 'application/octet-stream',
    };
    invoice.attachments = [...(invoice.attachments || []), attachment];
    await invoice.save();
    res.json({ attachment, attachments: invoice.attachments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/payments
router.post('/:id/payments', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!canRecordPayment(invoice)) {
      return res.status(400).json({
        error: invoice.flow === 'purchase'
          ? 'Cannot record payment on this vendor bill'
          : 'Cannot record payment on this invoice',
      });
    }

    const amount = Math.round((Number(req.body?.amount) || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    }

    const differenceMode = req.body?.differenceMode === 'mark_paid' ? 'mark_paid' : 'keep_open';
    const differenceAccountId = cleanObjectId(req.body?.differenceAccountId);
    const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const remaining = Math.round(((Number(invoice.grandTotal) || 0) - (Number(invoice.paidAmount) || 0)) * 100) / 100;
    const method = ['cash', 'card', 'bank_transfer', 'cheque', 'other', 'khata'].includes(req.body?.method)
      ? req.body.method
      : 'bank_transfer';

    // Sell invoices: overpay blocked unless mark_paid write-off.
    // Purchase bills: overpay allowed → Advance to supplier via createVendorPayment.
    if (invoice.flow !== 'purchase' && amount > remaining + 0.005 && differenceMode !== 'mark_paid') {
      return res.status(400).json({ error: 'Amount exceeds remaining balance' });
    }
    if (differenceMode === 'mark_paid' && remaining - amount > 0.005 && !differenceAccountId) {
      return res.status(400).json({ error: 'Difference account is required to mark as fully paid' });
    }

    // Purchase bills: unified AccountPayment (outbound) path
    if (invoice.flow === 'purchase') {
      const confirmNegativeCash = req.body?.confirmNegativeCash === true
        || req.body?.confirmNegative === true;
      const previousPaymentStatus = invoice.paymentStatus;
      const allocAmt = Math.min(amount, Math.max(0, remaining));
      const { createVendorPayment } = await import('../services/vendorPaymentService.js');
      try {
        await createVendorPayment({
          tenantId: invoice.tenantId,
          userId: req.user._id,
          vendorId: invoice.supplierId || null,
          vendorName: invoice.seller?.name || '',
          date: paymentDate,
          amount,
          method,
          reference: req.body?.reference || `pay-${invoice.invoiceNumber}`,
          memo: req.body?.memo || '',
          currency: invoice.currency || req.tenant?.settings?.currency || 'SAR',
          allocations: allocAmt > 0.005
            ? [{ billId: invoice._id, amount: allocAmt }]
            : [],
          source: 'invoice',
          confirmNegativeCash,
        });
      } catch (payErr) {
        const status = payErr.status || payErr.statusCode || 400;
        return res.status(status).json({
          error: payErr.message,
          code: payErr.code,
          details: payErr.details,
        });
      }
      const refreshed = await Invoice.findOne({ _id: invoice._id, ...req.tenantFilter });
      afterInvoiceWrite(refreshed || invoice, { userId: req.user._id, previousPaymentStatus });
      return res.json(refreshed || invoice);
    }

    const { createCustomerPayment } = await import('../services/customerPaymentService.js');
    const previousPaymentStatus = invoice.paymentStatus;
    await createCustomerPayment({
      tenantId: invoice.tenantId,
      userId: req.user._id,
      customerId: invoice.customerId || null,
      customerName: invoice.buyer?.name || '',
      date: paymentDate,
      amount,
      method,
      reference: req.body?.reference || '',
      memo: req.body?.memo || '',
      currency: invoice.currency || req.tenant?.settings?.currency || 'SAR',
      allocations: [{ invoiceId: invoice._id, amount }],
      source: 'invoice',
      differenceMode,
      differenceAccountId,
    });

    const refreshed = await Invoice.findOne({ _id: invoice._id, ...req.tenantFilter });
    if (refreshed?.customerId) {
      await syncCustomerStats(refreshed.tenantId, refreshed.customerId);
    }
    afterInvoiceWrite(refreshed || invoice, { userId: req.user._id, previousPaymentStatus });
    res.json(refreshed || invoice);
  } catch (error) {
    const status = error?.status || 400;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// @route   GET /api/invoices/:id
// @route   GET /api/invoices/:id/adjacent
// Returns { prev: { _id, invoiceNumber }, next: { _id, invoiceNumber } } for nav arrows
router.get('/:id/adjacent', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const scopeQuery = { _id: req.params.id, ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(scopeQuery, req.user._id);
    }
    const invoice = await Invoice.findOne(scopeQuery).select('issueDate flow').lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const base = { ...req.tenantFilter, flow: invoice.flow };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(base, req.user._id);
    }
    const [prevDoc, nextDoc] = await Promise.all([
      Invoice.findOne({ ...base, issueDate: { $lt: invoice.issueDate } })
        .sort({ issueDate: -1, _id: -1 })
        .select('_id invoiceNumber')
        .lean(),
      Invoice.findOne({ ...base, issueDate: { $gt: invoice.issueDate } })
        .sort({ issueDate: 1, _id: 1 })
        .select('_id invoiceNumber')
        .lean(),
    ]);

    res.json({
      prev: prevDoc ? { _id: prevDoc._id, invoiceNumber: prevDoc.invoiceNumber } : null,
      next: nextDoc ? { _id: nextDoc._id, invoiceNumber: nextDoc.invoiceNumber } : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const scopeQuery = { _id: req.params.id, ...req.tenantFilter };
    if (shouldScopeInvoicesToSelf(req.user)) {
      applyCreatedByScope(scopeQuery, req.user._id);
    }
    const invoice = await Invoice.findOne(scopeQuery)
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

router.post('/', invoiceWriteLimiter, checkTrialLimits('invoices'), checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const overrideReasonErr = requireOverrideReasonIfNeeded(req);
    if (overrideReasonErr) {
      return res.status(400).json({ error: overrideReasonErr.message, code: overrideReasonErr.code });
    }
    const typeOverrideMeta = takeTransactionTypeOverrideMeta(req.body);
    if (rejectOverpay(req, res)) return;
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

    // B2B identity gate — only when the invoice is explicitly B2B (never force on B2C)
    if (req.body.transactionType === 'B2B' && (req.body.flow || 'sell') === 'sell') {
      const { assertB2bInvoiceReady } = await import('../services/sales/creditLimit.js');
      const b2b = assertB2bInvoiceReady({
        ...buyer,
        isCompany: true,
        entityType: 'business',
        name: buyer.name || buyer.nameEn || customer?.name || customer?.nameEn,
        address: buyer.address || customer?.address,
        vatNumber: buyer.vatNumber || customer?.vatNumber,
        crNumber: buyer.crNumber || customer?.crNumber,
      });
      if (!b2b.ok) {
        return res.status(400).json({ error: b2b.error, code: b2b.code, missing: b2b.missing });
      }
    }

    const resolvedStatus = resolveInitialSellInvoiceStatus(req.body?.status, tenant);
    try {
      await runSellPrePostGate(req, {
        payload: {
          ...req.body,
          buyer,
          customerId: cleanObjectId(customer?._id || req.body.customerId),
          status: resolvedStatus,
        },
        statusHint: resolvedStatus,
      });
    } catch (gateErr) {
      if (gateErr.status === 400) {
        return res.status(400).json({
          error: gateErr.message,
          code: gateErr.code,
          checks: gateErr.checks,
          blockingFailed: gateErr.blockingFailed,
        });
      }
      throw gateErr;
    }

    // Ensure invoice lines from a sell SO carry sourcePoItemId (sale_line_ids)
    {
      const poId = cleanObjectId(req.body.sourcePurchaseOrderId || req.body.purchaseOrderId);
      if (poId && Array.isArray(req.body.lineItems) && (req.body.flow || 'sell') === 'sell') {
        const PurchaseOrder = (await import('../models/PurchaseOrder.js')).default;
        const po = await PurchaseOrder.findOne({ _id: poId, ...req.tenantFilter }).select('lineItems flow');
        if (po?.flow === 'sell') {
          const used = new Set();
          req.body.lineItems = req.body.lineItems.map((li) => {
            if (cleanObjectId(li.sourcePoItemId)) return li;
            const match = (po.lineItems || []).find((pli) => {
              const id = String(pli._id);
              if (used.has(id)) return false;
              if (li.productId && pli.productId && String(li.productId) === String(pli.productId)) {
                return true;
              }
              const name = String(li.productName || li.manualName || '').trim().toLowerCase();
              const poName = String(pli.manualName || pli.description || '').trim().toLowerCase();
              return name && poName && name === poName;
            });
            if (match?._id) {
              used.add(String(match._id));
              return { ...li, sourcePoItemId: match._id };
            }
            return li;
          });
          const missing = req.body.lineItems.filter(
            (li) => Number(li.quantity) > 0 && !cleanObjectId(li.sourcePoItemId),
          );
          if (missing.length) {
            return res.status(400).json({
              error: 'Invoice lines must reference sales order line ids (sourcePoItemId)',
              code: 'SOURCE_PO_ITEM_REQUIRED',
            });
          }
        }
      }
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
    
    const poIdForPolicy = cleanObjectId(req.body.sourcePurchaseOrderId || req.body.purchaseOrderId);
    if (poIdForPolicy && Array.isArray(req.body.lineItems)) {
      try {
        const policyResult = await applyDeliveredInvoicingPolicy({
          tenantId: req.user.tenantId,
          purchaseOrderId: poIdForPolicy,
          lineItems: req.body.lineItems,
        });
        req.body.lineItems = policyResult.lineItems;
      } catch (policyErr) {
        if (policyErr.code === 'INVOICING_POLICY_DELIVERED') {
          return res.status(400).json({ error: policyErr.message, code: policyErr.code });
        }
        throw policyErr;
      }
    }

    resolvePaymentStatus(req.body);

    const sanitizedBuyer = sanitizeBuyerForTransactionType(buyer, transactionType);
    const sellerVatNorm = normalizeSaudiVatDigits(tenant.business?.vatNumber) || tenant.business?.vatNumber || '';

    const invoiceData = {
      ...req.body,
      tenantId: req.user.tenantId,
      invoiceNumber,
      transactionType,
      invoiceTypeCode,
      issueDate,
      buyer: sanitizedBuyer,
      customerId: cleanObjectId(customer?._id || req.body.customerId),
      status: resolvedStatus,
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: sellerVatNorm,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address
      },
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user)
    };
    syncZatcaInvoiceType(invoiceData, transactionType);

    if (!cleanObjectId(invoiceData.warehouseId)) {
      delete invoiceData.warehouseId;
    }

    try {
      prepareSellInvoiceTermsAndSeller(invoiceData, {
        customer,
        tenant,
        bodyPaymentTerms: req.body.paymentTerms,
        bodyDueDate: req.body.dueDate,
        dueDateOverride: Boolean(req.body.dueDateOverride),
      });
    } catch (prepErr) {
      if (prepErr.status === 400) {
        return res.status(400).json({ error: prepErr.message, code: prepErr.code, missing: prepErr.missing });
      }
      throw prepErr;
    }

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const invoice = await Invoice.create(enrichedInvoiceData);
    await applyResolvedPayment(invoice);

    if (invoice.customerId) {
      await syncCustomerStats(invoice.tenantId, invoice.customerId);
    }

    if (await postSellLedgersOrConflict(res, invoice, req, tenant)) return;
    afterInvoiceWrite(invoice, { userId: req.user._id, created: true, previousPaymentStatus: 'pending' });

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
router.post('/sell', invoiceWriteLimiter, checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    if (rejectOverpay(req, res)) return;
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
      // warehouseId is optional on sell invoices — stock moves via delivery notes only
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
      customer = await ensureCustomerRecord(req.user.tenantId, buyer, null, req.user._id);
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

    const createAsDraft = normalizeText(req.body?.status).toLowerCase() === 'draft'
      && !Boolean(req.body?.confirmPost);
    const invoiceNumber = createAsDraft
      ? await allocateSellDraftNumber(req.user.tenantId)
      : await allocateSellInvoiceNumber(req.user.tenantId);

    const transactionType = req.body.transactionType === 'B2B' ? 'B2B' : 'B2C';
    const overrideGate = requireOverrideReasonIfNeeded(req);
    if (overrideGate) {
      return res.status(overrideGate.status).json({ error: overrideGate.message, code: overrideGate.code });
    }
    const invoiceSubtype = businessContext === 'travel_agency'
      ? (req.body.invoiceSubtype === 'proforma' ? 'proforma' : 'travel_ticket')
      : (req.body.invoiceSubtype === 'travel_ticket' ? 'travel_ticket' : (req.body.invoiceSubtype === 'proforma' ? 'proforma' : 'standard'));
    const invoiceTypeCode = req.body.invoiceTypeCode || (transactionType === 'B2C' ? '0200000' : '0100000');
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);

    const lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, 'sell');
    const invoiceDiscount = Math.max(0, toNumber(req.body?.invoiceDiscount, 0));

    const poIdForPolicy = cleanObjectId(req.body.sourcePurchaseOrderId || req.body.purchaseOrderId);
    let policyLineItems = lineItems;
    if (poIdForPolicy) {
      try {
        const policyResult = await applyDeliveredInvoicingPolicy({
          tenantId: req.user.tenantId,
          purchaseOrderId: poIdForPolicy,
          lineItems,
        });
        policyLineItems = policyResult.lineItems;
      } catch (policyErr) {
        if (policyErr.code === 'INVOICING_POLICY_DELIVERED') {
          return res.status(400).json({ error: policyErr.message, code: policyErr.code });
        }
        throw policyErr;
      }
    }

    const productIds = policyLineItems
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

    const sanitizedBuyer = sanitizeBuyerForTransactionType(buyer, transactionType);
    const sellerVatNorm = normalizeSaudiVatDigits(tenant.business?.vatNumber) || tenant.business?.vatNumber || '';

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
      buyer: sanitizedBuyer,
      customerId: cleanObjectId(customer?._id || req.body.customerId),
      status: resolveInitialSellInvoiceStatus(req.body?.status, tenant),
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: sellerVatNorm,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address,
        contactPhone: tenant.business.contactPhone,
        contactEmail: tenant.business.contactEmail,
      },
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      invoiceDiscount,
      lineItems: policyLineItems,
    };

    syncZatcaInvoiceType(invoiceData, transactionType);
    const sellTypeOverrideMeta = req.body.transactionTypeOverridden
      ? {
          from: req.body.transactionTypeOverrideFrom === 'B2B' ? 'B2B' : 'B2C',
          to: transactionType,
          reason: String(req.body.transactionTypeOverrideReason || '').trim(),
        }
      : null;

    // Strip client-only override flags so they are not persisted as unknown fields
    delete invoiceData.transactionTypeOverridden;
    delete invoiceData.transactionTypeOverrideReason;
    delete invoiceData.transactionTypeOverrideFrom;
    delete invoiceData.transactionTypeOverrideTo;

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

    try {
      const sellStatus = resolveInitialSellInvoiceStatus(req.body?.status, tenant);
      invoiceData.status = sellStatus;
      await runSellPrePostGate(req, {
        payload: invoiceData,
        statusHint: sellStatus,
      });
    } catch (gateErr) {
      if (gateErr.status === 400) {
        return res.status(400).json({
          error: gateErr.message,
          code: gateErr.code,
          checks: gateErr.checks,
          blockingFailed: gateErr.blockingFailed,
        });
      }
      throw gateErr;
    }

    try {
      prepareSellInvoiceTermsAndSeller(invoiceData, {
        customer,
        tenant,
        bodyPaymentTerms: req.body.paymentTerms,
        bodyDueDate: req.body.dueDate,
        dueDateOverride: Boolean(req.body.dueDateOverride),
        skipSellerCheck: createAsDraft || invoiceData.status === 'draft',
      });
    } catch (prepErr) {
      if (prepErr.status === 400) {
        return res.status(400).json({ error: prepErr.message, code: prepErr.code, missing: prepErr.missing });
      }
      throw prepErr;
    }

    resolvePaymentStatus(invoiceData);

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const createdInvoice = await Invoice.create(enrichedInvoiceData);
    await applyResolvedPayment(createdInvoice);
    const invoice = await attachDraftQr(createdInvoice, tenant.business, tenant);

    if (sellTypeOverrideMeta?.reason) {
      appendTransactionTypeOverride(req, invoice, sellTypeOverrideMeta);
      await invoice.save();
    }

    try {
      const { ensureInvoiceZatcaStub } = await import('../services/inventory/zatcaStub.js');
      await ensureInvoiceZatcaStub(invoice, { userId: req.user._id });
    } catch (zErr) {
      console.error('[invoice] zatca stub', zErr?.message || zErr);
    }

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

    if (await postSellLedgersOrConflict(res, invoice, req, tenant)) return;
    afterInvoiceWrite(invoice, { userId: req.user._id, created: true, previousPaymentStatus: 'pending' });

    const invoiceCustomer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email phone mobile contactPerson')
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

      try {
        await autoSmsInvoiceIfEnabled({
          tenant,
          invoice,
          customer: invoiceCustomer,
          language: tenant?.settings?.language,
        });
      } catch {
        // SMS failure must not block invoice issuance
      }
    }

    recordUserActivity(req, {
      action: 'create',
      module: 'invoicing',
      resourceType: 'Invoice',
      resourceId: invoice._id,
      resourceName: invoice.invoiceNumber,
      description: `Issued sales invoice ${invoice.invoiceNumber} (${invoice.grandTotal} SAR)`,
      descriptionAr: `أصدر فاتورة مبيعات رقم ${invoice.invoiceNumber} بقيمة ${invoice.grandTotal} ريال`,
      details: {
        total: invoice.grandTotal,
        customerName: invoice.buyer?.name || invoice.buyer?.nameAr,
        status: invoice.status,
        transactionType: invoice.transactionType,
      },
    }).catch(() => {});
    if (typeOverrideMeta?.reason) {
      appendTransactionTypeOverride(req, invoice, {
        from: typeOverrideMeta.from || (transactionType === 'B2B' ? 'B2C' : 'B2B'),
        to: typeOverrideMeta.to || transactionType,
        reason: typeOverrideMeta.reason,
      });
      await invoice.save();
    }

    syncMarqueeBookingFromDocument({
      tenant,
      user: req.user,
      documentType: 'invoice',
      document: invoice,
      body: req.body,
    }).catch(() => {});

    res.status(201).json({ ...invoice.toObject(), emailDelivery, whatsappDelivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/preview-journal
router.post('/preview-journal', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const flow = String(req.body?.flow || 'sell').toLowerCase() === 'purchase' ? 'purchase' : 'sell';
    const invoice = {
      invoiceNumber: req.body?.invoiceNumber || 'DRAFT',
      lineItems: Array.isArray(req.body?.lineItems) ? req.body.lineItems : [],
      grandTotal: Number(req.body?.grandTotal || 0),
      totalTax: Number(req.body?.totalTax || req.body?.taxAmount || 0),
      taxableAmount: Number(req.body?.taxableAmount || 0),
      sourcePurchaseOrderId: cleanObjectId(req.body?.sourcePurchaseOrderId),
      sourceGrnIds: Array.isArray(req.body?.sourceGrnIds) ? req.body.sourceGrnIds : [],
      paymentTerms: req.body?.paymentTerms || null,
      paymentSchedule: Array.isArray(req.body?.paymentSchedule) ? req.body.paymentSchedule : null,
      issueDate: req.body?.issueDate || null,
      dueDate: req.body?.dueDate || null,
      earlyPaymentDiscount: req.body?.earlyPaymentDiscount || null,
      customerId: cleanObjectId(req.body?.customerId),
      supplierId: cleanObjectId(req.body?.supplierId),
    };
    const {
      previewSalesInvoiceJournal,
      previewPurchaseInvoiceJournal,
    } = await import('../services/accountingService.js');
    const preview = flow === 'purchase'
      ? await previewPurchaseInvoiceJournal({ tenantId: req.user.tenantId, invoice })
      : await previewSalesInvoiceJournal({ tenantId: req.user.tenantId, invoice });
    res.json({ flow, ...preview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/three-way-match — preview for vendor bills
router.post('/three-way-match', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const { threeWayMatch, resolveThreeWayOptions } = await import('../services/inventory/threeWayMatch.js');
    const { getInvSettings } = await import('../services/inventory/settingsService.js');
    const purchaseOrderId = cleanObjectId(req.body.purchaseOrderId);
    if (!purchaseOrderId) {
      return res.status(400).json({ error: 'purchaseOrderId required' });
    }
    const settings = await getInvSettings(req.user.tenantId);
    const opts = resolveThreeWayOptions(settings, req.body);
    const result = await threeWayMatch({
      tenantId: req.user.tenantId,
      purchaseOrderId,
      billLines: req.body.billLines || [],
      excludeInvoiceId: cleanObjectId(req.body.excludeInvoiceId) || null,
      ...opts,
    });
    res.json(result);
  } catch (error) {
    const status = error.code === 'PO_NOT_FOUND' ? 404 : 400;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// @route   GET /api/invoices/purchase/vendor-account-predictions
router.get('/purchase/vendor-account-predictions', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const supplierId = cleanObjectId(req.query.supplierId);
    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId required' });
    }
    const { predictVendorLineAccounts } = await import('../services/vendorApService.js');
    const predictions = await predictVendorLineAccounts(req.user.tenantId, supplierId);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/sell/pre-post-check
router.post('/sell/pre-post-check', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await evaluateInvoicePrePost({
      tenantId: req.user.tenantId,
      payload: {
        customerId: body.customerId,
        buyer: body.buyer,
        lineItems: body.lineItems,
        transactionType: body.transactionType,
        issueDate: body.issueDate,
        grandTotal: body.grandTotal,
        status: body.status || 'approved',
      },
      excludeInvoiceId: cleanObjectId(body.excludeInvoiceId || body.invoiceId),
      language: req.query.lang || req.tenant?.settings?.language || 'en',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/sell/customer-stats/:customerId
router.get('/sell/customer-stats/:customerId', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const customerId = cleanObjectId(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }
    const { getCustomerArStats } = await import('../services/vendorApService.js');
    const stats = await getCustomerArStats(req.user.tenantId, customerId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/purchase/vendor-stats/:supplierId
router.get('/purchase/vendor-stats/:supplierId', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const supplierId = cleanObjectId(req.params.supplierId);
    if (!supplierId) {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }
    const { getVendorApStats } = await import('../services/vendorApService.js');
    const stats = await getVendorApStats(req.user.tenantId, supplierId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/sell/product-stats/:productId
router.get('/sell/product-stats/:productId', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const productId = cleanObjectId(req.params.productId);
    if (!productId) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
    const { getProductArStats } = await import('../services/vendorApService.js');
    const stats = await getProductArStats(req.user.tenantId, productId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/invoices/purchase/product-stats/:productId
router.get('/purchase/product-stats/:productId', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const productId = cleanObjectId(req.params.productId);
    if (!productId) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
    const { getProductApStats } = await import('../services/vendorApService.js');
    const stats = await getProductApStats(req.user.tenantId, productId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/purchase/batch-sepa-export
router.post('/purchase/batch-sepa-export', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoiceIds = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
    const { buildSepaCreditTransferXml, markSepaExported } = await import('../services/vendorApService.js');
    const result = await buildSepaCreditTransferXml(req.user.tenantId, invoiceIds, {
      executionDate: req.body?.executionDate,
    });
    try {
      await markSepaExported(req.user.tenantId, result.invoiceIds || invoiceIds, {
        filename: result.filename,
      });
    } catch {
      /* best-effort stamp */
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Sepa-Invoice-Ids', JSON.stringify(result.invoiceIds || invoiceIds));
    res.setHeader('X-Sepa-Transaction-Count', String(result.transactionCount || 0));
    res.send(result.xml);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/invoices/purchase/batch-sepa-mark-uploaded
router.post('/purchase/batch-sepa-mark-uploaded', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoiceIds = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
    const { markSepaUploadedToBank } = await import('../services/vendorApService.js');
    res.json(await markSepaUploadedToBank(req.user.tenantId, invoiceIds));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/invoices/purchase/check-print
router.post('/purchase/check-print', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    const {
      buildCheckPrintPayload,
      buildCheckPrintHtml,
      allocateNextCheckNumber,
    } = await import('../services/vendorApService.js');

    let checkNumber = String(req.body?.checkNumber || '').trim();
    let micrRouting = '';
    let micrAccount = '';
    if (!checkNumber) {
      const allocated = await allocateNextCheckNumber(req.user.tenantId);
      checkNumber = allocated.checkNumber;
      micrRouting = allocated.micrRouting;
      micrAccount = allocated.micrAccount;
    } else {
      const cfg = tenant?.settings?.accounting?.checkPrint || {};
      micrRouting = cfg.micrRouting || '';
      micrAccount = cfg.micrAccount || '';
    }

    const payload = buildCheckPrintPayload({
      tenant,
      payeeName: req.body?.payeeName,
      amount: Number(req.body?.amount || 0),
      currency: req.body?.currency || tenant?.settings?.currency || 'SAR',
      memo: req.body?.memo,
      checkNumber,
      paymentDate: req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      micrRouting,
      micrAccount,
    });
    if (String(req.query.format || req.body?.format || '').toLowerCase() === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(buildCheckPrintHtml(payload));
    }
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/invoices/purchase
router.post('/purchase', invoiceWriteLimiter, checkPermission('invoicing', 'create'), async (req, res) => {
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
      // warehouseId is optional on purchase invoices — stock moves via GRNs only
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

    const invoiceType = String(req.body.invoiceType || '388') === '381' ? '381' : '388';
    const createAsDraft = normalizeText(req.body?.status).toLowerCase() === 'draft'
      && !Boolean(req.body?.confirmPost);
    const invoiceNumber = createAsDraft
      ? await allocatePurchaseDraftNumber(req.user.tenantId, invoiceType)
      : await allocatePurchaseInvoiceNumber(req.user.tenantId, invoiceType);

    const vendorInvoiceNumber = String(
      req.body.vendorInvoiceNumber || req.body.contractNumber || '',
    ).trim();
    if (invoiceType === '388' && !vendorInvoiceNumber && !createAsDraft) {
      return res.status(400).json({
        error: 'Vendor invoice number is required (supplier document number for ZATCA audit)',
        code: 'VENDOR_INVOICE_NUMBER_REQUIRED',
      });
    }
    const vendorInvoiceDate = req.body.vendorInvoiceDate
      ? new Date(req.body.vendorInvoiceDate)
      : (req.body.issueDate ? new Date(req.body.issueDate) : new Date());

    const transactionType = req.body.transactionType || 'B2B';
    const invoiceSubtype = req.body.invoiceSubtype === 'travel_ticket' ? 'travel_ticket' : 'standard';
    const invoiceTypeCode = req.body.invoiceTypeCode || (invoiceType === '381'
      ? (transactionType === 'B2C' ? '0200100' : '0100100')
      : '0100000');
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const pdfTemplateId = resolvePdfTemplateId(req.body?.pdfTemplateId, tenant, businessContext);

    const lineItemsRaw = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, 'purchase');
    let lineItems;
    try {
      const draftOnly = String(req.body?.status || '').toLowerCase() === 'draft';
      const zatcaTenant = isZatcaCurrency(tenant);
      lineItems = await enrichAndValidatePurchaseBillTaxes({
        tenantId: req.user.tenantId,
        lineItems: lineItemsRaw,
        seller,
        supplier,
        requireSupplierVat: !draftOnly && zatcaTenant,
        strictTaxCode: zatcaTenant,
      });
      if (zatcaTenant && seller) {
        const vat = normalizeSaudiVatDigits(seller.vatNumber || supplier?.vatNumber || '');
        if (vat) seller.vatNumber = vat;
      }
    } catch (taxErr) {
      return res.status(taxErr.status || 400).json({
        error: taxErr.message,
        code: taxErr.code || 'TAX_VALIDATION',
      });
    }

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
      invoiceType,
      transactionType,
      invoiceSubtype,
      pdfTemplateId,
      invoiceTypeCode,
      issueDate,
      vendorInvoiceNumber,
      vendorInvoiceDate,
      contractNumber: vendorInvoiceNumber || String(req.body.contractNumber || '').trim(),
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

    ensureInvoiceDueDate(invoiceData);

    if (invoiceData.flow === 'purchase') {
      if (createAsDraft) {
        invoiceData.status = 'draft';
      } else {
        invoiceData.status = ['approved', 'pending', 'sent'].includes(String(invoiceData.status || '').toLowerCase())
          ? invoiceData.status
          : 'approved';
      }
    }

    resolvePaymentStatus(invoiceData);

    const poId = cleanObjectId(req.body.sourcePurchaseOrderId || invoiceData.sourcePurchaseOrderId);
    if (poId) {
      try {
        const { getInvSettings } = await import('../services/inventory/settingsService.js');
        const { resolveThreeWayOptions } = await import('../services/inventory/threeWayMatch.js');
        const settings = await getInvSettings(req.user.tenantId);
        const opts = resolveThreeWayOptions(settings, req.body);
        const matchResult = await assertThreeWayMatchOrThrow({
          tenantId: req.user.tenantId,
          purchaseOrderId: poId,
          billLines: lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
          ...opts,
        });
        invoiceData.matchingStatus = matchResult.matchingStatus;
        invoiceData.matchExceptions = (matchResult.exceptions || []).map((ex) => ({
          productId: ex.productId,
          type: ex.type,
          severity: ex.severity,
          message: ex.message,
          ordered: ex.ordered,
          received: ex.received,
          billedQty: ex.billedQty,
          remainingBillable: ex.remainingBillable,
          remainingOrderable: ex.remainingOrderable,
          poPrice: ex.poPrice,
          billPrice: ex.billPrice,
          diffPct: ex.diffPct,
          absDiff: ex.absDiff,
        }));
      } catch (matchErr) {
        if (matchErr.code === 'THREE_WAY_MATCH') {
          return res.status(409).json({
            error: matchErr.message,
            code: matchErr.code,
            exceptions: matchErr.exceptions || [],
          });
        }
        throw matchErr;
      }
      invoiceData.sourcePurchaseOrderId = poId;
    } else {
      invoiceData.matchingStatus = 'unmatched';
      invoiceData.matchExceptions = [];
    }

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const createdInvoice = await Invoice.create(enrichedInvoiceData);
    await applyResolvedPayment(createdInvoice);
    const invoice = await attachDraftQr(createdInvoice, seller, tenant);
    afterInvoiceWrite(invoice, { userId: req.user._id, created: true, previousPaymentStatus: 'pending' });

    try {
      const { ensureInvoiceZatcaStub } = await import('../services/inventory/zatcaStub.js');
      await ensureInvoiceZatcaStub(invoice, { userId: req.user._id });
    } catch (zErr) {
      console.error('[invoice] zatca stub', zErr?.message || zErr);
    }

    try {
      if (!createAsDraft) {
        await postPurchaseInvoiceLedgers(invoice, req, tenant);
      }
    } catch (jErr) {
      console.error('[invoice] purchase stock journal', jErr?.message || jErr);
    }

    // Bump PO quantityInvoiced after successful match + create
    if (poId) {
      try {
        const PurchaseOrder = mongoose.model('PurchaseOrder');
        const po = await PurchaseOrder.findOne({ _id: poId, ...req.tenantFilter });
        if (po) {
          for (const li of lineItems) {
            if (!li.productId) continue;
            const target = (po.lineItems || []).find((p) => String(p.productId) === String(li.productId));
            if (target) {
              target.quantityInvoiced = toNumber(target.quantityInvoiced, 0) + toNumber(li.quantity, 0);
            }
          }
          await po.save();
        }
      } catch {
        /* best-effort */
      }
    }

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
// @desc    No-op: invoices do not move stock (use Delivery Note / GRN)
router.post('/:id/post-inventory', requireBusinessType('trading'), checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const result = await postInventoryForInvoice(invoice, req.tenantFilter);
    res.json({
      ...((typeof result.toJSON === 'function' ? result.toJSON() : result) || {}),
      message: invoice.flow === 'purchase'
        ? 'Purchase invoices do not receive stock. Use a GRN to add inventory.'
        : 'Sales invoices do not deduct stock. Use a delivery note to ship inventory.',
      stockSkipped: true,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/invoices/:id
router.put('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    req.body = sanitizeInvoicePayload(req.body);
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const tenant = await Tenant.findById(req.user.tenantId);
    const isPhase1 = tenant?.zatca?.phase === 1;
    const isFullyEditable = isPhase1
      || (['draft', 'pending'].includes(invoice.status) && !invoice.zatca?.signedXml);

    // Posted / signed invoices: identity (buyer) only — document type is locked
    if (!isFullyEditable) {
      if (req.body.transactionType != null) {
        const nextType = req.body.transactionType === 'B2B' ? 'B2B' : (req.body.transactionType === 'B2C' ? 'B2C' : null);
        const prevType = invoice.transactionType === 'B2B' ? 'B2B' : 'B2C';
        if (nextType && nextType !== prevType) {
          return res.status(400).json({
            error: 'Posted invoices cannot change document type. Reset to draft first, then change type and post again.',
            code: 'POSTED_TYPE_LOCKED',
          });
        }
      }

      if (req.body.buyer && typeof req.body.buyer === 'object') {
        invoice.buyer = { ...(invoice.buyer?.toObject?.() || invoice.buyer || {}), ...req.body.buyer };
      }
      if (req.body.customerId !== undefined) {
        invoice.customerId = cleanObjectId(req.body.customerId) || null;
      }

      await invoice.save();
      if (isZatcaCurrency(tenant) && !invoice.zatca?.signedXml) {
        await attachDraftQr(invoice, invoice.seller || tenant.business, tenant);
      }
      afterInvoiceWrite(invoice, { userId: req.user._id });
      return res.json(invoice);
    }
    
    if (req.body.lineItems) {
      req.body.lineItems = await ensureProductsExist(req.user.tenantId, req.user._id, req.body.lineItems, invoice.flow);
    }

    if (invoice.flow === 'purchase') {
      const poId = cleanObjectId(req.body.sourcePurchaseOrderId || invoice.sourcePurchaseOrderId);
      const lineItemsForMatch = (req.body.lineItems || invoice.lineItems || [])
        .filter((li) => li?.productId && toNumber(li.quantity, 0) > 0);
      if (poId && lineItemsForMatch.length) {
        try {
          const { getInvSettings } = await import('../services/inventory/settingsService.js');
          const { resolveThreeWayOptions } = await import('../services/inventory/threeWayMatch.js');
          const settings = await getInvSettings(req.user.tenantId);
          const opts = resolveThreeWayOptions(settings, req.body);
          const matchResult = await assertThreeWayMatchOrThrow({
            tenantId: req.user.tenantId,
            purchaseOrderId: poId,
            billLines: lineItemsForMatch.map((li) => ({
              productId: li.productId,
              variantId: li.variantId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            })),
            excludeInvoiceId: invoice._id,
            ...opts,
          });
          req.body.matchingStatus = matchResult.matchingStatus;
          req.body.matchExceptions = (matchResult.exceptions || []).map((ex) => ({
            productId: ex.productId,
            type: ex.type,
            severity: ex.severity,
            message: ex.message,
            ordered: ex.ordered,
            received: ex.received,
            billedQty: ex.billedQty,
            remainingBillable: ex.remainingBillable,
            remainingOrderable: ex.remainingOrderable,
            poPrice: ex.poPrice,
            billPrice: ex.billPrice,
            diffPct: ex.diffPct,
            absDiff: ex.absDiff,
          }));
        } catch (matchErr) {
          if (matchErr.code === 'THREE_WAY_MATCH') {
            return res.status(409).json({
              error: matchErr.message,
              code: matchErr.code,
              exceptions: matchErr.exceptions || [],
            });
          }
          throw matchErr;
        }
      } else if (!poId) {
        req.body.matchingStatus = 'unmatched';
        req.body.matchExceptions = [];
      }
    }
    
    // Only resolve payment status for manually edited fields (not auto-triggered updates without payment info)
    if (
      req.body.paymentStatus ||
      req.body.paymentMethod ||
      req.body.grandTotal !== undefined ||
      req.body.paidAmount !== undefined
    ) {
      resolvePaymentStatus(req.body);
    }

    const confirmPost = Boolean(req.body.confirmPost);
    delete req.body.confirmPost;

    const prevTxnType = invoice.transactionType === 'B2B' ? 'B2B' : 'B2C';
    const overrideGate = requireOverrideReasonIfNeeded(req);
    if (overrideGate) {
      return res.status(overrideGate.status).json({ error: overrideGate.message, code: overrideGate.code });
    }
    const overrideReason = String(req.body.transactionTypeOverrideReason || '').trim();
    const overrideFrom = req.body.transactionTypeOverrideFrom;
    const overrideTo = req.body.transactionTypeOverrideTo;
    const wasOverridden = Boolean(req.body.transactionTypeOverridden);
    delete req.body.transactionTypeOverridden;
    delete req.body.transactionTypeOverrideReason;
    delete req.body.transactionTypeOverrideFrom;
    delete req.body.transactionTypeOverrideTo;

    Object.assign(invoice, req.body);

    const nextTxnType = invoice.transactionType === 'B2B' ? 'B2B' : 'B2C';
    syncZatcaInvoiceType(invoice, nextTxnType);
    if (wasOverridden && overrideReason && (prevTxnType !== nextTxnType || overrideFrom || overrideTo)) {
      appendTransactionTypeOverride(req, invoice, {
        from: overrideFrom === 'B2B' || overrideFrom === 'B2C' ? overrideFrom : prevTxnType,
        to: overrideTo === 'B2B' || overrideTo === 'B2C' ? overrideTo : nextTxnType,
        reason: overrideReason,
      });
    }

    if (invoice.flow === 'sell') {
      const wantsPost = confirmPost
        || (req.body.status && String(req.body.status).toLowerCase() !== 'draft');
      if (wantsPost && String(invoice.status) === 'draft') {
        invoice.status = resolveInitialSellInvoiceStatus(req.body.status, tenant);
        if (isPlaceholderSellInvoiceNumber(invoice.invoiceNumber)) {
          invoice.invoiceNumber = await allocateSellInvoiceNumber(req.user.tenantId);
        }
      } else if (!wantsPost && req.body.status != null) {
        invoice.status = 'draft';
      }
      try {
        await runSellPrePostGate(req, {
          payload: {
            customerId: invoice.customerId,
            buyer: invoice.buyer,
            lineItems: invoice.lineItems,
            transactionType: invoice.transactionType,
            issueDate: invoice.issueDate,
            grandTotal: invoice.grandTotal,
            status: invoice.status,
          },
          excludeInvoiceId: invoice._id,
          statusHint: invoice.status,
        });
      } catch (gateErr) {
        if (gateErr.status === 400) {
          return res.status(400).json({
            error: gateErr.message,
            code: gateErr.code,
            checks: gateErr.checks,
            blockingFailed: gateErr.blockingFailed,
          });
        }
        throw gateErr;
      }
    }

    if (invoice.flow === 'purchase') {
      const wantsPost = confirmPost
        || (req.body.status && String(req.body.status).toLowerCase() !== 'draft');
      if (wantsPost && String(invoice.status) === 'draft') {
        const vendorNo = String(invoice.vendorInvoiceNumber || invoice.contractNumber || '').trim();
        if (String(invoice.invoiceType || '388') === '388' && !vendorNo) {
          return res.status(400).json({
            error: 'Vendor invoice number is required (supplier document number for ZATCA audit)',
            code: 'VENDOR_INVOICE_NUMBER_REQUIRED',
          });
        }
        invoice.status = ['approved', 'pending', 'sent'].includes(String(req.body.status || '').toLowerCase())
          ? req.body.status
          : 'approved';
        if (isPlaceholderSellInvoiceNumber(invoice.invoiceNumber)) {
          invoice.invoiceNumber = await allocatePurchaseInvoiceNumber(
            req.user.tenantId,
            invoice.invoiceType || '388',
          );
        }
      } else if (!wantsPost && req.body.status != null) {
        invoice.status = 'draft';
      }
    }

    if (invoice.flow === 'sell') {
      let customerForTerms = null;
      if (invoice.customerId) {
        customerForTerms = await Customer.findOne({ _id: invoice.customerId, ...req.tenantFilter })
          .select('paymentTermsCustomer paymentTerms')
          .lean();
      }
      try {
        const plain = invoice.toObject ? invoice.toObject() : { ...invoice };
        prepareSellInvoiceTermsAndSeller(plain, {
          customer: customerForTerms,
          tenant,
          bodyPaymentTerms: Object.prototype.hasOwnProperty.call(req.body, 'paymentTerms')
            ? req.body.paymentTerms
            : invoice.paymentTerms,
          bodyDueDate: Object.prototype.hasOwnProperty.call(req.body, 'dueDate')
            ? req.body.dueDate
            : invoice.dueDate,
          dueDateOverride: Boolean(req.body.dueDateOverride),
          skipSellerCheck: true,
        });
        invoice.paymentTerms = plain.paymentTerms;
        invoice.dueDate = plain.dueDate;
        if (plain.paymentSchedule) invoice.paymentSchedule = plain.paymentSchedule;
        if (plain.earlyPaymentDiscount) invoice.earlyPaymentDiscount = plain.earlyPaymentDiscount;
      } catch (prepErr) {
        if (prepErr.status === 400) {
          return res.status(400).json({ error: prepErr.message, code: prepErr.code, missing: prepErr.missing });
        }
        throw prepErr;
      }
    } else {
      ensureInvoiceDueDate(invoice);
    }

    // Allow B2B ↔ B2C while draft; enforce identity only when leaving draft (post)
    if (
      invoice.flow === 'sell'
      && String(invoice.transactionType || req.body.transactionType || '') === 'B2B'
      && String(invoice.status || '') !== 'draft'
    ) {
      const buyer = invoice.buyer || {};
      const { assertB2bInvoiceReady } = await import('../services/sales/creditLimit.js');
      const b2b = assertB2bInvoiceReady({
        ...buyer,
        isCompany: true,
        entityType: 'business',
        name: buyer.name || buyer.nameEn,
        address: buyer.address,
        vatNumber: buyer.vatNumber,
        crNumber: buyer.crNumber,
      });
      if (!b2b.ok) {
        return res.status(400).json({ error: b2b.error, code: b2b.code, missing: b2b.missing });
      }
    }

    await invoice.save();
    if (isZatcaCurrency(tenant) && !invoice.zatca?.signedXml) {
      await attachDraftQr(invoice, invoice.seller || tenant.business, tenant);
    }
    afterInvoiceWrite(invoice, { userId: req.user._id });

    // Post GL when leaving draft (standard invoice or credit note)
    if (!['draft', 'cancelled'].includes(invoice.status)) {
      if (invoice.flow === 'purchase') {
        await postPurchaseInvoiceLedgers(invoice, req, tenant);
      } else {
        await postSellInvoiceLedgers(invoice, req, tenant);
      }
    }

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

    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));

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
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.flow === 'purchase') {
      return res.status(400).json({ error: 'Cannot sign purchase invoices' });
    }

    if (invoice.flow === 'sell' && String(invoice.transactionType || '').toUpperCase() === 'B2B') {
      const { assertB2bInvoiceReady } = await import('../services/sales/creditLimit.js');
      const b2b = assertB2bInvoiceReady({
        ...(invoice.buyer?.toObject?.() || invoice.buyer || {}),
        name: invoice.buyer?.name,
        vatNumber: invoice.buyer?.vatNumber,
        crNumber: invoice.buyer?.crNumber,
        address: invoice.buyer?.address,
      });
      if (!b2b.ok) {
        return res.status(400).json({ error: b2b.error, code: b2b.code, missing: b2b.missing });
      }
    }
    
    if (invoice.zatca?.submissionStatus !== 'pending' && invoice.zatca?.signedXml) {
      return res.status(400).json({ error: 'Invoice already signed' });
    }

    if ((invoice.businessContext || getPrimaryBusinessType(req.tenant)) === 'trading' && invoice.flow === 'sell' && !invoice.inventory?.skippedAt && !invoice.inventory?.postedAt) {
      try {
        // Mark inventory as skipped — invoices never move stock (use delivery notes)
        await postInventoryForInvoice(invoice, req.tenantFilter);
      } catch (err) {
        // Non-blocking: signing must not fail because stock is intentionally skipped
        console.warn('[invoice] inventory skip mark failed on sign:', err.message);
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

    await postSellInvoiceLedgers(invoice, req, tenant);

    afterInvoiceWrite(invoice, { userId: req.user._id });

    let digitalDelivery = { sent: false };
    if (['paid', 'partially_paid', 'approved'].includes(invoice.status)) {
      digitalDelivery = await deliverDigitalProductsByEmail(invoice, {
        language: req.tenant?.settings?.language,
      });
    }

    emitPlatformEvent('invoice_signed', {
      tenantId: String(invoice.tenantId),
      invoiceId: String(invoice._id),
      zatcaPhase: tenant.zatca?.phase,
      success: invoice.zatca?.submissionStatus !== 'rejected',
      userId: String(req.user._id),
    });

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email phone mobile contactPerson')
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

    try {
      await autoSmsInvoiceIfEnabled({
        tenant,
        invoice,
        customer,
        language: tenant?.settings?.language,
      });
    } catch {
      // SMS failure must not block signing
    }

    let whatsappDelivery = { sent: false, reason: 'disabled' };
    try {
      whatsappDelivery = await autoWhatsAppInvoiceIfEnabled({
        tenant,
        invoice,
        customer,
        language: tenant?.settings?.language,
      });
    } catch (waError) {
      whatsappDelivery = { sent: false, reason: waError.message };
    }
    
    res.json({ ...invoice.toObject(), emailDelivery, whatsappDelivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/send-email', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
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

    const hasEmailAddon = tenantHasEmailAddon(tenant);
    if (!hasEmailAddon) {
      return res.status(403).json({ error: 'Email Marketing is not installed for this tenant' });
    }

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email phone mobile contactPerson')
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
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req))
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
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req))
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
    const reason = String(req.body?.reason || req.body?.cancelReason || '').trim();
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { cancelInvoiceDocument } = await import('../services/accountingService.js');
    const cancelled = await cancelInvoiceDocument({
      tenantId: invoice.tenantId,
      userId: req.user?._id,
      invoice,
      reason,
      zatcaPhase: req.tenant?.zatca?.phase || 2,
    });

    afterInvoiceWrite(cancelled, { userId: req.user?._id });

    if (cancelled.customerId) {
      await syncCustomerStats(cancelled.tenantId, cancelled.customerId);
    }

    res.json(cancelled);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to cancel invoice',
      code: error.code || undefined,
    });
  }
});

// @route   POST /api/invoices/:id/reset-to-draft
router.post('/:id/reset-to-draft', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { resetInvoiceToDraft } = await import('../services/accountingService.js');
    const draft = await resetInvoiceToDraft({
      tenantId: invoice.tenantId,
      userId: req.user?._id,
      invoice,
      zatcaPhase: req.tenant?.zatca?.phase || 2,
    });

    afterInvoiceWrite(draft, { userId: req.user?._id });

    if (draft.customerId) {
      await syncCustomerStats(draft.tenantId, draft.customerId);
    }

    res.json(draft);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to reset invoice to draft',
      code: error.code || undefined,
    });
  }
});

// @route   POST /api/invoices/:id/credit-note
router.post('/:id/credit-note', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const originalInvoice = await Invoice.findOne(scopedInvoiceFilter(req));
    
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

    const action = String(req.body?.action || 'full').toLowerCase();
    const isPartial = action === 'partial';
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Credit note reason is required (ZATCA)', code: 'CREDIT_NOTE_REASON_REQUIRED' });
    }
    const creditNoteType = String(req.body?.creditNoteType || '').trim().toLowerCase();
    const allowedTypes = new Set(['full_refund', 'partial_refund', 'price_correction', 'return', 'damage', 'other']);
    const resolvedType = allowedTypes.has(creditNoteType)
      ? creditNoteType
      : (isPartial ? 'partial_refund' : 'full_refund');
    const reversalDateRaw = req.body?.reversalDate;
    const reversalDate = reversalDateRaw ? new Date(reversalDateRaw) : new Date();

    if (!isPartial) {
      const existingCn = await Invoice.findOne({
        tenantId: originalInvoice.tenantId,
        originalInvoiceId: originalInvoice._id,
        invoiceType: '381',
        status: { $nin: ['cancelled'] },
      }).select('_id invoiceNumber status');
      if (existingCn) {
        return res.status(400).json({
          error: `A credit note already exists (${existingCn.invoiceNumber})`,
          creditNoteId: existingCn._id,
        });
      }
    }

    const year = (reversalDate instanceof Date && !Number.isNaN(reversalDate.getTime())
      ? reversalDate
      : new Date()).getFullYear();
    const seriesPrefix = originalInvoice.flow === 'purchase' ? `VR-${year}-` : `CN-${year}-`;
    const seriesCount = await Invoice.countDocuments({
      tenantId: originalInvoice.tenantId,
      invoiceType: '381',
      flow: originalInvoice.flow || 'sell',
      invoiceNumber: new RegExp(`^${seriesPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    });
    const creditNoteNumber = `${seriesPrefix}${String(seriesCount + 1).padStart(6, '0')}`;
    const source = originalInvoice.toObject();
    delete source._id;
    delete source.__v;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.zatca;
    delete source.proformaSourceId;

    const refundLines = isPartial ? (Array.isArray(req.body?.refundLines) ? req.body.refundLines : []) : null;
    if (isPartial && !refundLines.length) {
      return res.status(400).json({ error: 'Partial refund requires refundLines with quantities' });
    }

    const reversedLines = buildReversedBillLines(source.lineItems, refundLines);
    if (!reversedLines.length) {
      return res.status(400).json({ error: 'No bill lines selected for refund' });
    }

    const subtotal = Number(reversedLines.reduce((sum, line) => sum + Number(line.lineExtensionAmount || line.lineTotal || 0), 0).toFixed(2));
    const taxAmount = Number(reversedLines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0).toFixed(2));
    const grandTotal = Number((subtotal + taxAmount).toFixed(2));

    const creditNote = await Invoice.create({
      ...source,
      invoiceNumber: creditNoteNumber,
      invoiceType: '381',
      invoiceTypeCode: originalInvoice.transactionType === 'B2C' ? '0200100' : '0100100',
      originalInvoiceId: originalInvoice._id,
      originalInvoiceNumber: originalInvoice.invoiceNumber,
      lineItems: reversedLines,
      subtotal,
      taxAmount,
      grandTotal,
      paidAmount: 0,
      status: 'draft',
      zatca: {},
      creditNoteReason: reason,
      creditNoteType: resolvedType,
      internalNotes: `Refund: ${reason}${originalInvoice.invoiceNumber ? ` (from ${originalInvoice.invoiceNumber})` : ''}`,
      createdBy: req.user._id,
      ...getUserDisplayNames(req.user),
      issueDate: reversalDate,
      accountingDate: reversalDate,
    });

    // Do not mark original as credited until the credit note is posted (see postSellInvoiceLedgers).
    // Keep a soft lock via existingCn check for non-cancelled drafts.

    if (originalInvoice.flow === 'purchase') {
      creditNote.status = 'approved';
      await creditNote.save();
      try {
        const tenant = await Tenant.findById(originalInvoice.tenantId);
        await postPurchaseInvoiceLedgers(creditNote, req, tenant);
      } catch (reconErr) {
        console.warn('[invoice] vendor refund reconciliation', reconErr?.message || reconErr);
      }
    }

    let draftBill = null;
    if (action === 'full_and_draft' && originalInvoice.flow === 'purchase') {
      const draftSource = originalInvoice.toObject();
      delete draftSource._id;
      delete draftSource.__v;
      delete draftSource.createdAt;
      delete draftSource.updatedAt;
      delete draftSource.zatca;
      delete draftSource.proformaSourceId;
      const draftCount = await Invoice.countDocuments({
        tenantId: originalInvoice.tenantId,
        flow: 'purchase',
        invoiceType: '388',
      });
      draftBill = await Invoice.create({
        ...draftSource,
        invoiceNumber: `BILL-${new Date().getFullYear()}-${String(draftCount + 1).padStart(6, '0')}`,
        status: 'draft',
        paidAmount: 0,
        paymentStatus: 'unpaid',
        originalInvoiceId: undefined,
        zatca: {},
        createdBy: req.user._id,
        ...getUserDisplayNames(req.user),
        issueDate: new Date(),
      });
    }

    if (originalInvoice.customerId) {
      await syncCustomerStats(originalInvoice.tenantId, originalInvoice.customerId);
    }

    res.status(201).json({ creditNote, draftBill });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/invoices/:id/debit-note
router.post('/:id/debit-note', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const originalInvoice = await Invoice.findOne(scopedInvoiceFilter(req));

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
    const proforma = await Invoice.findOne(scopedInvoiceFilter(req));
    
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

// @route   POST /api/invoices/:id/send-whatsapp
// @desc    Send invoice via WhatsApp (Official Cloud API or QR Baileys with wa.me link fallback)
router.post('/:id/send-whatsapp', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne(scopedInvoiceFilter(req));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tenant = req.tenant || (await Tenant.findById(req.user.tenantId));
    let customer = null;
    if (invoice.customerId) {
      customer = await Customer.findOne({ _id: invoice.customerId, tenantId: tenant._id });
    }

    const phone = req.body?.phone || customer?.phone || customer?.mobile || invoice?.buyer?.phone || invoice?.buyer?.contactPhone;
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${tenant.domain || 'app.maqder.com'}`;
    const link = `${baseUrl}/app/dashboard/invoices/${invoice._id}`;
    const amountLabel = `${Number(invoice.grandTotal || 0).toFixed(2)} ${invoice.currency || 'SAR'}`;
    const customerName = customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer';

    const textEn = `Dear ${customerName}, your invoice ${invoice.invoiceNumber} (${amountLabel}) is available here: ${link}`;
    const textAr = `عزيزي ${customerName}، فاتورتكم رقم ${invoice.invoiceNumber} بقيمة (${amountLabel}) متاحة عبر الرابط: ${link}`;
    const messageText = req.body?.language === 'ar' ? textAr : textEn;
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    // Try Cloud API
    const config = await getWhatsAppConfig(tenant._id, { requireActive: true });
    const cloudReady = Boolean(config?.isActive && config?.accessToken && config?.phoneNumberId);
    if (cloudReady && cleanPhone) {
      try {
        const result = await sendInvoiceOnWhatsApp({ tenant, invoice, customer, language: req.body?.language || 'ar' });
        if (result?.sent) {
          return res.json({ success: true, channel: 'cloud_api', message: 'Invoice sent via WhatsApp Cloud API successfully', waLink });
        }
      } catch (e) {
        console.warn('[Invoice] WhatsApp Cloud send failed, trying QR fallback:', e.message);
      }
    }

    // Try QR Web / Baileys
    if (cleanPhone) {
      try {
        const qrResult = await sendRestaurantWhatsApp({
          tenantId: tenant._id,
          phone: cleanPhone,
          messageEn: textEn,
          messageAr: textAr,
          replacements: { invoiceNumber: invoice.invoiceNumber, total: invoice.grandTotal, link, customer_name: customerName }
        });
        if (qrResult?.sent) {
          return res.json({ success: true, channel: 'qr_session', message: 'Invoice sent via WhatsApp session successfully', waLink });
        }
      } catch (e) {
        console.warn('[Invoice] WhatsApp QR session send failed:', e.message);
      }
    }

    // Return waLink fallback
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

export default router;
