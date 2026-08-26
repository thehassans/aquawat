import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * Hard validation: sold products need income; purchased/expensed need expense
 * (product override or category inheritance).
 */
export async function assertProductAccountingAccounts(tenantId, productLike = {}) {
  const tid = toObjectId(tenantId);
  const canBeSold = productLike.canBeSold !== false;
  const canBePurchased = !!productLike.canBePurchased;
  const canBeExpensed = !!productLike.canBeExpensed;

  let category = null;
  if (productLike.categoryId) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    category = await InvProductCategory.findOne({ _id: productLike.categoryId, tenantId: tid })
      .select('incomeAccountId expenseAccountId')
      .lean();
  }

  const hasIncome = !!(productLike.incomeAccountId || category?.incomeAccountId);
  const hasExpense = !!(productLike.expenseAccountId || category?.expenseAccountId);

  const missing = [];
  if (canBeSold && !hasIncome) missing.push('incomeAccountId');
  if ((canBePurchased || canBeExpensed) && !hasExpense) missing.push('expenseAccountId');

  if (!missing.length) return;

  throw new InventoryValidationError(
    canBeSold && !hasIncome && (canBePurchased || canBeExpensed) && !hasExpense
      ? 'Set income and expense accounts on the product or its category'
      : (!hasIncome
        ? 'Sold products require an income account on the product or category'
        : 'Purchased/expensed products require an expense account on the product or category'),
    'PRODUCT_ACCOUNTS_REQUIRED',
    { details: { missing } },
  );
}
