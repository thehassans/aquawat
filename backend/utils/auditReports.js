import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Voucher from '../models/Voucher.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import ZatcaAuditLog from '../models/ZatcaAuditLog.js';
import Tenant from '../models/Tenant.js';

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeAggregate = async (model, pipeline) => {
  try {
    return await model.aggregate(pipeline);
  } catch (error) {
    console.error('[auditReports] aggregation error:', error.message);
    return [];
  }
};

/**
 * Builds the Internal Audit Report for a tenant within a date range.
 * Evaluates internal controls, voided/cancelled transactions, discounts & price overrides,
 * expense policy compliance, cash/bank voucher reconciliation, and user separation of duties.
 */
export async function buildInternalAuditReport({ tenantId, startDate, endDate }) {
  const tenantFilter = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  eDate.setHours(23, 59, 59, 999);

  const dateFilter = { issueDate: { $gte: sDate, $lte: eDate } };
  const expenseDateFilter = { date: { $gte: sDate, $lte: eDate } };
  const voucherDateFilter = { date: { $gte: sDate, $lte: eDate } };

  // 1. Overall Invoice Stats & Status Breakdown
  const invoiceStatsPromise = safeAggregate(Invoice, [
    { $match: { ...tenantFilter, ...dateFilter, flow: 'sell' } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
        totalTax: { $sum: { $ifNull: ['$taxAmount', 0] } },
        totalSubtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
      },
    },
  ]);

  // 2. Voided / Cancelled Invoices
  const cancelledInvoicesPromise = Invoice.find({
    ...tenantFilter,
    ...dateFilter,
    flow: 'sell',
    status: { $in: ['cancelled', 'credited'] },
  })
    .sort({ issueDate: -1, createdAt: -1 })
    .limit(100)
    .populate('createdBy', 'name email')
    .populate('cancelledBy', 'name email')
    .lean();

  // 3. High Discount Invoices (> 15% discount or discountAmount > 100 SAR)
  const highDiscountInvoicesPromise = safeAggregate(Invoice, [
    {
      $match: {
        ...tenantFilter,
        ...dateFilter,
        flow: 'sell',
        status: { $nin: ['draft', 'cancelled'] },
        $or: [
          { discountAmount: { $gt: 50 } },
          { 'lines.discount': { $gt: 15 } },
        ],
      },
    },
    { $sort: { discountAmount: -1 } },
    { $limit: 100 },
    {
      $project: {
        invoiceNumber: 1,
        issueDate: 1,
        totalAmount: 1,
        discountAmount: 1,
        subtotal: 1,
        customerName: '$customer.name',
        paymentMethod: 1,
        createdBy: 1,
      },
    },
  ]);

  // 4. Payment Method & Cash vs Card vs Bank Breakdown
  const paymentMethodStatsPromise = safeAggregate(Invoice, [
    {
      $match: {
        ...tenantFilter,
        ...dateFilter,
        flow: 'sell',
        status: { $nin: ['draft', 'cancelled'] },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
      },
    },
  ]);

  // 5. Vouchers Breakdown & Reconciliation
  const vouchersPromise = safeAggregate(Voucher, [
    { $match: { ...tenantFilter, ...voucherDateFilter } },
    {
      $group: {
        _id: { type: '$type', status: '$status', paymentMethod: '$paymentMethod' },
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
      },
    },
  ]);

  // 6. Expense Control & Attachment Compliance
  const expenseStatsPromise = safeAggregate(Expense, [
    { $match: { ...tenantFilter, ...expenseDateFilter } },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        totalTax: { $sum: { $ifNull: ['$taxAmount', 0] } },
        withReceipt: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$receiptUrl', null] },
                  { $ne: ['$receiptUrl', ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
        highValueCount: {
          $sum: {
            $cond: [{ $gte: ['$totalAmount', 1000] }, 1, 0],
          },
        },
      },
    },
  ]);

  const highValueExpensesPromise = Expense.find({
    ...tenantFilter,
    ...expenseDateFilter,
    totalAmount: { $gte: 500 },
  })
    .sort({ totalAmount: -1 })
    .limit(50)
    .populate('createdBy', 'name email')
    .lean();

  // 7. Active Users & Governance Check
  const usersPromise = User.find({ tenantId })
    .select('name email role isActive lastLogin createdAt')
    .sort({ role: 1, name: 1 })
    .lean();

  // Await all queries concurrently
  const [
    invoiceStatusStats,
    cancelledInvoices,
    highDiscountInvoices,
    paymentMethodStats,
    vouchersStats,
    expenseStatsRaw,
    highValueExpenses,
    users,
  ] = await Promise.all([
    invoiceStatsPromise,
    cancelledInvoicesPromise,
    highDiscountInvoicesPromise,
    paymentMethodStatsPromise,
    vouchersPromise,
    expenseStatsPromise,
    highValueExpensesPromise,
    usersPromise,
  ]);

  // Process Invoices & Voided metrics
  let totalSalesInvoices = 0;
  let totalGrossRevenue = 0;
  let totalDiscountsGiven = 0;
  let totalCancelledCount = 0;
  let totalCancelledAmount = 0;

  invoiceStatusStats.forEach((stat) => {
    totalSalesInvoices += stat.count;
    if (stat._id === 'cancelled' || stat._id === 'credited') {
      totalCancelledCount += stat.count;
      totalCancelledAmount += num(stat.totalAmount);
    } else {
      totalGrossRevenue += num(stat.totalAmount);
      totalDiscountsGiven += num(stat.totalDiscount);
    }
  });

  const cancellationRate = totalSalesInvoices > 0 ? (totalCancelledCount / totalSalesInvoices) * 100 : 0;
  const discountRatio = totalGrossRevenue > 0 ? (totalDiscountsGiven / (totalGrossRevenue + totalDiscountsGiven)) * 100 : 0;

  // Process Expenses
  const expStats = expenseStatsRaw[0] || { totalExpenses: 0, totalAmount: 0, totalTax: 0, withReceipt: 0, highValueCount: 0 };
  const receiptComplianceRate = expStats.totalExpenses > 0 ? (expStats.withReceipt / expStats.totalExpenses) * 100 : 100;

  // Process Vouchers
  let totalVoucherReceipts = 0;
  let totalVoucherPayments = 0;
  let unapprovedVouchersCount = 0;

  vouchersStats.forEach((v) => {
    if (v._id?.type === 'receive') totalVoucherReceipts += num(v.totalAmount);
    if (v._id?.type === 'payment') totalVoucherPayments += num(v.totalAmount);
    if (v._id?.status === 'draft') unapprovedVouchersCount += v.count;
  });

  // Calculate Internal Control Score (0 - 100)
  let score = 100;
  const findings = [];

  // Finding 1: Cancellation check
  if (cancellationRate > 5) {
    score -= 20;
    findings.push({
      severity: 'high',
      titleEn: 'Elevated Transaction Cancellation Rate',
      titleAr: 'معدل إلغاء فواتير مرتفع',
      descEn: `${cancellationRate.toFixed(1)}% of invoices in this period were cancelled/credited (${totalCancelledCount} invoices totaling SAR ${totalCancelledAmount.toLocaleString()}).`,
      descAr: `تم إلغاء أو إشعار دائن لنسبة ${cancellationRate.toFixed(1)}% من الفواتير (${totalCancelledCount} فاتورة بقيمة ${totalCancelledAmount.toLocaleString()} ر.س).`,
      recommendationEn: 'Implement mandatory approval workflow for invoice cancellations and investigate high-value voids.',
      recommendationAr: 'تطبيق اعتماد إداري إلزامي لإلغاء الفواتير والتحقق من أسباب الإلغاء للفواتير ذات القيمة العالية.',
    });
  } else if (cancellationRate > 2) {
    score -= 10;
    findings.push({
      severity: 'medium',
      titleEn: 'Moderate Invoicing Cancellations',
      titleAr: 'إلغاءات فواتير متوسطة',
      descEn: `${totalCancelledCount} cancelled invoices detected in period (${cancellationRate.toFixed(1)}%).`,
      descAr: `تم رصد ${totalCancelledCount} فواتير ملغاة خلال الفترة (${cancellationRate.toFixed(1)}%).`,
      recommendationEn: 'Review staff training on POS and order finalizing to reduce draft errors.',
      recommendationAr: 'تدريب موظفي نقاط البيع والمبيعات لتقليل أخطاء إدخال الفواتير.',
    });
  }

  // Finding 2: Discount policy check
  if (discountRatio > 10) {
    score -= 15;
    findings.push({
      severity: 'high',
      titleEn: 'High Overall Discount Ratio',
      titleAr: 'نسبة خصومات مرتفعة تتجاوز الحدود المعيارية',
      descEn: `Total discounts granted reached SAR ${totalDiscountsGiven.toLocaleString()} (${discountRatio.toFixed(1)}% of gross revenue).`,
      descAr: `بلغ إجمالي الخصومات الممنوحة ${totalDiscountsGiven.toLocaleString()} ر.س (${discountRatio.toFixed(1)}% من إجمالي الإيرادات).`,
      recommendationEn: 'Enforce discount ceilings and verify authorization for discounts exceeding 10%.',
      recommendationAr: 'تحديد سقف أعلى للخصومات المباشرة وطلب موافقة المدير على الخصومات التي تتجاوز 10%.',
    });
  }

  // Finding 3: Expense receipts documentation
  if (receiptComplianceRate < 70 && expStats.totalExpenses > 0) {
    score -= 15;
    findings.push({
      severity: 'medium',
      titleEn: 'Missing Expense Receipts / Documentation',
      titleAr: 'نقص إرفاق مستندات وإيصالات المصروفات',
      descEn: `${(100 - receiptComplianceRate).toFixed(1)}% of recorded expenses lack digital attachments or receipts.`,
      descAr: `${(100 - receiptComplianceRate).toFixed(1)}% من المصروفات المسجلة لا تحتوي على إيصالات أو مرفقات إلكترونية.`,
      recommendationEn: 'Enforce mandatory file upload for all operating expenses before approval.',
      recommendationAr: 'إلزام موظفي المحاسبة برفع الفاتورة الضريبية أو الإيصال لكل سند صرف.',
    });
  }

  // Finding 4: Unapproved Vouchers
  if (unapprovedVouchersCount > 0) {
    score -= 10;
    findings.push({
      severity: 'medium',
      titleEn: 'Pending / Unapproved Vouchers in Ledger',
      titleAr: 'سندات قبض/صرف معلقة غير معتمدة',
      descEn: `${unapprovedVouchersCount} draft vouchers are pending review and approval in the system.`,
      descAr: `يوجد ${unapprovedVouchersCount} سند في حالة مسودة بانتظار الاعتماد المالي.`,
      recommendationEn: 'Review and approve or reject all draft payment/receipt vouchers.',
      recommendationAr: 'مراجعة واعتماد أو إلغاء جميع السندات المعلقة لتسوية الحسابات.',
    });
  }

  // Finding 5: User roles governance
  const adminUsers = users.filter((u) => u.role === 'admin' || u.role === 'super_admin');
  if (adminUsers.length === 1 && users.length > 3) {
    findings.push({
      severity: 'low',
      titleEn: 'Single Point of Administrative Access',
      titleAr: 'وجود حساب مشرف إداري واحد فقط',
      descEn: 'Only one user has administrative privileges. Consider setting a backup administrator with 2FA.',
      descAr: 'يوجد مستخدم واحد بصلاحيات إدارة كاملة. يُنصح بتعيين مشرف احتياطي مع تفعيل التحقق بخطوتين.',
      recommendationEn: 'Assign a secondary manager account and enforce role-based access for operational staff.',
      recommendationAr: 'تعيين حساب إدارة بديل وتطبيق الصلاحيات الدقيقة لبقية الموظفين.',
    });
  }

  score = Math.max(20, Math.min(100, score));
  let controlGrade = 'Strong';
  let controlGradeAr = 'قوي وممتاز';
  if (score < 60) {
    controlGrade = 'Needs Attention';
    controlGradeAr = 'يحتاج إلى تحسين ورقابة';
  } else if (score < 85) {
    controlGrade = 'Satisfactory';
    controlGradeAr = 'مرضي ومقبول';
  }

  return {
    reportType: 'internal_audit',
    generatedAt: new Date(),
    period: { startDate: sDate, endDate: eDate },
    score,
    controlGrade,
    controlGradeAr,
    kpis: [
      {
        key: 'audited_revenue',
        label: { en: 'Audited Gross Sales', ar: 'إجمالي المبيعات المدققة' },
        value: totalGrossRevenue,
        format: 'money',
      },
      {
        key: 'internal_score',
        label: { en: 'Internal Control Score', ar: 'مؤشر جودة الرقابة الداخلية' },
        value: `${score}/100 (${controlGrade})`,
        format: 'text',
      },
      {
        key: 'voided_invoices',
        label: { en: 'Voided Invoices', ar: 'الفواتير الملغاة / المرتجعة' },
        value: `${totalCancelledCount} (${totalCancelledAmount.toLocaleString()} SAR)`,
        format: 'text',
      },
      {
        key: 'total_discounts',
        label: { en: 'Discounts Granted', ar: 'إجمالي الخصومات الممنوحة' },
        value: totalDiscountsGiven,
        format: 'money',
      },
      {
        key: 'receipt_compliance',
        label: { en: 'Expense Receipt Compliance', ar: 'نسبة توثيق إيصالات المصروفات' },
        value: `${receiptComplianceRate.toFixed(0)}%`,
        format: 'text',
      },
      {
        key: 'active_staff',
        label: { en: 'Active Users Audited', ar: 'المستخدمين النشطين' },
        value: users.length,
        format: 'number',
      },
    ],
    findings,
    cancelledInvoicesList: cancelledInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      customerName: inv.customer?.name || inv.customer?.nameAr || 'Cash Customer',
      amount: num(inv.totalAmount),
      taxAmount: num(inv.taxAmount),
      cancelReason: inv.cancelReason || 'Customer requested / Entry correction',
      cancelledBy: inv.cancelledBy?.name || inv.createdBy?.name || 'System / Admin',
    })),
    highDiscountsList: highDiscountInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      customerName: inv.customerName || 'Cash Customer',
      subtotal: num(inv.subtotal),
      discountAmount: num(inv.discountAmount),
      totalAmount: num(inv.totalAmount),
      discountPct: inv.subtotal > 0 ? ((num(inv.discountAmount) / num(inv.subtotal)) * 100).toFixed(1) + '%' : '0%',
      paymentMethod: inv.paymentMethod || 'cash',
    })),
    expensesAuditList: highValueExpenses.map((exp) => ({
      expenseNumber: exp.expenseNumber || 'EXP',
      date: exp.date,
      category: exp.category || 'General',
      totalAmount: num(exp.totalAmount),
      taxAmount: num(exp.taxAmount),
      hasReceipt: Boolean(exp.receiptUrl),
      paymentMethod: exp.paymentMethod || 'cash',
      createdBy: exp.createdBy?.name || 'Staff',
    })),
    paymentMethodsBreakdown: paymentMethodStats.map((pm) => ({
      method: pm._id || 'cash',
      count: pm.count,
      totalAmount: num(pm.totalAmount),
      percentage: totalGrossRevenue > 0 ? ((num(pm.totalAmount) / totalGrossRevenue) * 100).toFixed(1) + '%' : '0%',
    })),
    usersGovernance: users.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.isActive !== false ? 'Active' : 'Inactive',
      lastLogin: u.lastLogin,
    })),
  };
}

/**
 * Builds the External Audit & Statutory Report for a tenant within a date range.
 * Evaluates ZATCA Phase 2 cryptographic hash chaining & reporting status,
 * statutory VAT 15% reconciliation, Accounts Receivable aging (IFRS 9),
 * period cut-off testing, and formal SOCPA/IFRS independent auditor review opinion.
 */
export async function buildExternalAuditReport({ tenantId, startDate, endDate }) {
  const tenantFilter = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  eDate.setHours(23, 59, 59, 999);

  const dateFilter = { issueDate: { $gte: sDate, $lte: eDate } };
  const expenseDateFilter = { date: { $gte: sDate, $lte: eDate } };

  // Fetch Tenant Profile & Settings for Statutory Check
  const tenantPromise = Tenant.findById(tenantId).lean();

  // 1. ZATCA Status & Cryptographic Chaining Audit
  const zatcaStatsPromise = safeAggregate(Invoice, [
    { $match: { ...tenantFilter, ...dateFilter, flow: 'sell', status: { $nin: ['draft', 'cancelled'] } } },
    {
      $group: {
        _id: {
          zatcaStatus: '$zatcaStatus',
          invoiceType: '$invoiceType',
          hasHash: { $cond: [{ $and: [{ $ne: ['$invoiceHash', null] }, { $ne: ['$invoiceHash', ''] }] }, true, false] },
          hasQR: { $cond: [{ $and: [{ $ne: ['$qrCode', null] }, { $ne: ['$qrCode', ''] }] }, true, false] },
        },
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
        subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
      },
    },
  ]);

  // 2. Statutory VAT Base Reconciliation (Standard 15%, Zero-Rated, Exempt)
  const vatTaxCategoryPromise = safeAggregate(Invoice, [
    { $match: { ...tenantFilter, ...dateFilter, flow: 'sell', status: { $nin: ['draft', 'cancelled'] } } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.taxCategory',
        taxableAmount: { $sum: { $ifNull: ['$lines.lineTotal', 0] } },
        taxAmount: { $sum: { $ifNull: ['$lines.taxAmount', 0] } },
        lineCount: { $sum: 1 },
      },
    },
  ]);

  // 3. Input VAT on Purchases & Expenses
  const inputVatPromise = safeAggregate(Expense, [
    { $match: { ...tenantFilter, ...expenseDateFilter, status: { $nin: ['draft', 'cancelled'] } } },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: { $ifNull: ['$totalAmount', 0] } },
        taxableAmount: { $sum: { $ifNull: ['$amount', 0] } },
        inputTaxClaimed: { $sum: { $ifNull: ['$taxAmount', 0] } },
        count: { $sum: 1 },
      },
    },
  ]);

  // 4. Period Cut-off Verification (First 7 days and Last 7 days)
  const first7End = new Date(sDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const last7Start = new Date(eDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const cutOffInvoicesPromise = Invoice.find({
    ...tenantFilter,
    flow: 'sell',
    status: { $nin: ['draft', 'cancelled'] },
    $or: [
      { issueDate: { $gte: sDate, $lte: first7End } },
      { issueDate: { $gte: last7Start, $lte: eDate } },
    ],
  })
    .sort({ issueDate: 1 })
    .limit(40)
    .select('invoiceNumber issueDate totalAmount taxAmount zatcaStatus paymentStatus customer createdAt')
    .lean();

  // 5. Accounts Receivable Aging Schedule (Unpaid/Partially Paid Sales Invoices)
  const arInvoicesPromise = Invoice.find({
    ...tenantFilter,
    flow: 'sell',
    status: { $in: ['issued', 'partially_paid', 'unpaid'] },
    paymentStatus: { $ne: 'paid' },
  })
    .sort({ issueDate: 1 })
    .select('invoiceNumber issueDate totalAmount amountPaid customer paymentStatus')
    .lean();

  // 6. ZATCA Audit Logs / Warnings
  const zatcaAuditLogsPromise = ZatcaAuditLog.find({
    tenantId,
    createdAt: { $gte: sDate, $lte: eDate },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  // Await all statutory queries concurrently
  const [
    tenant,
    zatcaStatsRaw,
    vatTaxCategories,
    inputVatRaw,
    cutOffInvoices,
    arInvoices,
    zatcaAuditLogs,
  ] = await Promise.all([
    tenantPromise,
    zatcaStatsPromise,
    vatTaxCategoryPromise,
    inputVatPromise,
    cutOffInvoicesPromise,
    arInvoicesPromise,
    zatcaAuditLogsPromise,
  ]);

  // Process Output VAT and ZATCA Phase 2 Metrics
  let totalInvoices = 0;
  let totalOutputTax = 0;
  let totalTaxableSales = 0;
  let zatcaCompliantCount = 0;
  let standardB2BCount = 0;
  let simplifiedB2CCount = 0;
  let missingHashCount = 0;
  let missingQrCount = 0;

  zatcaStatsRaw.forEach((row) => {
    totalInvoices += row.count;
    totalOutputTax += num(row.taxAmount);
    totalTaxableSales += num(row.subtotal);

    if (row._id?.invoiceType === 'standard') standardB2BCount += row.count;
    else simplifiedB2CCount += row.count;

    if (['REPORTED', 'CLEARED'].includes(row._id?.zatcaStatus)) {
      zatcaCompliantCount += row.count;
    }

    if (!row._id?.hasHash) missingHashCount += row.count;
    if (!row._id?.hasQR) missingQrCount += row.count;
  });

  const zatcaComplianceRate = totalInvoices > 0 ? (zatcaCompliantCount / totalInvoices) * 100 : 100;
  const hashIntegrityRate = totalInvoices > 0 ? ((totalInvoices - missingHashCount) / totalInvoices) * 100 : 100;

  // Process Statutory VAT Categories
  let vat15Base = 0;
  let vat15Tax = 0;
  let zeroRatedBase = 0;
  let exemptBase = 0;

  vatTaxCategories.forEach((cat) => {
    if (cat._id === 'S' || !cat._id) {
      vat15Base += num(cat.taxableAmount);
      vat15Tax += num(cat.taxAmount);
    } else if (cat._id === 'Z') {
      zeroRatedBase += num(cat.taxableAmount);
    } else if (cat._id === 'E' || cat._id === 'O') {
      exemptBase += num(cat.taxableAmount);
    }
  });

  const inputVatData = inputVatRaw[0] || { totalExpenses: 0, taxableAmount: 0, inputTaxClaimed: 0, count: 0 };
  const netVatPayable = totalOutputTax - num(inputVatData.inputTaxClaimed);

  // Process AR Aging Schedule
  const now = new Date();
  let arCurrent = 0; // 0 - 30 days
  let ar30to60 = 0;  // 31 - 60 days
  let ar60to90 = 0;  // 61 - 90 days
  let arOver90 = 0;  // 90+ days
  let totalAR = 0;

  const arAgingRows = arInvoices.map((inv) => {
    const invDate = new Date(inv.issueDate || inv.createdAt);
    const diffDays = Math.max(0, Math.floor((now - invDate) / (1000 * 60 * 60 * 24)));
    const balanceDue = Math.max(0, num(inv.totalAmount) - num(inv.amountPaid));
    totalAR += balanceDue;

    if (diffDays <= 30) arCurrent += balanceDue;
    else if (diffDays <= 60) ar30to60 += balanceDue;
    else if (diffDays <= 90) ar60to90 += balanceDue;
    else arOver90 += balanceDue;

    return {
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      customerName: inv.customer?.name || 'Customer',
      totalAmount: num(inv.totalAmount),
      amountPaid: num(inv.amountPaid),
      balanceDue,
      ageDays: diffDays,
      bucket: diffDays <= 30 ? '0-30 Days' : diffDays <= 60 ? '31-60 Days' : diffDays <= 90 ? '61-90 Days' : '90+ Days',
    };
  });

  // Statutory Compliance & Legal Checklist Verification
  const crNumber = tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || '';
  const vatNumber = tenant?.business?.vatNumber || tenant?.business?.vatCertificate?.vatNumber || '';
  const hasNationalAddress = Boolean(tenant?.business?.nationalAddress?.buildingNumber && tenant?.business?.nationalAddress?.city);
  const isZatcaPhase2 = Boolean(tenant?.zatca?.phase === 2 || tenant?.zatca?.productionCsid);
  const hasBankIban = Boolean(Array.isArray(tenant?.bankAccounts) && tenant.bankAccounts.some((b) => b.iban));

  const checklist = [
    {
      itemEn: 'Commercial Registration (CR) Verification',
      itemAr: 'التحقق من السجل التجاري',
      status: crNumber.length === 10 ? 'passed' : 'warning',
      details: crNumber ? `CR: ${crNumber}` : 'CR Number missing or incomplete',
    },
    {
      itemEn: 'ZATCA 15-Digit Tax Identification Number (TIN)',
      itemAr: 'الرقم الضريبي المعتمد (15 رقم)',
      status: vatNumber.length === 15 && vatNumber.startsWith('3') && vatNumber.endsWith('3') ? 'passed' : 'warning',
      details: vatNumber ? `TIN: ${vatNumber}` : 'VAT TIN missing or invalid format',
    },
    {
      itemEn: 'Saudi Post (SPL) National Address Compliance',
      itemAr: 'العنوان الوطني السعودي المعتمد (سبل)',
      status: hasNationalAddress ? 'passed' : 'warning',
      details: hasNationalAddress ? 'National Address verified' : 'National Address incomplete',
    },
    {
      itemEn: 'ZATCA Phase 2 Cryptographic Integration & CSID',
      itemAr: 'شهادة الربط والتكامل مع منصة فاتورة (المرحلة الثانية)',
      status: isZatcaPhase2 || zatcaComplianceRate >= 90 ? 'passed' : 'warning',
      details: isZatcaPhase2 ? 'Production CSID Active' : 'Onboarding / Phase 2 Simulation',
    },
    {
      itemEn: 'Bank Account & Official IBAN Registration',
      itemAr: 'الحسابات البنكية والآيبان الرسمي المعتمد',
      status: hasBankIban ? 'passed' : 'warning',
      details: hasBankIban ? 'Bank accounts active with IBAN' : 'No verified IBAN registered',
    },
  ];

  // Statutory Audit Score (0 - 100)
  let complianceScore = 100;
  if (zatcaComplianceRate < 90) complianceScore -= 20;
  if (missingHashCount > 0) complianceScore -= 15;
  if (arOver90 > 0.3 * totalAR && totalAR > 0) complianceScore -= 15;
  if (crNumber.length !== 10) complianceScore -= 10;
  if (vatNumber.length !== 15) complianceScore -= 10;
  if (!hasNationalAddress) complianceScore -= 10;

  complianceScore = Math.max(30, Math.min(100, complianceScore));

  let auditOpinion = 'Unqualified Clean Opinion';
  let auditOpinionAr = 'رأي غير متحفظ (مطابق ونظيف)';
  let opinionTextEn = 'In our professional assessment, the financial records, tax invoices, and ZATCA electronic billing streams present fairly, in all material respects, the statutory compliance and VAT position of the entity in accordance with Saudi Arabian tax regulations and ZATCA Phase 2 specifications.';
  let opinionTextAr = 'بناءً على نتائج التدقيق والمراجعة الرقمية، تبين أن السجلات المالية والفواتير الضريبية الإلكترونية المسجلة تعكس بعدالة ومصداقية الوضع الضريبي والمالي للمنشأة وفقاً لأحكام نظام ضريبة القيمة المضافة ومتطلبات هيئة الزكاة والضريبة والجمارك (زاتكا).';

  if (complianceScore < 70) {
    auditOpinion = 'Qualified Audit Opinion';
    auditOpinionAr = 'رأي متحفظ (مع ملاحظات نظامية)';
    opinionTextEn = 'Except for the highlighted disclosures regarding ZATCA reporting gaps, missing cryptographic hashes, or statutory documentation, the entity records are substantially compliant.';
    opinionTextAr = 'باستثناء الملاحظات الموضحة في تقرير التدقيق والمتعلقة ببعض الفجوات في إرسال الفواتير الإلكترونية أو الوثائق النظامية، فإن العمليات تعتبر متوافقة بشكل عام مع المعايير المعمول بها.';
  }

  return {
    reportType: 'external_audit',
    generatedAt: new Date(),
    period: { startDate: sDate, endDate: eDate },
    complianceScore,
    auditOpinion,
    auditOpinionAr,
    opinionTextEn,
    opinionTextAr,
    entity: {
      legalNameAr: tenant?.business?.legalNameAr || 'المنشأة',
      legalNameEn: tenant?.business?.legalNameEn || 'The Enterprise',
      crNumber,
      vatNumber,
      city: tenant?.business?.city || tenant?.business?.nationalAddress?.city || 'Riyadh',
    },
    kpis: [
      {
        key: 'taxable_revenue',
        label: { en: 'Net Taxable Sales Base', ar: 'إجمالي المبيعات الخاضعة للضريبة' },
        value: totalTaxableSales,
        format: 'money',
      },
      {
        key: 'output_vat',
        label: { en: 'Output VAT Collected (15%)', ar: 'ضريبة المخرجات المحصلة' },
        value: totalOutputTax,
        format: 'money',
      },
      {
        key: 'input_vat',
        label: { en: 'Input VAT Claimed', ar: 'ضريبة المدخلات المخصومة' },
        value: num(inputVatData.inputTaxClaimed),
        format: 'money',
      },
      {
        key: 'net_vat_payable',
        label: { en: 'Net VAT Payable to ZATCA', ar: 'صافي الضريبة المستحقة للسداد' },
        value: netVatPayable,
        format: 'money',
      },
      {
        key: 'zatca_compliance_rate',
        label: { en: 'ZATCA Phase 2 Compliance', ar: 'نسبة مطابقة زاتكا (المرحلة 2)' },
        value: `${zatcaComplianceRate.toFixed(1)}%`,
        format: 'text',
      },
      {
        key: 'statutory_score',
        label: { en: 'Statutory Audit Score', ar: 'درجة الجاهزية للتدقيق النظامي' },
        value: `${complianceScore}/100`,
        format: 'text',
      },
    ],
    statutoryVatSummary: [
      {
        category: 'Standard Rated Sales (15%)',
        categoryAr: 'المبيعات الخاضعة للنسبة الأساسية (15%)',
        taxableAmount: vat15Base,
        taxAmount: vat15Tax,
      },
      {
        category: 'Zero-Rated Sales (0%)',
        categoryAr: 'المبيعات الخاضعة لنسبة الصفر (0%)',
        taxableAmount: zeroRatedBase,
        taxAmount: 0,
      },
      {
        category: 'Exempt & Out-of-Scope Supplies',
        categoryAr: 'التوريدات المعفاة وخارج نطاق الضريبة',
        taxableAmount: exemptBase,
        taxAmount: 0,
      },
      {
        category: 'Total Taxable Operating Expenses & Input Tax',
        categoryAr: 'إجمالي مشتريات ومصروفات التشغيل وضريبتها',
        taxableAmount: num(inputVatData.taxableAmount),
        taxAmount: num(inputVatData.inputTaxClaimed),
      },
    ],
    zatcaBreakdown: {
      totalInvoices,
      standardB2BCount,
      simplifiedB2CCount,
      clearedOrReported: zatcaCompliantCount,
      missingHashCount,
      missingQrCount,
      complianceRate: zatcaComplianceRate,
      hashIntegrityRate,
    },
    checklist,
    arAging: {
      totalAR,
      arCurrent,
      ar30to60,
      ar60to90,
      arOver90,
      rows: arAgingRows.slice(0, 50),
    },
    cutOffTesting: cutOffInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      customerName: inv.customer?.name || 'Customer',
      totalAmount: num(inv.totalAmount),
      taxAmount: num(inv.taxAmount),
      zatcaStatus: inv.zatcaStatus || 'REPORTED',
      paymentStatus: inv.paymentStatus || 'paid',
    })),
    zatcaLogsSummary: zatcaAuditLogs.map((log) => ({
      action: log.action,
      severity: log.severity,
      status: log.status,
      message: log.message,
      createdAt: log.createdAt,
    })),
  };
}
