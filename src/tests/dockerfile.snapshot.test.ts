/**
 * Snapshot tests — Dockerfile output stability per family
 *
 * These tests lock down the exact Dockerfile output for each family.
 * If the template changes intentionally, update snapshots with:
 *   npx vitest run --update-snapshots
 */

import { describe, it, expect } from "vitest";
import { generateDockerfile } from "../templates/dockerfile.js";
import type { GenerateDockerfileInput } from "../types/index.js";

const snapInput = (
  family: GenerateDockerfileInput["family"],
): GenerateDockerfileInput => ({
  serviceName: "testapp",
  serviceVersion: "v1.2.3",
  family,
  profile: "standard",
  description: "Snapshot test image",
  exposePorts: [8080],
  volumes: ["/data"],
  runtimeDirs: ["/data"],
});

describe("Dockerfile snapshots", () => {
  it("go-static snapshot", () => {
    expect(generateDockerfile(snapInput("go-static"))).toMatchSnapshot();
  });

  it("c-musl snapshot", () => {
    expect(
      generateDockerfile({
        ...snapInput("c-musl"),
        sourceUrl: "https://example.com/testapp-1.2.3.tar.gz",
      }),
    ).toMatchSnapshot();
  });

  it("c-glibc snapshot", () => {
    expect(generateDockerfile(snapInput("c-glibc"))).toMatchSnapshot();
  });

  it("go-cgo snapshot", () => {
    expect(generateDockerfile(snapInput("go-cgo"))).toMatchSnapshot();
  });

  it("rust-static snapshot", () => {
    expect(generateDockerfile(snapInput("rust-static"))).toMatchSnapshot();
  });

  it("python-static snapshot", () => {
    expect(generateDockerfile(snapInput("python-static"))).toMatchSnapshot();
  });

  it("node-static snapshot", () => {
    expect(generateDockerfile(snapInput("node-static"))).toMatchSnapshot();
  });

  it("java-distroless snapshot", () => {
    expect(generateDockerfile(snapInput("java-distroless"))).toMatchSnapshot();
  });
});
