# CymClaw — NemoClaw Sync Log

## 2026-03-27

### NemoClaw commits applied

| Issue | Description |
|-------|-------------|
| #951 | Fix ulimit order: set soft limit before hard limit to prevent silent failures |

### OpenClaw version

`openclaw@2026.3.24` (unchanged)

### Files changed

- `sandbox/entrypoint.sh` — swapped ulimit soft/hard order; improved error messages to match upstream best-effort pattern

### Skipped (not applicable to CymClaw)

- #438 — WebSocket CONNECT tunnel for Discord/Slack presets (NemoClaw policy-specific)
- #913 — tsconfig.cli.json, TS coverage ratchet (NemoClaw dev tooling)
- #953 — Gateway lifecycle recovery (NemoClaw CLI-specific)
- #337 — Docker volume cleanup after failed gateway start (NemoClaw CLI-specific)
- #947 — ulimit best-effort + PATH test regression (ulimit part already applied; test is NemoClaw-specific)
- #840 — Node.js minimum version standardization (docs only)
- #875 — Cyclomatic complexity lint rule (dev tooling)
- #903, #925, #885, #950 — Docs and CI only

## 2026-03-26

### NemoClaw commits applied

| Issue | Description |
|-------|-------------|
| #830 | Harden sandbox: add `ulimit -u 512` (hard+soft) to prevent fork bombs |
| #917 | Drop unnecessary Linux capabilities at startup via `capsh` (CAP_NET_RAW, CAP_DAC_OVERRIDE, etc.) |
| #929 | Keep `cap_setpcap` so capsh can drop other capabilities |

### OpenClaw version

`openclaw@2026.3.22` → `openclaw@2026.3.24`

### Files changed

- `sandbox/Dockerfile` — added `libcap2-bin` package for capsh; bumped openclaw to 2026.3.24
- `sandbox/entrypoint.sh` — added ulimit fork-bomb protection; added capsh capability drop at startup

## 2026-03-23

### NemoClaw commits applied

| Issue | Description |
|-------|-------------|
| #686 | Pin Dockerfile base image to `node:22-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d` |
| #330 | Prevent API key leaking in process args — `docker run` now uses `--env-file` (mode 600) instead of `-e OPENAI_API_KEY=<value>` |
| #687 | Validate endpoint URL to prevent SSRF — gateway rejects private/loopback/link-local IP ranges even if somehow whitelisted |
| #689 | Use `mktemp` for Docker installer download in `install.sh` to prevent TOCTOU race on temp file path |

### OpenClaw version updated

`openclaw@2026.3.11` → `openclaw@2026.3.22`

### Files changed

- `sandbox/Dockerfile` — pinned base image digest; updated openclaw version
- `gateway/server.js` — added `isPrivateHost()` guard in `isWhitelisted()`
- `bin/lib/start.js` — API key written to `~/.cymclaw/.sandbox.env` (mode 600), passed via `--env-file`
- `install.sh` — Docker installer downloaded to `mktemp` file before execution
