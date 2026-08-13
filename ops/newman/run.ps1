# Fill ops/newman/env.example.json then:
npx newman run ops/newman/tenant-isolation.postman_collection.json `
  -e ops/newman/env.example.json --bail
