export const clampLimit = (value, { def = 50, max = 100 } = {}) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, max);
};
