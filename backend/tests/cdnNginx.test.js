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

test('Cloudflare real-ip list includes published IPv4 and IPv6 prefixes', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'cloudflare-realip.conf'), 'utf8');
  assert.match(conf, /set_real_ip_from 104\.16\.0\.0\/13;/);
  assert.match(conf, /set_real_ip_from 2400:cb00::\/32;/);
  assert.match(conf, /real_ip_header CF-Connecting-IP;/);
});
