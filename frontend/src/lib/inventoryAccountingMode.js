/** Mirrors backend/services/inventory/accountingMode.js */

export function resolveInventoryAccountingMode(settings = {}) {
  if (['ops_only', 'costing', 'full_accounting'].includes(settings.inventoryAccountingMode)) {
    return settings.inventoryAccountingMode
  }
  const evaluationOn = settings.inventoryEvaluationEnabled !== false
  const stockGlOn = settings.stockAccountingEnabled !== false
  if (evaluationOn && stockGlOn) return 'full_accounting'
  if (evaluationOn && !stockGlOn) return 'costing'
  return 'ops_only'
}

export function isFullInventoryAccounting(settings) {
  return resolveInventoryAccountingMode(settings) === 'full_accounting'
}

export function isInventoryEvaluationOn(settings) {
  const mode = resolveInventoryAccountingMode(settings)
  return mode === 'costing' || mode === 'full_accounting'
}

export function isStockGlOn(settings) {
  return resolveInventoryAccountingMode(settings) === 'full_accounting'
}

export const ACCOUNTING_MODE_OPTIONS = [
  {
    id: 'ops_only',
    en: 'Stock operations only',
    ar: 'عمليات المخزون فقط',
    hintEn: 'Quantities and transfers. No cost layers, no inventory journals.',
    hintAr: 'كميات وتحويلات فقط. بلا طبقات تكلفة وبلا قيود مخزون.',
  },
  {
    id: 'costing',
    en: 'Costing without GL',
    ar: 'تكلفة بدون قيود محاسبية',
    hintEn: 'AVCO / FIFO layers for reports. Sales still use income accounts; no stock journals.',
    hintAr: 'طبقات متوسط/FIFO للتقارير. المبيعات تستخدم حساب الإيراد؛ بلا قيود مخزون.',
  },
  {
    id: 'full_accounting',
    en: 'Full inventory accounting (Anglo-Saxon)',
    ar: 'محاسبة مخزون كاملة (أنجلو ساكسون)',
    hintEn: 'Posts inventory journals on receipt/delivery: valuation ↔ interim / COGS.',
    hintAr: 'ترحيل قيود المخزون عند الاستلام والصرف: تقييم ↔ وسيط / تكلفة البضاعة.',
  },
]
