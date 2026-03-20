// CymClaw — Docker helpers
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { execSync } = require('child_process');

function dockerRun(args, opts = {}) {
  const cmd = `docker run ${args}`;
  return _exec(cmd, opts);
}

function dockerPs(name) {
  try {
    const out = execSync(`docker ps --filter name=^/${name}$ --format '{{.Names}}'`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return out === name;
  } catch {
    return false;
  }
}

function dockerStop(name, opts = {}) {
  return _exec(`docker stop ${name}`, opts);
}

function dockerRm(name, opts = {}) {
  return _exec(`docker rm -f ${name}`, opts);
}

function dockerExec(name, shellCmd, opts = {}) {
  return _exec(`docker exec ${name} ${shellCmd}`, opts);
}

function dockerLogs(name, follow = false) {
  const flag = follow ? ' -f' : '';
  return _exec(`docker logs${flag} ${name}`, { stdio: 'inherit' });
}

function dockerNetworkExists(name) {
  try {
    execSync(`docker network inspect ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function dockerNetworkCreate(name, opts = '') {
  return _exec(`docker network create ${opts} ${name}`, { ignoreError: true });
}

function dockerInspect(name, format) {
  try {
    return execSync(`docker inspect ${name} --format '${format}'`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function dockerBuild(contextPath, tag, opts = '') {
  return _exec(`docker build ${opts} -t ${tag} ${contextPath}`, { stdio: 'inherit' });
}

function dockerVolumeCreate(name) {
  return _exec(`docker volume create ${name}`, { ignoreError: true });
}

function _exec(cmd, opts = {}) {
  const { spawnSync } = require('child_process');
  const result = spawnSync('bash', ['-c', cmd], {
    stdio: opts.stdio ?? ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.ignoreError) {
    throw new Error(`Docker command failed (${result.status}): ${cmd}`);
  }
  return result;
}

module.exports = {
  dockerRun,
  dockerPs,
  dockerStop,
  dockerRm,
  dockerExec,
  dockerLogs,
  dockerNetworkExists,
  dockerNetworkCreate,
  dockerInspect,
  dockerBuild,
  dockerVolumeCreate,
};
