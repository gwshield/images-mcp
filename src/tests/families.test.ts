/**
 * Unit tests — families module
 */

import { describe, it, expect } from "vitest";
import { FAMILIES, suggestFamily, getFamily } from "../templates/families.js";

describe("FAMILIES", () => {
  it("defines all expected family keys", () => {
    const keys = Object.keys(FAMILIES);
    expect(keys).toContain("go-static");
    expect(keys).toContain("c-musl");
    expect(keys).toContain("c-glibc");
    expect(keys).toContain("go-cgo");
    expect(keys).toContain("rust-static");
  });

  it("every family has required fields", () => {
    for (const info of Object.values(FAMILIES)) {
      expect(info.family).toBeTruthy();
      expect(info.runtime).toBeTruthy();
      expect(info.linking).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(Array.isArray(info.examples)).toBe(true);
      expect(info.examples.length).toBeGreaterThan(0);
    }
  });
});

describe("suggestFamily", () => {
  it("returns go-static for traefik", () => {
    expect(suggestFamily("traefik").family).toBe("go-static");
  });

  it("returns c-musl for nginx", () => {
    expect(suggestFamily("nginx").family).toBe("c-musl");
  });

  it("returns rust-static for ripgrep", () => {
    expect(suggestFamily("ripgrep").family).toBe("rust-static");
  });

  it("returns c-glibc for postgres", () => {
    expect(suggestFamily("postgres").family).toBe("c-glibc");
  });

  it("falls back to go-static for unknown service with go language hint", () => {
    expect(suggestFamily("my-unknown-svc", "go").family).toBe("go-static");
  });

  it("falls back to rust-static for rust language hint", () => {
    expect(suggestFamily("my-tool", "rust").family).toBe("rust-static");
  });

  it("falls back to python-static for python language hint", () => {
    expect(suggestFamily("my-api", "python").family).toBe("python-static");
  });

  it("falls back to node-static for node language hint", () => {
    expect(suggestFamily("my-svc", "node").family).toBe("node-static");
  });

  it("falls back to node-static for typescript language hint", () => {
    expect(suggestFamily("my-svc", "typescript").family).toBe("node-static");
  });

  it("falls back to java-distroless for java language hint", () => {
    expect(suggestFamily("my-app", "java").family).toBe("java-distroless");
  });

  it("falls back to java-distroless for kotlin language hint", () => {
    expect(suggestFamily("my-app", "kotlin").family).toBe("java-distroless");
  });

  it("falls back to go-static when completely unknown", () => {
    expect(suggestFamily("totally-unknown-xyz").family).toBe("go-static");
  });
});

describe("getFamily", () => {
  it("returns the correct family object", () => {
    const f = getFamily("rust-static");
    expect(f.family).toBe("rust-static");
    expect(f.runtime).toContain("scratch");
  });
});
