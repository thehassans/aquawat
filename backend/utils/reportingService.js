import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import VatReturn from '../models/VatReturn.js';
import { statsAggregate } from './mongoReadPreference.js';

const TRAVEL_MARGIN_VAT_RATE = 15;

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const resolveTenantMatch = (tenantId) => {
  if (!tenantId) return {};
  if (tenantId instanceof mongoose.Types.ObjectId) return { tenantId };
  if (typeof tenantId === 'string' && mongoose.Types.ObjectId.isValid(tenantId)) {
    return { tenantId: new mongoose.Types.ObjectId(tenantId) };
  }
  return { tenantId };
};

export const resolvePeriodKey = (startDate) => `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

export const resolveReportPeriod = ({ month, year, startDate, endDate, now = new Date() } = {}) => {
  const monthParam = Number(month);
  const yearParam = Number(year);
  const startDateParam = startDate ? new Date(startDate) : null;
  const endDateParam = endDate ? new Date(endDate) : null;
  const hasStartEnd = startDateParam instanceof Date && !Number.isNaN(startDateParam.getTime()) && endDateParam instanceof Date && !Number.isNaN(endDateParam.getTime());

  if (hasStartEnd) {
    return { startDate: startDateParam, endDate: endDateParam };
  }

  if (Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 && Number.isFinite(yearParam) && yearParam >= 1970) {
    return {
      startDate: new Date(yearParam, monthParam - 1, 1),
      endDate: new Date(yearParam, monthParam, 0, 23, 59, 59, 999),
    };
  }

  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
};

const buildVatReportLineAmountExpression = (linePath) => ({
  $cond: [
    { $eq: [`${linePath}.isTravelMargin`, true] },
    { $ifNull: [`${linePath}.marginTaxable`, 0] },
    { $ifNull: [`${linePath}.lineTotal`, 0] },
  ],
});

const buildVatReportLineVatExpression = (linePath) => ({
  $cond: [
    {
      $and: [
        { $eq: [`${linePath}.isTravelMargin`, true] },
        { $eq: [`${linePath}.taxCategory`, 'S'] },
      ],
    },
    {
      $multiply: [
        { $ifNull: [`${linePath}.marginTaxable`, 0] },
        TRAVEL_MARGIN_VAT_RATE / 100,
      ],
    },
    { $ifNull: [`${linePath}.taxAmount`, 0] },
  ],
});

const buildVatReportLineTaxRateExpression = (linePath) => ({
  $cond: [
    {
      $and: [
        { $eq: [`${linePath}.isTravelMargin`, true] },
        { $eq: [`${linePath}.taxCategory`, 'S'] },
      ],
    },
    TRAVEL_MARGIN_VAT_RATE,
    { $ifNull: [`${linePath}.taxRate`, 0] },
  ],
});

const buildVatReportInvoiceLineSumExpression = (builder) => ({
  $sum: {
    $map: {
      input: { $ifNull: ['$lineItems', []] },
      as: 'line',
      in: builder('$$line'),
    },
  },
});

const normalizeManualLine = (value = {}) => ({
  amount: toNumber(value.amount),
  adjustment: toNumber(value.adjustment),
  vatAmount: toNumber(value.vatAmount),
});

const getDefaultManualLines = () => ({
  salesStandardRated: normalizeManualLine(),
  salesSpecialCitizen: normalizeManualLine(),
  salesZeroRatedDomestic: normalizeManualLine(),
  salesExports: normalizeManualLine(),
  salesExempt: normalizeManualLine(),
  purchasesStandardRatedDomestic: normalizeManualLine(),
  purchasesImportsCustoms: normalizeManualLine(),
  purchasesImportsReverseCharge: normalizeManualLine(),
  purchasesZeroRated: normalizeManualLine(),
  purchasesExempt: normalizeManualLine(),
});

const mergeManualLines = (current = {}) => {
  const defaults = getDefaultManualLines();
  return Object.keys(defaults).reduce((accumulator, key) => {
    accumulator[key] = normalizeManualLine(current?.[key] || defaults[key]);
    return accumulator;
  }, {});
};

const combineVatLine = (computed = {}, manual = {}) => {
  const amount = toNumber(computed.amount) + toNumber(manual.amount);
  const adjustment = toNumber(manual.adjustment);
  const vatAmount = toNumber(computed.vatAmount) + toNumber(manual.vatAmount);
  return { amount, adjustment, vatAmount };
};

const buildVatStatement = ({ manualLines, lineBuckets, expenseTotals, savedReturn }) => {
  const salesStandardRated = combineVatLine(lineBuckets.sell.S, manualLines.salesStandardRated);
  const salesSpecialCitizen = combineVatLine({}, manualLines.salesSpecialCitizen);
  const salesZeroRatedDomestic = combineVatLine(lineBuckets.sell.Z, manualLines.salesZeroRatedDomestic);
  const salesExports = combineVatLine({}, manualLines.salesExports);
  const salesExempt = combineVatLine(lineBuckets.sell.E, manualLines.salesExempt);
  const totalSales = {
    amount: salesStandardRated.amount + salesSpecialCitizen.amount + salesZeroRatedDomestic.amount + salesExports.amount + salesExempt.amount,
    adjustment: salesStandardRated.adjustment + salesSpecialCitizen.adjustment + salesZeroRatedDomestic.adjustment + salesExports.adjustment + salesExempt.adjustment,
    vatAmount: salesStandardRated.vatAmount + salesSpecialCitizen.vatAmount + salesZeroRatedDomestic.vatAmount + salesExports.vatAmount + salesExempt.vatAmount,
  };

  const purchasesStandardRatedDomestic = combineVatLine({
    amount: toNumber(lineBuckets.purchase.S.amount) + toNumber(expenseTotals.amount),
    vatAmount: toNumber(lineBuckets.purchase.S.vatAmount) + toNumber(expenseTotals.taxAmount),
  }, manualLines.purchasesStandardRatedDomestic);
  const purchasesImportsCustoms = combineVatLine({}, manualLines.purchasesImportsCustoms);
  const purchasesImportsReverseCharge = combineVatLine({}, manualLines.purchasesImportsReverseCharge);
  const purchasesZeroRated = combineVatLine(lineBuckets.purchase.Z, manualLines.purchasesZeroRated);
  const purchasesExempt = combineVatLine(lineBuckets.purchase.E, manualLines.purchasesExempt);
  const totalPurchases = {
    amount: purchasesStandardRatedDomestic.amount + purchasesImportsCustoms.amount + purchasesImportsReverseCharge.amount + purchasesZeroRated.amount + purchasesExempt.amount,
    adjustment: purchasesStandardRatedDomestic.adjustment + purchasesImportsCustoms.adjustment + purchasesImportsReverseCharge.adjustment + purchasesZeroRated.adjustment + purchasesExempt.adjustment,
    vatAmount: purchasesStandardRatedDomestic.vatAmount + purchasesImportsCustoms.vatAmount + purchasesImportsReverseCharge.vatAmount + purchasesZeroRated.vatAmount + purchasesExempt.vatAmount,
  };

  const totalVatDueCurrentPeriod = totalSales.vatAmount - totalPurchases.vatAmount;
  const correctionsPreviousPeriod = toNumber(savedReturn?.correctionsPreviousPeriod);
  const vatCreditCarriedForward = toNumber(savedReturn?.vatCreditCarriedForward);
  const netVatDue = totalVatDueCurrentPeriod + correctionsPreviousPeriod - vatCreditCarriedForward;

  return {
    salesStandardRated,
    salesSpecialCitizen,
    salesZeroRatedDomestic,
    salesExports,
    salesExempt,
    totalSales,
    purchasesStandardRatedDomestic,
    purchasesImportsCustoms,
    purchasesImportsReverseCharge,
    purchasesZeroRated,
    purchasesExempt,
    totalPurchases,
    totalVatDueCurrentPeriod: { amount: 0, adjustment: 0, vatAmount: totalVatDueCurrentPeriod },
    correctionsPreviousPeriod: { amount: 0, adjustment: 0, vatAmount: correctionsPreviousPeriod },
    vatCreditCarriedForward: { amount: 0, adjustment: 0, vatAmount: vatCreditCarriedForward },
    netVatDue: { amount: 0, adjustment: 0, vatAmount: netVatDue },
  };
};

const buildVatReturnPayload = async ({ tenantId, startDate, endDate }) => {
  const tenantMatch = resolveTenantMatch(tenantId);
  const invoiceMatch = {
    ...tenantMatch,
    issueDate: { $gte: startDate, $lte: endDate },
    status: { $nin: ['draft', 'cancelled', 'credited'] },
  };
  const expenseMatch = {
    ...tenantMatch,
    expenseDate: { $gte: startDate, $lte: endDate },
    status: 'paid',
    isActive: true,
  };
  const periodKey = resolvePeriodKey(startDate);

  const [savedReturn, invoiceLines, expenseAggregation] = await Promise.all([
    tenantId ? VatReturn.findOne({ tenantId: resolveTenantMatch(tenantId).tenantId, periodKey }) : null,
    Invoice.statsAggregate([
      { $match: invoiceMatch },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: {
            flow: '$flow',
            taxCategory: '$lineItems.taxCategory',
          },
          amount: { $sum: buildVatReportLineAmountExpression('$lineItems') },
          vatAmount: { $sum: buildVatReportLineVatExpression('$lineItems') },
        },
      },
    ]),
    statsAggregate(Expense, [
      { $match: expenseMatch },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ['$amount', 0] } },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        },
      },
    ]),
  ]);

  const lineBuckets = {
    sell: { S: { amount: 0, vatAmount: 0 }, Z: { amount: 0, vatAmount: 0 }, E: { amount: 0, vatAmount: 0 } },
    purchase: { S: { amount: 0, vatAmount: 0 }, Z: { amount: 0, vatAmount: 0 }, E: { amount: 0, vatAmount: 0 } },
  };

  for (const row of invoiceLines || []) {
    const flow = row?._id?.flow === 'purchase' ? 'purchase' : 'sell';
    const category = ['S', 'Z', 'E'].includes(row?._id?.taxCategory) ? row._id.taxCategory : null;
    if (!category) continue;
    lineBuckets[flow][category].amount += toNumber(row.amount);
    lineBuckets[flow][category].vatAmount += toNumber(row.vatAmount);
  }

  const expenseTotals = expenseAggregation?.[0] || { amount: 0, taxAmount: 0, totalAmount: 0 };
  const manualLines = mergeManualLines(savedReturn?.manual);
  const statement = buildVatStatement({ manualLines, lineBuckets, expenseTotals, savedReturn });

  return {
    savedReturn,
    manualLines,
    expenseTotals,
    statement,
    meta: {
      periodKey,
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
      businessLocation: savedReturn?.businessLocation || 'all',
      notes: savedReturn?.notes || '',
      correctionsPreviousPeriod: toNumber(savedReturn?.correctionsPreviousPeriod),
      vatCreditCarriedForward: toNumber(savedReturn?.vatCreditCarriedForward),
      status: savedReturn?.status || 'draft',
      lastImportedAt: savedReturn?.lastImportedAt || null,
    },
  };
};

export const buildVatReturnReport = async ({ tenantId, startDate, endDate }) => {
  const tenantMatch = resolveTenantMatch(tenantId);
  const invoiceTaxableAmountExpression = buildVatReportInvoiceLineSumExpression(buildVatReportLineAmountExpression);
  const invoiceVatAmountExpression = buildVatReportInvoiceLineSumExpression(buildVatReportLineVatExpression);

  const match = {
    ...tenantMatch,
    issueDate: { $gte: startDate, $lte: endDate },
    status: { $nin: ['draft', 'cancelled', 'credited'] },
  };

  const [result] = await Invoice.statsAggregate([
    { $match: match },
    {
      $facet: {
        invoices: [
          {
            $project: {
              totalDiscount: { $ifNull: ['$totalDiscount', 0] },
              taxableAmount: invoiceTaxableAmountExpression,
              totalTax: invoiceVatAmountExpression,
            },
          },
          {
            $addFields: {
              grandTotal: { $add: ['$taxableAmount', '$totalTax'] },
            },
          },
          {
            $group: {
              _id: null,
              invoiceCount: { $sum: 1 },
              totalDiscount: { $sum: '$totalDiscount' },
              taxableAmount: { $sum: '$taxableAmount' },
              totalTax: { $sum: '$totalTax' },
              grandTotal: { $sum: '$grandTotal' },
            },
          },
        ],
        byTaxCategory: [
          { $unwind: '$lineItems' },
          {
            $group: {
              _id: {
                taxCategory: '$lineItems.taxCategory',
                taxRate: buildVatReportLineTaxRateExpression('$lineItems'),
              },
              taxableAmount: { $sum: buildVatReportLineAmountExpression('$lineItems') },
              taxAmount: { $sum: buildVatReportLineVatExpression('$lineItems') },
              totalWithTax: { $sum: { $ifNull: ['$lineItems.lineTotalWithTax', 0] } },
            },
          },
          { $sort: { '_id.taxCategory': 1, '_id.taxRate': -1 } },
        ],
        travelMargin: [
          { $unwind: '$lineItems' },
          { $match: { 'lineItems.isTravelMargin': true } },
          {
            $group: {
              _id: null,
              lineCount: { $sum: 1 },
              customerNet: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
              agencyCost: {
                $sum: {
                  $multiply: [
                    { $ifNull: ['$lineItems.quantity', 0] },
                    { $ifNull: ['$lineItems.agencyPrice', 0] },
                  ],
                },
              },
              marginTaxable: { $sum: { $ifNull: ['$lineItems.marginTaxable', 0] } },
              taxAmount: { $sum: buildVatReportLineVatExpression('$lineItems') },
            },
          },
        ],
        byTransactionType: [
          {
            $project: {
              transactionType: 1,
              totalDiscount: { $ifNull: ['$totalDiscount', 0] },
              taxableAmount: invoiceTaxableAmountExpression,
              totalTax: invoiceVatAmountExpression,
            },
          },
          {
            $addFields: {
              grandTotal: { $add: ['$taxableAmount', '$totalTax'] },
            },
          },
          {
            $group: {
              _id: '$transactionType',
              invoiceCount: { $sum: 1 },
              totalDiscount: { $sum: '$totalDiscount' },
              taxableAmount: { $sum: '$taxableAmount' },
              totalTax: { $sum: '$totalTax' },
              grandTotal: { $sum: '$grandTotal' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const invoices = result?.invoices?.[0] || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
  const byTaxCategory = result?.byTaxCategory || [];
  const byTransactionType = result?.byTransactionType || [];
  const travelMarginTotals = result?.travelMargin?.[0] || { lineCount: 0, customerNet: 0, agencyCost: 0, marginTaxable: 0, taxAmount: 0 };

  const totalsByCategory = {
    standardRated: { taxableAmount: 0, taxAmount: 0 },
    zeroRated: { taxableAmount: 0, taxAmount: 0 },
    exempt: { taxableAmount: 0, taxAmount: 0 },
    outOfScope: { taxableAmount: 0, taxAmount: 0 },
  };

  for (const row of byTaxCategory) {
    const category = row?._id?.taxCategory;
    const taxableAmount = row?.taxableAmount || 0;
    const taxAmount = row?.taxAmount || 0;

    if (category === 'S') {
      totalsByCategory.standardRated.taxableAmount += taxableAmount;
      totalsByCategory.standardRated.taxAmount += taxAmount;
    } else if (category === 'Z') {
      totalsByCategory.zeroRated.taxableAmount += taxableAmount;
      totalsByCategory.zeroRated.taxAmount += taxAmount;
    } else if (category === 'E') {
      totalsByCategory.exempt.taxableAmount += taxableAmount;
      totalsByCategory.exempt.taxAmount += taxAmount;
    } else if (category === 'O') {
      totalsByCategory.outOfScope.taxableAmount += taxableAmount;
      totalsByCategory.outOfScope.taxAmount += taxAmount;
    }
  }

  const vatReturn = await buildVatReturnPayload({ tenantId, startDate, endDate });

  return {
    period: { startDate, endDate },
    currency: 'SAR',
    totals: {
      invoiceCount: invoices.invoiceCount || 0,
      totalDiscount: invoices.totalDiscount || 0,
      taxableAmount: invoices.taxableAmount || 0,
      totalTax: invoices.totalTax || 0,
      grandTotal: invoices.grandTotal || 0,
      byCategory: totalsByCategory,
      purchasesTaxAmount: vatReturn.expenseTotals?.taxAmount || 0,
      travelMargin: {
        lineCount: travelMarginTotals.lineCount || 0,
        customerNet: travelMarginTotals.customerNet || 0,
        agencyCost: travelMarginTotals.agencyCost || 0,
        marginTaxable: travelMarginTotals.marginTaxable || 0,
        taxAmount: travelMarginTotals.taxAmount || 0,
      },
    },
    breakdown: {
      byTaxCategory,
      byTransactionType,
    },
    vatReturn: {
      ...vatReturn.meta,
      manual: vatReturn.manualLines,
      statement: vatReturn.statement,
    },
  };
};

export const buildBusinessSummaryReport = async ({ tenantId, startDate, endDate }) => {
  const tenantMatch = resolveTenantMatch(tenantId);

  const invoiceMatch = {
    ...tenantMatch,
    issueDate: { $gte: startDate, $lte: endDate },
    status: { $nin: ['draft', 'cancelled', 'credited'] },
  };

  const expenseMatch = {
    ...tenantMatch,
    expenseDate: { $gte: startDate, $lte: endDate },
    status: 'paid',
    isActive: true,
  };

  const [invoiceAgg, expenseAgg] = await Promise.all([
    Invoice.statsAggregate([
      { $match: invoiceMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: '$flow',
                invoiceCount: { $sum: 1 },
                totalDiscount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
                taxableAmount: { $sum: { $ifNull: ['$taxableAmount', 0] } },
                totalTax: { $sum: { $ifNull: ['$totalTax', 0] } },
                grandTotal: { $sum: { $ifNull: ['$grandTotal', 0] } },
              },
            },
          ],
          byTransactionType: [
            { $match: { flow: 'sell' } },
            {
              $group: {
                _id: '$transactionType',
                invoiceCount: { $sum: 1 },
                discount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
                revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
                tax: { $sum: { $ifNull: ['$totalTax', 0] } },
              },
            },
            { $sort: { revenue: -1 } },
          ],
          topCustomers: [
            { $match: { flow: 'sell' } },
            {
              $group: {
                _id: { $ifNull: ['$buyer.name', 'Unknown'] },
                invoiceCount: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]),
    statsAggregate(Expense, [
      { $match: expenseMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                expenseCount: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
                taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: { $ifNull: ['$category', 'other'] },
                count: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
              },
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]),
  ]);

  const invoiceResult = invoiceAgg?.[0] || {};
  const expenseResult = expenseAgg?.[0] || {};
  const totalsByFlow = Array.isArray(invoiceResult.totals) ? invoiceResult.totals : [];

  const sell = totalsByFlow.find((row) => row._id === 'sell') || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
  const purchase = totalsByFlow.find((row) => row._id === 'purchase') || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
  const expenseTotals = expenseResult?.totals?.[0] || { expenseCount: 0, totalAmount: 0, taxAmount: 0 };
  const net = (sell.grandTotal || 0) - (purchase.grandTotal || 0) - (expenseTotals.totalAmount || 0);

  return {
    period: { startDate, endDate },
    currency: 'SAR',
    totals: {
      sales: {
        invoiceCount: sell.invoiceCount || 0,
        totalDiscount: sell.totalDiscount || 0,
        taxableAmount: sell.taxableAmount || 0,
        totalTax: sell.totalTax || 0,
        grandTotal: sell.grandTotal || 0,
      },
      purchases: {
        invoiceCount: purchase.invoiceCount || 0,
        totalDiscount: purchase.totalDiscount || 0,
        taxableAmount: purchase.taxableAmount || 0,
        totalTax: purchase.totalTax || 0,
        grandTotal: purchase.grandTotal || 0,
      },
      expenses: {
        expenseCount: expenseTotals.expenseCount || 0,
        totalAmount: expenseTotals.totalAmount || 0,
        taxAmount: expenseTotals.taxAmount || 0,
      },
      net,
    },
    breakdown: {
      salesByTransactionType: invoiceResult.byTransactionType || [],
      topCustomers: invoiceResult.topCustomers || [],
      expensesByCategory: expenseResult.byCategory || [],
    },
  };
};
