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

## v0.3 — Package Quality and CI Hardening (released 2026-04-03)

- [x] Exclude `dist/tests` from published npm tarball
- [x] Add `"types"` field to `package.json` for TypeScript consumers
- [x] Switch publish workflow to npm Trusted Publishing (OIDC)

## v0.4 — Validation Depth (released 2026-04-07)

- [x] **Expanded validation**: stricter pillar checks, line citations, `warn` tier
  - P-01: distroless runtime emits `warn` with line citation
  - P-02: CGO_ENABLED=0 without readelf emits `warn`; readelf present upgrades to `pass`
  - P-05: pinned but non-standard stage names emit `warn`
  - P-12: partial hardening flags (3-4/5) emit `warn`; all flags without strip emit `warn`
  - P-13: family-aware skip for source-copy families (python-static, node-static, java-distroless, go-cgo)
  - All applicable pillars emit `lines?: number[]` for editor-actionable citations
- [x] **`parseDockerfileStages()` export**: public stage parser API with per-stage line arrays
- [x] **`warnings` count** on `ValidationResult`: distinct from score and failure count
- [x] **Renderer**: `[WARN]` icon and `(line N)` suffix in tool output
- [x] **Test suite expanded**: 130 tests (21 new — warn tier, lines, warnings, stage parser)
- [ ] **HTTP SSE transport** — deferred to v0.5
- [ ] **Digest pinning** integration — deferred to v0.5

## v0.5 — Transport and Tooling

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
