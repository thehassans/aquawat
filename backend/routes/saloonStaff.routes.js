import express from 'express';
import SaloonStaff from '../models/SaloonStaff.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('saloon'));

// @route   GET /api/saloon/staff
router.get('/', checkPermission('saloon', 'read'), async (req, res) => {
  try {
    const staff = await SaloonStaff.find({ tenantId: req.user.tenantId });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/saloon/staff
router.post('/', checkPermission('saloon', 'write'), async (req, res) => {
  try {
    const newStaff = new SaloonStaff({
      ...req.body,
      tenantId: req.user.tenantId
    });
    await newStaff.save();
    res.status(201).json(newStaff);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
