# Roadmap

This roadmap outlines the planned development of the GWShield Image Builder MCP server.
It is version-based and subject to change based on community feedback and pipeline requirements.

## v0.2 — Additional Families and Test Coverage

- **New image families**:
  - `python-static` — CPython with musl, minimal runtime
  - `node-static` — Node.js with distroless base
  - `java-distroless` — OpenJDK with distroless/java base
- **Test suite** (Jest or Vitest):
  - Unit tests for each tool input/output contract
  - Snapshot tests for generated Dockerfile content
  - Integration tests for MCP protocol handshake
- **Expanded validation**: stricter pillar checks, line-by-line analysis

## v0.3 — Package Release and Transport

- **npm publish** under `@gwshield/image-builder-mcp` or `gwshield-image-builder-mcp`
  (final package name to be decided — see open discussion)
- **HTTP SSE transport** in addition to stdio
  — enables remote agent connections and web-based tooling
- **Digest pinning** integration: auto-suggest pinned digests for `FROM` base images
  using the GHCR API (read-only)
- **Versioned release automation**: GitHub Actions workflow for tag-triggered npm publish

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
