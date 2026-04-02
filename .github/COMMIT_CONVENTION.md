# Commit Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

## Format

```
<type>(<scope>): <short summary>
```

The `<scope>` is optional.

## Types

| Type       | When to use                                                                 |
|------------|-----------------------------------------------------------------------------|
| `feat`     | A new tool, prompt, resource, or image family                               |
| `fix`      | A bug fix in existing tool logic or generated output                        |
| `docs`     | Changes to README, CHANGELOG, ROADMAP, or other documentation               |
| `refactor` | Code change that neither fixes a bug nor adds a feature                     |
| `test`     | Adding or updating tests                                                    |
| `chore`    | Build system, dependency updates, CI configuration                          |
| `perf`     | Performance improvement                                                     |
| `revert`   | Reverts a previous commit                                                   |

## Breaking changes

Add `!` after the type/scope, or include `BREAKING CHANGE:` in the footer:

```
feat!: rename generate_dockerfile input field sourceFiles to sourcePaths
```

## Examples

```
feat(go-static): add TARGETARCH support for multi-arch builds
fix(validate): correct pillar check for non-root USER enforcement
docs: update README agent configuration examples
chore: bump @modelcontextprotocol/sdk to 1.10.0
feat!: rename tool generate_dockerfile to dockerfile_generate
```

## Scope reference

| Scope          | Description                              |
|----------------|------------------------------------------|
| `go-static`    | Go static family                         |
| `rust-static`  | Rust static family                       |
| `c-musl`       | C musl family                            |
| `c-glibc`      | C glibc family                           |
| `go-cgo`       | Go CGO family                            |
| `validate`     | validate_dockerfile tool                 |
| `pillars`      | Hardening pillars logic                  |
| `prompts`      | harden_image / review_dockerfile prompts |
| `resources`    | gwshield:// resources                    |
| `mcp`          | MCP server transport / protocol          |
