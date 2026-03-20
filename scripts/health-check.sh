#!/usr/bin/env bash
# CymClaw — system health check
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

ok()   { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m  %s\n' "$*"; FAILED=1; }
warn() { printf '  \033[33m~\033[0m  %s\n' "$*"; }

FAILED=0
CONFIG_DIR="${HOME}/.cymclaw"
CONFIG_FILE="${CONFIG_DIR}/config.json"
SANDBOX_NAME="cymclaw-sandbox"
GATEWAY_PORT="${GATEWAY_PORT:-8899}"

echo ""
echo "  CymClaw Health Check"
echo "  ─────────────────────────────────────────"
echo ""

# 1. Docker
if docker info &>/dev/null; then
  ok "Docker daemon running ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
  fail "Docker daemon not running"
fi

# 2. Docker network
if docker network inspect cymclaw-isolated &>/dev/null; then
  ok "Network 'cymclaw-isolated' exists"
else
  warn "Network 'cymclaw-isolated' not found (run: cymclaw install)"
fi

# 3. Sandbox container
if docker ps --filter name="^/${SANDBOX_NAME}$" --format '{{.Names}}' | grep -q "^${SANDBOX_NAME}$"; then
  ok "Sandbox '${SANDBOX_NAME}' is running"
else
  warn "Sandbox '${SANDBOX_NAME}' is not running (run: cymclaw start)"
fi

# 4. Gateway process
GATEWAY_PID_FILE="${CONFIG_DIR}/gateway.pid"
if [[ -f "$GATEWAY_PID_FILE" ]]; then
  PID="$(cat "$GATEWAY_PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    ok "Gateway running (pid ${PID})"
  else
    warn "Gateway pid file exists but process ${PID} is dead"
  fi
else
  warn "Gateway not running (run: cymclaw start)"
fi

# 5. Gateway HTTP check
if curl -sf "http://localhost:${GATEWAY_PORT}/health" &>/dev/null; then
  ok "Gateway responding on :${GATEWAY_PORT}"
else
  warn "Gateway not responding on :${GATEWAY_PORT}"
fi

# 6. Config
if [[ -f "$CONFIG_FILE" ]]; then
  ok "Config found at ${CONFIG_FILE}"
  API_KEY="$(node -e "try{const c=JSON.parse(require('fs').readFileSync('${CONFIG_FILE}','utf-8'));console.log(c.geminiApiKey?'set':'missing')}catch{console.log('error')}" 2>/dev/null)"
  if [[ "$API_KEY" == "set" ]]; then
    ok "Gemini API key is configured"
  else
    fail "Gemini API key is not configured (run: cymclaw config)"
  fi
else
  fail "Config not found (run: cymclaw install)"
fi

# 7. Seccomp profile
if [[ -f "${CONFIG_DIR}/cymclaw-seccomp.json" ]]; then
  ok "Seccomp profile present"
else
  warn "Seccomp profile missing (run: cymclaw install)"
fi

# 8. Node.js version
NODE_VER="$(node --version 2>/dev/null || echo 'missing')"
if [[ "$NODE_VER" != "missing" ]]; then
  MAJOR="${NODE_VER#v}"; MAJOR="${MAJOR%%.*}"
  if (( MAJOR >= 22 )); then
    ok "Node.js ${NODE_VER}"
  else
    warn "Node.js ${NODE_VER} (recommend v22+)"
  fi
else
  fail "Node.js not found"
fi

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "  \033[32mAll checks passed.\033[0m"
else
  echo "  \033[31mSome checks failed — see above.\033[0m"
  exit 1
fi
echo ""
