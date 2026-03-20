// CymClaw — config loader
// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CONFIG_DIR  = path.join(os.homedir(), '.cymclaw');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  geminiApiKey: '',
  model: 'gemini-2.0-flash-exp',
  gatewayPort: 8899,
  sandboxPort: 18789,
  uiPort: 3847,
  networkWhitelist: [
    'generativelanguage.googleapis.com',
    'api.anthropic.com',
    'github.com',
    'api.github.com',
    'registry.npmjs.org',
    'openclaw.ai',
    'clawhub.com',
  ],
  logAudit: true,
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

module.exports = { CONFIG_DIR, CONFIG_PATH, DEFAULTS, loadConfig, saveConfig };
