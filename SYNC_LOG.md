# CymClaw — NemoClaw Sync Log

## 2026-04-10

### NemoClaw commits reviewed

| Commit | Description | Action |
|--------|-------------|--------|
| 55ba539 | **fix(security): gate GitHub access behind an opt-in policy preset** (#1583/#1660) | **Applied** — removed GitHub from CymClaw default whitelist, added opt-in `github.yaml` preset, updated docs/tests |
| 77051cc | fix(security): remove pre-allowed messaging from base sandbox policy (#1705) | Skipped — CymClaw default whitelist already excludes Telegram/Discord; messaging stays opt-in via channel presets |
| d8d0d44 | fix(security): drop POST allow rule from huggingface preset (#1432/#1663) | Skipped — CymClaw whitelist is host-level only; no method-scoped HuggingFace allow rules exist |
| 19839be | fix(policy): block POST to sentry.io to prevent multi-tenant data exfiltration (#1437/#1625) | Skipped — CymClaw has no default `sentry.io` allowlist entry |
| a7cafd0 | fix(policy): restrict npm and PyPI presets to GET-only REST rules (#1672) | Skipped — CymClaw does not yet support method-level REST policy rules; current npm/PyPI exposure is host-only |
| 57580bd | fix(security): validate run ID in rollback to prevent path traversal [MEDIUM] (#1559) | Skipped — CymClaw has no rollback/run-id path handling flow |

### Security fix applied

**NemoClaw #1583 / #1660 — GitHub access is now opt-in by default**

CymClaw previously exposed `github.com` and `api.github.com` in the runtime default whitelist.
That meant every sandbox started with repo/API reachability even when the task only needed inference.

Applied changes:
1. Removed GitHub from `bin/lib/config.js` default `networkWhitelist`
2. Removed GitHub from the documented default preset / default whitelist
3. Added `policies/presets/github.yaml` for explicit opt-in
4. Updated tests to assert GitHub is no longer present in the default preset/config

### OpenClaw version

`sandbox/Dockerfile`: `openclaw@2026.3.28` → `openclaw@2026.4.9`

### Files changed

- `bin/lib/config.js` — removed default GitHub hosts
- `policies/presets/default.yaml` — removed GitHub from default preset
- `policies/presets/github.yaml` — added opt-in GitHub preset
- `policies/network-whitelist.yaml` — documented GitHub as opt-in, not default
- `docs/security.md` — updated default-host docs + GitHub opt-in note
- `README.md` — updated preset table / FAQ / sync badge
- `test/docker.test.js` — assert GitHub absent from defaults
- `test/policy.test.js` — assert `github.yaml` exists and default preset excludes GitHub
- `sandbox/Dockerfile` — bumped OpenClaw to `2026.4.9`

## 2026-03-30

### NemoClaw commits reviewed

| Commit | Description | Action |
|--------|-------------|--------|
| cae0f87 | fix(sandbox): restore sandbox DNS resolution for web tools (#1062) | Skipped — NemoClaw OpenShell sandbox network namespace DNS proxy; CymClaw uses Docker bridge networking without isolated veth namespaces |

### OpenClaw version

`openclaw@2026.3.28` (unchanged)

### No action required

The only commit since last sync is a DNS forwarder for NemoClaw's isolated sandbox network namespace (10.200.0.0/24 veth pair with iptables). CymClaw's Docker sandbox uses standard bridge networking where DNS resolution works natively. No security implications.

## 2026-03-28

### NemoClaw commits reviewed

| Commit | Description | Action |
|--------|-------------|--------|
| 5f692e5 | fix(policies): preset application for versionless policies (#101) | Skipped — NemoClaw-specific preset logic, CymClaw uses simple whitelist |
| c051cbb | fix(sandbox): export proxy env vars with NO_PROXY (#1025) | Skipped — DGX Spark/Brev-specific, CymClaw uses Docker bridge networking |
| 6f9d530 | **fix(security): strip credentials from migration snapshots (#769)** | **Applied** — ported credential stripping to entrypoint.sh |
| a03eda0 | fix: harden installer and onboard resiliency (#961) | Skipped — NemoClaw installer/onboard lifecycle, not applicable |

### Security fix applied

**NemoClaw #769 — credential stripping (defense-in-depth)**

Ported the `stripCredentials()` sanitization logic to `sandbox/entrypoint.sh`.
Before runtime env vars are patched into `openclaw.json`, the entrypoint now:
1. Strips all credential fields (`apiKey`, `token`, `secret`, `password`, etc.)
2. Removes the `gateway` config section (may contain auth tokens)
3. Uses pattern-based detection for fields like `accessToken`, `clientSecret`

This ensures even if credentials are accidentally baked into the Docker image,
they are scrubbed before the sandboxed agent can read them. Credentials are then
injected fresh from runtime environment variables.

### Files changed

- `sandbox/entrypoint.sh` — added credential sanitization block before runtime patching

### Commits not applied (rationale)

- **Policies preset (#101)**: NemoClaw's policy presets are a versioned policy distribution system for DGX environments. CymClaw uses a simpler per-host whitelist (`policies/network-whitelist.yaml`). No equivalent logic to fix.
- **Proxy env vars (#1025)**: Specific to NemoClaw's OpenShell sandbox reconnect on DGX Spark/Brev. CymClaw containers use Docker internal networking with a gateway proxy — no proxy env var injection needed.
- **Installer hardening (#961)**: NemoClaw's `install.sh` and onboard wizard overhaul. CymClaw has its own installer (`scripts/setup-docker.sh`) with a different architecture.

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
