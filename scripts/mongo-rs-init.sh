#!/bin/sh
# Initiate rs0 and add a votes:0 read secondary.
# votes:0 so a down secondary cannot take the replica set read-only.
set -e

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if mongosh --quiet --host mongo:27017 --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

mongosh --quiet --host mongo:27017 --eval '
  const secondary = "mongo-secondary:27017";
  const cfg = {
    _id: "rs0",
    members: [
      { _id: 0, host: "mongo:27017", priority: 1 },
      { _id: 1, host: secondary, priority: 0, votes: 0 }
    ]
  };
  try {
    const s = rs.status();
    const hosts = (s.members || []).map((m) => m.name);
    if (!hosts.some((h) => h.indexOf("mongo-secondary") !== -1)) {
      rs.add({ host: secondary, priority: 0, votes: 0 });
      print("rs.add mongo-secondary");
    } else {
      print("replica set already has secondary");
    }
  } catch (e) {
    rs.initiate(cfg);
    print("rs.initiate rs0");
  }
'
