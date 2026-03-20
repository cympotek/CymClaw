#!/usr/bin/env bash
# CymClaw — configure Docker network isolation
# SPDX-License-Identifier: Apache-2.0
#
# On Linux: creates the internal bridge + iptables whitelist rules.
# On macOS: creates the bridge only (gateway proxy enforces whitelist).

set -euo pipefail

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

NETWORK_NAME="cymclaw-isolated"
CONFIG_DIR="${HOME}/.cymclaw"
CONFIG_FILE="${CONFIG_DIR}/config.json"

# Parse whitelist from config.json
get_whitelist() {
  if [[ -f "$CONFIG_FILE" ]]; then
    node -e "
      const c = JSON.parse(require('fs').readFileSync('${CONFIG_FILE}','utf-8'));
      (c.networkWhitelist||[]).forEach(h => console.log(h));
    " 2>/dev/null || true
  fi
}

resolve_ip() {
  local host="$1"
  getent hosts "$host" 2>/dev/null | awk '{print $1; exit}' \
    || dig +short "$host" 2>/dev/null | grep -E '^[0-9.]+$' | head -1 \
    || true
}

setup_iptables() {
  local container_subnet
  container_subnet="$(docker network inspect "$NETWORK_NAME" \
    --format '{{(index .IPAM.Config 0).Subnet}}' 2>/dev/null || true)"
  if [[ -z "$container_subnet" ]]; then
    warn "Could not determine container subnet — skipping iptables rules."
    return
  fi

  info "Container subnet: ${container_subnet}"
  info "Applying iptables whitelist rules..."

  # Flush any existing CymClaw rules
  iptables -F CYMCLAW 2>/dev/null || true
  iptables -N CYMCLAW 2>/dev/null || true
  # Jump into CymClaw chain from DOCKER-USER
  iptables -D DOCKER-USER -s "$container_subnet" -j CYMCLAW 2>/dev/null || true
  iptables -I DOCKER-USER 1 -s "$container_subnet" -j CYMCLAW

  while IFS= read -r host; do
    [[ -z "$host" ]] && continue
    local ip
    ip="$(resolve_ip "$host")"
    if [[ -n "$ip" ]]; then
      iptables -A CYMCLAW -d "$ip" -j ACCEPT
      info "  Allow ${host} → ${ip}"
    else
      warn "  Could not resolve ${host} — skipping"
    fi
  done < <(get_whitelist)

  # Allow gateway port (on host, for inference routing)
  iptables -A CYMCLAW -d 172.17.0.1 -p tcp --dport 8899 -j ACCEPT
  iptables -A CYMCLAW -d 172.17.0.1 -p tcp --dport 8899 -j ACCEPT

  # Allow DNS
  iptables -A CYMCLAW -p udp --dport 53 -j ACCEPT
  iptables -A CYMCLAW -p tcp --dport 53 -j ACCEPT

  # Drop everything else from sandbox
  iptables -A CYMCLAW -j DROP

  info "iptables rules applied."
}

main() {
  local os
  os="$(uname -s)"

  # Create Docker bridge network (internal)
  if docker network inspect "$NETWORK_NAME" &>/dev/null; then
    info "Network '${NETWORK_NAME}' already exists."
  else
    info "Creating Docker network '${NETWORK_NAME}'..."
    docker network create \
      --driver bridge \
      --internal \
      --subnet 10.222.0.0/24 \
      --opt com.docker.network.bridge.name=cymclaw0 \
      "$NETWORK_NAME"
    info "Network created."
  fi

  if [[ "$os" == "Linux" ]]; then
    if [[ "$(id -u)" == "0" ]]; then
      setup_iptables
    else
      info "Not root — skipping iptables. Run with sudo for full network isolation."
      info "On macOS or without root, the gateway proxy enforces the whitelist."
    fi
  else
    info "macOS detected — network isolation enforced via gateway proxy."
    info "All inference traffic routes through localhost:$(node -e "try{const c=JSON.parse(require('fs').readFileSync('${CONFIG_FILE}','utf-8'));console.log(c.gatewayPort||8899)}catch{console.log(8899)}" 2>/dev/null || echo 8899)."
  fi

  info "Network setup complete."
}

main "$@"
