import { AsyncLocalStorage } from 'node:async_hooks';

export const invQueryStore = new AsyncLocalStorage();

const COUNTED = /^(find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|updateOne|updateMany|deleteOne|deleteMany|countDocuments|estimatedDocumentCount|aggregate|distinct|replaceOne|create|insertMany|bulkWrite|save)/;

/**
 * Mongoose plugin — increments per-request DB round-trip counter when ALS is active.
 */
export function invQueryCounterPlugin(schema) {
  const bump = function bumpQueryCount() {
    const store = invQueryStore.getStore();
    if (store) store.count += 1;
  };

  schema.pre(COUNTED, bump);
  schema.pre('aggregate', bump);
}

/**
 * Mount on /api/stock after auth.
 * Enable with INV_QUERY_BUDGET=1 (or always in test).
 * Fail the request when INV_QUERY_BUDGET_FAIL=1 and count > max (default 10).
 */
export function stockQueryBudget({ max = 10 } = {}) {
  const enabled = process.env.INV_QUERY_BUDGET === '1'
    || process.env.NODE_ENV === 'test'
    || process.env.INV_QUERY_BUDGET_FAIL === '1';

  return function stockQueryBudgetMiddleware(req, res, next) {
    if (!enabled) return next();

    invQueryStore.run({ count: 0, path: req.path }, () => {
      const originalJson = res.json.bind(res);
      res.json = function budgetJson(body) {
        const store = invQueryStore.getStore();
        const count = store?.count || 0;
        res.setHeader('X-Inv-Query-Count', String(count));
        if (process.env.INV_QUERY_BUDGET_FAIL === '1' && count > max) {
          res.statusCode = 500;
          return originalJson({
            error: `Endpoint exceeded DB query budget (${count}/${max})`,
            code: 'QUERY_BUDGET',
            meta: { count, max, path: req.path },
          });
        }
        return originalJson(body);
      };
      next();
    });
  };
}

export function currentQueryCount() {
  return invQueryStore.getStore()?.count ?? 0;
}
