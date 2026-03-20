#!/usr/bin/env node
// CymClaw inference gateway — HTTP proxy that routes AI calls to Gemini
// Runs on the HOST, not inside Docker.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const http   = require('http');
const https  = require('https');
const url    = require('url');
const fs     = require('fs');
const path   = require('path');

// ── Config from environment ────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.0-flash-exp';
const GATEWAY_PORT   = parseInt(process.env.GATEWAY_PORT || '8899', 10);
const AUDIT_LOG      = process.env.AUDIT_LOG === '1';
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(process.env.HOME || '/tmp', '.cymclaw', 'audit.log');
const WHITELIST_RAW  = process.env.WHITELIST || '';

// Gemini OpenAI-compatible endpoint
const GEMINI_UPSTREAM = {
  host: 'generativelanguage.googleapis.com',
  basePath: '/v1beta/openai',
  port: 443,
};

// Build whitelist set — always include Gemini
const WHITELIST = new Set([
  'generativelanguage.googleapis.com',
  ...(WHITELIST_RAW ? WHITELIST_RAW.split(',').map((h) => h.trim()).filter(Boolean) : []),
]);

// ── Audit logging ──────────────────────────────────────────────────
function auditLog(entry) {
  if (!AUDIT_LOG) return;
  const line = `[${new Date().toISOString()}] ${entry}\n`;
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch {}
}

// ── Request helpers ────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isWhitelisted(targetHost) {
  if (WHITELIST.has(targetHost)) return true;
  // Check suffix match (e.g. *.googleapis.com)
  for (const h of WHITELIST) {
    if (h.startsWith('*.') && targetHost.endsWith(h.slice(1))) return true;
  }
  return false;
}

// ── Health check ───────────────────────────────────────────────────
function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    model: GEMINI_MODEL,
    whitelist: [...WHITELIST],
    timestamp: new Date().toISOString(),
  }));
}

// ── Proxy to Gemini ────────────────────────────────────────────────
async function proxyToGemini(req, res, body) {
  const parsedUrl = url.parse(req.url);
  // Strip /v1 prefix if present, map to Gemini's path
  let targetPath = parsedUrl.pathname || '/';
  if (targetPath.startsWith('/v1')) {
    targetPath = GEMINI_UPSTREAM.basePath + targetPath.slice(3);
  } else {
    targetPath = GEMINI_UPSTREAM.basePath + targetPath;
  }
  if (parsedUrl.query) targetPath += '?' + parsedUrl.query;

  const upstreamHeaders = {
    ...req.headers,
    host: GEMINI_UPSTREAM.host,
    authorization: `Bearer ${GEMINI_API_KEY}`,
    'content-length': body.length,
  };
  // Remove hop-by-hop headers
  ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
   'te', 'trailers', 'transfer-encoding', 'upgrade'].forEach((h) => delete upstreamHeaders[h]);

  auditLog(`ALLOW ${req.method} ${GEMINI_UPSTREAM.host}${targetPath} (${body.length}B)`);

  return new Promise((resolve) => {
    const upstreamReq = https.request({
      hostname: GEMINI_UPSTREAM.host,
      port: GEMINI_UPSTREAM.port,
      path: targetPath,
      method: req.method,
      headers: upstreamHeaders,
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
      upstreamRes.on('end', resolve);
    });

    upstreamReq.on('error', (err) => {
      console.error(`[gateway] upstream error: ${err.message}`);
      auditLog(`ERROR upstream: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Gateway upstream error', type: 'proxy_error' } }));
      }
      resolve();
    });

    upstreamReq.write(body);
    upstreamReq.end();
  });
}

// ── Proxy to arbitrary whitelisted host ────────────────────────────
async function proxyToHost(req, res, body, targetHost) {
  const parsedUrl = url.parse(req.url);
  const targetPath = parsedUrl.path || '/';

  const upstreamHeaders = { ...req.headers, host: targetHost };
  ['connection', 'keep-alive', 'transfer-encoding'].forEach((h) => delete upstreamHeaders[h]);
  if (body.length > 0) upstreamHeaders['content-length'] = body.length;

  auditLog(`ALLOW ${req.method} ${targetHost}${targetPath} (${body.length}B)`);

  return new Promise((resolve) => {
    const upstreamReq = https.request({
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: req.method,
      headers: upstreamHeaders,
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
      upstreamRes.on('end', resolve);
    });

    upstreamReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502); res.end(JSON.stringify({ error: err.message }));
      }
      resolve();
    });
    if (body.length > 0) upstreamReq.write(body);
    upstreamReq.end();
  });
}

// ── Main handler ───────────────────────────────────────────────────
async function handleRequest(req, res) {
  if (req.url === '/health' || req.url === '/healthz') {
    handleHealth(req, res); return;
  }

  const body = await readBody(req);

  // Determine target host from header or URL
  const targetHost = req.headers['x-cymclaw-target'] || GEMINI_UPSTREAM.host;

  if (!isWhitelisted(targetHost)) {
    auditLog(`BLOCK ${req.method} ${targetHost}${req.url}`);
    console.log(`[gateway] BLOCKED: ${targetHost}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message: `CymClaw gateway: host '${targetHost}' is not whitelisted`,
        type: 'policy_violation',
        code: 403,
      },
    }));
    return;
  }

  // Route AI calls to Gemini (OpenAI-compat path)
  if (req.url.startsWith('/v1/') || req.url.startsWith('/v1beta/') ||
      targetHost === GEMINI_UPSTREAM.host) {
    await proxyToGemini(req, res, body);
    return;
  }

  await proxyToHost(req, res, body, targetHost);
}

// ── Server ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error(`[gateway] unhandled error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(500); res.end(JSON.stringify({ error: 'internal gateway error' }));
    }
  });
});

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log(`[cymclaw-gateway] listening on :${GATEWAY_PORT}`);
  console.log(`[cymclaw-gateway] model: ${GEMINI_MODEL}`);
  console.log(`[cymclaw-gateway] whitelist: ${[...WHITELIST].join(', ')}`);
  if (!GEMINI_API_KEY) {
    console.warn('[cymclaw-gateway] WARNING: GEMINI_API_KEY is not set');
  }
});

server.on('error', (err) => {
  console.error(`[cymclaw-gateway] server error: ${err.message}`);
  process.exit(1);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
