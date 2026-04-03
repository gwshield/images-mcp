# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/gwshield/images-mcp/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/gwshield/images-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gwshield/images-mcp/compare/v0.1.0-alpha...v0.2.0
[0.1.0-alpha]: https://github.com/gwshield/images-mcp/releases/tag/v0.1.0-alpha
