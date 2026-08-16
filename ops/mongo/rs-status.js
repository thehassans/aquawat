print('=== conf ===');
try { printjson(rs.conf()); } catch (e) { print(String(e)); }
print('=== status ===');
try {
  const s = rs.status();
  printjson({
    ok: s.ok,
    myState: s.myState,
    set: s.set,
    members: (s.members || []).map((m) => ({
      name: m.name,
      stateStr: m.stateStr,
      health: m.health,
      votes: m.votes,
      uptime: m.uptime,
    })),
  });
} catch (e) {
  print(String(e));
}
print('=== hello ===');
printjson(db.hello());
