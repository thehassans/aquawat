import express from 'express';
import { protect, checkPermission, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { filterInventoryMenu } from '../services/inventory/menu.js';
import { ensureInventoryBootstrap } from '../services/inventory/bootstrap.js';
import { getInvSettings } from '../services/inventory/settingsService.js';

const router = express.Router();
router.use(protect, tenantFilter, requireTenantFilter);

async function loadSettings(req) {
  try {
    await ensureInventoryBootstrap(req.user.tenantId, req.user._id);
  } catch {
    /* optional */
  }
  try {
    const settings = await getInvSettings(req.user.tenantId);
    return settings?.toObject ? settings.toObject() : (settings || {});
  } catch {
    return {};
  }
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
