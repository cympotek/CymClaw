#!/bin/bash
# CymClaw sandbox entrypoint
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# ── Patch openclaw.json with runtime env vars ─────────────────────
# OPENAI_API_KEY and OPENAI_BASE_URL are set by docker run
# We patch the openclaw.json to use the gateway URL at runtime.
if [[ -n "${OPENAI_BASE_URL:-}" ]] && [[ -f /sandbox/.openclaw/openclaw.json ]]; then
  node - <<'PATCH'
const fs = require('fs');
const p = '/sandbox/.openclaw/openclaw.json';
const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
const baseUrl = process.env.OPENAI_BASE_URL || 'http://cymclaw-gateway:8899/v1';
const apiKey  = process.env.OPENAI_API_KEY  || 'placeholder';
const model   = process.env.CYMCLAW_MODEL   || 'gemini-2.0-flash-exp';

if (cfg.models && cfg.models.providers && cfg.models.providers.gemini) {
  cfg.models.providers.gemini.baseUrl = baseUrl;
  cfg.models.providers.gemini.apiKey  = apiKey;
  if (cfg.agents && cfg.agents.defaults && cfg.agents.defaults.model) {
    cfg.agents.defaults.model.primary = model;
  }
  if (cfg.models.providers.gemini.models && cfg.models.providers.gemini.models.length > 0) {
    cfg.models.providers.gemini.models[0].id   = model;
    cfg.models.providers.gemini.models[0].name = 'Gemini 3 Flash Preview';
  }
}
fs.writeFileSync(p, JSON.stringify(cfg, null, 2), { mode: 0o600 });
PATCH
fi

echo "╔═══════════════════════════════════════════╗"
echo "║   CymClaw Sandbox — $(date '+%Y-%m-%d %H:%M')      ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Model:   ${CYMCLAW_MODEL:-gemini-2.0-flash-exp}"
echo "  Gateway: ${OPENAI_BASE_URL:-http://cymclaw-gateway:8899/v1}"
echo ""
echo "  Commands:"
echo "    openclaw tui                          — interactive chat"
echo "    openclaw agent --agent main --local   — CLI agent"
echo ""

exec "$@"
