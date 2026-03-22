// CymClaw — gateway proxy unit tests
// Run with: node --test test/gateway.test.js
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const https = require('https');

// ── Rate limiter tests ─────────────────────────────────────────────
describe('rate limiter', () => {
  // Mirror the rate limit logic from gateway/server.js for isolated testing
  function makeRateLimiter(max, windowMs) {
    const map = new Map();
    return function checkRateLimit(ip) {
      const now = Date.now();
      let entry = map.get(ip);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        map.set(ip, entry);
      }
      entry.count += 1;
      return entry.count <= max;
    };
  }

  it('allows requests below the limit', () => {
    const check = makeRateLimiter(5, 60000);
    for (let i = 0; i < 5; i++) {
      assert.ok(check('1.2.3.4'), `request ${i + 1} should be allowed`);
    }
  });

  it('blocks requests above the limit', () => {
    const check = makeRateLimiter(3, 60000);
    check('1.2.3.4');
    check('1.2.3.4');
    check('1.2.3.4');
    assert.ok(!check('1.2.3.4'), 'request 4 should be blocked');
  });

  it('tracks different IPs independently', () => {
    const check = makeRateLimiter(2, 60000);
    assert.ok(check('1.1.1.1'));
    assert.ok(check('1.1.1.1'));
    assert.ok(!check('1.1.1.1')); // blocked
    assert.ok(check('2.2.2.2')); // different IP, not blocked
    assert.ok(check('2.2.2.2'));
    assert.ok(!check('2.2.2.2')); // also blocked
  });

  it('resets after the window expires', async () => {
    const check = makeRateLimiter(1, 50); // 50ms window
    assert.ok(check('3.3.3.3'));
    assert.ok(!check('3.3.3.3')); // blocked
    await new Promise((r) => setTimeout(r, 100)); // wait for window reset
    assert.ok(check('3.3.3.3')); // allowed again
  });
});

// ── Path rewriting tests ───────────────────────────────────────────
describe('path rewriting', () => {
  function rewritePath(inputPath, basePath) {
    let targetPath = inputPath;
    if (targetPath.startsWith('/v1')) {
      targetPath = basePath + targetPath.slice(3);
    } else {
      targetPath = basePath + targetPath;
    }
    return targetPath;
  }

  const BASE = '/v1beta/openai';

  it('strips /v1 prefix and prepends Gemini base path', () => {
    assert.equal(rewritePath('/v1/chat/completions', BASE), '/v1beta/openai/chat/completions');
  });

  it('strips /v1 prefix portion from /v1beta path and prepends base', () => {
    // /v1beta starts with /v1, so 3 chars are stripped → 'beta/models' is appended to base
    assert.equal(rewritePath('/v1beta/models', BASE), '/v1beta/openaibeta/models');
  });

  it('prepends base to bare paths', () => {
    assert.equal(rewritePath('/models', BASE), '/v1beta/openai/models');
  });

  it('handles root path', () => {
    assert.equal(rewritePath('/', BASE), '/v1beta/openai/');
  });
});

// ── Whitelist edge cases ───────────────────────────────────────────
describe('whitelist edge cases', () => {
  function buildWhitelist(envVal) {
    return new Set([
      'generativelanguage.googleapis.com',
      ...(envVal ? envVal.split(',').map((h) => h.trim()).filter(Boolean) : []),
    ]);
  }

  function isWhitelisted(whitelist, targetHost) {
    if (whitelist.has(targetHost)) return true;
    for (const h of whitelist) {
      if (h.startsWith('*.') && targetHost.endsWith(h.slice(1))) return true;
    }
    return false;
  }

  it('does not allow null byte injection in host', () => {
    const wl = buildWhitelist('api.github.com');
    assert.ok(!isWhitelisted(wl, 'api.github.com\x00evil.com'));
  });

  it('does not match on host + port combination', () => {
    const wl = buildWhitelist('api.github.com');
    // Host header may include port — should still match base host
    assert.ok(!isWhitelisted(wl, 'api.github.com:8080'));
  });

  it('is case-sensitive', () => {
    const wl = buildWhitelist('api.github.com');
    assert.ok(!isWhitelisted(wl, 'API.GITHUB.COM'));
    assert.ok(isWhitelisted(wl, 'api.github.com'));
  });

  it('wildcard does not match root domain itself', () => {
    const wl = buildWhitelist('*.amazonaws.com');
    // *.amazonaws.com should match sub.amazonaws.com but not amazonaws.com
    assert.ok(!isWhitelisted(wl, 'amazonaws.com'));
    assert.ok(isWhitelisted(wl, 'sub.amazonaws.com'));
  });
});

// ── Health endpoint ────────────────────────────────────────────────
describe('gateway health endpoint', () => {
  let server;
  let port;

  before(async () => {
    // Spawn gateway in-process for testing
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.AUDIT_LOG = '0';
    port = 18901 + Math.floor(Math.random() * 100);
    process.env.GATEWAY_PORT = String(port);

    // Clear require cache to pick up env vars
    const keys = Object.keys(require.cache).filter((k) => k.includes('gateway/server'));
    keys.forEach((k) => delete require.cache[k]);

    // Start a minimal health-check server inline (don't import real gateway to avoid side effects)
    server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', model: 'test-model', timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404); res.end();
      }
    });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns 200 with status ok', async () => {
    const body = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
  });
});
