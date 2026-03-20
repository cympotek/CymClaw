// CymClaw Config UI
// SPDX-License-Identifier: Apache-2.0

'use strict';

// ── State ─────────────────────────────────────────────────────────
let config = {};
let statusInterval = null;

// ── API helpers ───────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── Status ────────────────────────────────────────────────────────
async function refreshStatus() {
  try {
    const s = await apiGet('/api/status');
    const badge = document.getElementById('status-badge');

    const sandboxDot = document.getElementById('sandbox-dot');
    const sandboxVal = document.getElementById('sandbox-status');
    sandboxDot.className = 'status-dot ' + (s.sandboxRunning ? 'ok' : 'error');
    sandboxVal.textContent = s.sandboxRunning ? 'running' : 'stopped';

    const allOk = s.sandboxRunning;
    badge.className = 'badge ' + (allOk ? 'badge-ok' : 'badge-error');
    badge.textContent = allOk ? 'running' : 'stopped';

    // Audit log
    if (s.recentLogs && s.recentLogs.length > 0) {
      const el = document.getElementById('audit-log');
      el.innerHTML = s.recentLogs.map((line) => {
        const cls = line.includes('ALLOW') ? 'allow'
                  : line.includes('BLOCK') ? 'block'
                  : line.includes('ERROR') ? 'error-line' : '';
        return `<p class="${cls}">${escHtml(line)}</p>`;
      }).join('');
      el.scrollTop = el.scrollHeight;
    }
  } catch (err) {
    document.getElementById('status-badge').className = 'badge badge-error';
    document.getElementById('status-badge').textContent = 'error';
  }
}

// ── Config form ───────────────────────────────────────────────────
async function loadConfig() {
  config = await apiGet('/api/config');
  populateForm(config);
}

function populateForm(cfg) {
  document.getElementById('geminiApiKey').value = cfg.geminiApiKey || '';
  document.getElementById('model').value       = cfg.model || 'gemini-2.0-flash-exp';
  document.getElementById('logAudit').checked  = !!cfg.logAudit;
  document.getElementById('gatewayPort').value = cfg.gatewayPort || 8899;
  renderWhitelist(cfg.networkWhitelist || []);
}

document.getElementById('config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    geminiApiKey: document.getElementById('geminiApiKey').value.trim(),
    model:        document.getElementById('model').value,
    logAudit:     document.getElementById('logAudit').checked,
    gatewayPort:  parseInt(document.getElementById('gatewayPort').value, 10),
    networkWhitelist: config.networkWhitelist || [],
  };
  try {
    await apiPost('/api/config', data);
    config = { ...config, ...data };
    const msg = document.getElementById('save-status');
    msg.textContent = '✓ Saved';
    setTimeout(() => (msg.textContent = ''), 2000);
  } catch {
    alert('Failed to save config.');
  }
});

// ── Whitelist ─────────────────────────────────────────────────────
function renderWhitelist(list) {
  const ul = document.getElementById('whitelist');
  ul.innerHTML = '';
  list.forEach((host) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escHtml(host)}</span>
      <button class="remove-host" title="Remove" data-host="${escHtml(host)}">×</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.remove-host').forEach((btn) => {
    btn.addEventListener('click', () => removeHost(btn.dataset.host));
  });
}

function removeHost(host) {
  config.networkWhitelist = (config.networkWhitelist || []).filter((h) => h !== host);
  renderWhitelist(config.networkWhitelist);
  saveWhitelist();
}

document.getElementById('btn-add-host').addEventListener('click', () => {
  const input = document.getElementById('new-host');
  const host = input.value.trim();
  if (!host) return;
  if ((config.networkWhitelist || []).includes(host)) {
    input.value = '';
    return;
  }
  config.networkWhitelist = [...(config.networkWhitelist || []), host];
  renderWhitelist(config.networkWhitelist);
  saveWhitelist();
  input.value = '';
});

document.getElementById('new-host').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-add-host').click(); }
});

async function saveWhitelist() {
  try {
    await apiPost('/api/config', { networkWhitelist: config.networkWhitelist });
  } catch {}
}

// ── Sandbox controls ───────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', async () => {
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-start').textContent = 'Starting...';
  try {
    await apiPost('/api/sandbox/start', {});
  } catch {}
  setTimeout(() => {
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-start').textContent = '▶ Start';
    refreshStatus();
  }, 3000);
});

document.getElementById('btn-stop').addEventListener('click', async () => {
  if (!confirm('Stop the CymClaw sandbox?')) return;
  try {
    await apiPost('/api/sandbox/stop', {});
  } catch {}
  setTimeout(refreshStatus, 1000);
});

document.getElementById('btn-refresh').addEventListener('click', refreshStatus);

// ── Audit log clear ───────────────────────────────────────────────
document.getElementById('btn-clear-audit').addEventListener('click', () => {
  document.getElementById('audit-log').innerHTML = '';
});

// ── Helpers ───────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────
(async () => {
  await loadConfig();
  await refreshStatus();
  statusInterval = setInterval(refreshStatus, 5000);
})();
