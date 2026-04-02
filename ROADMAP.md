# Roadmap

This roadmap outlines the planned development of the GWShield Image Builder MCP server.
It is version-based and subject to change based on community feedback and pipeline requirements.

## v0.2 — Additional Families and Test Coverage (released 2026-04-02)

- [x] **New image families**:
  - `python-static` — CPython with distroless runtime, pip venv, `.pyc` precompile
  - `node-static` — Node.js with distroless base, 5-stage pattern, npm ci --omit=dev
  - `java-distroless` — OpenJDK with distroless/java21 base, Maven fat JAR + exploded layers
- [x] **Test suite** (Vitest, 109 tests):
  - Unit tests for each tool input/output contract
  - Snapshot tests for generated Dockerfile content (all 8 families)
  - Integration test for MCP protocol handshake (JSON-RPC stdio)
- [x] **GitHub Actions CI**: build + lint + Vitest on Node 20 + 22 matrix
- [x] **GitHub Actions publish**: tag-triggered npm publish on `v*` tags
- [ ] **Expanded validation**: stricter pillar checks, line-by-line analysis (deferred to v0.3)

## v0.3 — Validation Depth and Transport

- **Expanded validation**: stricter pillar checks, line-by-line analysis, per-layer scoring
- **HTTP SSE transport** in addition to stdio
  — enables remote agent connections and web-based tooling
- **Digest pinning** integration: auto-suggest pinned digests for `FROM` base images
  using the GHCR API (read-only)
- **npm publish** under `gwshield-image-builder-mcp` — stable package name confirmed

## v1.0 — Production Grade

- **Automatic digest pinning** via GHCR API — resolve `latest` to pinned digest at generation time
- **SBOM stub generation** — produce a minimal `spdx.json` stub for the generated image
- **Pipeline contract validation** — verify generated Dockerfiles against the
  `gwshield/images-processor` pipeline schema before output
- **Multi-tenant support** — `--tenant-id` flag for scoped image generation in enterprise overlays
- **Stable API** — no breaking changes to tool/prompt/resource interfaces after v1.0

## Deferred (no target version)

- GUI or web playground for Dockerfile generation
- Direct image build triggering (out of scope — MCP server generates only, does not build)
- Team or organization access controls (deferred until Hub enterprise tier is productized)
