<div align="center">

<img src="meta/assets/gwdn-logo-v0-trans.svg" alt="Gatewarden Shield" width="120" height="120"/>

# Gatewarden Shield Image Builder MCP

### _AI-Assisted Hardened Container Image Generation_

**Generate production-grade Dockerfiles following the 15 GWShield hardening pillars.**
Works with Claude, Gemini, OpenCode, and any MCP-compatible AI agent.

<br/>

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.x-brightgreen.svg)](https://modelcontextprotocol.io/)

</div>

---

## What this tool does

This is a **Model Context Protocol (MCP) server** that encodes the full
GWShield hardening methodology into an AI-accessible tool. It enables any
AI coding agent to generate Dockerfiles, smoke tests, version pins, and
supporting files that conform to the same standards used by the production
GWShield image pipeline.

The server does **not** build images. It generates files.

---

## The 15 Hardening Pillars

Every generated Dockerfile enforces these pillars:

| #   | Pillar                         | Summary                                                                 |
| --- | ------------------------------ | ----------------------------------------------------------------------- |
| 1   | FROM scratch/distroless        | Runtime FROM scratch; distroless only with documented justification     |
| 2   | Static binary                  | CGO_ENABLED=0 (Go) or musl-static (C/Rust); no unjustified dynamic deps |
| 3   | Non-root UID 65532             | USER 65532:65532 in final stage; no root start with privilege drop      |
| 4   | No shell in runtime            | No /bin/sh, no package manager, no curl/wget/nc                         |
| 5   | Multi-stage + digest-pinned    | deps -> banner -> builder -> runtime; all FROM images sha256-pinned     |
| 6   | Pinned gwshield builder        | Use ghcr.io/gwshield/\*-builder images as build base                    |
| 7   | Cosign keyless signing         | Sigstore OIDC; no long-lived key material                               |
| 8   | SBOM attach                    | CycloneDX + SPDX bound to image digest                                  |
| 9   | Trivy hard CRITICAL gate       | 0 unfixed HIGH/CRITICAL at release; allowlist with evidence only        |
| 10  | OCI label schema               | org.opencontainers.image._ + io.gwshield._ labels                       |
| 11  | gwshield-init banner           | Static C wrapper as ENTRYPOINT; exec() to real binary                   |
| 12  | Hardened compiler flags        | -fstack-protector-strong, FORTIFY_SOURCE=2, RELRO, PIE                  |
| 13  | Source tarball + SHA-256       | Build from upstream source; verify tarball hash                         |
| 14  | Per-image smoke test           | tests/smoke.sh for startup, non-root, no-shell, version check           |
| 15  | CVE allowlist + risk statement | scan/allowlist.yaml + docs/risk-statement.md with evidence              |

---

## Installation

No global install required. The server runs on demand via `npx`.

Run once to confirm the server starts:

```bash
npx -y gwshield-image-builder-mcp
```

Then add it to your agent config:

### Claude Desktop / Claude Code

File: `~/.claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gwshield-image-builder": {
      "command": "npx",
      "args": ["-y", "gwshield-image-builder-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### OpenCode

File: `~/.config/opencode/config.json` or `opencode.json` (project)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "gwshield-image-builder": {
      "type": "local",
      "command": ["npx", "-y", "gwshield-image-builder-mcp"],
      "enabled": true
    }
  }
}
```

OpenCode uses `"mcp"` (not `"mcpServers"`) with `type: "local"` and a command array.

### Cursor

File: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "gwshield-image-builder": {
      "command": "npx",
      "args": ["-y", "gwshield-image-builder-mcp"]
    }
  }
}
```

### Continue (VS Code / JetBrains)

File: `.continue/mcpServers/gwshield.yaml` (workspace)

```yaml
name: GWShield Image Builder
version: 0.0.1
schema: v1
mcpServers:
  - name: gwshield-image-builder
    command: npx
    args:
      - "-y"
      - "gwshield-image-builder-mcp"
```

### Gemini CLI

File: `~/.gemini/settings.json`

```json
{
  "mcpServers": {
    "gwshield-image-builder": {
      "command": "npx",
      "args": ["-y", "gwshield-image-builder-mcp"]
    }
  }
}
```

### From source

```bash
git clone git@github.com:gwshield/images-mcp.git
cd images-mcp
npm install
npm run build
```

Then point your MCP client to:

```json
{
  "mcpServers": {
    "gwshield-image-builder": {
      "command": "node",
      "args": ["path/to/images-mcp/dist/index.js"]
    }
  }
}
```

All agents use the `npx` stdio transport — no daemon, no port, no persistent process.

---

## MCP Tools

| Tool                    | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `list_pillars`          | List all 15 hardening pillars with descriptions               |
| `suggest_runtime_base`  | Pick the right distroless or scratch base for a language      |
| `generate_dockerfile`   | Generate a fully hardened multi-stage Dockerfile              |
| `generate_versions_env` | Generate a pinned VERSIONS.env for reproducible builds        |
| `generate_smoke_test`   | Generate a per-image smoke test script                        |
| `validate_dockerfile`   | Validate a Dockerfile against all 15 pillars                  |
| `generate_dockerignore` | Generate a minimal, family-aware .dockerignore                |

## MCP Prompts

| Prompt              | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `harden_image`      | Full analysis + hardened Dockerfile generation for any image             |
| `review_dockerfile` | Audit an existing Dockerfile against GWShield pillars                    |
| `build_test_iterate`| Build → scan → fix iteration loop with Trivy (max 5 iterations)         |

## MCP Resources

| Resource                 | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `gwshield://pillars`     | All 15 pillars with rationale and implementation notes |
| `gwshield://families`    | Supported image families: Go, C, Rust                |
| `gwshield://contributing`| GWShield contributing guidelines for new images      |

---

## Example prompts

Ask your agent any of these after connecting the server:

**"Harden my Go HTTP service"**
Uses `harden_image` → `suggest_runtime_base` → `generate_dockerfile` (distroless runtime,
`CGO_ENABLED=0`, UID 65532, pinned builder digest) → `validate_dockerfile` confirms all 15 pillars.

**"Review my existing Dockerfile"**
Uses `review_dockerfile` → `validate_dockerfile`. Returns a structured report: which pillars
pass, which fail, and concrete fixes for each gap.

**"Generate a smoke test for my nginx image"**
Calls `generate_smoke_test` with the image family and binary path. Returns a script that checks
binary execution, non-root user, no shell, and clean exit code.

**"Build, scan, and fix until clean"**
Uses `build_test_iterate`. The agent guides you through `docker build` → `trivy image` → fix
→ repeat until Trivy reports zero HIGH or CRITICAL findings (max 5 iterations).

---

## Image Family Classification

The server classifies services into build families to select the correct
Dockerfile pattern:

| Family        | Runtime                    | Linking       | Example services              |
| ------------- | -------------------------- | ------------- | ----------------------------- |
| `go-static`   | scratch                    | CGO_ENABLED=0 | Traefik, Caddy, NATS          |
| `c-musl`      | scratch + musl loader      | musl static   | nginx, Redis, Valkey, HAProxy |
| `c-glibc`     | distroless/cc-debian12     | glibc dynamic | PostgreSQL                    |
| `go-cgo`      | distroless/static-debian12 | CGO enabled   | Pomerium, OTel Collector      |
| `rust-static` | scratch                    | musl target   | Future Rust services          |

---

## Build philosophy

This tool encodes the same hardening philosophy used across all Gatewarden
Shield images:

- **From source, from scratch** -- no vendor base images
- **Security first, not convenience first** -- no init scripts, no shell
- **Scan evidence required** -- no claims without proof
- **Transparent false positives** -- scanner noise documented, not hidden

---

## Inspiration and Acknowledgments

The design of this MCP server was influenced by
[Viktor Farcic](https://devopstoolkit.ai)'s work on AI-assisted
Dockerfile generation. His
[`generate-dockerfile`](https://github.com/vfarcic/dot-ai/blob/main/shared-prompts/generate-dockerfile.md)
prompt in the [dot-ai](https://github.com/vfarcic/dot-ai) and
[dot-ai-stack](https://github.com/vfarcic/dot-ai-stack) repositories
demonstrated that encoding Dockerfile best practices as structured AI
prompts produces consistently better output than ad-hoc generation.

Key ideas we adopted or adapted from his approach:

- **Project-analysis-first workflow** -- analyze the codebase before
  generating, rather than relying solely on user-provided parameters
- **Explicit .dockerignore generation** -- treat .dockerignore as a
  first-class build artifact, not an afterthought
- **Verify everything before adding it** -- never assume a package,
  path, or binary exists; always verify from the actual project context
- **Build-test-iterate loop** -- build the image, run it, check logs,
  run linters and scanners, iterate until clean (available via the
  `build_test_iterate` prompt)

Where Viktor's approach is language-agnostic and general-purpose, this
server is opinionated and security-hardened: it enforces the 15 GWShield
pillars, targets `scratch` and `distroless` runtimes exclusively, and
generates the full file set (Dockerfile, versions.env, smoke.sh,
allowlist, risk statement) required by the GWShield image pipeline.

Thank you, Viktor, for making your prompts and methodology open source.

---

## License

Apache-2.0 -- Gatewarden / RelicFrog Foundation
