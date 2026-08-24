import StockSettings from '../models/stock/StockSettings.js';

/**
 * Block legacy direct stock mutations when the stock engine is enabled for the tenant.
 */
export async function blockLegacyStockIfEngineEnabled(req, res, next) {
  try {
    const settings = await StockSettings.findOne({ tenantId: req.user.tenantId }).lean();
    // Only block when stock engine has been explicitly bootstrapped for this tenant
    if (settings?.engineEnabled === true) {
      return res.status(403).json({
        error: 'Direct stock mutations are disabled. Use the Inventory transfer engine (/api/stock/pickings).',
        code: 'STOCK_ENGINE_ENABLED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}
