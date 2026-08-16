try {
  printjson(rs.remove('mongo-secondary:27017'));
} catch (e) {
  print(String(e.message || e));
}
printjson({
  writable: db.hello().isWritablePrimary,
  members: (rs.status().members || []).map((m) => ({
    name: m.name,
    stateStr: m.stateStr,
    health: m.health,
    uptime: m.uptime,
  })),
});
