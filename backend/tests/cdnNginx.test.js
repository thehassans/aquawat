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
  assert.match(conf, /resolver 127\.0\.0\.11 valid=10s ipv6=off;/);
  assert.match(conf, /set \$backend_upstream backend:3000;/);
  const backendPassCount = (conf.match(/proxy_pass\s+http:\/\/\$backend_upstream;/g) || []).length;
  assert.ok(backendPassCount >= 3, 'expected variable proxy_pass to backend for api/socket/uploads');
  assert.match(conf, /location \/api\/auth\/ \{/);
  assert.match(conf, /location \/api\/ \{/);
  assert.doesNotMatch(conf, /location \/api\/ \{[\s\S]*location \/api\/auth\//);
  assert.doesNotMatch(conf, /upstream backend_pool/);
});

test('Cloudflare real-ip list includes published IPv4 and IPv6 prefixes', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'cloudflare-realip.conf'), 'utf8');
  assert.match(conf, /set_real_ip_from 104\.16\.0\.0\/13;/);
  assert.match(conf, /set_real_ip_from 2400:cb00::\/32;/);
  assert.match(conf, /real_ip_header CF-Connecting-IP;/);
});

test('Nginx auth zone is 10r/m burst 20 (Node Redis limiter is 40/15min)', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  assert.match(conf, /limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=10r\/m;/);
  assert.match(conf, /limit_req zone=auth_limit burst=20 nodelay;/);
});

test('updating.html is an English light deploy holding page with the Maqder mark', () => {
  const html = fs.readFileSync(path.join(frontendDir, 'public/updating.html'), 'utf8');
  assert.match(html, /data-maqder-updating="1"/);
  assert.match(html, /3–5 minutes|3-5 minutes/);
  assert.match(html, /Thank you for your patience/);
  assert.match(html, /maqderbestlogo\.png/);
  assert.match(html, /\.logo \{[\s\S]*?background:\s*#fff/);
  assert.doesNotMatch(html, /\.logo \{[\s\S]*?background:\s*#000/);
  assert.doesNotMatch(html, /class="wordmark"/);
  assert.match(html, /#f4f6f3/);
  assert.doesNotMatch(html, /شكراً|مقدر|الرجاء/);
});

test('edge nginx serves the updating page on 502/503/504 for HTML, not for socket/api', () => {
  const conf = fs.readFileSync(path.resolve(frontendDir, '../ops/updating/nginx.conf'), 'utf8');
  assert.match(conf, /error_page 502 503 504 =200 \/updating\.html;/);
  assert.match(conf, /location \/socket\.io\//);
  assert.match(conf, /@socket_unavailable/);
  assert.match(conf, /@api_unavailable/);
  assert.match(conf, /return 503/);
  assert.match(conf, /resolver 127\.0\.0\.11/);
  let depth = 0;
  const stripped = conf.replace(/#[^\n]*/g, '');
  for (const ch of stripped) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    assert.ok(depth >= 0, 'closing brace without opener');
  }
  assert.equal(depth, 0);
});

test('frontend nginx does not remap socket.io failures to HTML 200', () => {
  const conf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  assert.match(conf, /location \/socket\.io\//);
  assert.match(conf, /proxy_intercept_errors off/);
  assert.match(conf, /@socket_unavailable/);
  assert.match(conf, /map \$http_upgrade \$connection_upgrade/);
  const socketBlock = conf.match(/location \/socket\.io\/ \{[\s\S]*?\n    \}/)?.[0] || '';
  assert.match(socketBlock, /proxy_intercept_errors off/);
  assert.match(socketBlock, /error_page 502 503 504 = @socket_unavailable/);
});

test('compose keeps host 8080 on the edge proxy, not the frontend app', () => {
  const compose = fs.readFileSync(path.resolve(frontendDir, '../docker-compose.yml'), 'utf8');
  assert.match(compose, /container_name: maqder_edge/);
  assert.match(compose, /container_name: maqder_edge[\s\S]*?"8080:80"/);
  const frontendService = compose.match(/\n  frontend:[\s\S]*?\n  [a-z]/);
  const block = frontendService ? frontendService[0] : '';
  assert.doesNotMatch(block, /8080:80/);
  assert.match(block, /expose:/);
});

test('compose backend must not require object storage over server .env', () => {
  const compose = fs.readFileSync(path.resolve(frontendDir, '../docker-compose.yml'), 'utf8');
  const backendService = compose.match(/\n  backend:[\s\S]*?\n  pdf-worker:/);
  const block = backendService ? backendService[0] : '';
  assert.doesNotMatch(block, /REQUIRE_OBJECT_STORAGE:\s*"true"/);
  assert.match(block, /ALLOW_LOCAL_UPLOADS:\s*"true"/);
});
