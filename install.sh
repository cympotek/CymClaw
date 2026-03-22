#!/usr/bin/env bash
# CymClaw installer — Ubuntu 22.04+ and macOS (Apple Silicon)
# SPDX-License-Identifier: Apache-2.0
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/cympotek/CymClaw/main/install.sh | bash
#   or locally: bash install.sh

set -euo pipefail

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

command_exists() { command -v "$1" &>/dev/null; }

MIN_NODE_MAJOR=22
CYMCLAW_SHIM_DIR="${HOME}/.local/bin"
ORIGINAL_PATH="${PATH:-}"

version_major() { printf '%s\n' "${1#v}" | cut -d. -f1; }

version_gte() {
  local IFS=.
  # shellcheck disable=SC2206
  local -a a=($1) b=($2)
  for i in 0 1 2; do
    local ai=${a[$i]:-0} bi=${b[$i]:-0}
    (( ai > bi )) && return 0
    (( ai < bi )) && return 1
  done
  return 0
}

ensure_nvm_loaded() {
  if [[ -z "${NVM_DIR:-}" ]]; then export NVM_DIR="$HOME/.nvm"; fi
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then \. "$NVM_DIR/nvm.sh"; fi
}

refresh_path() {
  ensure_nvm_loaded
  local npm_bin
  npm_bin="$(npm config get prefix 2>/dev/null)/bin" || true
  if [[ -n "$npm_bin" && -d "$npm_bin" && ":$PATH:" != *":$npm_bin:"* ]]; then
    export PATH="$npm_bin:$PATH"
  fi
  if [[ -d "$CYMCLAW_SHIM_DIR" && ":$PATH:" != *":$CYMCLAW_SHIM_DIR:"* ]]; then
    export PATH="$CYMCLAW_SHIM_DIR:$PATH"
  fi
}

# ── 1. Docker ─────────────────────────────────────────────────────
install_docker_linux() {
  if command_exists docker; then
    info "Docker found: $(docker --version)"
    return
  fi
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
  info "Docker installed. You may need to log out and back in for group membership."
  # Start Docker service
  sudo systemctl enable --now docker || true
}

install_docker_macos() {
  if command_exists docker; then
    info "Docker found: $(docker --version)"
    return
  fi
  if command_exists brew; then
    info "Installing Docker Desktop via Homebrew..."
    brew install --cask docker
    info "Docker Desktop installed. Please open Docker.app to complete setup, then re-run this script."
    exit 0
  else
    error "Docker not found. Install Docker Desktop from https://docs.docker.com/desktop/mac/install/"
  fi
}

ensure_docker() {
  local os
  os="$(uname -s)"
  if [[ "$os" == "Darwin" ]]; then
    install_docker_macos
  else
    install_docker_linux
  fi
  # Wait for Docker daemon
  local retries=0
  while ! docker info &>/dev/null; do
    retries=$(( retries + 1 ))
    if (( retries > 15 )); then
      error "Docker daemon is not running. Start Docker and retry."
    fi
    info "Waiting for Docker daemon..."
    sleep 2
  done
  info "Docker daemon is running"
}

# ── 2. Node.js ────────────────────────────────────────────────────
install_nodejs() {
  ensure_nvm_loaded
  if command_exists node; then
    local major
    major="$(version_major "$(node --version)")"
    if (( major >= MIN_NODE_MAJOR )); then
      info "Node.js OK: $(node --version)"
      return
    fi
    warn "Node.js $(node --version) is below required v${MIN_NODE_MAJOR}"
  fi
  info "Installing Node.js v${MIN_NODE_MAJOR} via nvm..."
  if [[ ! -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    local NVM_VERSION="v0.40.4"
    local NVM_SHA256="4b7412c49960c7d31e8df72da90c1fb5b8cccb419ac99537b737028d497aba4f"
    local nvm_tmp
    nvm_tmp="$(mktemp)"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" -o "$nvm_tmp"
    local actual_hash
    if command_exists sha256sum; then
      actual_hash="$(sha256sum "$nvm_tmp" | awk '{print $1}')"
    elif command_exists shasum; then
      actual_hash="$(shasum -a 256 "$nvm_tmp" | awk '{print $1}')"
    else
      warn "No SHA-256 tool found — skipping integrity check"
      actual_hash="$NVM_SHA256"
    fi
    if [[ "$actual_hash" != "$NVM_SHA256" ]]; then
      rm -f "$nvm_tmp"
      error "nvm installer integrity check failed\n  Expected: $NVM_SHA256\n  Actual:   $actual_hash"
    fi
    bash "$nvm_tmp"
    rm -f "$nvm_tmp"
    ensure_nvm_loaded
  fi
  nvm install "${MIN_NODE_MAJOR}"
  info "Node.js installed: $(node --version)"
}

# ── 3. pnpm ───────────────────────────────────────────────────────
ensure_pnpm() {
  if command_exists pnpm; then
    info "pnpm found: $(pnpm --version)"; return
  fi
  info "Installing pnpm..."
  npm install -g pnpm
  refresh_path
  info "pnpm installed: $(pnpm --version)"
}

# ── 4. CymClaw ────────────────────────────────────────────────────
install_cymclaw() {
  if [[ -f "./package.json" ]] && grep -q '"name": "cymclaw"' ./package.json 2>/dev/null; then
    info "Installing CymClaw from source..."
    pnpm install
    pnpm link --global
  else
    info "Installing CymClaw from GitHub..."
    pnpm install -g git+https://github.com/cympotek/CymClaw.git
  fi
  refresh_path
  # Create shim if npm global bin not on PATH
  local npm_bin
  npm_bin="$(npm config get prefix 2>/dev/null)/bin" || true
  if [[ -n "$npm_bin" && -x "$npm_bin/cymclaw" ]]; then
    if [[ ":$ORIGINAL_PATH:" != *":$npm_bin:"* ]]; then
      mkdir -p "$CYMCLAW_SHIM_DIR"
      ln -sfn "$npm_bin/cymclaw" "${CYMCLAW_SHIM_DIR}/cymclaw"
      refresh_path
    fi
  fi
}

verify_cymclaw() {
  if command_exists cymclaw; then
    info "Verified: cymclaw at $(command -v cymclaw)"
    return 0
  fi
  warn "cymclaw not found on PATH after install."
  warn "Add to your shell profile: export PATH=\"\$HOME/.local/bin:\$PATH\""
  warn "Then run: source ~/.bashrc  (or ~/.zshrc)"
  return 1
}

# ── 5. Onboard ────────────────────────────────────────────────────
run_onboard() {
  info "Running cymclaw install..."
  if [[ "${NON_INTERACTIVE:-}" == "1" ]]; then
    cymclaw install --non-interactive
  elif [[ -t 0 ]]; then
    cymclaw install
  elif exec 3</dev/tty; then
    info "stdin is piped — attaching to /dev/tty..."
    cymclaw install <&3 || true
    exec 3<&-
  else
    error "Interactive setup requires a TTY. Re-run in a terminal or set CYMCLAW_NON_INTERACTIVE=1."
  fi
}

post_install_message() {
  if [[ ! -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then return 0; fi
  local profile="$HOME/.bashrc"
  if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$(basename "${SHELL:-}")" == "zsh" ]]; then
    profile="$HOME/.zshrc"
  fi
  echo ""
  echo "  ──────────────────────────────────────────────────"
  warn "Your current shell may not have the updated PATH."
  echo "  Run:  source $profile  or open a new terminal."
  echo "  ──────────────────────────────────────────────────"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────
main() {
  NON_INTERACTIVE=""
  for arg in "$@"; do
    [[ "$arg" == "--non-interactive" ]] && NON_INTERACTIVE=1
  done
  NON_INTERACTIVE="${NON_INTERACTIVE:-${CYMCLAW_NON_INTERACTIVE:-}}"
  export CYMCLAW_NON_INTERACTIVE="${NON_INTERACTIVE}"

  echo ""
  echo "  ╔═════════════════════════════════════╗"
  echo "  ║        CymClaw Installer            ║"
  echo "  ║  OpenClaw · Docker · Gemini Flash   ║"
  echo "  ╚═════════════════════════════════════╝"
  echo ""

  ensure_docker
  install_nodejs
  ensure_pnpm
  install_cymclaw
  verify_cymclaw
  post_install_message
  run_onboard

  echo ""
  info "=== CymClaw installation complete ==="
  echo ""
  echo "  cymclaw start     — start sandbox + gateway"
  echo "  cymclaw connect   — shell into sandbox"
  echo "  cymclaw ui        — open web config UI"
  echo ""
}

main "$@"
