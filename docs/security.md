# Security Model

CymClaw uses defense in depth: multiple independent layers that each limit what a compromised agent can do.

## Protection Layers

| Layer | Mechanism | Strength |
|-------|-----------|----------|
| Network egress | Docker `--internal` + gateway whitelist | Strong on Linux (iptables); gateway-only on macOS |
| Filesystem | `--read-only` + tmpfs | Prevents persistent writes outside `/sandbox/workspace` |
| Process | `--security-opt no-new-privileges` | No privilege escalation |
| Syscalls | seccomp profile (40+ blocked) | Kernel-level call filtering |
| User | Non-root `sandbox` user | Limits container breakout damage |
| Inference | Gateway key injection + audit logging | Agent never holds the real API key |

## Network Whitelist

The gateway enforces an explicit allowlist. Requests to any unlisted host return HTTP 403.

Default allowed hosts:
- `generativelanguage.googleapis.com` — Gemini API (always allowed)
- `api.anthropic.com` — OpenClaw telemetry
- `openclaw.ai`, `clawhub.com` — OpenClaw services
- `registry.npmjs.org` — npm package installs

GitHub access is intentionally opt-in. Add it with `cymclaw policy add <host>` or the `github` preset when a sandbox truly needs repo access.

### macOS vs Linux

On **Linux**, two layers enforce the whitelist:
1. The gateway proxy (Node.js, user-space)
2. iptables rules in `CYMCLAW` chain (kernel)

On **macOS**, Docker Desktop does not expose the host kernel's iptables. The Docker `--internal` network still blocks direct outbound routing, and the gateway proxy is the sole allowed egress path. This provides equivalent security for agent use.

## Seccomp Profile

`policies/cymclaw-seccomp.json` uses an allowlist model (default: deny). It permits ~130 standard POSIX syscalls and blocks dangerous ones including:

| Blocked syscall | Risk prevented |
|-----------------|----------------|
| `mount`, `umount2` | Filesystem mounting |
| `kexec_load`, `kexec_file_load` | Kernel replacement |
| `init_module`, `finit_module` | Kernel module loading |
| `reboot` | System reboot |
| `bpf` | eBPF programs (kernel manipulation) |
| `iopl`, `ioperm` | Direct hardware I/O |
| `ptrace` | Process tracing (restricted) |
| `pivot_root` | Container escape vector |
| `clone` with `CLONE_NEWUSER` | User namespace privilege escalation |
| `unshare` with `CLONE_NEWUSER` | Same |

## AppArmor (Linux)

An AppArmor profile template is provided at `policies/apparmor-cymclaw`. On systems with AppArmor enabled, load it with:

```bash
sudo apparmor_parser -r policies/apparmor-cymclaw
docker run --security-opt apparmor=cymclaw-sandbox ...
```

The profile restricts:
- `/proc` writes (prevents kernel parameter manipulation)
- `/sys` writes
- Raw network socket creation
- Execution of interpreters outside `/sandbox`

## API Key Security

The Gemini API key is:
- Stored in `~/.cymclaw/config.json` (mode 600, owner-readable only)
- Passed to the gateway at startup via environment variable
- Written into `openclaw.json` inside the container at runtime by `entrypoint.sh`
- **Never exposed to the sandbox as a directly readable variable** after the entrypoint runs

**Known limitation:** The key is visible in `docker inspect` output and in `/proc/<pid>/environ` inside the container while the process runs. This is a fundamental limitation of `docker run -e`. For higher-assurance deployments, consider Docker secrets or a secrets manager.

## Audit Log

All requests through the gateway are logged to `~/.cymclaw/audit.log`:

```
[2026-03-15T12:34:56.789Z] ALLOW POST generativelanguage.googleapis.com/v1beta/openai/chat/completions (1234B)
[2026-03-15T12:35:01.123Z] BLOCK GET evil.example.com/exfil
```

Each line: timestamp, verdict (ALLOW/BLOCK/ERROR), method, host+path, body size.

View recent entries in `cymclaw status` or the web UI.

## Rate Limiting

The gateway enforces a per-IP rate limit (default: 60 requests/minute for external IPs). Sandbox containers on the internal Docker network (`172.x.x.x`) are exempt.

## Reporting Vulnerabilities

File security issues at: https://github.com/cympotek/CymClaw/security/advisories

Do **not** open public GitHub issues for security vulnerabilities.
