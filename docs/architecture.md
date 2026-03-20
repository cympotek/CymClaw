# CymClaw Architecture

## Overview

CymClaw is a thin CLI that orchestrates two components:

1. **Sandbox** — a Docker container running OpenClaw with filesystem and network isolation
2. **Gateway** — a Node.js HTTP proxy on the host that routes inference calls to Gemini

```
Host
├── cymclaw CLI (Node.js)
│   ├── bin/cymclaw.js          — command dispatch
│   └── bin/lib/
│       ├── install.js          — setup wizard
│       ├── start.js            — start sandbox + gateway
│       ├── docker.js           — Docker helpers
│       ├── config.js           — config (~/. cymclaw/config.json)
│       └── ...
│
├── gateway/server.js            — inference proxy (port 8899)
│   ├── Whitelist enforcement
│   ├── API key injection
│   └── Audit logging
│
└── Docker
    ├── Network: cymclaw-isolated  (--internal bridge, no direct internet)
    └── Container: cymclaw-sandbox
        ├── OpenClaw pre-installed
        ├── User: sandbox (non-root)
        ├── --read-only filesystem
        ├── --tmpfs /tmp
        └── --security-opt seccomp=cymclaw-seccomp.json
```

## Inference Routing

```
OpenClaw agent (in sandbox)
    │  OPENAI_BASE_URL=http://cymclaw-gateway:8899/v1
    ▼
cymclaw-gateway (host, port 8899)
    │  check whitelist
    │  inject GEMINI_API_KEY
    ▼
https://generativelanguage.googleapis.com/v1beta/openai/
    (Gemini OpenAI-compatible endpoint)
```

The sandbox sets `OPENAI_BASE_URL` to the gateway. OpenClaw uses OpenAI SDK format, which the Gemini endpoint accepts.

## Security Model

### Network Isolation
- Docker network `cymclaw-isolated` is `--internal` (no outbound routing by Docker)
- On Linux, iptables rules in `CYMCLAW` chain allow only whitelisted IPs
- On macOS, the gateway proxy is the sole network egress path
- The gateway only forwards to `generativelanguage.googleapis.com` (and whitelist additions)

### Filesystem Isolation
- Container root filesystem is `--read-only`
- `/tmp` is a tmpfs (max 512 MB, exec allowed for builds)
- `/sandbox/workspace` is a persistent Docker volume
- All other paths read-only inside the image

### Process Isolation
- Non-root user `sandbox` inside container
- `--security-opt no-new-privileges` prevents privilege escalation
- `--security-opt seccomp=cymclaw-seccomp.json` blocks dangerous syscalls (mount, reboot, kexec, BPF, etc.)

## Config Lifecycle

```
~/.cymclaw/
├── config.json        (600) — API key, model, whitelist
├── gateway.pid        (600) — gateway process ID
├── cymclaw-seccomp.json     — seccomp profile
└── audit.log               — gateway request log
```
