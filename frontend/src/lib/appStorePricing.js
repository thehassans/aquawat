/** Yearly plans bill 10 months so tenants get 2 months free (~17% off). */
export const YEARLY_BILLED_MONTHS = 10;

export function resolveAppPrices(app) {
  const monthly = Number(app?.monthlyPrice || 0) || 0;
  let yearly = Number(app?.yearlyPrice || 0) || 0;
  if (yearly <= 0 && monthly > 0) yearly = monthly * YEARLY_BILLED_MONTHS;
  return { monthly, yearly };
}

export function yearlySavingsPercent(monthly, yearly) {
  if (!(monthly > 0 && yearly > 0)) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

export function formatMoneyAmount(amount, currency = 'SAR') {
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  const formatted = n % 1 ? n.toFixed(2) : String(Math.round(n));
  return `${currency} ${formatted}`;
}
