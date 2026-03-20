#!/usr/bin/env bash
# CymClaw uninstaller
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }

CONFIG_DIR="${HOME}/.cymclaw"
SHIM="${HOME}/.local/bin/cymclaw"

read -r -p "  Remove CymClaw containers, images, and config? [y/N]: " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "  Aborted."; exit 0
fi

info "Stopping and removing containers..."
docker stop cymclaw-sandbox cymclaw-gateway 2>/dev/null || true
docker rm -f cymclaw-sandbox cymclaw-gateway 2>/dev/null || true

info "Removing Docker network..."
docker network rm cymclaw-isolated 2>/dev/null || true

read -r -p "  Remove workspace volume (all agent data)? [y/N]: " rmvol
if [[ "${rmvol,,}" == "y" ]]; then
  docker volume rm cymclaw-workspace 2>/dev/null || true
  info "Workspace volume removed."
fi

read -r -p "  Remove sandbox image? [y/N]: " rmimg
if [[ "${rmimg,,}" == "y" ]]; then
  docker rmi cymclaw-sandbox:latest 2>/dev/null || true
  info "Image removed."
fi

info "Removing config directory..."
rm -rf "$CONFIG_DIR"

info "Removing shim..."
rm -f "$SHIM"

info "Uninstalling cymclaw package..."
pnpm uninstall -g cymclaw 2>/dev/null || npm uninstall -g cymclaw 2>/dev/null || true

echo ""
info "CymClaw uninstalled."
