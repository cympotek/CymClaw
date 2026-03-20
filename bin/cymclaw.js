#!/usr/bin/env node
// CymClaw CLI — main entry point
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { spawnSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const { run, runInteractive, runCapture } = require('./lib/runner');
const { loadConfig, saveConfig, CONFIG_PATH } = require('./lib/config');
const { dockerPs, dockerExec, dockerLogs, dockerStop, dockerRm } = require('./lib/docker');
const { SANDBOX_NAME, GATEWAY_NAME, GATEWAY_PORT, UI_PORT } = require('./lib/constants');

// ── ASCII banner ──────────────────────────────────────────────────
function banner() {
  console.log('\x1b[34m');
  console.log('   ██████╗██╗   ██╗███╗   ███╗ ██████╗██╗      █████╗ ██╗    ██╗');
  console.log('  ██╔════╝╚██╗ ██╔╝████╗ ████║██╔════╝██║     ██╔══██╗██║    ██║');
  console.log('  ██║      ╚████╔╝ ██╔████╔██║██║     ██║     ███████║██║ █╗ ██║');
  console.log('  ██║       ╚██╔╝  ██║╚██╔╝██║██║     ██║     ██╔══██║██║███╗██║');
  console.log('  ╚██████╗   ██║   ██║ ╚═╝ ██║╚██████╗███████╗██║  ██║╚███╔███╔╝');
  console.log('   ╚═════╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ');
  console.log('\x1b[0m');
  console.log('  \x1b[2mOpenClaw in Docker · Gemini 3 Flash Preview · by CymPack\x1b[0m');
  console.log('');
}

// ── Help ──────────────────────────────────────────────────────────
function help() {
  banner();
  console.log(`  \x1b[1mUsage:\x1b[0m cymclaw <command> [options]

  \x1b[1mSetup:\x1b[0m
    install              First-time setup wizard
    uninstall            Remove CymClaw and all containers

  \x1b[1mSandbox:\x1b[0m
    start                Start sandbox + gateway
    stop                 Stop everything
    connect              Open shell inside sandbox
    status               Show running status
    logs [-f]            Stream sandbox logs

  \x1b[1mConfig:\x1b[0m
    config               Edit config interactively
    ui                   Open web config UI (localhost:${UI_PORT})

  \x1b[1mPolicy:\x1b[0m
    policy add <host>    Add host to network whitelist
    policy list          List allowed endpoints
    policy remove <host> Remove host from whitelist

  \x1b[1mOptions:\x1b[0m
    --help, -h           Show this help
    --version, -v        Show version
`);
}

// ── Commands ──────────────────────────────────────────────────────

async function cmdInstall(args) {
  const { runInstall } = require('./lib/install');
  await runInstall({ nonInteractive: args.includes('--non-interactive') });
}

async function cmdStart() {
  const { startSandbox } = require('./lib/start');
  await startSandbox();
}

function cmdStop() {
  console.log('  Stopping CymClaw sandbox...');
  dockerStop(SANDBOX_NAME, { ignoreError: true });
  dockerRm(SANDBOX_NAME, { ignoreError: true });
  dockerStop(GATEWAY_NAME, { ignoreError: true });
  dockerRm(GATEWAY_NAME, { ignoreError: true });
  console.log('  \x1b[32m✓\x1b[0m Stopped.');
}

function cmdConnect() {
  const running = dockerPs(SANDBOX_NAME);
  if (!running) {
    console.error('  \x1b[31m✗\x1b[0m Sandbox is not running. Run: cymclaw start');
    process.exit(1);
  }
  console.log(`  Connecting to sandbox '${SANDBOX_NAME}'...`);
  console.log('  \x1b[2mTip: run "openclaw tui" inside to chat with the agent.\x1b[0m');
  console.log('');
  runInteractive(`docker exec -it ${SANDBOX_NAME} /bin/bash`);
}

function cmdStatus() {
  const { showStatus } = require('./lib/status');
  showStatus();
}

function cmdLogs(args) {
  const follow = args.includes('-f') || args.includes('--follow');
  const followFlag = follow ? ' -f' : '';
  const running = dockerPs(SANDBOX_NAME);
  if (!running) {
    console.error(`  \x1b[31m✗\x1b[0m Sandbox '${SANDBOX_NAME}' is not running.`);
    process.exit(1);
  }
  run(`docker logs${followFlag} ${SANDBOX_NAME}`);
}

async function cmdConfig() {
  const { editConfig } = require('./lib/config-wizard');
  await editConfig();
}

async function cmdUi() {
  const { launchUi } = require('./lib/ui');
  await launchUi();
}

async function cmdPolicy(args) {
  const { policyAdd, policyList, policyRemove } = require('./lib/policy');
  const sub = args[0];
  if (sub === 'add') {
    const host = args[1];
    if (!host) { console.error('  Usage: cymclaw policy add <host>'); process.exit(1); }
    await policyAdd(host);
  } else if (sub === 'list') {
    policyList();
  } else if (sub === 'remove') {
    const host = args[1];
    if (!host) { console.error('  Usage: cymclaw policy remove <host>'); process.exit(1); }
    await policyRemove(host);
  } else {
    console.error('  Usage: cymclaw policy <add|list|remove> [host]');
    process.exit(1);
  }
}

// ── Dispatch ──────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

(async () => {
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    help();
    return;
  }

  if (cmd === '--version' || cmd === '-v') {
    const pkg = require('../package.json');
    console.log(pkg.version);
    return;
  }

  switch (cmd) {
    case 'install':    await cmdInstall(args); break;
    case 'uninstall':  run(`bash "${ROOT}/uninstall.sh"`); break;
    case 'start':      await cmdStart(); break;
    case 'stop':       cmdStop(); break;
    case 'connect':    cmdConnect(); break;
    case 'status':     cmdStatus(); break;
    case 'logs':       cmdLogs(args); break;
    case 'config':     await cmdConfig(); break;
    case 'ui':         await cmdUi(); break;
    case 'policy':     await cmdPolicy(args); break;
    default:
      console.error(`  Unknown command: ${cmd}`);
      console.error(`  Run 'cymclaw help' for usage.`);
      process.exit(1);
  }
})();
