/**
 * Integration test — MCP stdio protocol handshake
 *
 * Spawns the built MCP server process, sends an initialize request over stdin,
 * and asserts a valid initialize response. This verifies the full binary works
 * end-to-end without testing internals directly.
 *
 * Prerequisites: `npm run build` must have been run before this test.
 * In CI this is handled by the workflow running build before test.
 */

import { describe, it, expect, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, "../../dist/index.js");

function sendJsonRpc(proc: ChildProcess, message: object): Promise<object> {
  return new Promise((resolvePromise, rejectPromise) => {
    const line = JSON.stringify(message) + "\n";

    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      // Keep last partial line in buffer
      buffer = lines.pop() ?? "";
      for (const l of lines) {
        const trimmed = l.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          proc.stdout!.off("data", onData);
          resolvePromise(parsed);
          return;
        } catch {
          // not JSON yet — keep buffering
        }
      }
    };

    const timeout = setTimeout(() => {
      proc.stdout!.off("data", onData);
      rejectPromise(new Error("MCP response timeout after 5s"));
    }, 5000);

    proc.stdout!.on("data", onData);
    proc.once("error", (err) => {
      clearTimeout(timeout);
      rejectPromise(err);
    });

    proc.stdin!.write(line);
  });
}

describe("MCP stdio integration", () => {
  let proc: ChildProcess;

  it("server responds to initialize with a valid result", async () => {
    proc = spawn("node", [SERVER_ENTRY], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Collect stderr for debug on failure
    const stderrChunks: string[] = [];
    proc.stderr!.on("data", (d: Buffer) => stderrChunks.push(d.toString()));

    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    };

    let response: Record<string, unknown>;
    try {
      response = (await sendJsonRpc(proc, initRequest)) as Record<
        string,
        unknown
      >;
    } catch (err) {
      const stderr = stderrChunks.join("");
      throw new Error(`sendJsonRpc failed: ${err}\nServer stderr:\n${stderr}`);
    }

    // JSON-RPC response must have id matching the request
    expect(response.id).toBe(1);
    expect(response.jsonrpc).toBe("2.0");

    // Must have a result (not an error)
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const result = response.result as Record<string, unknown>;

    // MCP initialize result must contain serverInfo
    expect(result.serverInfo).toBeDefined();
    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(typeof serverInfo.name).toBe("string");
    expect(serverInfo.name).toBeTruthy();

    // Must declare capabilities
    expect(result.capabilities).toBeDefined();
  });

  afterAll(() => {
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
    }
  });
});
