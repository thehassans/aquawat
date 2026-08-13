/** Halala rounding — 2 decimal places, SAR fils / halalas. */
export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default { roundMoney };
