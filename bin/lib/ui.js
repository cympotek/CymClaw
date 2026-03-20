// CymClaw — web UI launcher
// SPDX-License-Identifier: Apache-2.0

'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');
const { loadConfig, saveConfig } = require('./config');
const { ROOT } = require('./runner');
const { UI_PORT } = require('./constants');

async function launchUi() {
  const cfg = loadConfig();
  const port = cfg.uiPort || UI_PORT;
  const uiDir = path.join(ROOT, 'ui');

  const server = http.createServer((req, res) => {
    // API endpoints
    if (req.method === 'GET' && req.url === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadConfig()));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/config') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body);
          const current = loadConfig();
          saveConfig({ ...current, ...incoming });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400); res.end('Bad Request');
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      const { dockerPs } = require('./docker');
      const { SANDBOX_NAME, GATEWAY_PORT } = require('./constants');
      const sandboxRunning = dockerPs(SANDBOX_NAME);
      const auditPath = path.join(require('./config').CONFIG_DIR, 'audit.log');
      let recentLogs = [];
      if (fs.existsSync(auditPath)) {
        recentLogs = fs.readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean).slice(-20);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sandboxRunning, recentLogs }));
      return;
    }

    // Static files
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
    // Open browser
    try {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      execSync(`${opener} ${url}`, { stdio: 'ignore' });
    } catch {}
  });

  // Keep alive
  await new Promise(() => {});
}

module.exports = { launchUi };
