// CymClaw — policy management
// SPDX-License-Identifier: Apache-2.0

'use strict';

const readline = require('readline');
const { loadConfig, saveConfig } = require('./config');

function ask(rl, q) { return new Promise((r) => rl.question(q, r)); }

function policyList() {
  const cfg = loadConfig();
  const list = cfg.networkWhitelist || [];
  console.log('');
  console.log('  \x1b[1mAllowed endpoints:\x1b[0m');
  list.forEach((h) => console.log(`    \x1b[32m●\x1b[0m  ${h}`));
  console.log('');
  console.log('  \x1b[2mChanges take effect after: cymclaw stop && cymclaw start\x1b[0m');
  console.log('');
}

async function policyAdd(host) {
  const cfg = loadConfig();
  if (!cfg.networkWhitelist) cfg.networkWhitelist = [];
  if (cfg.networkWhitelist.includes(host)) {
    console.log(`  \x1b[33m~\x1b[0m  '${host}' is already whitelisted.`);
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await ask(rl, `  Add '${host}' to whitelist? [Y/n]: `);
  rl.close();
  if (confirm.trim().toLowerCase() === 'n') return;
  cfg.networkWhitelist.push(host);
  saveConfig(cfg);
  console.log(`  \x1b[32m✓\x1b[0m Added '${host}'`);
}

async function policyRemove(host) {
  const cfg = loadConfig();
  const before = (cfg.networkWhitelist || []).length;
  cfg.networkWhitelist = (cfg.networkWhitelist || []).filter((h) => h !== host);
  if (cfg.networkWhitelist.length === before) {
    console.log(`  \x1b[33m~\x1b[0m  '${host}' was not in the whitelist.`);
    return;
  }
  saveConfig(cfg);
  console.log(`  \x1b[32m✓\x1b[0m Removed '${host}'`);
}

module.exports = { policyList, policyAdd, policyRemove };
