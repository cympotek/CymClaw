# Contributing to CymClaw

Thank you for your interest in contributing! This document describes how to set up a development environment and submit changes.

## Development Setup

```bash
git clone https://github.com/cympotek/CymClaw.git
cd CymClaw
pnpm install
pnpm link --global   # makes 'cymclaw' available on PATH from source
```

Run tests:

```bash
pnpm test
```

## Project Structure

```
bin/           CLI entry point and library modules
  cymclaw.js   Main dispatcher
  lib/         Individual command implementations
gateway/       Host-side inference proxy (gateway/server.js)
ui/            Web config interface (static HTML/JS/CSS)
sandbox/       Docker image for the agent container
policies/      Network whitelist presets and seccomp profile
docs/          User documentation
test/          Unit tests (Node.js built-in test runner)
scripts/       Utility scripts (Docker setup, health checks)
```

## Guidelines

- **No dependencies** unless absolutely necessary. The CLI and gateway are intentionally dependency-light.
- **Security first.** Any change that weakens the network whitelist, seccomp profile, or key handling requires explicit justification.
- **Tests required** for new gateway whitelist logic, policy handling, or config behavior.
- **Apache 2.0** — all new files must include the SPDX header `// SPDX-License-Identifier: Apache-2.0`.

## Running Tests

```bash
# All tests
pnpm test

# Individual test files
node --test test/docker.test.js
node --test test/network.test.js
node --test test/gateway.test.js
```

## Submitting a Pull Request

1. Fork the repo and create a feature branch from `main`.
2. Make your changes with tests where appropriate.
3. Run `pnpm test` — all tests must pass.
4. Open a PR against `main` with a clear description of the change.

## Security Issues

Please do **not** open public issues for security vulnerabilities. Instead, report them via [GitHub Security Advisories](https://github.com/cympotek/CymClaw/security/advisories).

## Code of Conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## License

By contributing, you agree your contributions will be licensed under the Apache License 2.0.
