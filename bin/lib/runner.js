// CymClaw — shell runner utilities
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function run(cmd, opts = {}) {
  const stdio = opts.stdio ?? ['ignore', 'inherit', 'inherit'];
  const result = spawnSync('bash', ['-c', cmd], {
    stdio,
    cwd: ROOT,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.ignoreError) {
    console.error(`  Command failed (exit ${result.status}): ${cmd.slice(0, 120)}`);
    process.exit(result.status || 1);
  }
  return result;
}

function runInteractive(cmd, opts = {}) {
  const result = spawnSync('bash', ['-c', cmd], {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.ignoreError) {
    console.error(`  Command failed (exit ${result.status}): ${cmd.slice(0, 120)}`);
    process.exit(result.status || 1);
  }
  return result;
}

function runCapture(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (opts.ignoreError) return '';
    throw err;
  }
}

module.exports = { ROOT, run, runInteractive, runCapture };
