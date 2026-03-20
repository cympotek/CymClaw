// CymClaw — install wizard
// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

const { ROOT } = require('./runner');
const { loadConfig, saveConfig, CONFIG_DIR } = require('./config');
const {
  SANDBOX_IMAGE, NETWORK_NAME, SANDBOX_NAME, GATEWAY_PORT,
} = require('./constants');
const {
  dockerNetworkExists, dockerNetworkCreate, dockerBuild, dockerVolumeCreate,
} = require('./docker');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function checkDocker() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function runInstall({ nonInteractive = false } = {}) {
  console.log('');
  console.log('  \x1b[1m\x1b[34mCymClaw Setup Wizard\x1b[0m');
  console.log('  ─────────────────────────────────────────');
  console.log('');

  // 1. Docker check
  if (!checkDocker()) {
    console.error('  \x1b[31m✗\x1b[0m Docker is not running.');
    console.error('    Install Docker: https://docs.docker.com/get-docker/');
    console.error('    On macOS with Homebrew: brew install --cask docker');
    process.exit(1);
  }
  console.log('  \x1b[32m✓\x1b[0m Docker is running');

  let cfg = loadConfig();

  if (!nonInteractive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // 2. Gemini API key
    console.log('');
    console.log('  Get a Gemini API key at: https://aistudio.google.com/app/apikey');
    const existingKey = cfg.geminiApiKey ? ` [current: ${cfg.geminiApiKey.slice(0, 8)}...]` : '';
    const apiKey = await ask(rl, `  Gemini API key${existingKey}: `);
    if (apiKey.trim()) cfg.geminiApiKey = apiKey.trim();

    if (!cfg.geminiApiKey) {
      console.error('  \x1b[31m✗\x1b[0m Gemini API key is required.');
      rl.close();
      process.exit(1);
    }

    // 3. Model selection
    console.log('');
    console.log('  Available models:');
    console.log('    1. gemini-2.0-flash-exp  (recommended, fast)');
    console.log('    2. gemini-1.5-flash');
    console.log('    3. gemini-1.5-pro');
    const modelChoice = await ask(rl, `  Model [1]: `);
    const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const idx = parseInt(modelChoice.trim() || '1', 10) - 1;
    cfg.model = models[Math.max(0, Math.min(2, idx))];

    rl.close();
  } else {
    if (!cfg.geminiApiKey && process.env.GEMINI_API_KEY) {
      cfg.geminiApiKey = process.env.GEMINI_API_KEY;
    }
    if (!cfg.geminiApiKey) {
      console.error('  \x1b[31m✗\x1b[0m Set GEMINI_API_KEY env or run interactively.');
      process.exit(1);
    }
  }

  saveConfig(cfg);
  console.log(`  \x1b[32m✓\x1b[0m Config saved to ${path.join(CONFIG_DIR, 'config.json')}`);

  // 4. Docker network
  console.log('');
  console.log(`  Setting up Docker network '${NETWORK_NAME}'...`);
  if (!dockerNetworkExists(NETWORK_NAME)) {
    dockerNetworkCreate(NETWORK_NAME, '--driver bridge --internal');
    console.log(`  \x1b[32m✓\x1b[0m Network '${NETWORK_NAME}' created`);
  } else {
    console.log(`  \x1b[32m✓\x1b[0m Network '${NETWORK_NAME}' already exists`);
  }

  // 5. Workspace volume
  dockerVolumeCreate('cymclaw-workspace');
  console.log('  \x1b[32m✓\x1b[0m Workspace volume ready');

  // 6. Build sandbox image
  console.log('');
  console.log('  Building sandbox image (first run takes a few minutes)...');
  const sandboxDir = path.join(ROOT, 'sandbox');
  dockerBuild(sandboxDir, SANDBOX_IMAGE);
  console.log(`  \x1b[32m✓\x1b[0m Image '${SANDBOX_IMAGE}' built`);

  // 7. Copy seccomp profile to config dir
  const seccompSrc = path.join(ROOT, 'policies', 'cymclaw-seccomp.json');
  const seccompDst = path.join(CONFIG_DIR, 'cymclaw-seccomp.json');
  if (fs.existsSync(seccompSrc)) {
    fs.copyFileSync(seccompSrc, seccompDst);
    console.log(`  \x1b[32m✓\x1b[0m Seccomp profile copied`);
  }

  // 8. Done
  console.log('');
  console.log('  ──────────────────────────────────────────────────');
  console.log(`  Sandbox  cymclaw-sandbox (Docker · seccomp · network isolation)`);
  console.log(`  Model    ${cfg.model} (Google AI)`);
  console.log(`  Gateway  localhost:${GATEWAY_PORT} (inference proxy)`);
  console.log('  ──────────────────────────────────────────────────');
  console.log('');
  console.log('  Run:    cymclaw start');
  console.log('  Shell:  cymclaw connect');
  console.log('  UI:     cymclaw ui');
  console.log('');
}

module.exports = { runInstall };
