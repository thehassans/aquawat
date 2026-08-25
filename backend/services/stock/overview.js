/**
 * Bucket pickings into N calendar days starting at `fromDate` (local midnight).
 */
export function bucketScheduledByDay(pickings, fromDate = new Date(), days = 7) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      count: 0,
    });
  }

  const indexByDate = new Map(buckets.map((b, i) => [b.date, i]));
  for (const p of pickings || []) {
    if (!p.scheduledDate) continue;
    const d = new Date(p.scheduledDate);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx != null) buckets[idx].count += 1;
  }
  return buckets;
}
