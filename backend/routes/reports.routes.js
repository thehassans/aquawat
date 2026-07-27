import express from 'express';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import VatReturn from '../models/VatReturn.js';
import ReportSchedule from '../models/ReportSchedule.js';
import RentalContract from '../models/RentalContract.js';
import LaundryOrder from '../models/LaundryOrder.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import { protect, tenantFilter, authorize, checkEmailAddon, requireBusinessType } from '../middleware/auth.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';
import { buildBusinessReports } from '../utils/businessReports.js';
import { computeNextRunAt, normalizeRecipients, serializeReportSchedule, REPORT_SCHEDULE_FREQUENCIES, REPORT_SCHEDULE_PRESETS, REPORT_SCHEDULE_TYPES } from '../utils/reportScheduleService.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);

function normalizeReportSchedulePayload(payload = {}) {
  const reportType = REPORT_SCHEDULE_TYPES.includes(String(payload?.reportType || '').trim())
    ? String(payload.reportType).trim()
    : 'vat';
  const rangePreset = REPORT_SCHEDULE_PRESETS.includes(String(payload?.rangePreset || '').trim())
    ? String(payload.rangePreset).trim()
    : 'this_month';
  const frequency = REPORT_SCHEDULE_FREQUENCIES.includes(String(payload?.frequency || '').trim())
    ? String(payload.frequency).trim()
    : 'weekly';
  const sendAtHour = Math.max(0, Math.min(23, Number(payload?.sendAtHour) || 8));
  const sendAtMinute = Math.max(0, Math.min(59, Number(payload?.sendAtMinute) || 0));
  const dayOfWeek = Math.max(0, Math.min(6, Number(payload?.dayOfWeek) || 1));
  const dayOfMonth = Math.max(1, Math.min(28, Number(payload?.dayOfMonth) || 1));

  return {
    name: String(payload?.name || '').trim(),
    reportType,
    rangePreset,
    frequency,
    dayOfWeek,
    dayOfMonth,
    sendAtHour,
    sendAtMinute,
    recipients: normalizeRecipients(payload?.recipients || []),
    language: payload?.language === 'ar' ? 'ar' : 'en',
    enabled: payload?.enabled !== false,
  };
}

router.get('/schedules', checkEmailAddon, async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    const schedules = await ReportSchedule.find({ tenantId: req.user.tenantId }).sort({ createdAt: -1 });
    return res.json({ schedules: schedules.map(serializeReportSchedule) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/schedules', checkEmailAddon, authorize('admin'), async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    const payload = normalizeReportSchedulePayload(req.body?.schedule || req.body || {});
    if (!payload.name) {
      return res.status(400).json({ error: 'Schedule name is required' });
    }
    if (payload.recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    const schedule = await ReportSchedule.create({
      tenantId: req.user.tenantId,
      ...payload,
      nextRunAt: computeNextRunAt(payload),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json({ schedule: serializeReportSchedule(schedule) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/schedules/:id', checkEmailAddon, authorize('admin'), async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    const schedule = await ReportSchedule.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!schedule) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    const payload = normalizeReportSchedulePayload({ ...schedule.toObject(), ...(req.body?.schedule || req.body || {}) });
    if (!payload.name) {
      return res.status(400).json({ error: 'Schedule name is required' });
    }
    if (payload.recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    Object.assign(schedule, payload, {
      nextRunAt: computeNextRunAt(payload),
      updatedBy: req.user._id,
      lastError: payload.enabled ? schedule.lastError : '',
    });
    await schedule.save();

    return res.json({ schedule: serializeReportSchedule(schedule) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/schedules/:id', checkEmailAddon, authorize('admin'), async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    const schedule = await ReportSchedule.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!schedule) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

function resolvePeriod(req) {
  const now = new Date();

  const monthParam = Number(req.query.month);
  const yearParam = Number(req.query.year);

  const startDateParam = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDateParam = req.query.endDate ? new Date(req.query.endDate) : null;

  const hasStartEnd = startDateParam instanceof Date && !Number.isNaN(startDateParam.getTime()) &&
    endDateParam instanceof Date && !Number.isNaN(endDateParam.getTime());

  let startDate;
  let endDate;

  if (hasStartEnd) {
    startDate = startDateParam;
    endDate = endDateParam;
  } else if (Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 && Number.isFinite(yearParam) && yearParam >= 1970) {
    startDate = new Date(yearParam, monthParam - 1, 1);
    endDate = new Date(yearParam, monthParam, 0, 23, 59, 59, 999);
  } else {
    const month = now.getMonth();
    const year = now.getFullYear();
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolvePeriodKey(startDate) {
  return `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
}

const TRAVEL_MARGIN_VAT_RATE = 15;

function buildVatReportLineAmountExpression(linePath) {
  return {
    $cond: [
      { $eq: [`${linePath}.isTravelMargin`, true] },
      { $ifNull: [`${linePath}.marginTaxable`, 0] },
      { $ifNull: [`${linePath}.lineTotal`, 0] },
    ],
  };
}

function buildVatReportLineVatExpression(linePath) {
  return {
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
  };
}

function buildVatReportLineTaxRateExpression(linePath) {
  return {
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
  };
}

function buildVatReportInvoiceLineSumExpression(builder) {
  return {
    $sum: {
      $map: {
        input: { $ifNull: ['$lineItems', []] },
        as: 'line',
        in: builder('$$line'),
      },
    },
  };
}

function normalizeManualLine(value = {}) {
  return {
    amount: toNumber(value.amount),
    adjustment: toNumber(value.adjustment),
    vatAmount: toNumber(value.vatAmount),
  };
}

function getDefaultManualLines() {
  return {
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
  };
}

function mergeManualLines(current = {}) {
  const defaults = getDefaultManualLines();
  return Object.keys(defaults).reduce((accumulator, key) => {
    accumulator[key] = normalizeManualLine(current?.[key] || defaults[key]);
    return accumulator;
  }, {});
}

function combineVatLine(computed = {}, manual = {}) {
  const amount = toNumber(computed.amount) + toNumber(manual.amount);
  const adjustment = toNumber(manual.adjustment);
  const vatAmount = toNumber(computed.vatAmount) + toNumber(manual.vatAmount);
  return { amount, adjustment, vatAmount };
}

function buildVatStatement({ manualLines, lineBuckets, expenseTotals, savedReturn }) {
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
}

async function buildVatReturnPayload({ tenantId, tenantFilterValue, startDate, endDate }) {
  const invoiceMatch = {
    ...tenantFilterValue,
    issueDate: { $gte: startDate, $lte: endDate },
    status: { $nin: ['draft', 'cancelled', 'credited'] }
  };
  const expenseMatch = {
    ...tenantFilterValue,
    expenseDate: { $gte: startDate, $lte: endDate },
    status: 'paid',
    isActive: true,
  };
  const periodKey = resolvePeriodKey(startDate);

  const [savedReturn, invoiceLines, expenseAggregation] = await Promise.all([
    VatReturn.findOne({ tenantId, periodKey }),
    Invoice.aggregate([
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
        }
      }
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ['$amount', 0] } },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        }
      }
    ])
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
    }
  };
}

router.get('/vat-return', async (req, res) => {
  try {
    const { startDate, endDate } = resolvePeriod(req);
    const invoiceTaxableAmountExpression = buildVatReportInvoiceLineSumExpression(buildVatReportLineAmountExpression);
    const invoiceVatAmountExpression = buildVatReportInvoiceLineSumExpression(buildVatReportLineVatExpression);

    const match = {
      ...req.tenantFilter,
      issueDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ['draft', 'cancelled', 'credited'] }
    };

    const [result] = await Invoice.aggregate([
      { $match: match },
      {
        $facet: {
          invoices: [
            {
              $project: {
                totalDiscount: { $ifNull: ['$totalDiscount', 0] },
                taxableAmount: invoiceTaxableAmountExpression,
                totalTax: invoiceVatAmountExpression,
              }
            },
            {
              $addFields: {
                grandTotal: { $add: ['$taxableAmount', '$totalTax'] }
              }
            },
            {
              $group: {
                _id: null,
                invoiceCount: { $sum: 1 },
                totalDiscount: { $sum: '$totalDiscount' },
                taxableAmount: { $sum: '$taxableAmount' },
                totalTax: { $sum: '$totalTax' },
                grandTotal: { $sum: '$grandTotal' }
              }
            }
          ],
          byTaxCategory: [
            { $unwind: '$lineItems' },
            {
              $group: {
                _id: {
                  taxCategory: '$lineItems.taxCategory',
                  taxRate: buildVatReportLineTaxRateExpression('$lineItems')
                },
                taxableAmount: { $sum: buildVatReportLineAmountExpression('$lineItems') },
                taxAmount: { $sum: buildVatReportLineVatExpression('$lineItems') },
                totalWithTax: { $sum: { $ifNull: ['$lineItems.lineTotalWithTax', 0] } }
              }
            },
            { $sort: { '_id.taxCategory': 1, '_id.taxRate': -1 } }
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
                      { $ifNull: ['$lineItems.agencyPrice', 0] }
                    ]
                  }
                },
                marginTaxable: { $sum: { $ifNull: ['$lineItems.marginTaxable', 0] } },
                taxAmount: { $sum: buildVatReportLineVatExpression('$lineItems') }
              }
            }
          ],
          byTransactionType: [
            {
              $project: {
                transactionType: 1,
                totalDiscount: { $ifNull: ['$totalDiscount', 0] },
                taxableAmount: invoiceTaxableAmountExpression,
                totalTax: invoiceVatAmountExpression,
              }
            },
            {
              $addFields: {
                grandTotal: { $add: ['$taxableAmount', '$totalTax'] }
              }
            },
            {
              $group: {
                _id: '$transactionType',
                invoiceCount: { $sum: 1 },
                totalDiscount: { $sum: '$totalDiscount' },
                taxableAmount: { $sum: '$taxableAmount' },
                totalTax: { $sum: '$totalTax' },
                grandTotal: { $sum: '$grandTotal' }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const invoices = result?.invoices?.[0] || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
    const byTaxCategory = result?.byTaxCategory || [];
    const byTransactionType = result?.byTransactionType || [];
    const travelMarginTotals = result?.travelMargin?.[0] || { lineCount: 0, customerNet: 0, agencyCost: 0, marginTaxable: 0, taxAmount: 0 };

    const totalsByCategory = {
      standardRated: { taxableAmount: 0, taxAmount: 0 },
      zeroRated: { taxableAmount: 0, taxAmount: 0 },
      exempt: { taxableAmount: 0, taxAmount: 0 },
      outOfScope: { taxableAmount: 0, taxAmount: 0 }
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

    const vatReturn = await buildVatReturnPayload({
      tenantId: req.user.tenantId,
      tenantFilterValue: req.tenantFilter,
      startDate,
      endDate,
    });

    res.json({
      period: {
        startDate,
        endDate,
      },
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
        byTransactionType
      },
      vatReturn: {
        ...vatReturn.meta,
        manual: vatReturn.manualLines,
        statement: vatReturn.statement,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/vat-return', authorize('admin'), async (req, res) => {
  try {
    const { month, year, startDate, endDate, businessLocation, manual, correctionsPreviousPeriod, vatCreditCarriedForward, notes, status } = req.body || {};
    const periodStart = startDate ? new Date(startDate) : new Date(Number(year), Number(month) - 1, 1);
    const periodEnd = endDate ? new Date(endDate) : new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return res.status(400).json({ error: 'Invalid VAT return period' });
    }

    const correctionsValue = toNumber(correctionsPreviousPeriod);
    if (Math.abs(correctionsValue) > 5000) {
      return res.status(400).json({ error: 'Corrections from previous period must be between SAR -5000 and 5000' });
    }

    const periodKey = resolvePeriodKey(periodStart);
    const manualLines = mergeManualLines(manual);

    await VatReturn.findOneAndUpdate(
      { tenantId: req.user.tenantId, periodKey },
      {
        $set: {
          tenantId: req.user.tenantId,
          periodKey,
          month: periodStart.getMonth() + 1,
          year: periodStart.getFullYear(),
          periodStart,
          periodEnd,
          businessLocation: String(businessLocation || 'all'),
          manual: manualLines,
          correctionsPreviousPeriod: correctionsValue,
          vatCreditCarriedForward: toNumber(vatCreditCarriedForward),
          notes: String(notes || ''),
          status: status === 'submitted' ? 'submitted' : 'draft',
          lastImportedAt: new Date(),
          updatedBy: req.user._id,
        },
        $setOnInsert: { createdBy: req.user._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const payload = await buildVatReturnPayload({
      tenantId: req.user.tenantId,
      tenantFilterValue: req.tenantFilter,
      startDate: periodStart,
      endDate: periodEnd,
    });

    res.json({
      period: { startDate: periodStart, endDate: periodEnd },
      vatReturn: {
        ...payload.meta,
        manual: payload.manualLines,
        statement: payload.statement,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/business-summary', async (req, res) => {
  try {
    const { startDate, endDate } = resolvePeriod(req);

    const invoiceMatch = {
      ...req.tenantFilter,
      issueDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ['draft', 'cancelled', 'credited'] }
    };

    const expenseMatch = {
      ...req.tenantFilter,
      expenseDate: { $gte: startDate, $lte: endDate },
      status: 'paid',
      isActive: true
    };

    const [invoiceAgg, expenseAgg] = await Promise.all([
      Invoice.aggregate([
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
                }
              }
            ],
            // Travel agency margin breakdown — sums marginTaxable and agency cost
            // from line items flagged as isTravelMargin. Used to compute accurate
            // net profit for travel agencies (margin-scheme billing).
            travelMargin: [
              { $match: { flow: 'sell' } },
              { $unwind: '$lineItems' },
              { $match: { 'lineItems.isTravelMargin': true } },
              {
                $group: {
                  _id: null,
                  lineCount: { $sum: 1 },
                  // Total customer-facing price (full package price billed)
                  customerNet: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
                  // Agency cost paid to supplier (agencyPrice × qty)
                  agencyCost: {
                    $sum: {
                      $multiply: [
                        { $ifNull: ['$lineItems.quantity', 0] },
                        { $ifNull: ['$lineItems.agencyPrice', 0] }
                      ]
                    }
                  },
                  // Margin = customerNet - agencyCost (the taxable profit)
                  marginTaxable: { $sum: { $ifNull: ['$lineItems.marginTaxable', 0] } },
                  vatOnMargin: { $sum: { $ifNull: ['$lineItems.taxAmount', 0] } },
                }
              }
            ],
            byTransactionType: [
              {
                $match: { flow: 'sell' }
              },
              {
                $group: {
                  _id: '$transactionType',
                  invoiceCount: { $sum: 1 },
                  discount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
                  revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
                  tax: { $sum: { $ifNull: ['$totalTax', 0] } },
                }
              },
              { $sort: { revenue: -1 } }
            ],
            topCustomers: [
              {
                $match: { flow: 'sell' }
              },
              {
                $group: {
                  _id: { $ifNull: ['$buyer.name', 'Unknown'] },
                  invoiceCount: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
                }
              },
              { $sort: { revenue: -1 } },
              { $limit: 10 }
            ]
          }
        }
      ]),
      Expense.aggregate([
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
                }
              }
            ],
            byCategory: [
              {
                $group: {
                  _id: { $ifNull: ['$category', 'other'] },
                  count: { $sum: 1 },
                  totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } }
                }
              },
              { $sort: { totalAmount: -1 } },
              { $limit: 10 }
            ]
          }
        }
      ])
    ]);

    const invoiceResult = invoiceAgg?.[0] || {};
    const expenseResult = expenseAgg?.[0] || {};

    const totalsByFlow = Array.isArray(invoiceResult.totals) ? invoiceResult.totals : [];

    const sell = totalsByFlow.find((r) => r._id === 'sell') || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
    const purchase = totalsByFlow.find((r) => r._id === 'purchase') || { invoiceCount: 0, totalDiscount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };

    const expenseTotals = expenseResult?.totals?.[0] || { expenseCount: 0, totalAmount: 0, taxAmount: 0 };
    const travelMarginTotals = invoiceResult?.travelMargin?.[0] || { lineCount: 0, customerNet: 0, agencyCost: 0, marginTaxable: 0, vatOnMargin: 0 };

    // Fetch extra revenue from modular systems
    const businessTypes = getTenantBusinessTypes(req.tenant);
    let extraRevenue = 0;
    
    if (businessTypes.includes('car_rental')) {
      const [{ rev } = { rev: 0 }] = await RentalContract.aggregate([
        { $match: { ...req.tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['CANCELLED'] } } },
        { $group: { _id: null, rev: { $sum: { $ifNull: ['$subtotal', 0] } } } }
      ]).catch(() => [{ rev: 0 }]);
      extraRevenue += rev;
    }
    
    if (businessTypes.includes('laundry')) {
      const [{ rev } = { rev: 0 }] = await LaundryOrder.aggregate([
        { $match: { ...req.tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, rev: { $sum: { $ifNull: ['$subtotal', 0] } } } }
      ]).catch(() => [{ rev: 0 }]);
      extraRevenue += rev;
    }

    if (businessTypes.includes('restaurant')) {
      const [{ rev } = { rev: 0 }] = await RestaurantOrder.aggregate([
        { $match: { ...req.tenantFilter, createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, rev: { $sum: { $ifNull: ['$subtotal', 0] } } } }
      ]).catch(() => [{ rev: 0 }]);
      extraRevenue += rev;
    }

    // For travel agencies using the margin scheme: net profit = margin earned - expenses.
    // For regular businesses: net profit = sales ex-VAT - purchases ex-VAT - expenses.
    // Travel agency is detected when there are margin-scheme line items in the period.
    const isTravelAgency = (travelMarginTotals.lineCount || 0) > 0;
    // Note: expenses are stored with totalAmount and taxAmount. Taxable expense = totalAmount - taxAmount
    const expenseBaseAmount = (expenseTotals.totalAmount || 0) - (expenseTotals.taxAmount || 0);
    const invoiceRevenue = isTravelAgency ? (travelMarginTotals.marginTaxable || 0) : (sell.taxableAmount || 0);
    
    const net = (invoiceRevenue + extraRevenue) - (purchase.taxableAmount || 0) - Math.max(0, expenseBaseAmount);

    res.json({
      period: { startDate, endDate },
      currency: 'SAR',
      totals: {
        sales: {
          invoiceCount: sell.invoiceCount || 0,
          totalDiscount: sell.totalDiscount || 0,
          taxableAmount: (sell.taxableAmount || 0) + extraRevenue,
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
        travelMargin: {
          isTravelAgency,
          lineCount: travelMarginTotals.lineCount || 0,
          customerNet: travelMarginTotals.customerNet || 0,
          agencyCost: travelMarginTotals.agencyCost || 0,
          marginTaxable: travelMarginTotals.marginTaxable || 0,
          vatOnMargin: travelMarginTotals.vatOnMargin || 0,
        },
      },
      breakdown: {
        salesByTransactionType: invoiceResult.byTransactionType || [],
        topCustomers: invoiceResult.topCustomers || [],
        expensesByCategory: expenseResult.byCategory || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily-invoices', async (req, res) => {
  try {
    const { startDate, endDate } = resolvePeriod(req);
    const invoices = await Invoice.aggregate([
      { $match: { ...req.tenantFilter, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled'] } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalTax: { $sum: '$totalTax' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customer-sales', async (req, res) => {
  try {
    const { startDate, endDate } = resolvePeriod(req);
    const sales = await Invoice.aggregate([
      { $match: { ...req.tenantFilter, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled'] } } },
      { $group: {
          _id: '$customerId',
          customerName: { $first: '$buyer.name' },
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customer-statement', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });
    const { startDate, endDate } = resolvePeriod(req);
    
    const mongoose = (await import('mongoose')).default;
    const Voucher = mongoose.model('Voucher');
    
    const invoices = await Invoice.find({ 
      ...req.tenantFilter, customerId, flow: 'sell', issueDate: { $gte: startDate, $lte: endDate }, status: { $nin: ['draft', 'cancelled'] }
    }).select('invoiceNumber issueDate grandTotal paymentStatus paidAmount').lean();
    
    let receipts = [];
    try {
      receipts = await Voucher.find({
        ...req.tenantFilter, partyId: customerId, type: 'receive', date: { $gte: startDate, $lte: endDate }
      }).select('voucherNumber date amount description').lean();
    } catch(e) {
      console.log('Voucher collection missing or error:', e.message);
    }

    const invoiceDebits = invoices.map(i => ({ type: 'invoice', id: i.invoiceNumber, date: i.issueDate, debit: i.grandTotal, credit: 0, desc: 'Invoice' }));
    const invoiceCredits = invoices.filter(i => i.paidAmount > 0).map(i => ({ type: 'invoice_payment', id: i.invoiceNumber, date: i.issueDate, debit: 0, credit: i.paidAmount, desc: `Invoice Payment (${i.invoiceNumber})` }));
    
    const transactions = [
      ...invoiceDebits,
      ...invoiceCredits,
      ...receipts.map(r => ({ type: 'receipt', id: r.voucherNumber, date: r.date, debit: 0, credit: r.amount, desc: r.description }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const statement = transactions.map(t => {
      balance += t.debit - t.credit;
      return { ...t, balance };
    });

    res.json({ statement, totalBalance: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/reports/operations
// Business-type-specific operational reports (KPIs + detail tables) tailored to
// the tenant's enabled business types (restaurant, laundry, car rental, etc.).
router.get('/operations', async (req, res) => {
  try {
    const { startDate, endDate } = resolvePeriod(req);
    const only = req.query.businessType ? String(req.query.businessType).trim() : null;

    const { businessTypes, sections } = await buildBusinessReports({
      tenant: req.tenant,
      tenantFilter: req.tenantFilter,
      startDate,
      endDate,
      only,
    });

    res.json({
      period: { startDate, endDate },
      currency: 'SAR',
      businessTypes,
      sections,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
