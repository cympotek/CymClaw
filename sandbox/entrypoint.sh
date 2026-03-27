#!/bin/bash
# CymClaw sandbox entrypoint
# SPDX-License-Identifier: Apache-2.0
#
# SECURITY: Lock down PATH to prevent the sandboxed agent from injecting
# malicious binaries into commands executed by this entrypoint.
# Ref: NemoClaw bb8ba78 (gateway isolation from sandbox agent)

set -euo pipefail

# Harden: limit process count to prevent fork bombs (ref: NemoClaw #809, #830)
# Best-effort: some container runtimes restrict ulimit modification.
# Set soft limit BEFORE hard limit (ref: NemoClaw #951 — wrong order caused
# silent failures when soft > hard ceiling).
if ! ulimit -Su 512 2>/dev/null; then
  echo "[SECURITY] Could not set soft nproc limit (container runtime may restrict ulimit)" >&2
fi
if ! ulimit -Hu 512 2>/dev/null; then
  echo "[SECURITY] Could not set hard nproc limit (container runtime may restrict ulimit)" >&2
fi

# SECURITY: Lock down PATH
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ── Drop unnecessary Linux capabilities ──────────────────────────
# Ref: NemoClaw #797, #917, #929
# Drop dangerous caps from the bounding set. Keeps only caps needed for
# tini/gosu privilege separation: cap_chown, cap_setuid, cap_setgid,
# cap_fowner, cap_kill.
if [ "${CYMCLAW_CAPS_DROPPED:-}" != "1" ] && command -v capsh >/dev/null 2>&1; then
  if capsh --has-p=cap_setpcap 2>/dev/null; then
    export CYMCLAW_CAPS_DROPPED=1
    exec capsh \
      --drop=cap_net_raw,cap_dac_override,cap_sys_chroot,cap_fsetid,cap_setfcap,cap_mknod,cap_audit_write,cap_net_bind_service \
      -- -c 'exec /usr/local/bin/entrypoint.sh "$@"' -- "$@"
  else
    echo "[SECURITY] CAP_SETPCAP not available — runtime already restricts capabilities" >&2
  fi
elif [ "${CYMCLAW_CAPS_DROPPED:-}" != "1" ]; then
  echo "[SECURITY WARNING] capsh not available — running with default capabilities" >&2
fi

# ── Config integrity check ────────────────────────────────────────
# Verify openclaw.json has not been tampered with since image build.
verify_config_integrity() {
  local hash_file="/sandbox/.openclaw/.config-hash"
  if [ -f "$hash_file" ]; then
    if ! (cd /sandbox/.openclaw && sha256sum -c "$hash_file" --status 2>/dev/null); then
      echo "[SECURITY] openclaw.json integrity check FAILED — config may have been tampered with"
      exit 1
    fi
  fi
}

verify_config_integrity

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
