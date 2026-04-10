// CymClaw — policy loading unit tests
// Run with: node --test test/policy.test.js
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PRESETS_DIR = path.join(__dirname, '..', 'policies', 'presets');

describe('policy presets', () => {
  it('default preset file exists and is valid YAML', () => {
    const yaml = require('js-yaml');
    const file = path.join(PRESETS_DIR, 'default.yaml');
    assert.ok(fs.existsSync(file), 'default.yaml should exist');
    const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
    assert.equal(doc.name, 'default');
    assert.ok(Array.isArray(doc.whitelist), 'whitelist should be an array');
    assert.ok(doc.whitelist.length > 0, 'whitelist should not be empty');
    assert.ok(doc.whitelist.includes('generativelanguage.googleapis.com'), 'Gemini should always be in default');
  });

  it('minimal preset exists and only contains Gemini', () => {
    const yaml = require('js-yaml');
    const file = path.join(PRESETS_DIR, 'minimal.yaml');
    assert.ok(fs.existsSync(file), 'minimal.yaml should exist');
    const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
    assert.equal(doc.name, 'minimal');
    assert.ok(Array.isArray(doc.whitelist));
    assert.equal(doc.whitelist.length, 1, 'minimal should have exactly 1 host');
    assert.equal(doc.whitelist[0], 'generativelanguage.googleapis.com');
  });

  it('development preset exists and extends default', () => {
    const yaml = require('js-yaml');
    const file = path.join(PRESETS_DIR, 'development.yaml');
    assert.ok(fs.existsSync(file), 'development.yaml should exist');
    const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
    assert.equal(doc.name, 'development');
    assert.equal(doc.extends, 'default');
    assert.ok(Array.isArray(doc.whitelist));
  });

  it('slack preset exists and extends default', () => {
    const yaml = require('js-yaml');
    const file = path.join(PRESETS_DIR, 'slack.yaml');
    assert.ok(fs.existsSync(file), 'slack.yaml should exist');
    const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
    assert.equal(doc.name, 'slack');
    assert.equal(doc.extends, 'default');
    assert.ok(doc.whitelist.includes('api.slack.com'));
  });

  it('github preset exists and default does not include GitHub by default', () => {
    const yaml = require('js-yaml');
    const defaultFile = path.join(PRESETS_DIR, 'default.yaml');
    const githubFile = path.join(PRESETS_DIR, 'github.yaml');
    assert.ok(fs.existsSync(githubFile), 'github.yaml should exist');

    const defaultDoc = yaml.load(fs.readFileSync(defaultFile, 'utf-8'));
    const githubDoc = yaml.load(fs.readFileSync(githubFile, 'utf-8'));

    assert.equal(githubDoc.name, 'github');
    assert.equal(githubDoc.extends, 'default');
    assert.ok(githubDoc.whitelist.includes('github.com'));
    assert.ok(!defaultDoc.whitelist.includes('github.com'));
    assert.ok(!defaultDoc.whitelist.includes('api.github.com'));
  });

  it('all presets have name and description fields', () => {
    const yaml = require('js-yaml');
    const files = fs.readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.yaml'));
    assert.ok(files.length >= 4, 'should have at least 4 presets');
    for (const file of files) {
      const doc = yaml.load(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf-8'));
      assert.ok(doc.name, `${file} should have a name field`);
      assert.ok(doc.description, `${file} should have a description field`);
    }
  });
});

describe('policy module', () => {
  let origHome;
  let tmpHome;

  before(() => {
    origHome = process.env.HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cymclaw-policy-test-'));
    process.env.HOME = tmpHome;
    delete require.cache[require.resolve('../bin/lib/config')];
    delete require.cache[require.resolve('../bin/lib/policy')];
  });

  after(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    delete require.cache[require.resolve('../bin/lib/config')];
    delete require.cache[require.resolve('../bin/lib/policy')];
  });

  it('policyList runs without error', () => {
    const { policyList } = require('../bin/lib/policy');
    // Should not throw
    assert.doesNotThrow(() => policyList());
  });

  it('policyRemove removes a host from config', async () => {
    const { loadConfig, saveConfig } = require('../bin/lib/config');
    const { policyRemove } = require('../bin/lib/policy');
    // Set up config with a test host
    saveConfig({ networkWhitelist: ['api.test.example.com', 'registry.npmjs.org'] });
    await policyRemove('api.test.example.com');
    const cfg = loadConfig();
    assert.ok(!cfg.networkWhitelist.includes('api.test.example.com'));
    assert.ok(cfg.networkWhitelist.includes('registry.npmjs.org'));
  });
});
