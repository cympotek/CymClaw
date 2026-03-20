# Quickstart

## 1. Install

```bash
curl -fsSL https://raw.githubusercontent.com/cympack/cymclaw/main/install.sh | bash
```

This will:
- Install Docker (if missing)
- Install Node.js 22 via nvm (if missing)
- Install pnpm and cymclaw
- Run `cymclaw install` (interactive setup wizard)
- Build the sandbox Docker image
- Configure the network

## 2. Get a Gemini API Key

Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create a free key.

During `cymclaw install`, paste it when prompted.

## 3. Start

```bash
cymclaw start
```

This starts:
- `cymclaw-gateway` — inference proxy on `localhost:8899`
- `cymclaw-sandbox` — Docker container with OpenClaw

## 4. Connect and Chat

```bash
cymclaw connect
```

Inside the sandbox:

```bash
# Interactive TUI
openclaw tui

# CLI one-shot
openclaw agent --agent main --local -m "Hello, what can you do?" --session-id s1
```

## 5. Web UI

```bash
cymclaw ui
```

Opens `http://localhost:3847` — manage config, whitelist, and view audit log.

## Common Commands

```bash
cymclaw status          # check sandbox + gateway health
cymclaw logs -f         # stream logs
cymclaw stop            # stop everything
cymclaw policy add api.example.com   # whitelist a new host
```
