// CymClaw — start sandbox + gateway
// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, spawn } = require('child_process');

const { ROOT }         = require('./runner');
const { loadConfig, CONFIG_DIR } = require('./config');
const {
  SANDBOX_NAME, GATEWAY_NAME, NETWORK_NAME, SANDBOX_IMAGE,
  GATEWAY_PORT, SANDBOX_PORT,
} = require('./constants');
const {
  dockerPs, dockerStop, dockerRm, dockerNetworkExists, dockerNetworkCreate,
  dockerVolumeCreate,
} = require('./docker');

async function startSandbox() {
  const cfg = loadConfig();

  if (!cfg.geminiApiKey) {
    console.error('  \x1b[31m✗\x1b[0m No Gemini API key configured. Run: cymclaw install');
    process.exit(1);
  }

  // Ensure network exists (may have been removed)
  if (!dockerNetworkExists(NETWORK_NAME)) {
    dockerNetworkCreate(NETWORK_NAME, '--driver bridge --internal');
  }

  // Ensure workspace volume
  dockerVolumeCreate('cymclaw-workspace');

  // Stop existing containers cleanly
  if (dockerPs(SANDBOX_NAME)) {
    console.log(`  Stopping existing sandbox...`);
    dockerStop(SANDBOX_NAME, { ignoreError: true });
    dockerRm(SANDBOX_NAME, { ignoreError: true });
  }
  if (dockerPs(GATEWAY_NAME)) {
    dockerStop(GATEWAY_NAME, { ignoreError: true });
    dockerRm(GATEWAY_NAME, { ignoreError: true });
  }

  // ── Start gateway ─────────────────────────────────────────────
  console.log(`  Starting inference gateway on port ${GATEWAY_PORT}...`);
  const gatewayDir = path.join(ROOT, 'gateway');

  // The gateway runs as a plain Node.js process on the host (not in Docker)
  // so it can reach the internet and forward to Gemini while the sandbox
  // is --network=none / internal-only.
  const gatewayEnv = {
    ...process.env,
    GEMINI_API_KEY: cfg.geminiApiKey,
    GEMINI_MODEL: cfg.model,
    GATEWAY_PORT: String(cfg.gatewayPort || GATEWAY_PORT),
    WHITELIST: (cfg.networkWhitelist || []).join(','),
    AUDIT_LOG: cfg.logAudit ? '1' : '0',
    AUDIT_LOG_PATH: path.join(CONFIG_DIR, 'audit.log'),
  };

  const gatewayProc = spawn('node', [path.join(gatewayDir, 'server.js')], {
    env: gatewayEnv,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  gatewayProc.unref();

  // Save gateway PID
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONFIG_DIR, 'gateway.pid'), String(gatewayProc.pid), { mode: 0o600 });

  // Brief wait for gateway to bind
  await new Promise((r) => setTimeout(r, 800));
  console.log(`  \x1b[32m✓\x1b[0m Gateway started (pid ${gatewayProc.pid})`);

  // ── Start sandbox ─────────────────────────────────────────────
  console.log(`  Starting sandbox '${SANDBOX_NAME}'...`);

  const seccompPath = path.join(CONFIG_DIR, 'cymclaw-seccomp.json');
  const hasSeccomp  = fs.existsSync(seccompPath);

  // Get host gateway IP (the gateway is on the host, reachable from bridge)
  let hostGatewayIp = '172.17.0.1'; // docker0 default
  try {
    const info = execSync(`docker network inspect ${NETWORK_NAME} --format '{{(index .IPAM.Config 0).Gateway}}'`, {
      encoding: 'utf-8', stdio: ['pipe','pipe','pipe'],
    }).trim();
    if (info) hostGatewayIp = info;
  } catch {}

  const seccompOpt = hasSeccomp
    ? `--security-opt seccomp=${seccompPath}`
    : '--security-opt seccomp=unconfined';

  const dockerRunCmd = [
    'docker run -d',
    `--name ${SANDBOX_NAME}`,
    `--network ${NETWORK_NAME}`,
    seccompOpt,
    '--security-opt no-new-privileges',
    '--read-only',
    '--tmpfs /tmp:exec,size=512m',
    '--tmpfs /run:size=64m',
    `-v cymclaw-workspace:/sandbox/workspace`,
    `-p ${SANDBOX_PORT}:${SANDBOX_PORT}`,
    // Point gateway URL to host gateway IP
    `-e OPENAI_API_KEY=${cfg.geminiApiKey}`,
    `-e OPENAI_BASE_URL=http://${hostGatewayIp}:${cfg.gatewayPort || GATEWAY_PORT}/v1`,
    `-e CYMCLAW_MODEL=${cfg.model}`,
    // Allow container to reach host gateway via host-gateway extra host
    `--add-host=cymclaw-gateway:${hostGatewayIp}`,
    SANDBOX_IMAGE,
  ].join(' \\\n    ');

  const { spawnSync } = require('child_process');
  const result = spawnSync('bash', ['-c', dockerRunCmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  if (result.status !== 0) {
    console.error('  \x1b[31m✗\x1b[0m Failed to start sandbox:');
    console.error('  ' + (result.stderr || '').toString().trim());
    process.exit(1);
  }

  console.log(`  \x1b[32m✓\x1b[0m Sandbox started`);

  // ── Summary ───────────────────────────────────────────────────
  console.log('');
  console.log('  ──────────────────────────────────────────────────');
  console.log(`  Sandbox  ${SANDBOX_NAME}`);
  console.log(`  Model    ${cfg.model} (Google AI via gateway)`);
  console.log(`  Gateway  http://localhost:${cfg.gatewayPort || GATEWAY_PORT}`);
  console.log('  ──────────────────────────────────────────────────');
  console.log('');
  console.log('  cymclaw connect      — open shell inside sandbox');
  console.log('  cymclaw status       — check health');
  console.log('  cymclaw logs -f      — stream logs');
  console.log('  cymclaw ui           — open web config UI');
  console.log('');
}

module.exports = { startSandbox };
