#!/usr/bin/env bash
# CymClaw — ensure Docker is installed and running
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

OS="$(uname -s)"

check_docker_running() {
  docker info &>/dev/null
}

install_docker_ubuntu() {
  info "Installing Docker on Ubuntu/Debian..."
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  usermod -aG docker "$SUDO_USER" 2>/dev/null || usermod -aG docker "$USER" 2>/dev/null || true
  info "Docker installed."
}

install_docker_macos() {
  if command -v brew &>/dev/null; then
    info "Installing Docker Desktop via Homebrew..."
    brew install --cask docker
    info "Open Docker.app to complete setup, then re-run cymclaw install."
    exit 0
  else
    error "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
  fi
}

main() {
  if command -v docker &>/dev/null; then
    if check_docker_running; then
      info "Docker is running: $(docker --version)"
      exit 0
    else
      warn "Docker is installed but not running."
      if [[ "$OS" == "Linux" ]]; then
        info "Starting Docker service..."
        systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
        sleep 2
        check_docker_running || error "Could not start Docker daemon."
        info "Docker daemon started."
      else
        error "Please start Docker Desktop and retry."
      fi
      exit 0
    fi
  fi

  info "Docker not found."
  if [[ "$OS" == "Darwin" ]]; then
    install_docker_macos
  elif [[ "$OS" == "Linux" ]]; then
    if [[ "$(id -u)" != "0" ]]; then
      error "Run with sudo to install Docker: sudo bash scripts/setup-docker.sh"
    fi
    install_docker_ubuntu
  else
    error "Unsupported OS: $OS"
  fi
}

main "$@"
