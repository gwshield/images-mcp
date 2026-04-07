# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-04-07

### Added

- **`warn` tier** in `PillarStatus`: new intermediate status between `pass` and `fail`
  for findings that require attention but do not block production builds
- **`lines?: number[]`** field on `PillarValidationResult`: 1-indexed line citations
  for every applicable pillar result, enabling actionable editor integration
- **`warnings: number`** field on `ValidationResult`: count of pillars in `warn` state,
  distinct from `score` (pass count) and failures
- **`parseDockerfileStages()`** export: splits a raw Dockerfile into `StageInfo` records
  with `name`, `fromRef`, `fromLine`, `endLine`, and per-stage line arrays
- **Stage parser unit tests** (7 new tests): alias extraction, unnamed stage, `fromRef`
  content preservation, `endLine` boundary, per-stage line array

### Changed

- **P-01**: distroless final stage now emits `warn` (not `fail`); line citation on FROM line
- **P-02**: CGO_ENABLED=0 without `readelf` verification emits `warn`; musl without
  `readelf` also emits `warn`; pass requires readelf confirmation; line citations on
  CGO/musl and readelf lines
- **P-05**: stages with all bases pinned but non-standard names (deps/banner/builder/runtime)
  emits `warn` instead of `pass`; line citations on unpinned FROM lines when applicable
- **P-12**: all 5 flags present but no `strip` step emits `warn`; 3-4 flags present emits
  `warn`; fewer than 3 flags remain `fail`; citation on hardening-flags line and strip line
- **P-13**: `python-static`, `node-static`, `java-distroless`, `go-cgo` families skip tarball
  checks (source copy pattern, no wget/curl tarball download expected)
- **Summary format**: three-case output —
  all pass → `All N applicable pillars pass. Dockerfile is compliant.`;
  warnings only → `N/M pass, W warning(s). Address warnings to reach full compliance.`;
  failures → `N/M pass, W warning(s), F failure(s). Fix failures first.`
- **Renderer** (`src/tools/index.ts`): `[WARN]` icon added; line citation suffix
  `(line N)` / `(lines N, M)` appended to pillar header; score line shows `| N warning(s)`

### Tests

- Updated: summary regex aligned to new format (`/failure/` replaces `/need attention/`)
- Added: `warn` tier assertions for P-01, P-02, P-05
- Added: `lines` field assertions for P-03, P-11, P-02 warn
- Added: `warnings` field type and value assertions on `ValidationResult`
- Added: `parseDockerfileStages` unit tests (7 cases)
- Total: 130 tests (up from 109)

## [0.3.1] - 2026-04-04

### Added

- **Automated and AI-assisted contributions policy** in `CONTRIBUTING.md`: defines
  permitted (Dependabot, AI-assisted with human review) and prohibited (autonomous bots
  without named human owner) PR types; explains supply chain rationale
- **`CODE_OF_CONDUCT.md`**: cross-reference to `CONTRIBUTING.md` automated contributions
  policy added to unacceptable behavior list
- **`PULL_REQUEST_TEMPLATE.md`**: checklist item for human review of AI-assisted changes
- **`SECURITY.md`**: vulnerability reporting policy and supported version table
- **`dependabot.yml`**: weekly npm and GitHub Actions dependency update schedule
- **`.npmrc`**: `provenance=true` — all publishes include npm provenance by default
- **OpenSSF Scorecard** workflow (`.github/workflows/scorecard.yml`): weekly + push
  analysis, results published to GitHub Security tab
- **Supply chain security section** in `README.md`: SBOM, provenance, Scorecard badge,
  and verification instructions

### Changed

- **CI workflow** (`.github/workflows/ci.yml`): all actions SHA-pinned, explicit
  `permissions` blocks added, `npm audit --audit-level=high` step added
- **Publish workflow** (`.github/workflows/publish.yml`): all actions SHA-pinned,
  explicit `permissions` blocks added

## [0.3.0] - 2026-04-03

### Changed

- Exclude `dist/tests` from published npm tarball — test files are not useful to consumers
- Add `"types": "dist/index.d.ts"` to `package.json` for correct TypeScript type resolution
- Switch publish workflow to npm Trusted Publishing (OIDC) — `NPM_TOKEN` no longer required

## [0.2.0] - 2026-04-02

### Added

- **3 new image families**: `python-static`, `node-static`, `java-distroless`
  - `python-static`: distroless/python3-debian12 runtime, gwshield/python-builder,
    pip venv, `.pyc` precompile via `compileall`, `PYTHONPATH`/`PYTHONUNBUFFERED` env vars
  - `node-static`: distroless/nodejs20-debian12 runtime, gwshield/node-builder,
    5-stage pattern (deps → banner → deps-install → build → runtime),
    `npm ci --omit=dev`, `NODE_ENV=production`
  - `java-distroless`: distroless/java21-debian12 runtime, gwshield/java-builder,
    Maven fat JAR + exploded JAR layers, `JAVA_TOOL_OPTIONS` container memory flag
- **Vitest test suite** (109 tests across 6 files):
  - `pillars.test.ts` — 8 unit tests for `getAllPillars`, `getPillarById`, `getPillarsFor`
  - `families.test.ts` — 16 unit tests for `FAMILIES`, `suggestFamily`, `getFamily`,
    language hint coverage for all 8 families
  - `validate.test.ts` — 17 unit tests for compliant/non-compliant Dockerfile analysis
    and CI-only pillar coverage
  - `dockerfile.test.ts` — 60 unit tests for all generator functions and
    `generateDockerignore` across all 8 families
  - `dockerfile.snapshot.test.ts` — 8 snapshot tests (one per family)
  - `mcp-integration.test.ts` — 1 integration test (JSON-RPC `initialize` over stdio)
- **`npm test` / `npm run test:watch` / `npm run test:coverage`** scripts
- **GitHub Actions CI** (`.github/workflows/ci.yml`): build + lint + Vitest on
  push/PR to `main`, `development`, `release/**`; Node 20 + 22 matrix
- **GitHub Actions publish** (`.github/workflows/publish.yml`): tag-triggered npm
  publish on `v*` tags with `--provenance` and `NODE_AUTH_TOKEN`
- `suggestFamily()` extended with Python, Node.js, Java, Kotlin, TypeScript language hints

### Changed

- `ImageFamily` union type extended to include `python-static`, `node-static`,
  `java-distroless`
- `FAMILY_VALUES` const array extended with 3 new values (used in MCP tool schema)

## [0.1.0-alpha] - 2026-04-01

Initial release of the GWShield Image Builder MCP server.

### Added

- **7 tools**: `generate_dockerfile`, `generate_dockerignore`, `generate_versions_env`,
  `generate_smoke_test`, `validate_dockerfile`, `list_pillars`, `suggest_runtime_base`
- **3 prompts**: `harden_image`, `review_dockerfile`, `build_test_iterate`
- **3 resources**: `gwshield://pillars`, `gwshield://families`, `gwshield://contributing`
- **5 image families**: `go-static`, `c-musl`, `c-glibc`, `go-cgo`, `rust-static`
- Multi-architecture support via `ARG TARGETARCH` in `go-static`, `rust-static`, `c-musl` families
- Explicit `COPY` patterns with layer-caching support for Go and Rust source trees
- `.dockerignore` generation with pipeline-image-aware output
- Viktor Farcic findings F-1 through F-6 integrated:
  - F-1: `build_test_iterate` prompt for iterative Dockerfile development
  - F-2: `generate_dockerignore` tool
  - F-3: verify-everything validation step in `validate_dockerfile`
  - F-4: multi-arch `ARG TARGETARCH` patterns
  - F-5: explicit `COPY` with `sourceFiles` parameter
  - F-6: project-analysis-first step in `harden_image` prompt
- Compatible with Claude Desktop, Cursor, Gemini CLI, Continue, and OpenCode

[Unreleased]: https://github.com/gwshield/images-mcp/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/gwshield/images-mcp/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/gwshield/images-mcp/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/gwshield/images-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gwshield/images-mcp/compare/v0.1.0-alpha...v0.2.0
[0.1.0-alpha]: https://github.com/gwshield/images-mcp/releases/tag/v0.1.0-alpha
