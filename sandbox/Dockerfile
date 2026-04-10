# CymClaw sandbox image
# OpenClaw pre-installed, Gemini-configured, non-root sandbox user
# SPDX-License-Identifier: Apache-2.0

FROM node:22-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        iproute2 \
        libcap2-bin \
        procps \
        python3 \
        python3-pip \
        tini \
        tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user
RUN groupadd -r sandbox && \
    useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox && \
    mkdir -p /sandbox/.openclaw /sandbox/workspace && \
    chown -R sandbox:sandbox /sandbox

# Install OpenClaw CLI globally
RUN npm install -g openclaw@2026.4.9 --ignore-scripts

# Copy entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Working directory
WORKDIR /sandbox
USER sandbox

# Pre-create OpenClaw directory structure
RUN mkdir -p \
      /sandbox/.openclaw/agents/main/agent \
      /sandbox/.openclaw/sessions \
    && chmod 700 /sandbox/.openclaw

# Write openclaw.json — configure Gemini via gateway (OpenAI-compat)
# OPENAI_BASE_URL and OPENAI_API_KEY are injected at runtime via docker run -e
# The gateway translates /v1/* → Gemini's /v1beta/openai/*
RUN node -e " \
  const fs = require('fs'); \
  const config = { \
    agents: { \
      defaults: { \
        model: { \
          primary: 'gemini-2.0-flash-exp' \
        } \
      } \
    }, \
    models: { \
      mode: 'merge', \
      providers: { \
        gemini: { \
          baseUrl: 'http://cymclaw-gateway:8899/v1', \
          apiKey: 'placeholder-injected-at-runtime', \
          api: 'openai-completions', \
          models: [{ \
            id: 'gemini-2.0-flash-exp', \
            name: 'Gemini 2.0 Flash', \
            reasoning: false, \
            input: ['text'], \
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, \
            contextWindow: 1048576, \
            maxTokens: 8192 \
          }] \
        } \
      } \
    } \
  }; \
  const p = '/sandbox/.openclaw/openclaw.json'; \
  fs.writeFileSync(p, JSON.stringify(config, null, 2), { mode: 0o600 }); \
"

# Pre-run openclaw doctor to initialize plugin directories
RUN openclaw doctor --fix > /dev/null 2>&1 || true

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('fs').accessSync('/sandbox/.openclaw/openclaw.json')" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
