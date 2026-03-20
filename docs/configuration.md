# Configuration

## Config File

Location: `~/.cymclaw/config.json` (permissions: 600)

```json
{
  "geminiApiKey": "AIza...",
  "model": "gemini-2.0-flash-exp",
  "gatewayPort": 8899,
  "sandboxPort": 18789,
  "uiPort": 3847,
  "networkWhitelist": [
    "generativelanguage.googleapis.com",
    "api.anthropic.com",
    ...
  ],
  "logAudit": true
}
```

## Edit Config

```bash
cymclaw config    # interactive editor
cymclaw ui        # web UI at localhost:3847
```

## Available Models

| Model | Context | Notes |
|-------|---------|-------|
| `gemini-2.0-flash-exp` | 1M tokens | Recommended — fast, capable |
| `gemini-1.5-flash` | 1M tokens | Stable release |
| `gemini-1.5-pro` | 2M tokens | Most capable, slower |

## Gateway Port

Default: `8899`. Change if there is a port conflict:

```bash
cymclaw config   # set gatewayPort
cymclaw stop && cymclaw start
```

## Network Whitelist

```bash
cymclaw policy list              # view
cymclaw policy add api.foo.com   # add
cymclaw policy remove api.foo.com  # remove
```

Or edit via `cymclaw ui`.

Changes take effect on next `cymclaw start`.

## Policy Presets

Apply a preset by adding its hosts to the whitelist via `cymclaw policy add` or the UI. Preset definitions are in `policies/presets/`.

| Preset | File | Additional hosts |
|--------|------|-----------------|
| cympack | `policies/presets/cympack.yaml` | Jina, Pacdora |
| slack | `policies/presets/slack.yaml` | Slack API |
| telegram | `policies/presets/telegram.yaml` | Telegram Bot API |
