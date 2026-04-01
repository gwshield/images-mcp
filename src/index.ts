#!/usr/bin/env node

/**
 * GWShield Image Builder MCP Server
 *
 * AI-assisted hardened container image generation following
 * the 15 GWShield best-practice hardening pillars.
 *
 * Transport: stdio
 * SDK: @modelcontextprotocol/sdk
 *
 * Copyright RELICFROG Foundation, Patrick Paechnatz — Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";

const SERVER_NAME = "gwshield-image-builder-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all MCP capabilities
  registerTools(server);
  registerPrompts(server);
  registerResources(server);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
