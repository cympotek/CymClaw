# CymClaw — NemoClaw Sync Log

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
