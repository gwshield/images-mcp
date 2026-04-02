# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/gwshield/images-mcp/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/gwshield/images-mcp/releases/tag/v0.1.0-alpha
