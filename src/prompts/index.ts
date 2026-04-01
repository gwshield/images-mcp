/**
 * GWShield Image Builder MCP — Prompt Definitions
 *
 * Prompts encode multi-step workflows for AI agents. They instruct the
 * agent which tools to call and in what order, but also enforce critical
 * principles like "verify everything before adding it" and
 * "analyse the project before generating".
 *
 * Ref: Viktor Farcic comparison — findings F-1, F-3, F-6
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  // -------------------------------------------------------------------------
  // harden_image — interactive Dockerfile generation workflow
  // -------------------------------------------------------------------------
  server.prompt(
    "harden_image",
    "Generate a complete hardened image file set (Dockerfile, smoke test, versions.env, .dockerignore, allowlist stub)",
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
                // ── F-6: Analysis-first ──────────────────────────────────
                `## Step 0 — Analyse the project context\n\n` +
                `Before calling any generation tools, perform these checks:\n\n` +
                `1. **Existing Dockerfile** — check if \`images/${serviceName}/${serviceVersion}/Dockerfile\` ` +
                `already exists. If it does, read it and use the \`review_dockerfile\` prompt ` +
                `first to assess its current state before generating a replacement.\n` +
                `2. **Upstream source** — locate the official release page or tarball URL for ` +
                `${serviceName} ${serviceVersion}. Confirm the version tag exists upstream.\n` +
                `3. **Project structure** — if working inside a gwshield images repo, read ` +
                `\`STRUCTURE.md\` and \`CONTRIBUTING.md\` to understand the per-image contract.\n\n` +
                // ── F-3: Verify everything ───────────────────────────────
                `## Critical Principle — Verify everything before adding it\n\n` +
                `Before adding ANY instruction, configuration, or dependency to the ` +
                `generated Dockerfile, **verify it exists and is correct**:\n\n` +
                `- **Source URL** — verify the tarball URL resolves (HEAD request or ` +
                `check the upstream release page). Never guess a URL.\n` +
                `- **Service version** — confirm the version string matches an actual ` +
                `upstream release tag.\n` +
                `- **Build dependencies** — verify each Alpine package in \`extraBuildDeps\` ` +
                `exists (check via \`apk search\` or Alpine package index).\n` +
                `- **Ports** — verify exposed ports match the service's documented defaults.\n` +
                `- **Runtime directories** — verify data/log/config paths match the ` +
                `service's documentation.\n` +
                `- **Binary name** — verify the compiled binary name and path.\n\n` +
                `**Never assume. Always verify. When uncertain, ask the user.**\n\n` +
                // ── Generation workflow ───────────────────────────────────
                `## Step 1 — Generate the file set\n\n` +
                `Once verification is complete, generate all required files:\n\n` +
                `1. Use \`suggest_runtime_base\` to determine the correct image family\n` +
                `2. Use \`generate_dockerfile\` to create the Dockerfile\n` +
                `3. Use \`generate_versions_env\` for the version pin file\n` +
                `4. Use \`generate_smoke_test\` for the smoke test\n` +
                `5. Use \`generate_dockerignore\` for the build-context filter\n` +
                `6. Use \`validate_dockerfile\` to check pillar compliance\n\n` +
                `The output should follow the per-image contract:\n` +
                `\`\`\`\n` +
                `images/${serviceName}/${serviceVersion}/\n` +
                `  Dockerfile\n` +
                `  .dockerignore\n` +
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
  // review_dockerfile — validate an existing Dockerfile (F-3 enhanced)
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
                `## Automated check\n\n` +
                `Use the \`validate_dockerfile\` tool to check compliance, then provide:\n` +
                `1. A summary of which pillars pass and which fail\n` +
                `2. Specific recommendations for each failing pillar\n` +
                `3. Suggested code changes to bring the Dockerfile into compliance\n\n` +
                `## Manual verification\n\n` +
                `In addition to the automated pillar check, manually verify:\n\n` +
                `- **Every COPY** — does the source path actually exist in the ` +
                `build context or a prior stage?\n` +
                `- **Every RUN** — does the binary/command exist in the stage's ` +
                `base image? Is it installed in a prior RUN?\n` +
                `- **Every EXPOSE** — does the port match the service's actual default?\n` +
                `- **Every ENV** — is the variable used by the service, or is it dead config?\n` +
                `- **FROM digests** — are the sha256 digests current, or do they ` +
                `reference an outdated image version?\n\n` +
                `Flag anything that looks assumed rather than verified.\n\n` +
                `Here is the Dockerfile:\n\n` +
                `\`\`\`dockerfile\n${dockerfile}\n\`\`\``,
            },
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // build_test_iterate — build-test loop for generated Dockerfiles (F-1)
  // -------------------------------------------------------------------------
  server.prompt(
    "build_test_iterate",
    "Build, test, and iterate on a generated Dockerfile until it passes all checks",
    {
      serviceName: z
        .string()
        .describe("Name of the service (e.g., 'redis', 'traefik')"),
      serviceVersion: z.string().describe("Service version (e.g., 'v7.4.8')"),
      imageDir: z
        .string()
        .optional()
        .describe("Path to the image directory (e.g., 'images/redis/v7.4.8')"),
    },
    async ({ serviceName, serviceVersion, imageDir }) => {
      const dir = imageDir ?? `images/${serviceName}/${serviceVersion}`;
      const imageTag = `gwshield-${serviceName}-validation`;
      const containerName = `gwshield-${serviceName}-test`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `## Build-Test-Iterate Loop\n\n` +
                `Validate the Dockerfile at \`${dir}/Dockerfile\` by building, ` +
                `running, and scanning it. Iterate until all checks pass ` +
                `(maximum **5 attempts**).\n\n` +
                `### Step 1 — Build\n\n` +
                `\`\`\`bash\n` +
                `docker build -t ${imageTag} -f ${dir}/Dockerfile .\n` +
                `\`\`\`\n\n` +
                `If the build fails, analyse the error, fix the Dockerfile, and ` +
                `retry from this step.\n\n` +
                `### Step 2 — Run\n\n` +
                `\`\`\`bash\n` +
                `docker run -d --name ${containerName} ${imageTag}\n` +
                `sleep 5\n` +
                `\`\`\`\n\n` +
                `Check the container state:\n` +
                `\`\`\`bash\n` +
                `docker inspect --format='{{.State.Status}}' ${containerName}\n` +
                `docker inspect --format='{{.State.ExitCode}}' ${containerName}\n` +
                `\`\`\`\n\n` +
                `The container should be **running** (services) or exited with ` +
                `code **0** (CLI tools). If it crashed, proceed to log analysis.\n\n` +
                `### Step 3 — Log analysis\n\n` +
                `\`\`\`bash\n` +
                `docker logs ${containerName} 2>&1\n` +
                `\`\`\`\n\n` +
                `Analyse logs for errors, missing dependencies, permission issues, ` +
                `or configuration problems. Fix and retry if needed.\n\n` +
                `### Step 4 — Smoke test\n\n` +
                `If \`${dir}/tests/smoke.sh\` exists, run it:\n` +
                `\`\`\`bash\n` +
                `bash ${dir}/tests/smoke.sh ${imageTag}\n` +
                `\`\`\`\n\n` +
                `### Step 5 — Lint (if available)\n\n` +
                `\`\`\`bash\n` +
                `hadolint ${dir}/Dockerfile 2>/dev/null || echo "hadolint not installed — skipping"\n` +
                `\`\`\`\n\n` +
                `Evaluate each warning. Fix genuine issues; ignore false positives ` +
                `with \`# hadolint ignore=DLxxxx\` comments.\n\n` +
                `### Step 6 — Security scan (if available)\n\n` +
                `\`\`\`bash\n` +
                `trivy image --severity HIGH,CRITICAL ${imageTag} 2>/dev/null || echo "trivy not installed — skipping"\n` +
                `\`\`\`\n\n` +
                `If trivy reports HIGH/CRITICAL vulnerabilities:\n` +
                `- Base image issue: consider a newer base digest\n` +
                `- Application dependency: note for the user, don't block\n` +
                `- Known false positive: add to \`scan/allowlist.yaml\`\n\n` +
                `### Step 7 — Iterate or finish\n\n` +
                `If any step failed, fix the Dockerfile and retry from Step 1.\n` +
                `Maximum **5 iterations**. If still failing after 5 attempts, ` +
                `stop, present the current state, explain what's failing, and ask ` +
                `for guidance.\n\n` +
                `### Step 8 — Cleanup\n\n` +
                `**Always** clean up, whether successful or not:\n` +
                `\`\`\`bash\n` +
                `docker stop ${containerName} 2>/dev/null || true\n` +
                `docker rm ${containerName} 2>/dev/null || true\n` +
                `docker rmi ${imageTag} 2>/dev/null || true\n` +
                `\`\`\`\n\n` +
                `Only present the Dockerfile as "ready" after all checks pass ` +
                `and cleanup is complete.`,
            },
          },
        ],
      };
    },
  );
}
