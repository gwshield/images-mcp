/**
 * GWShield Image Builder MCP — Tool Implementations
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllPillars } from "../pillars/index.js";
import { FAMILIES, suggestFamily } from "../templates/families.js";
import {
  generateDockerfile,
  generateVersionsEnv,
  generateSmokeTest,
  generateAllowlistStub,
  generateRiskStatementStub,
} from "../templates/dockerfile.js";
import { validateDockerfileContent } from "./validate.js";
import type { ImageFamily, ImageProfile } from "../types/index.js";

const FAMILY_VALUES = [
  "go-static",
  "c-musl",
  "c-glibc",
  "go-cgo",
  "rust-static",
] as const;

const PROFILE_VALUES = [
  "standard",
  "tls",
  "cluster",
  "cli",
  "http2",
  "http3",
  "dev",
  "compile-only",
] as const;

export function registerTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list_pillars
  // -------------------------------------------------------------------------
  server.tool(
    "list_pillars",
    "Return the 15 GWShield hardening pillars with descriptions",
    {},
    async () => {
      const pillars = getAllPillars();
      const text = pillars
        .map(
          (p) =>
            `## ${p.id}: ${p.name}\n\n` +
            `**Summary:** ${p.summary}\n\n` +
            `${p.description}\n\n` +
            `**Enforcement:** ${p.enforcement}\n\n` +
            `**Applies to:** ${p.appliesTo}\n\n---\n`,
        )
        .join("\n");

      return {
        content: [{ type: "text", text }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // suggest_runtime_base
  // -------------------------------------------------------------------------
  server.tool(
    "suggest_runtime_base",
    "Recommend scratch vs distroless based on service type and language",
    {
      serviceName: z
        .string()
        .describe("Name of the service (e.g., 'nginx', 'traefik', 'postgres')"),
      language: z
        .string()
        .optional()
        .describe("Programming language (e.g., 'go', 'c', 'rust')"),
    },
    async ({ serviceName, language }) => {
      const info = suggestFamily(serviceName, language);
      const text =
        `## Recommended Family: \`${info.family}\`\n\n` +
        `**Runtime:** ${info.runtime}\n` +
        `**Linking:** ${info.linking}\n\n` +
        `${info.description}\n\n` +
        `**Known examples in this family:** ${info.examples.join(", ")}`;

      return {
        content: [{ type: "text", text }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // generate_dockerfile
  // -------------------------------------------------------------------------
  server.tool(
    "generate_dockerfile",
    "Generate a hardened Dockerfile following all 15 GWShield pillars",
    {
      serviceName: z
        .string()
        .describe("Service name (e.g., 'redis', 'traefik')"),
      serviceVersion: z
        .string()
        .describe("Service version (e.g., 'v7.4.8', 'v3.6.9')"),
      family: z.enum(FAMILY_VALUES).describe("Image build family"),
      profile: z
        .enum(PROFILE_VALUES)
        .default("standard")
        .describe("Image profile variant"),
      sourceUrl: z
        .string()
        .optional()
        .describe("URL to download the source tarball"),
      description: z
        .string()
        .optional()
        .describe("Image description for OCI labels"),
      exposePorts: z
        .array(z.number())
        .optional()
        .describe("Ports to expose (e.g., [6379])"),
      volumes: z
        .array(z.string())
        .optional()
        .describe('Volume mount points (e.g., ["/data"])'),
      runtimeDirs: z
        .array(z.string())
        .optional()
        .describe(
          'Runtime directories to create (e.g., ["/data", "/var/log/redis"])',
        ),
      extraBuildDeps: z
        .array(z.string())
        .optional()
        .describe("Additional Alpine build dependencies"),
    },
    async (input) => {
      const dockerfile = generateDockerfile({
        serviceName: input.serviceName,
        serviceVersion: input.serviceVersion,
        family: input.family as ImageFamily,
        profile: input.profile as ImageProfile,
        sourceUrl: input.sourceUrl,
        description: input.description,
        exposePorts: input.exposePorts,
        volumes: input.volumes,
        runtimeDirs: input.runtimeDirs,
        extraBuildDeps: input.extraBuildDeps,
      });

      return {
        content: [
          {
            type: "text",
            text:
              `# Generated Dockerfile for gwshield-${input.serviceName} ${input.serviceVersion}\n\n` +
              "```dockerfile\n" +
              dockerfile +
              "\n```\n\n" +
              "**Next steps:**\n" +
              "1. Replace `sha256:REPLACE_WITH_ACTUAL_DIGEST` with real digests\n" +
              "2. Adjust build commands for your specific service\n" +
              "3. Run `generate_versions_env` to create the version pin file\n" +
              "4. Run `generate_smoke_test` to create the smoke test\n" +
              "5. Build and scan before committing",
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // generate_versions_env
  // -------------------------------------------------------------------------
  server.tool(
    "generate_versions_env",
    "Generate a pinned versions.env file for a service",
    {
      serviceName: z.string().describe("Service name"),
      serviceVersion: z.string().describe("Service version"),
      alpineTag: z.string().optional().describe("Alpine tag (default: 3.22)"),
      alpineDigest: z.string().optional().describe("Alpine image digest"),
    },
    async (input) => {
      const env = generateVersionsEnv({
        serviceName: input.serviceName,
        serviceVersion: input.serviceVersion,
        family: "go-static",
        profile: "standard",
        alpineTag: input.alpineTag,
        alpineDigest: input.alpineDigest,
      });

      return {
        content: [
          {
            type: "text",
            text:
              `# versions.env for gwshield-${input.serviceName}\n\n` +
              "```bash\n" +
              env +
              "\n```",
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // generate_smoke_test
  // -------------------------------------------------------------------------
  server.tool(
    "generate_smoke_test",
    "Generate a smoke test script (tests/smoke.sh) for a service",
    {
      serviceName: z.string().describe("Service name"),
      serviceVersion: z.string().describe("Service version"),
      profile: z
        .enum(PROFILE_VALUES)
        .default("standard")
        .describe("Image profile"),
      exposePorts: z
        .array(z.number())
        .optional()
        .describe("Ports the service exposes"),
    },
    async (input) => {
      const smoke = generateSmokeTest({
        serviceName: input.serviceName,
        serviceVersion: input.serviceVersion,
        family: "go-static",
        profile: input.profile as ImageProfile,
        exposePorts: input.exposePorts,
      });

      return {
        content: [
          {
            type: "text",
            text:
              `# smoke.sh for gwshield-${input.serviceName}\n\n` +
              "```bash\n" +
              smoke +
              "\n```\n\n" +
              "**Remember:** Make executable with `chmod +x tests/smoke.sh`",
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // validate_dockerfile
  // -------------------------------------------------------------------------
  server.tool(
    "validate_dockerfile",
    "Validate a Dockerfile against the 15 GWShield hardening pillars",
    {
      dockerfile: z.string().describe("The Dockerfile content to validate"),
      family: z
        .enum(FAMILY_VALUES)
        .optional()
        .describe("Expected image family (helps with family-specific checks)"),
    },
    async ({ dockerfile, family }) => {
      const result = validateDockerfileContent(
        dockerfile,
        family as ImageFamily | undefined,
      );

      const pillarLines = result.pillars
        .map((p) => {
          const icon =
            p.status === "pass"
              ? "[PASS]"
              : p.status === "fail"
                ? "[FAIL]"
                : p.status === "not-applicable"
                  ? "[N/A]"
                  : "[CHECK]";
          return `${icon} ${p.pillarId}: ${p.pillarName}\n    ${p.detail}`;
        })
        .join("\n\n");

      const text =
        `# Dockerfile Validation Report\n\n` +
        `**Score:** ${result.score}/${result.maxScore}\n\n` +
        `${result.summary}\n\n` +
        `---\n\n` +
        pillarLines;

      return {
        content: [{ type: "text", text }],
      };
    },
  );
}
