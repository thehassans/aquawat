import express from 'express';
import { protect, tenantFilter, requireTenantFilter, requireBusinessType } from '../middleware/auth.js';
import PharmacyDispense from '../models/PharmacyDispense.js';
import BakalaProduct from '../models/BakalaProduct.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('pharmacy'));

router.get('/dispenses', async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.controlled === 'true') filter.hasControlled = true;
    if (req.query.rx === 'true') filter.hasPrescription = true;
    const q = String(req.query.search || '').trim();
    if (q) {
      filter.$or = [
        { patientName: { $regex: q, $options: 'i' } },
        { prescriptionNumber: { $regex: q, $options: 'i' } },
        { invoiceNumber: { $regex: q, $options: 'i' } },
      ];
    }
    const rows = await PharmacyDispense.find(filter).sort('-dispensedAt').limit(200).lean();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const [products, rxCount, controlledCount] = await Promise.all([
      BakalaProduct.aggregate([
        { $match: { tenantId, isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            rx: { $sum: { $cond: ['$requiresPrescription', 1, 0] } },
            controlled: { $sum: { $cond: ['$isControlled', 1, 0] } },
            expiring: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$expiryDate', null] }, { $lte: ['$expiryDate', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      PharmacyDispense.countDocuments({ tenantId, hasPrescription: true }),
      PharmacyDispense.countDocuments({ tenantId, hasControlled: true }),
    ]);
    res.json({
      catalog: products[0] || { total: 0, rx: 0, controlled: 0, expiring: 0 },
      prescriptions: rxCount,
      controlledDispenses: controlledCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
