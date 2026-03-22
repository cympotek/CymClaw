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
  console.log('  \x1b[2mOpenClaw in Docker · Gemini Flash · by CymPotek\x1b[0m');
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

  \x1b[1mMaintenance:\x1b[0m
    doctor               Check Docker, Node.js, network health
    update               Self-update CymClaw from GitHub

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
  // Also kill gateway process if running by PID
  const pidFile = path.join(os.homedir(), '.cymclaw', 'gateway.pid');
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (pid && pid > 0) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }
      fs.unlinkSync(pidFile);
    } catch {}
  }
  console.log('  \x1b[32m✓\x1b[0m Stopped.');
}

function cmdConnect() {
  const running = dockerPs(SANDBOX_NAME);
  if (!running) {
    console.error('  \x1b[31m✗\x1b[0m Sandbox is not running. Run: cymclaw start');
    console.error('  \x1b[2mHint: use "cymclaw doctor" to check your setup.\x1b[0m');
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
    console.error('  \x1b[2mHint: run "cymclaw start" to start the sandbox.\x1b[0m');
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

function cmdDoctor() {
  console.log('\n  \x1b[1mCymClaw Doctor\x1b[0m — checking your environment\n');
  let allOk = true;

  function check(label, fn) {
    try {
      const result = fn();
      if (result === false) {
        console.log(`  \x1b[31m✗\x1b[0m ${label}`);
        allOk = false;
      } else {
        console.log(`  \x1b[32m✓\x1b[0m ${label}${result && result !== true ? '  \x1b[2m' + result + '\x1b[0m' : ''}`);
      }
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m ${label}  \x1b[2m${err.message}\x1b[0m`);
      allOk = false;
    }
  }

  // Check Node.js version
  check('Node.js version', () => {
    const v = process.version;
    const major = parseInt(v.slice(1), 10);
    if (major < 22) throw new Error(`${v} — need ≥22. Run: nvm install 22`);
    return v;
  });

  // Check Docker
  check('Docker installed', () => {
    const r = spawnSync('docker', ['--version'], { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error('docker not found. Install Docker from https://docs.docker.com/get-docker/');
    return r.stdout.trim();
  });

  // Check Docker daemon
  check('Docker daemon running', () => {
    const r = spawnSync('docker', ['info'], { encoding: 'utf-8', stdio: 'pipe' });
    if (r.status !== 0) throw new Error('Docker daemon not responding. Start Docker Desktop or run: sudo systemctl start docker');
    return true;
  });

  // Check pnpm
  check('pnpm installed', () => {
    const r = spawnSync('pnpm', ['--version'], { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error('pnpm not found. Run: npm install -g pnpm');
    return r.stdout.trim();
  });

  // Check config
  check('Config file exists', () => {
    const cfg = loadConfig();
    if (!cfg.geminiApiKey) throw new Error('Gemini API key not set. Run: cymclaw config');
    return CONFIG_PATH;
  });

  // Check Docker network
  check('CymClaw Docker network', () => {
    const { dockerNetworkExists } = require('./lib/docker');
    const { NETWORK_NAME } = require('./lib/constants');
    if (!dockerNetworkExists(NETWORK_NAME)) throw new Error(`Network '${NETWORK_NAME}' not found. Run: cymclaw install`);
    return NETWORK_NAME;
  });

  // Check sandbox image
  check('Sandbox Docker image', () => {
    const { SANDBOX_IMAGE } = require('./lib/constants');
    const r = spawnSync('docker', ['image', 'inspect', SANDBOX_IMAGE], { encoding: 'utf-8', stdio: 'pipe' });
    if (r.status !== 0) throw new Error(`Image '${SANDBOX_IMAGE}' not found. Run: cymclaw install`);
    return SANDBOX_IMAGE;
  });

  console.log('');
  if (allOk) {
    console.log('  \x1b[32m✓ All checks passed.\x1b[0m\n');
  } else {
    console.log('  \x1b[33m⚠ Some checks failed. See suggestions above.\x1b[0m\n');
    process.exit(1);
  }
}

async function cmdUpdate() {
  console.log('\n  \x1b[1mUpdating CymClaw\x1b[0m from GitHub...\n');
  const repo = 'https://github.com/cympotek/CymClaw.git';

  // Check if running from a git checkout
  const gitDir = path.join(ROOT, '.git');
  if (fs.existsSync(gitDir)) {
    console.log('  Pulling latest changes from git...');
    const r = spawnSync('git', ['pull', '--ff-only'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) {
      console.error('  \x1b[31m✗\x1b[0m git pull failed. Resolve conflicts and retry.');
      process.exit(1);
    }
    console.log('  Installing updated dependencies...');
    const r2 = spawnSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
    if (r2.status !== 0) {
      console.error('  \x1b[31m✗\x1b[0m pnpm install failed.');
      process.exit(1);
    }
  } else {
    console.log('  Installing latest version from GitHub...');
    const r = spawnSync('pnpm', ['install', '-g', `git+${repo}`], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error('  \x1b[31m✗\x1b[0m Update failed. Try: pnpm install -g git+' + repo);
      process.exit(1);
    }
  }

  const pkg = require('../package.json');
  console.log(`\n  \x1b[32m✓\x1b[0m CymClaw updated to v${pkg.version}\n`);
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
    case 'doctor':     cmdDoctor(); break;
    case 'update':     await cmdUpdate(); break;
    default:
      console.error(`  Unknown command: ${cmd}`);
      console.error(`  Run 'cymclaw help' for usage.`);
      process.exit(1);
  }
})();
