/**
 * mongosh diagnostics — replica routing, invoice covering index, cursor vs skip.
 *
 *   mongosh "$MONGO_URI" --file ops/mongo/explain-diagnostics.js
 *
 * Set TENANT_ID to a 24-hex tenant ObjectId.
 */
const tenantId = process.env.TENANT_ID;
if (!tenantId) {
  print('Set TENANT_ID to a 24-hex ObjectId');
  quit(1);
}

const dbName = process.env.DB_NAME || 'maqder';
const dbh = db.getSiblingDB(dbName);
const oid = ObjectId(tenantId);

print('\n=== replica set ===');
try {
  printjson(rs.status().members.map((m) => ({ name: m.name, stateStr: m.stateStr, health: m.health })));
} catch (e) {
  print('rs.status() failed (standalone?):', e.message);
}

print('\n=== hello readPreference ===');
printjson(db.runCommand({ hello: 1 }));

print('\n=== stats aggregate readPreference (secondaryPreferred) ===');
const statsExplain = dbh.invoices.explain('executionStats').aggregate(
  [
    { $match: { tenantId: oid } },
    { $group: { _id: '$status', n: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
  ],
  { readPreference: 'secondaryPreferred' }
);
printjson({
  ok: statsExplain.ok,
  serverInfo: statsExplain.serverInfo || statsExplain.serverResponse?.info,
  stages: (statsExplain.stages || statsExplain.queryPlanner?.winningPlan || 'see full explain'),
});

print('\n=== list query: tenantId+flow+status+issueDate, NO skip ===');
const listExplain = dbh.invoices
  .find({ tenantId: oid, flow: 'sell', status: 'approved' })
  .sort({ issueDate: -1, _id: -1 })
  .limit(20)
  .explain('executionStats');

const winning = listExplain.queryPlanner?.winningPlan || {};
function walk(plan, acc = []) {
  if (!plan) return acc;
  if (plan.indexName) acc.push(plan.indexName);
  if (plan.inputStage) walk(plan.inputStage, acc);
  if (Array.isArray(plan.inputStages)) plan.inputStages.forEach((s) => walk(s, acc));
  return acc;
}
printjson({
  indexesUsed: walk(winning),
  winningStage: winning.stage,
  totalDocsExamined: listExplain.executionStats?.totalDocsExamined,
  totalKeysExamined: listExplain.executionStats?.totalKeysExamined,
  nReturned: listExplain.executionStats?.nReturned,
});

print('\n=== skip/limit plan (legacy page=2) — compare examined docs ===');
const skipExplain = dbh.invoices
  .find({ tenantId: oid, flow: 'sell' })
  .sort({ issueDate: -1, _id: -1 })
  .skip(40)
  .limit(20)
  .explain('executionStats');
printjson({
  indexesUsed: walk(skipExplain.queryPlanner?.winningPlan || {}),
  totalDocsExamined: skipExplain.executionStats?.totalDocsExamined,
  nReturned: skipExplain.executionStats?.nReturned,
});

print('\nPass: list indexesUsed includes tenantId_1_flow_1_status_1_issueDate_-1 (or tenantId_1_issueDate_-1__id_-1).');
print('Pass: skip plan examines more docs than cursor/limit plan at the same page depth.');
print('Pass: hello / explain serverInfo.primary is false or hosts a secondary when rs0 has a healthy secondary.');
