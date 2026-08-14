try {
  printjson(rs.add({ host: 'mongo-secondary:27017', priority: 0, votes: 0 }));
} catch (e) {
  print(String(e.message || e));
}
printjson((rs.status().members || []).map((m) => ({ name: m.name, stateStr: m.stateStr, health: m.health })));
