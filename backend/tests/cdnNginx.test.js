import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');

test('Nginx hashed /assets/ send Cloudflare CDN cache headers', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  assert.match(conf, /location \/assets\//);
  assert.match(conf, /CDN-Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(conf, /Cloudflare-CDN-Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(conf, /include \/etc\/nginx\/cloudflare-realip.conf;/);
});

test('index.html is not cached at the CDN', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  assert.match(conf, /location = \/index.html/);
  assert.match(conf, /CDN-Cache-Control "no-store"/);
});

test('nginx.conf braces are balanced (invalid config takes the origin offline)', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  const stripped = conf.replace(/#[^\n]*/g, '');
  let depth = 0;
  for (const ch of stripped) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    assert.ok(depth >= 0, 'closing brace without opener');
  }
  assert.equal(depth, 0);
  const apiAuthCount = (conf.match(/proxy_pass\s+http:\/\/backend_pool\/api\/auth\//g) || []).length;
  const apiCount = (conf.match(/proxy_pass\s+http:\/\/backend_pool\/api\/;/g) || []).length;
  assert.equal(apiAuthCount, 1);
  assert.equal(apiCount, 1);
  assert.match(conf, /location \/api\/auth\/ \{/);
  assert.match(conf, /location \/api\/ \{/);
  assert.doesNotMatch(conf, /location \/api\/ \{[\s\S]*location \/api\/auth\//);
});

test('Cloudflare real-ip list includes published IPv4 and IPv6 prefixes', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'cloudflare-realip.conf'), 'utf8');
  assert.match(conf, /set_real_ip_from 104\.16\.0\.0\/13;/);
  assert.match(conf, /set_real_ip_from 2400:cb00::\/32;/);
  assert.match(conf, /real_ip_header CF-Connecting-IP;/);
});
