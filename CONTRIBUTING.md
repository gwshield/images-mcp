# Contributing to gwshield-image-builder-mcp

Thank you for considering a contribution. This document explains how to set up the project locally, how the codebase is structured, and what the contribution process looks like.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Automated Contributions Policy](#automated-contributions-policy)
- [Dependabot Triage Policy](#dependabot-triage-policy)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
  - [Adding a new image family](#adding-a-new-image-family)
  - [Adding a new tool](#adding-a-new-tool)
  - [Adding or modifying a prompt](#adding-or-modifying-a-prompt)
  - [Modifying hardening pillars](#modifying-hardening-pillars)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Pillar Compliance](#pillar-compliance)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

---

## Automated Contributions Policy

Every pull request must have a named human owner who is accountable for the changes.

**Not permitted:**

- PRs opened by autonomous bots or agent systems without a designated human owner
- Fully automated commits that bypass human review (e.g., scripts that open PRs directly)

**Permitted:**

- **Dependabot** — dependency update PRs opened by the `dependabot[bot]` GitHub App are
  accepted. A human maintainer reviews and merges them according to the triage rules below.
- **Project CI apps** — status checks, lint bots, and similar automated systems that
  comment on or update existing PRs (but do not open them) are accepted.
- **AI-assisted contributions** — PRs where the author used AI coding tools (LLMs,
  code-completion agents, etc.) to write or review code are accepted, provided that:
  - A human reviews the full diff before opening the PR
  - A human runs the build and any relevant tests locally
  - The human takes full responsibility for the correctness and security of the changes
  - No mandatory disclosure of AI tool usage is required

**Why this policy exists:**

Automated and agent-generated PRs without human review introduce supply chain risk. This
project ships a tool used in security-sensitive pipelines. Human accountability on every
change is non-negotiable.

---

## Dependabot Triage Policy

All Dependabot PRs are reviewed manually before merge. The following triage rules apply:

| Update type | Action |
|---|---|
| Security CVE in any production dependency | Merge immediately; escalate if CI fails |
| Production dependency — major version bump | Review changelog; apply manually with signed commit if safe; do not use bot merge |
| Production dependency — minor or patch | Merge after CI green; spot-check changelog |
| Dev-only dependency — major version bump | Merge after CI green; verify build output unchanged |
| Dev-only dependency — minor or patch | Merge after CI green |
| GitHub Actions — any version | Update SHA pin to match; merge after CI green |

**Major version bumps in production dependencies** (e.g. `zod`, `@modelcontextprotocol/sdk`) are
applied as manual signed commits rather than bot-merged PRs. This ensures that version bumps
appear in the signed commit log and the Dependabot PR closes automatically.

**GitHub Actions updates** always require updating the SHA pin in the workflow file to match
the new tag, since this project uses SHA-pinned action references (ADR-0009).

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20 |
| npm | 9 |
| TypeScript | bundled via `devDependencies` |

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/gwshield/images-mcp.git
cd images-mcp

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run build

# 4. Verify the MCP server starts
node dist/index.js
# Expected: process starts and awaits stdin (MCP stdio transport)

# 5. Watch mode during development
npm run dev
```

---

## Project Structure

```
images-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types/
│   │   └── index.ts          # Shared TypeScript types (GenerateDockerfileInput, etc.)
│   ├── templates/
│   │   ├── dockerfile.ts     # Dockerfile generators per image family
│   │   └── families.ts       # Image family registry and metadata
│   ├── tools/
│   │   ├── index.ts          # MCP tool registrations
│   │   └── validate.ts       # Dockerfile pillar validator
│   ├── prompts/
│   │   └── index.ts          # MCP prompt registrations
│   ├── resources/
│   │   └── index.ts          # MCP resource registrations
│   └── pillars/
│       └── index.ts          # 15 GWShield hardening pillar definitions
├── dist/                     # Compiled output (not committed)
├── meta/                     # Supporting metadata files
├── CHANGELOG.md
├── ROADMAP.md
├── package.json
└── tsconfig.json
```

---

## How to Contribute

### Adding a new image family

1. Add the family definition to `src/templates/families.ts`:
   - `id`, `name`, `description`, `runtime`, `linking`, `parameters`
2. Add a `generate<FamilyName>()` function to `src/templates/dockerfile.ts`:
   - Follow the multi-stage pattern used by existing families
   - Include `ARG TARGETARCH` + architecture-aware build steps where applicable
   - Support `sourceFiles` for explicit `COPY` layer-caching
   - All 15 hardening pillars must be addressed — see [Pillar Compliance](#pillar-compliance)
3. Wire the new family into `generateDockerfile()` in `src/templates/dockerfile.ts`
4. Update `CHANGELOG.md` under `[Unreleased]`

### Adding a new tool

1. Implement the handler function (pure function, no side effects)
2. Register the tool in `src/tools/index.ts` using `server.tool()`:
   - Provide a clear `description` — agents rely on it for tool selection
   - Define input schema with Zod
3. Update `CHANGELOG.md` under `[Unreleased]`

### Adding or modifying a prompt

Prompts live in `src/prompts/index.ts`. Each prompt is registered via `server.prompt()`.

- Keep prompts **stateless** — the MCP server does not persist state between calls
- If a prompt references a tool, name it explicitly so agents can chain them
- Update `CHANGELOG.md` under `[Unreleased]`

### Modifying hardening pillars

The 15 pillars are defined in `src/pillars/index.ts` and are the foundation of everything this server produces. Changes to pillar definitions must:

- Not break existing Dockerfile outputs silently
- Be reflected in `src/tools/validate.ts` if the pillar has a validation rule
- Be noted in `CHANGELOG.md` with a clear description of the behavioral change

> **Note:** The MCP server output is designed to be compatible with the [gwshield-images](https://github.com/gwshield/images) build pipeline. If a change affects `versions.env`, smoke test contracts, or the directory layout expected by the pipeline, note this explicitly in the PR description.

---

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). See [`.github/COMMIT_CONVENTION.md`](.github/COMMIT_CONVENTION.md) for the full reference.

Quick summary:

```
feat(go-static): add ARG TARGETARCH multi-arch support
fix(validate): correct pillar 3 check for scratch images
docs: update agent config examples in README
chore(deps): bump @modelcontextprotocol/sdk to 1.13.0
```

---

## Pull Request Process

1. Fork the repository and create a branch: `feat/my-feature` or `fix/my-bug`
2. Make your changes following the guidelines above
3. Run `npm run build` — the build must be clean (zero TypeScript errors)
4. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Open the PR against `main`

All PRs require at least one review before merge.

---

## Pillar Compliance

Every Dockerfile generated by this server must address all 15 GWShield hardening pillars. When adding or modifying a family template, verify compliance against each pillar. The current pillar list is always available via the `list_pillars` MCP tool or at `gwshield://pillars`.

| # | Pillar area |
|---|-------------|
| 1–3 | Base image selection and pinning |
| 4–6 | Multi-stage build and artifact isolation |
| 7–9 | Non-root user, filesystem permissions |
| 10–12 | Build reproducibility and compiler hardening |
| 13–15 | Supply chain, SBOM readiness, runtime constraints |
