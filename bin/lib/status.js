// CymClaw — status display
// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CONFIG_DIR, loadConfig } = require('./config');
const { SANDBOX_NAME, GATEWAY_NAME, GATEWAY_PORT } = require('./constants');
const { dockerPs } = require('./docker');

function showStatus() {
  const cfg = loadConfig();

  const sandboxRunning = dockerPs(SANDBOX_NAME);
  const gatewayPidFile = path.join(CONFIG_DIR, 'gateway.pid');
  let gatewayRunning = false;
  let gatewayPid = null;
  if (fs.existsSync(gatewayPidFile)) {
    gatewayPid = fs.readFileSync(gatewayPidFile, 'utf-8').trim();
    try {
      process.kill(parseInt(gatewayPid, 10), 0);
      gatewayRunning = true;
    } catch {}
  }

  const ok    = '\x1b[32m●\x1b[0m';
  const fail  = '\x1b[31m●\x1b[0m';
  const blank = '\x1b[2m○\x1b[0m';

  console.log('');
  console.log('  \x1b[1mCymClaw Status\x1b[0m');
  console.log('  ─────────────────────────────────────────');
  console.log(`  ${sandboxRunning ? ok : fail}  Sandbox   ${SANDBOX_NAME}`);
  console.log(`  ${gatewayRunning ? ok : fail}  Gateway   localhost:${cfg.gatewayPort || GATEWAY_PORT}${gatewayPid ? ` (pid ${gatewayPid})` : ''}`);
  console.log('');
  console.log(`  Model:    ${cfg.model || 'not configured'}`);
  console.log(`  API key:  ${cfg.geminiApiKey ? cfg.geminiApiKey.slice(0, 8) + '...' : '\x1b[31mnot set\x1b[0m'}`);
  console.log('');

  // Recent audit log
  const auditPath = path.join(CONFIG_DIR, 'audit.log');
  if (fs.existsSync(auditPath)) {
    const lines = fs.readFileSync(auditPath, 'utf-8').trim().split('\n');
    const recent = lines.slice(-5);
    if (recent.length > 0 && recent[0]) {
      console.log('  \x1b[2mRecent requests:\x1b[0m');
      recent.forEach((l) => console.log(`    ${l}`));
      console.log('');
    }
  }
}

module.exports = { showStatus };
