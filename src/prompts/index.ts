/**
 * GWShield Image Builder MCP — Prompt Definitions
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  // -------------------------------------------------------------------------
  // harden_image — interactive Dockerfile generation workflow
  // -------------------------------------------------------------------------
  server.prompt(
    "harden_image",
    "Generate a complete hardened image file set (Dockerfile, smoke test, versions.env, allowlist stub)",
    {
      serviceName: z
        .string()
        .describe("Name of the service (e.g., 'redis', 'traefik', 'nginx')"),
      serviceVersion: z.string().describe("Service version (e.g., 'v7.4.8')"),
      language: z
        .string()
        .optional()
        .describe(
          "Programming language (go, c, rust) — helps with family detection",
        ),
    },
    async ({ serviceName, serviceVersion, language }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `I want to create a hardened GWShield container image for **${serviceName} ${serviceVersion}**` +
                (language ? ` (written in ${language})` : "") +
                `.\n\n` +
                `Please help me generate all required files following the 15 GWShield hardening pillars:\n\n` +
                `1. First, use \`suggest_runtime_base\` to determine the correct image family\n` +
                `2. Then use \`generate_dockerfile\` to create the Dockerfile\n` +
                `3. Use \`generate_versions_env\` for the version pin file\n` +
                `4. Use \`generate_smoke_test\` for the smoke test\n` +
                `5. Finally, use \`validate_dockerfile\` to check compliance\n\n` +
                `The output should follow the per-image contract:\n` +
                `\`\`\`\n` +
                `images/${serviceName}/${serviceVersion}/\n` +
                `  Dockerfile\n` +
                `  build/versions.env\n` +
                `  tests/smoke.sh\n` +
                `  scan/allowlist.yaml\n` +
                `  docs/risk-statement.md\n` +
                `  docs/mitigation-summary.md\n` +
                `  configs/${serviceName}-minimal.yml\n` +
                `\`\`\`\n\n` +
                `Ask me for any details you need (source URL, build deps, ports, volumes, profiles).`,
            },
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // review_dockerfile — validate an existing Dockerfile
  // -------------------------------------------------------------------------
  server.prompt(
    "review_dockerfile",
    "Review an existing Dockerfile against the 15 GWShield hardening pillars",
    {
      dockerfile: z.string().describe("The Dockerfile content to review"),
    },
    async ({ dockerfile }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Please review this Dockerfile against the 15 GWShield hardening pillars.\n\n` +
                `Use the \`validate_dockerfile\` tool to check compliance, then provide:\n` +
                `1. A summary of which pillars pass and which fail\n` +
                `2. Specific recommendations for each failing pillar\n` +
                `3. Suggested code changes to bring the Dockerfile into compliance\n\n` +
                `Here is the Dockerfile:\n\n` +
                `\`\`\`dockerfile\n${dockerfile}\n\`\`\``,
            },
          },
        ],
      };
    },
  );
}
