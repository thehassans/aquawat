import express from 'express';
import CarrierConnector from '../models/sales/CarrierConnector.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { shopShippingRates } from '../services/sales/shippingRateShop.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

/** Blueprint: POST /api/shipping/rates */
router.post('/rates', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const connectors = await CarrierConnector.find({ ...req.tenantFilter, isActive: true }).lean();
    const rates = await shopShippingRates({ connectors, payload: req.body });
    res.json({ rates });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
