import express from 'express';
import { protect, checkPermission, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { InvSettings } from '../models/inventory/index.js';
import { filterInventoryMenu } from '../services/inventory/menu.js';
import { ensureInventoryBootstrap } from '../services/inventory/bootstrap.js';

const router = express.Router();
router.use(protect, tenantFilter, requireTenantFilter);

async function loadSettings(req) {
  let settings = await InvSettings.findOne({ ...req.tenantFilter }).lean();
  if (!settings) {
    try {
      await ensureInventoryBootstrap(req.user.tenantId, req.user._id);
    } catch {
      /* optional */
    }
    settings = await InvSettings.findOne({ ...req.tenantFilter }).lean();
  }
  return settings || {};
}

/** Filtered menu tree for the inventory shell (v2 IA). */
router.get('/menu', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await loadSettings(req);
    const items = filterInventoryMenu(settings, req.user);
    res.json({ items, settingsVersion: settings.version ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
