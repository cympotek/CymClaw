# CymClaw

[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange)](docs/quickstart.md)

CymClaw runs [OpenClaw](https://openclaw.ai) always-on assistants safely inside Docker, with inference routed through [Google AI](https://ai.google.dev) (Gemini 3 Flash Preview). It is a fork of NVIDIA NemoClaw that replaces OpenShell with pure Docker.

> **Alpha software** — interfaces and behavior may change without notice.

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/cympack/cymclaw/main/install.sh | bash
```

Or from source:

```bash
git clone https://github.com/cympack/cymclaw.git
cd cymclaw
bash install.sh
```

After install:

```bash
cymclaw start      # start sandbox + gateway
cymclaw connect    # shell into sandbox
```

Inside the sandbox:

```bash
openclaw tui       # interactive chat with the agent
```

---

## Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 2 vCPU  | 4+ vCPU     |
| RAM      | 4 GB    | 8 GB        |
| Disk     | 5 GB    | 10 GB       |

| Dependency | Version |
|------------|---------|
| Docker     | 24+     |
| Node.js    | 22+     |
| pnpm       | 9+      |

Supported platforms: Ubuntu 22.04+, macOS (Apple Silicon + Intel).

---

## How It Works

```
cymclaw start
    │
    ├── docker run cymclaw-sandbox   (--network cymclaw-isolated --read-only --seccomp)
    │       OpenClaw agent inside
    │       OPENAI_BASE_URL → gateway
    │
    └── node gateway/server.js       (host, port 8899)
            ↓ whitelist check
            ↓ key injection
        https://generativelanguage.googleapis.com/v1beta/openai/
```

All inference calls from the sandbox go through the host-side gateway, which:
1. Checks the request host against the whitelist
2. Injects the Gemini API key
3. Forwards to Gemini's OpenAI-compatible endpoint

The sandbox container never has direct internet access (Docker `--internal` network).

---

## Security Layers

| Layer      | Mechanism                               | Notes                          |
|------------|-----------------------------------------|--------------------------------|
| Network    | Docker `--internal` bridge + gateway proxy | iptables rules on Linux too  |
| Filesystem | `--read-only` + `--tmpfs /tmp`          | Write only to `/sandbox`       |
| Process    | `--security-opt seccomp=cymclaw-seccomp.json` | Blocks dangerous syscalls |
| Privileges | `--security-opt no-new-privileges` + `USER sandbox` | Non-root user |
| Inference  | Gateway proxy intercepts all AI calls   | Whitelist + key injection      |

---

## CLI Reference

```
cymclaw install          First-time setup wizard
cymclaw start            Start sandbox + gateway
cymclaw stop             Stop everything
cymclaw connect          Open shell inside sandbox
cymclaw status           Show running status
cymclaw logs [-f]        Stream sandbox logs
cymclaw config           Edit config interactively
cymclaw ui               Open web config UI (localhost:3847)
cymclaw policy add <host>   Add host to network whitelist
cymclaw policy list         List allowed endpoints
cymclaw policy remove <host> Remove from whitelist
cymclaw uninstall        Remove CymClaw
```

---

## Configuration

Config is stored at `~/.cymclaw/config.json` (mode 600).

| Key | Default | Description |
|-----|---------|-------------|
| `geminiApiKey` | — | Google AI API key |
| `model` | `gemini-2.0-flash-exp` | Gemini model |
| `gatewayPort` | `8899` | Gateway listen port |
| `uiPort` | `3847` | Web UI port |
| `networkWhitelist` | see defaults | Allowed outbound hosts |
| `logAudit` | `true` | Log requests to `~/.cymclaw/audit.log` |

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey).

---

## Web UI

```bash
cymclaw ui   # opens http://localhost:3847
```

Features:
- View sandbox + gateway status
- Edit Gemini API key and model
- Manage network whitelist (add/remove hosts)
- View audit log of recent inference calls
- Start/stop sandbox

---

## Network Whitelist Presets

| Preset | Included hosts |
|--------|---------------|
| `default` | Gemini, Anthropic, OpenClaw, GitHub, npm |
| `cympack` | default + Jina AI, Pacdora |
| `slack` | default + Slack API |
| `telegram` | default + Telegram Bot API |

---

## Learn More

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Configuration](docs/configuration.md)

## License

Apache License 2.0 — see [LICENSE](LICENSE).
