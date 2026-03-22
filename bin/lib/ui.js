// CymClaw — web UI launcher
// SPDX-License-Identifier: Apache-2.0

'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { execSync, spawnSync } = require('child_process');
const { loadConfig, saveConfig, CONFIG_DIR } = require('./config');
const { ROOT } = require('./runner');
const { UI_PORT, GATEWAY_PORT } = require('./constants');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'http://localhost:' + (process.env.CYMCLAW_UI_PORT || UI_PORT),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
  });
}

function isGatewayRunning(port) {
  try {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => { req.destroy(); resolve(false); });
    });
  } catch {
    return Promise.resolve(false);
  }
}

async function launchUi() {
  const cfg = loadConfig();
  const port = cfg.uiPort || UI_PORT;
  const uiDir = path.join(ROOT, 'ui');

  const server = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return;
    }

    // ── GET /api/config ───────────────────────────────────────────
    if (req.method === 'GET' && req.url === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadConfig()));
      return;
    }

    // ── POST /api/config ──────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/config') {
      const body = await readBody(req);
      try {
        const incoming = JSON.parse(body);
        const current = loadConfig();
        saveConfig({ ...current, ...incoming });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400); res.end('Bad Request');
      }
      return;
    }

    // ── GET /api/status ───────────────────────────────────────────
    if (req.method === 'GET' && req.url === '/api/status') {
      const { dockerPs } = require('./docker');
      const { SANDBOX_NAME } = require('./constants');
      const currentCfg = loadConfig();
      const gPort = currentCfg.gatewayPort || GATEWAY_PORT;

      const sandboxRunning = dockerPs(SANDBOX_NAME);
      const gatewayRunning = await isGatewayRunning(gPort);

      const auditPath = path.join(CONFIG_DIR, 'audit.log');
      let recentLogs = [];
      if (fs.existsSync(auditPath)) {
        recentLogs = fs.readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean).slice(-20);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sandboxRunning, gatewayRunning, recentLogs }));
      return;
    }

    // ── POST /api/sandbox/start ───────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/sandbox/start') {
      try {
        spawnSync('cymclaw', ['start'], { stdio: 'ignore', detached: true });
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── POST /api/sandbox/stop ────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/sandbox/stop') {
      try {
        spawnSync('cymclaw', ['stop'], { stdio: 'ignore' });
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── Static files ──────────────────────────────────────────────
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(uiDir, filePath);
    if (!filePath.startsWith(uiDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }

    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`  \x1b[32m✓\x1b[0m CymClaw UI running at \x1b[34m${url}\x1b[0m`);
    console.log('  Press Ctrl+C to stop the UI server.');
    try {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      execSync(`${opener} ${url}`, { stdio: 'ignore' });
    } catch {}
  });

  await new Promise(() => {});
}

module.exports = { launchUi };
