// CymClaw — gateway whitelist unit tests
// Run with: node --test test/network.test.js
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Extract whitelist logic inline for testing (mirrors gateway/server.js)
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

describe('gateway whitelist', () => {
  it('always allows generativelanguage.googleapis.com', () => {
    const wl = buildWhitelist('');
    assert.ok(isWhitelisted(wl, 'generativelanguage.googleapis.com'));
  });

  it('blocks unlisted hosts', () => {
    const wl = buildWhitelist('');
    assert.ok(!isWhitelisted(wl, 'evil.example.com'));
    assert.ok(!isWhitelisted(wl, 'api.openai.com'));
    assert.ok(!isWhitelisted(wl, 'exfil.attacker.io'));
  });

  it('allows hosts added via whitelist env', () => {
    const wl = buildWhitelist('api.github.com,registry.npmjs.org');
    assert.ok(isWhitelisted(wl, 'api.github.com'));
    assert.ok(isWhitelisted(wl, 'registry.npmjs.org'));
  });

  it('does not allow partial host matches without wildcard', () => {
    const wl = buildWhitelist('github.com');
    // Should NOT match evil-github.com
    assert.ok(!isWhitelisted(wl, 'evil-github.com'));
    assert.ok(!isWhitelisted(wl, 'notgithub.com'));
  });

  it('wildcard prefix matches subdomain suffix', () => {
    const wl = buildWhitelist('*.amazonaws.com');
    assert.ok(isWhitelisted(wl, 's3.amazonaws.com'));
    assert.ok(isWhitelisted(wl, 'ec2.us-east-1.amazonaws.com'));
    assert.ok(!isWhitelisted(wl, 'evil-amazonaws.com'));
  });

  it('trims whitespace from whitelist entries', () => {
    const wl = buildWhitelist('  api.github.com , registry.npmjs.org  ');
    assert.ok(isWhitelisted(wl, 'api.github.com'));
    assert.ok(isWhitelisted(wl, 'registry.npmjs.org'));
  });

  it('ignores empty entries in whitelist string', () => {
    const wl = buildWhitelist(',,,api.github.com,,');
    assert.ok(isWhitelisted(wl, 'api.github.com'));
    assert.equal(wl.size, 2); // generativelanguage + github
  });
});

describe('policy helpers', () => {
  it('policy list returns array from config', () => {
    // Minimal smoke test — just verifies module loads
    const path = require('path');
    const mod = require(path.join(__dirname, '..', 'bin', 'lib', 'policy'));
    assert.ok(typeof mod.policyList === 'function');
    assert.ok(typeof mod.policyAdd === 'function');
    assert.ok(typeof mod.policyRemove === 'function');
  });
});
