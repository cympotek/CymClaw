// CymClaw — interactive config editor
// SPDX-License-Identifier: Apache-2.0

'use strict';

const readline = require('readline');
const { loadConfig, saveConfig } = require('./config');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function editConfig() {
  const cfg = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log('  \x1b[1mCymClaw Configuration\x1b[0m');
  console.log('  (press Enter to keep current value)');
  console.log('');

  const newKey = await ask(rl, `  Gemini API key [${cfg.geminiApiKey ? cfg.geminiApiKey.slice(0,8)+'...' : 'not set'}]: `);
  if (newKey.trim()) cfg.geminiApiKey = newKey.trim();

  console.log('');
  console.log('  Models: 1=gemini-2.0-flash-exp  2=gemini-1.5-flash  3=gemini-1.5-pro');
  const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const currentIdx = models.indexOf(cfg.model) + 1 || 1;
  const modelChoice = await ask(rl, `  Model [${currentIdx}=${cfg.model}]: `);
  if (modelChoice.trim()) {
    const idx = parseInt(modelChoice.trim(), 10) - 1;
    if (idx >= 0 && idx < models.length) cfg.model = models[idx];
  }

  const auditChoice = await ask(rl, `  Audit logging [${cfg.logAudit ? 'y' : 'n'}]: `);
  if (auditChoice.trim()) cfg.logAudit = auditChoice.trim().toLowerCase() !== 'n';

  rl.close();
  saveConfig(cfg);
  console.log('');
  console.log('  \x1b[32m✓\x1b[0m Config saved. Restart with: cymclaw stop && cymclaw start');
  console.log('');
}

module.exports = { editConfig };
