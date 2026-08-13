/**
 * Read preference for heavy aggregations (dashboard, stats, VAT).
 * secondaryPreferred uses a secondary when a replica set exists and
 * falls back to primary on standalone / single-node rs0.
 */
export function statsReadPreference() {
  return process.env.MONGODB_STATS_READ_PREFERENCE || 'secondaryPreferred';
}

export function statsRead(queryOrAggregate) {
  const pref = statsReadPreference();
  if (queryOrAggregate && typeof queryOrAggregate.read === 'function') {
    return queryOrAggregate.read(pref);
  }
  return queryOrAggregate;
}

export function statsAggregate(model, pipeline) {
  return statsRead(model.aggregate(pipeline));
}

export default { statsReadPreference, statsRead };
