import express from 'express';
import Employee from '../models/Employee.js';
import Invoice from '../models/Invoice.js';
import { protect, tenantFilter } from '../middleware/auth.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);

// Iqama/Saudization/ZATCA compliance tracking only applies to Saudi
// (SAR-denominated) tenants.
router.use((req, res, next) => {
  if (!isZatcaCurrency(req.tenant)) {
    return res.status(400).json({ error: 'Saudi compliance tracking (Iqama/Saudization/ZATCA) only applies to SAR-denominated tenants.' });
  }
  next();
});

// ─── Overview ──────────────────────────────────────────────────────────────────

router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const day14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Iqama alerts
    const iqamaEmployees = await Employee.find({
      ...req.tenantFilter,
      isActive: true,
      nationalIdType: 'iqama',
      nationalIdExpiry: { $gte: now, $lte: day60 }
    })
      .select('_id firstNameEn lastNameEn firstNameAr lastNameAr employeeId nationality nationalIdExpiry nationalIdExpiryHijri department position')
      .lean();

    const iqamaAlerts = { critical: [], warning: [], upcoming: [] };
    iqamaEmployees.forEach(emp => {
      const daysUntilExpiry = Math.ceil((new Date(emp.nationalIdExpiry) - now) / (1000 * 60 * 60 * 24));
      const enriched = { ...emp, daysUntilExpiry };
      if (daysUntilExpiry <= 14) iqamaAlerts.critical.push(enriched);
      else if (daysUntilExpiry <= 30) iqamaAlerts.warning.push(enriched);
      else iqamaAlerts.upcoming.push(enriched);
    });

    // Document alerts (work permits, passports, etc.)
    const docEmployees = await Employee.find({
      ...req.tenantFilter,
      isActive: true,
      'documents.expiryDate': { $gte: now, $lte: day60 }
    })
      .select('_id firstNameEn lastNameEn employeeId nationality documents department')
      .lean();

    const documentAlerts = { critical: [], warning: [], upcoming: [] };
    docEmployees.forEach(emp => {
      (emp.documents || []).forEach(doc => {
        if (!doc.expiryDate) return;
        const expiry = new Date(doc.expiryDate);
        if (expiry < now || expiry > day60) return;
        const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        const item = {
          employeeId: emp.employeeId,
          employeeName: `${emp.firstNameEn} ${emp.lastNameEn}`,
          _id: emp._id,
          docType: doc.type,
          docNumber: doc.number,
          expiryDate: doc.expiryDate,
          expiryDateHijri: doc.expiryDateHijri,
          daysUntilExpiry
        };
        if (daysUntilExpiry <= 14) documentAlerts.critical.push(item);
        else if (daysUntilExpiry <= 30) documentAlerts.warning.push(item);
        else documentAlerts.upcoming.push(item);
      });
    });

    // ZATCA status from tenant
    const zatca = req.tenant?.zatca || {};
    const zatcaStatus = {
      isOnboarded: zatca.isOnboarded || false,
      invoiceCounter: zatca.invoiceCounter || 0,
      onboardedAt: zatca.onboardedAt || null,
      hasProductionCsid: !!(zatca.productionCsid)
    };

    // Workforce summary
    const [totalActive, saudiCount] = await Promise.all([
      Employee.countDocuments({ ...req.tenantFilter, isActive: true, status: { $nin: ['terminated', 'resigned'] } }),
      Employee.countDocuments({ ...req.tenantFilter, isActive: true, nationality: 'SA', status: { $nin: ['terminated', 'resigned'] } })
    ]);
    const nonSaudi = totalActive - saudiCount;
    const saudizationPercent = totalActive > 0 ? Math.round((saudiCount / totalActive) * 100 * 10) / 10 : 0;

    // Fleet registration expiries (optional - graceful if model doesn't exist)
    let registrationExpiries = [];
    try {
      const { default: FleetAsset } = await import('../models/FleetAsset.js');
      registrationExpiries = await FleetAsset.find({
        ...req.tenantFilter,
        isActive: true,
        registrationExpiry: { $gte: now, $lte: day60 }
      }).select('name assetNumber registrationNumber registrationExpiry').lean();
      registrationExpiries = registrationExpiries.map(a => ({
        ...a,
        daysUntilExpiry: Math.ceil((new Date(a.registrationExpiry) - now) / (1000 * 60 * 60 * 24))
      }));
    } catch (_) {
      registrationExpiries = [];
    }

    res.json({
      iqamaAlerts,
      documentAlerts,
      zatcaStatus,
      workforceSummary: { total: totalActive, saudi: saudiCount, nonSaudi, saudizationPercent },
      registrationExpiries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Iqama Alerts (paginated) ─────────────────────────────────────────────────

router.get('/iqama-alerts', async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const now = new Date();
    const day90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const query = {
      ...req.tenantFilter,
      isActive: true,
      nationalIdType: 'iqama',
      nationalIdExpiry: { $gte: now, $lte: day90 }
    };

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .sort({ nationalIdExpiry: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('employeeId firstNameEn lastNameEn firstNameAr lastNameAr nationality nationalIdExpiry nationalIdExpiryHijri department position'),
      Employee.countDocuments(query)
    ]);

    const enriched = employees.map(emp => {
      const daysUntilExpiry = Math.ceil((new Date(emp.nationalIdExpiry) - now) / (1000 * 60 * 60 * 24));
      return { ...emp.toObject(), daysUntilExpiry };
    });

    res.json({ employees: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Workforce Summary ────────────────────────────────────────────────────────

router.get('/workforce-summary', async (req, res) => {
  try {
    const saudizationTarget = parseFloat(req.query.target) || 30;
    const activeFilter = { ...req.tenantFilter, isActive: true, status: { $nin: ['terminated', 'resigned'] } };

    const [nationalityBreakdown, total, saudiCount] = await Promise.all([
      Employee.aggregate([
        { $match: activeFilter },
        { $group: { _id: '$nationality', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Employee.countDocuments(activeFilter),
      Employee.countDocuments({ ...activeFilter, nationality: 'SA' })
    ]);

    const saudizationPercent = total > 0 ? Math.round((saudiCount / total) * 100 * 10) / 10 : 0;

    res.json({
      total,
      saudi: saudiCount,
      nonSaudi: total - saudiCount,
      saudizationPercent,
      saudizationTarget,
      meetingTarget: saudizationPercent >= saudizationTarget,
      nationalityBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ZATCA Status ─────────────────────────────────────────────────────────────

router.get('/zatca-status', async (req, res) => {
  try {
    const zatca = req.tenant?.zatca || {};

    // Count B2C invoices pending ZATCA reporting (sample, not full scan)
    let pendingB2CCount = 0;
    try {
      pendingB2CCount = await Invoice.countDocuments({
        tenantId: req.user.tenantId,
        invoiceType: 'B2C',
        zatcaStatus: { $ne: 'reported' }
      });
    } catch (_) {}

    res.json({
      isOnboarded: zatca.isOnboarded || false,
      invoiceCounter: zatca.invoiceCounter || 0,
      onboardedAt: zatca.onboardedAt || null,
      hasProductionCsid: !!(zatca.productionCsid),
      certificateSerialNumber: zatca.certificateSerialNumber || null,
      certificateValid: zatca.isOnboarded || false,
      pendingB2CCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
