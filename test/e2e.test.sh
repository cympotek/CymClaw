#!/usr/bin/env bash
# CymClaw — end-to-end smoke tests
# Requires: Docker running, cymclaw installed
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

ok()   { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m  %s\n' "$*"; FAILED=1; }
skip() { printf '  \033[33m~\033[0m  %s (skipped)\n' "$*"; }

FAILED=0
TIMEOUT=30

echo ""
echo "  CymClaw E2E Smoke Tests"
echo "  ─────────────────────────────────────────"
echo ""

# ── 1. cymclaw binary ─────────────────────────────────────────────
if command -v cymclaw &>/dev/null; then
  ok "cymclaw binary on PATH"
else
  fail "cymclaw not found on PATH"
  echo "  Run: npm install -g . or bash install.sh"
  exit 1
fi

# ── 2. version flag ───────────────────────────────────────────────
VER="$(cymclaw --version 2>/dev/null || echo '')"
if [[ -n "$VER" ]]; then
  ok "cymclaw --version → ${VER}"
else
  fail "cymclaw --version returned empty"
fi

# ── 3. help output ────────────────────────────────────────────────
if cymclaw help 2>&1 | grep -q 'install'; then
  ok "cymclaw help shows expected commands"
else
  fail "cymclaw help missing expected output"
fi

# ── 4. Docker available ───────────────────────────────────────────
if docker info &>/dev/null; then
  ok "Docker daemon running"
else
  skip "Docker not running — skipping container tests"
  echo ""
  echo "  ${FAILED} failures."
  [[ "$FAILED" -eq 0 ]] && echo "  All checks passed." || exit 1
  exit 0
fi

# ── 5. cymclaw start (requires config) ───────────────────────────
CONFIG="${HOME}/.cymclaw/config.json"
if [[ -f "$CONFIG" ]] && node -e "const c=JSON.parse(require('fs').readFileSync('${CONFIG}','utf-8'));process.exit(c.geminiApiKey?0:1)" 2>/dev/null; then
  ok "Config with API key found"

  cymclaw start 2>&1 | tail -5
  ok "cymclaw start completed"

  # Wait for sandbox
  retries=0
  while ! docker ps --filter name="^/cymclaw-sandbox$" --format '{{.Names}}' | grep -q cymclaw-sandbox; do
    retries=$(( retries + 1 ))
    [[ "$retries" -gt "$TIMEOUT" ]] && { fail "Sandbox did not start within ${TIMEOUT}s"; break; }
    sleep 1
  done
  [[ "$retries" -le "$TIMEOUT" ]] && ok "Sandbox container running"

  # ── 6. Gateway health check ──────────────────────────────────
  GPORT="$(node -e "try{const c=JSON.parse(require('fs').readFileSync('${CONFIG}','utf-8'));console.log(c.gatewayPort||8899)}catch{console.log(8899)}" 2>/dev/null)"
  GATEWAY_STATUS="$(curl -sf "http://localhost:${GPORT}/health" | node -e "let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{try{console.log(JSON.parse(b).status)}catch{console.log('error')}})" 2>/dev/null || echo 'error')"
  if [[ "$GATEWAY_STATUS" == "ok" ]]; then
    ok "Gateway /health → ok"
  else
    fail "Gateway /health returned: ${GATEWAY_STATUS}"
  fi

  # ── 7. Container exec ─────────────────────────────────────────
  if docker exec cymclaw-sandbox node --version &>/dev/null; then
    ok "docker exec into sandbox works"
  else
    fail "docker exec into sandbox failed"
  fi

  # ── 8. openclaw available in sandbox ──────────────────────────
  if docker exec cymclaw-sandbox openclaw --version &>/dev/null; then
    ok "openclaw CLI available in sandbox"
  else
    fail "openclaw CLI not found in sandbox"
  fi

  # ── 9. Cleanup ───────────────────────────────────────────────
  cymclaw stop 2>&1 | tail -2
  ok "cymclaw stop completed"

else
  skip "No API key configured — skipping live sandbox tests"
  skip "  Run: cymclaw install to configure"
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "  \033[32mAll E2E checks passed.\033[0m"
else
  echo "  \033[31m${FAILED} check(s) failed.\033[0m"
  exit 1
fi
echo ""
