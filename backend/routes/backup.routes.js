import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import { clampLimit } from '../utils/pagination.js';

const router = express.Router();

router.use(protect, authorize('admin'));

/** Streamed/chunked export — never load unbounded tenant datasets into memory. */
router.get('/export', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user, req);
    const pageSize = clampLimit(req.query.pageSize, { def: 200, max: 500 });

    const loadAll = async (Model, projection) => {
      const rows = [];
      let skip = 0;
      for (;;) {
        const batch = await Model.find({ tenantId })
          .select(projection)
          .sort({ _id: 1 })
          .skip(skip)
          .limit(pageSize)
          .lean();
        if (!batch.length) break;
        rows.push(...batch);
        skip += batch.length;
        if (batch.length < pageSize) break;
        // Soft cap to protect memory on huge tenants
        if (rows.length >= 50_000) break;
      }
      return rows;
    };

    const [invoices, customers, expenses] = await Promise.all([
      loadAll(Invoice, '-__v'),
      loadAll(Customer, '-__v'),
      loadAll(Expense, '-__v'),
    ]);

    const backupData = {
      tenantId: String(tenantId),
      timestamp: new Date().toISOString(),
      truncated: invoices.length >= 50_000 || customers.length >= 50_000 || expenses.length >= 50_000,
      data: { invoices, customers, expenses },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=backup-${new Date().toISOString().split('T')[0]}.json`
    );
    res.send(JSON.stringify(backupData));
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: 'Backup export failed' });
  }
});

export default router;
