/** Halala rounding — 2 decimal places, SAR fils / halalas. */
export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Same formula as Invoice pre-validate: round after qty×rate, not IEEE leftover. */
export function vatHalala(taxable, rate = 15) {
  return roundMoney((Number(taxable) || 0) * (Number(rate) || 0) / 100);
}

export default { roundMoney, vatHalala };
