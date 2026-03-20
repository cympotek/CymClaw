# Security

## Protection Layers

| Layer | Mechanism | Strength |
|-------|-----------|----------|
| Network egress | Docker `--internal` + gateway whitelist | Strong on Linux (iptables); gateway-only on macOS |
| Filesystem | `--read-only` + tmpfs | Prevents persistent writes outside `/sandbox` |
| Process | `--security-opt no-new-privileges` | No privilege escalation |
| Syscalls | seccomp profile | Blocks 30+ dangerous syscalls |
| User | Non-root `sandbox` user | Limits damage if container breakout |
| Inference | Gateway key injection + logging | Agent never holds the real key |

## Network Whitelist

Default allowed hosts:
- `generativelanguage.googleapis.com` — Gemini API
- `api.anthropic.com` — OpenClaw
- `openclaw.ai`, `clawhub.com` — OpenClaw services
- `github.com`, `api.github.com` — git
- `registry.npmjs.org` — npm

Add hosts with `cymclaw policy add <host>`.

### macOS vs Linux

On **Linux**, two layers enforce the whitelist:
1. The gateway proxy (software)
2. iptables rules in `CYMCLAW` chain (kernel)

On **macOS**, Docker Desktop does not expose the kernel's network stack the same way. The Docker `--internal` network blocks direct outbound routing, and the gateway proxy is the sole allowed egress path. This is equivalent security for agent use.

## Seccomp Profile

`policies/cymclaw-seccomp.json` blocks syscalls including:
- `mount`, `umount` — filesystem mounting
- `kexec_load`, `kexec_file_load` — kernel replacement
- `init_module`, `finit_module` — kernel modules
- `reboot` — system reboot
- `bpf` — kernel eBPF programs
- `iopl`, `ioperm` — direct I/O port access
- `ptrace` — process tracing (partially restricted)
- `pivot_root` — container escape vector

## API Key Security

The Gemini API key is:
- Stored in `~/.cymclaw/config.json` (mode 600, readable only by owner)
- Injected into the sandbox at startup via `docker run -e`
- Never visible inside the container as a plain variable after startup (it is written into `openclaw.json` by `entrypoint.sh` and the env var is available in the container env — this is a known limitation of `docker run -e`)

## Audit Log

All inference requests through the gateway are logged to `~/.cymclaw/audit.log`. Each line includes timestamp, method, host, and path. The log is readable in `cymclaw status` and the web UI.

## Reporting Issues

File security issues at: https://github.com/cympack/cymclaw/security/advisories
