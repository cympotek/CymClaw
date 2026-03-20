// CymClaw — Docker helpers unit tests
// Run with: node --test test/docker.test.js
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

describe('docker helpers', () => {
  it('dockerPs returns false for nonexistent container', () => {
    const { dockerPs } = require('../bin/lib/docker');
    const result = dockerPs('cymclaw-nonexistent-test-container-' + Date.now());
    assert.equal(result, false);
  });

  it('dockerNetworkExists returns false for nonexistent network', () => {
    const { dockerNetworkExists } = require('../bin/lib/docker');
    const result = dockerNetworkExists('cymclaw-nonexistent-network-' + Date.now());
    assert.equal(result, false);
  });
});

describe('config', () => {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  let origHome;
  let tmpHome;

  before(() => {
    origHome = process.env.HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cymclaw-test-'));
    process.env.HOME = tmpHome;
    // Clear require cache so config picks up new HOME
    delete require.cache[require.resolve('../bin/lib/config')];
  });

  after(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    delete require.cache[require.resolve('../bin/lib/config')];
  });

  it('loadConfig returns defaults when no config file exists', () => {
    const { loadConfig, DEFAULTS } = require('../bin/lib/config');
    const cfg = loadConfig();
    assert.equal(cfg.model, DEFAULTS.model);
    assert.equal(cfg.gatewayPort, DEFAULTS.gatewayPort);
    assert.deepEqual(cfg.networkWhitelist, DEFAULTS.networkWhitelist);
  });

  it('saveConfig and loadConfig roundtrip', () => {
    const { loadConfig, saveConfig } = require('../bin/lib/config');
    const testCfg = { geminiApiKey: 'test-key-123', model: 'gemini-1.5-flash', gatewayPort: 9000 };
    saveConfig(testCfg);
    const loaded = loadConfig();
    assert.equal(loaded.geminiApiKey, 'test-key-123');
    assert.equal(loaded.model, 'gemini-1.5-flash');
    assert.equal(loaded.gatewayPort, 9000);
  });

  it('config file has mode 600', () => {
    const { saveConfig, CONFIG_PATH } = require('../bin/lib/config');
    saveConfig({ geminiApiKey: 'test' });
    const stat = fs.statSync(CONFIG_PATH);
    const mode = (stat.mode & 0o777).toString(8);
    assert.equal(mode, '600');
  });
});

describe('constants', () => {
  it('all constants are defined', () => {
    const c = require('../bin/lib/constants');
    assert.ok(c.SANDBOX_NAME);
    assert.ok(c.GATEWAY_NAME);
    assert.ok(c.NETWORK_NAME);
    assert.ok(c.SANDBOX_IMAGE);
    assert.ok(typeof c.GATEWAY_PORT === 'number');
    assert.ok(typeof c.SANDBOX_PORT === 'number');
    assert.ok(typeof c.UI_PORT === 'number');
  });
});
