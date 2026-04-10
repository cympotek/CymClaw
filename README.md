# CymClaw

```
   ██████╗██╗   ██╗███╗   ███╗ ██████╗██╗      █████╗ ██╗    ██╗
  ██╔════╝╚██╗ ██╔╝████╗ ████║██╔════╝██║     ██╔══██╗██║    ██║
  ██║      ╚████╔╝ ██╔████╔██║██║     ██║     ███████║██║ █╗ ██║
  ██║       ╚██╔╝  ██║╚██╔╝██║██║     ██║     ██╔══██║██║███╗██║
  ╚██████╗   ██║   ██║ ╚═╝ ██║╚██████╗███████╗██║  ██║╚███╔███╔╝
   ╚═════╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
```

[![CI](https://github.com/cympotek/CymClaw/actions/workflows/ci.yml/badge.svg)](https://github.com/cympotek/CymClaw/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![Status](https://img.shields.io/badge/status-alpha-orange)](docs/quickstart.md)
[![NemoClaw sync](https://img.shields.io/badge/NemoClaw%20sync-2026--04--10-blue)](SYNC_LOG.md)

CymClaw runs [OpenClaw](https://openclaw.ai) always-on AI agents safely inside Docker, with inference routed through [Google AI](https://ai.google.dev) (Gemini 2.0 Flash). It is inspired by NVIDIA NemoClaw but replaces OpenShift with pure Docker for easier local deployment.

> **Alpha software** — interfaces and behavior may change without notice.

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/cympotek/CymClaw/main/install.sh | bash
```

Or from source:

```bash
git clone https://github.com/cympotek/CymClaw.git
cd CymClaw
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

## How It Works

```
cymclaw start
    │
    ├── docker run cymclaw-sandbox
    │       (--network cymclaw-isolated  ← no direct internet)
    │       (--read-only --seccomp       ← hardened filesystem)
    │       OpenClaw agent inside
    │       OPENAI_BASE_URL → http://cymclaw-gateway:8899/v1
    │
    └── node gateway/server.js  (runs on HOST, port 8899)
            │
            ├── ① whitelist check   → 403 if host not allowed
            ├── ② inject Gemini key → Bearer token added
            └── ③ forward request   → https://generativelanguage.googleapis.com/v1beta/openai/
```

All inference calls from the sandbox go through the host-side gateway, which:
1. Checks the request host against the configurable whitelist
2. Injects the Gemini API key (the sandbox never sees the real key)
3. Forwards to Gemini's OpenAI-compatible endpoint
4. Logs all requests to `~/.cymclaw/audit.log`

The sandbox container never has direct internet access (Docker `--internal` network).

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

## Security Layers

| Layer      | Mechanism                                          | Notes                              |
|------------|----------------------------------------------------|------------------------------------|
| Network    | Docker `--internal` bridge + gateway proxy         | iptables rules on Linux too        |
| Filesystem | `--read-only` + `--tmpfs /tmp`                     | Write only to `/sandbox/workspace` |
| Process    | `--security-opt no-new-privileges`                 | No privilege escalation            |
| Syscalls   | `--security-opt seccomp=cymclaw-seccomp.json`       | Blocks 40+ dangerous syscalls      |
| User       | Non-root `sandbox` user (UID dynamic)              | Limits container breakout damage   |
| Inference  | Gateway proxy intercepts all AI calls              | Whitelist + key injection          |

See [docs/security.md](docs/security.md) for full details.

---

## CymClaw vs Alternatives

| Feature                  | **CymClaw**          | NemoClaw              | Raw Docker           |
|--------------------------|----------------------|-----------------------|----------------------|
| Setup complexity         | One-command install  | Requires OpenShift    | Manual configuration |
| API key exposure         | Key never in sandbox | Varies                | Full exposure        |
| Network whitelist        | Built-in, editable   | Fixed                 | None                 |
| Audit logging            | Always-on            | Limited               | None                 |
| Web UI                   | Included             | None                  | None                 |
| Seccomp profile          | Included             | Partial               | Default Docker       |
| Platform support         | Linux + macOS        | Linux only            | Any                  |

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
cymclaw policy add <host>    Add host to network whitelist
cymclaw policy list          List allowed endpoints
cymclaw policy remove <host> Remove from whitelist
cymclaw doctor           Check Docker, Node, network health
cymclaw update           Self-update from GitHub
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

Environment variables (for `.env` or CI):

```
GEMINI_API_KEY=your-key
CYMCLAW_GATEWAY_PORT=8899
CYMCLAW_UI_PORT=3847
```

---

## Web UI

```bash
cymclaw ui   # opens http://localhost:3847
```

Features:
- View sandbox + gateway status (real-time)
- Edit Gemini API key and model
- Manage network whitelist (add/remove hosts)
- View audit log of recent inference calls
- Start/stop sandbox
- Dark/light mode toggle

---

## Network Whitelist Presets

| Preset | Included hosts |
|--------|---------------|
| `default` | Gemini, Anthropic, OpenClaw, npm |
| `github` | default + GitHub repo/API access |
| `minimal` | Gemini only |
| `development` | default + PyPI, HuggingFace, Docker Hub |
| `cympack` | default + Jina AI, Pacdora |
| `slack` | default + Slack API |
| `telegram` | default + Telegram Bot API |

---

## FAQ

**Q: Does the sandbox have internet access?**
A: Only to hosts on the whitelist, via the gateway proxy. The Docker `--internal` network blocks all other outbound traffic.

**Q: Is GitHub allowed by default?**
A: No. GitHub access is opt-in now, because repo/API access is broader than most agent sessions need.

**Q: Is my Gemini API key safe?**
A: The key is stored in `~/.cymclaw/config.json` (mode 600) and injected into the gateway at startup. The sandbox container never receives the real key directly.

**Q: Can the agent escape the sandbox?**
A: CymClaw uses Docker's `--read-only` filesystem, seccomp syscall filtering, `no-new-privileges`, and a non-root user. Container escape is not impossible but requires chaining multiple vulnerabilities. See [docs/security.md](docs/security.md).

**Q: What models are supported?**
A: Any Gemini model via `cymclaw config`. Tested with `gemini-2.0-flash-exp`, `gemini-1.5-flash`, and `gemini-1.5-pro`.

**Q: Does it work on Windows?**
A: Not currently. WSL2 may work but is untested. Pull requests welcome.

**Q: How do I add a custom tool to the agent?**
A: Place tools in `/sandbox/workspace` and configure them in OpenClaw's agent definition. See [OpenClaw docs](https://openclaw.ai).

---

## Learn More

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Configuration](docs/configuration.md)
- [Contributing](CONTRIBUTING.md)

## License

Apache License 2.0 — see [LICENSE](LICENSE).
