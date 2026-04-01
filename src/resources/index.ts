/**
 * GWShield Image Builder MCP — Resource Definitions
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllPillars } from "../pillars/index.js";
import { FAMILIES } from "../templates/families.js";

export function registerResources(server: McpServer): void {
  // -------------------------------------------------------------------------
  // gwshield://pillars — the 15 hardening pillars as structured data
  // -------------------------------------------------------------------------
  server.resource(
    "pillars",
    "gwshield://pillars",
    {
      description: "The 15 GWShield hardening pillars as structured JSON",
      mimeType: "application/json",
    },
    async () => {
      return {
        contents: [
          {
            uri: "gwshield://pillars",
            mimeType: "application/json",
            text: JSON.stringify(getAllPillars(), null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // gwshield://families — image family classification
  // -------------------------------------------------------------------------
  server.resource(
    "families",
    "gwshield://families",
    {
      description: "Image family classification and runtime selection guide",
      mimeType: "application/json",
    },
    async () => {
      return {
        contents: [
          {
            uri: "gwshield://families",
            mimeType: "application/json",
            text: JSON.stringify(FAMILIES, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // gwshield://contributing — contributing guidelines
  // -------------------------------------------------------------------------
  server.resource(
    "contributing",
    "gwshield://contributing",
    {
      description: "GWShield contributing guidelines for adding new images",
      mimeType: "text/markdown",
    },
    async () => {
      const text = `# Contributing a New Image to GWShield

## Per-image Contract

Every directory under \`images/<name>/<version>/\` must contain:

| File | Required | Purpose |
|---|---|---|
| \`Dockerfile\` | Yes | Multi-stage build; digest-pinned; non-root; FROM scratch |
| \`build/versions.env\` | Yes | All pinned versions + digests; Renovate regex source |
| \`tests/smoke.sh\` | Yes | Executable smoke test; exits 0 on pass |
| \`scan/allowlist.yaml\` | Yes | CVE findings after build + false positive evidence |
| \`docs/risk-statement.md\` | Yes | Residual risk statement |
| \`docs/mitigation-summary.md\` | Yes | Delta vs. upstream baseline |
| \`configs/*-minimal.yml\` | Recommended | Minimal runtime config for smoke/CI |

## Dockerfile Conventions

- Multi-stage: deps -> banner -> builder -> runtime
- Final stage: FROM scratch (preferred) or distroless
- Base images pinned by digest, not just tag
- Non-root: USER 65532:65532 in the final stage
- No shell, no curl/wget/nc in the runtime layer
- HEALTHCHECK if a health endpoint is available

## Commit Style

Follow Conventional Commits:

\`\`\`
feat(nginx): add hardened nginx v1.27.4 image
fix(traefik): update Go toolchain to 1.25.8
chore(deps): bump alpine to 3.23.1
\`\`\`
`;
      return {
        contents: [
          {
            uri: "gwshield://contributing",
            mimeType: "text/markdown",
            text,
          },
        ],
      };
    },
  );
}
