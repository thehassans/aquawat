/**
 * Accounting integration bootstrap.
 * Requires Mongo (ACCOUNTING_TEST_MONGODB_URI || STOCK_TEST_MONGODB_URI || MONGODB_URI).
 */
import mongoose from 'mongoose';
import Tenant from '../../models/Tenant.js';
import Invoice from '../../models/Invoice.js';
import ChartOfAccount from '../../models/ChartOfAccount.js';
import {
  ensureDefaultChartOfAccounts,
  startBankSyncOAuth,
  syncBankFeed,
  handleAccountingPaymentProviderWebhook,
} from '../../services/accountingService.js';
import { autoMatchBankStatementLines } from '../../services/bankReconciliationService.js';

export function getAccountingTestUri() {
  return process.env.ACCOUNTING_TEST_MONGODB_URI
    || process.env.STOCK_TEST_MONGODB_URI
    || process.env.MONGODB_URI;
}

/** @deprecated use getAccountingTestUri() — kept for older tests */
export const uri = getAccountingTestUri();

export async function resolveAccountingSkip() {
  const mongoUri = getAccountingTestUri();
  if (!mongoUri) {
    return 'Set ACCOUNTING_TEST_MONGODB_URI (or MONGODB_URI) to run accounting integration tests';
  }
  try {
    await mongoose.connect(mongoUri);
    await mongoose.connection.db.admin().command({ ping: 1 });
    return false;
  } catch (error) {
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    return `Mongo unavailable: ${error.message}`;
  }
}

export async function connectAccountingMongo() {
  if (mongoose.connection.readyState === 1) return;
  const mongoUri = getAccountingTestUri();
  if (!mongoUri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(mongoUri);
}

export async function disconnectAccountingMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function createAccountingTestTenant({
  slugSuffix = Date.now().toString(36),
  webhookSecret = 'test-webhook-secret',
  provider = 'moyasar',
} = {}) {
  const slug = `acct-test-${slugSuffix}`.toLowerCase();
  const tenant = await Tenant.create({
    name: `Accounting Test ${slugSuffix}`,
    slug,
    business: {
      legalNameAr: 'اختبار محاسبة',
      legalNameEn: 'Accounting Test Co',
    },
    settings: {
      currency: 'SAR',
      accounting: {
        paymentProviders: [{
          provider,
          name: 'Test Gateway',
          nameAr: 'بوابة اختبار',
          journalCode: '',
          active: true,
          webhookSecret,
        }],
      },
    },
  });
  await ensureDefaultChartOfAccounts(tenant._id, null, 'SAR');
  return tenant;
}

export async function createOpenSalesInvoice(tenantId, {
  grandTotal = 115,
  subtotal = 100,
  totalTax = 15,
  paidAmount = 0,
} = {}) {
  const invoice = await Invoice.create({
    tenantId,
    flow: 'sell',
    invoiceNumber: `INV-TEST-${Date.now()}`,
    invoiceTypeCode: '0100000',
    transactionType: 'B2C',
    issueDate: new Date(),
    seller: { name: 'Seller Co' },
    buyer: { name: 'Buyer Co' },
    lineItems: [{
      productName: 'Test item',
      quantity: 1,
      unitPrice: subtotal,
      taxRate: 15,
      taxAmount: totalTax,
      lineTotal: subtotal,
      lineTotalWithTax: grandTotal,
    }],
    subtotal,
    totalTax,
    grandTotal,
    currency: 'SAR',
    paymentMethod: 'credit',
    paidAmount,
    paymentStatus: paidAmount > 0 ? 'partial' : 'pending',
    status: 'approved',
  });
  return invoice;
}

export async function cleanupAccountingTenant(tenantId) {
  if (!tenantId) return;
  const InvoiceModel = Invoice;
  const JournalEntry = (await import('../../models/JournalEntry.js')).default;
  const JournalItem = (await import('../../models/JournalItem.js')).default;
  const BankStatement = (await import('../../models/BankStatement.js')).default;
  const BankStatementLine = (await import('../../models/BankStatementLine.js')).default;
  await Promise.all([
    InvoiceModel.deleteMany({ tenantId }),
    JournalEntry.deleteMany({ tenantId }),
    JournalItem.deleteMany({ tenantId }),
    BankStatement.deleteMany({ tenantId }),
    BankStatementLine.deleteMany({ tenantId }),
    ChartOfAccount.deleteMany({ tenantId }),
    Tenant.deleteOne({ _id: tenantId }),
  ]);
}

export {
  startBankSyncOAuth,
  syncBankFeed,
  handleAccountingPaymentProviderWebhook,
  autoMatchBankStatementLines,
};

export default {
  uri,
  resolveAccountingSkip,
  connectAccountingMongo,
  disconnectAccountingMongo,
  createAccountingTestTenant,
  createOpenSalesInvoice,
  cleanupAccountingTenant,
};
