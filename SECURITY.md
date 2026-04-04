# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |
| < latest | No (please update to the latest release) |

## Reporting a Vulnerability

**Do not open a public issue to report a security vulnerability.**

Report vulnerabilities through [GitHub private security advisories](https://github.com/gwshield/images-mcp/security/advisories/new).

Please include:

- A clear description of the vulnerability
- Steps to reproduce, or a minimal proof-of-concept
- The version(s) affected
- Any suggested mitigations if you have them

## Disclosure Timeline

- **Acknowledgement**: within 5 business days of receipt
- **Status update**: within 14 days — confirmed, investigating, or unable to reproduce
- **Resolution target**: within 90 days for confirmed vulnerabilities
- **Coordinated disclosure**: we will coordinate public disclosure with the reporter

## Scope

This policy covers:

- The `gwshield-image-builder-mcp` npm package (`gwshield/images-mcp` repository)
- The GitHub Actions CI and publish workflows in this repository

Out of scope:

- Vulnerabilities in upstream dependencies — please report those to the respective upstream projects
- Issues that require physical access to the operator's machine
