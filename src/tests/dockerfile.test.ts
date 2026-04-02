/**
 * Unit tests — dockerfile generator (non-snapshot checks)
 */

import { describe, it, expect } from "vitest";
import {
  generateDockerfile,
  generateDockerignore,
  generateVersionsEnv,
  generateSmokeTest,
  generateAllowlistStub,
  generateRiskStatementStub,
} from "../templates/dockerfile.js";
import type { GenerateDockerfileInput } from "../types/index.js";

const BASE_INPUT: GenerateDockerfileInput = {
  serviceName: "myapp",
  serviceVersion: "v1.0.0",
  family: "go-static",
  profile: "standard",
};

describe("generateDockerfile — go-static", () => {
  const df = generateDockerfile(BASE_INPUT);

  it("contains FROM scratch as runtime", () => {
    expect(df).toContain("FROM scratch AS runtime");
  });

  it("contains USER 65532:65532", () => {
    expect(df).toContain("USER 65532:65532");
  });

  it("contains ENTRYPOINT gwshield-init", () => {
    expect(df).toContain("gwshield-init");
  });

  it("contains CGO_ENABLED=0", () => {
    expect(df).toContain("CGO_ENABLED=0");
  });

  it("contains OCI labels", () => {
    expect(df).toContain("org.opencontainers.image.title");
    expect(df).toContain("io.gwshield.profile");
  });

  it("contains banner stage", () => {
    expect(df).toContain("gwshield-init.c");
  });

  it("contains STOPSI​GNAL SIGTERM", () => {
    expect(df).toContain("STOPSIGNAL SIGTERM");
  });

  it("uses service name in binary path", () => {
    expect(df).toContain("/usr/local/bin/myapp");
  });
});

describe("generateDockerfile — go-static with sourceFiles", () => {
  const df = generateDockerfile({
    ...BASE_INPUT,
    sourceFiles: ["go.mod", "go.sum", "main.go", "pkg/"],
  });

  it("generates explicit COPY for go.mod/go.sum", () => {
    expect(df).toContain("COPY go.mod go.sum /build/");
  });

  it("generates COPY for source files", () => {
    expect(df).toContain("COPY main.go pkg/ /build/");
  });

  it("includes go mod download", () => {
    expect(df).toContain("go mod download");
  });
});

describe("generateDockerfile — go-static without sourceFiles", () => {
  const df = generateDockerfile(BASE_INPUT);

  it("falls back to COPY . /build/ with TODO comment", () => {
    expect(df).toContain("COPY . /build/");
    expect(df).toContain("TODO");
  });
});

describe("generateDockerfile — c-musl", () => {
  const df = generateDockerfile({
    ...BASE_INPUT,
    family: "c-musl",
    sourceUrl: "https://example.com/myapp-1.0.0.tar.gz",
  });

  it("uses Alpine builder stage", () => {
    expect(df).toContain("AS builder");
  });

  it("contains hardened CFLAGS", () => {
    expect(df).toContain("fstack-protector-strong");
  });

  it("contains musl loader copy", () => {
    expect(df).toContain("ld-musl");
  });

  it("uses FROM scratch runtime", () => {
    expect(df).toContain("FROM scratch AS runtime");
  });
});

describe("generateDockerfile — rust-static", () => {
  const df = generateDockerfile({
    ...BASE_INPUT,
    family: "rust-static",
  });

  it("uses rust-builder image", () => {
    expect(df).toContain("gwshield/rust-builder");
  });

  it("uses musl target", () => {
    expect(df).toContain("linux-musl");
  });

  it("verifies static binary", () => {
    expect(df).toContain("statically linked");
  });
});

describe("generateDockerfile — c-glibc", () => {
  const df = generateDockerfile({ ...BASE_INPUT, family: "c-glibc" });

  it("uses distroless runtime", () => {
    expect(df).toContain("distroless");
  });
});

describe("generateDockerfile — go-cgo", () => {
  const df = generateDockerfile({ ...BASE_INPUT, family: "go-cgo" });

  it("uses distroless runtime", () => {
    expect(df).toContain("distroless");
  });
});

describe("generateDockerfile — ports and volumes", () => {
  const df = generateDockerfile({
    ...BASE_INPUT,
    exposePorts: [8080, 9090],
    volumes: ["/data", "/config"],
  });

  it("exposes declared ports", () => {
    expect(df).toContain("EXPOSE 8080");
    expect(df).toContain("EXPOSE 9090");
  });

  it("declares volumes", () => {
    expect(df).toContain('"/data"');
    expect(df).toContain('"/config"');
  });
});

describe("generateDockerfile — healthcheck", () => {
  const df = generateDockerfile({
    ...BASE_INPUT,
    healthcheckCmd: ["myapp", "--health"],
  });

  it("includes HEALTHCHECK instruction", () => {
    expect(df).toContain("HEALTHCHECK");
    expect(df).toContain('"myapp"');
    expect(df).toContain('"--health"');
  });
});

describe("generateDockerfile — python-static", () => {
  const df = generateDockerfile({ ...BASE_INPUT, family: "python-static" });

  it("uses distroless/python3 runtime", () => {
    expect(df).toContain("distroless/python3-debian12");
  });

  it("contains gwshield/python-builder", () => {
    expect(df).toContain("gwshield/python-builder");
  });

  it("pre-compiles .pyc files", () => {
    expect(df).toContain("compileall");
  });

  it("sets PYTHONDONTWRITEBYTECODE", () => {
    expect(df).toContain("PYTHONDONTWRITEBYTECODE");
  });

  it("sets PYTHONPATH to venv", () => {
    expect(df).toContain("PYTHONPATH");
  });

  it("contains USER 65532:65532", () => {
    expect(df).toContain("USER 65532:65532");
  });
});

describe("generateDockerfile — node-static", () => {
  const df = generateDockerfile({ ...BASE_INPUT, family: "node-static" });

  it("uses distroless/nodejs20 runtime", () => {
    expect(df).toContain("distroless/nodejs20-debian12");
  });

  it("contains gwshield/node-builder", () => {
    expect(df).toContain("gwshield/node-builder");
  });

  it("runs npm ci --omit=dev for production deps", () => {
    expect(df).toContain("npm ci --omit=dev");
  });

  it("sets NODE_ENV=production", () => {
    expect(df).toContain('NODE_ENV="production"');
  });

  it("contains USER 65532:65532", () => {
    expect(df).toContain("USER 65532:65532");
  });
});

describe("generateDockerfile — java-distroless", () => {
  const df = generateDockerfile({ ...BASE_INPUT, family: "java-distroless" });

  it("uses distroless/java21 runtime", () => {
    expect(df).toContain("distroless/java21-debian12");
  });

  it("contains gwshield/java-builder", () => {
    expect(df).toContain("gwshield/java-builder");
  });

  it("uses exploded JAR layers for caching", () => {
    expect(df).toContain("BOOT-INF/lib");
    expect(df).toContain("META-INF");
  });

  it("sets JAVA_TOOL_OPTIONS for container memory", () => {
    expect(df).toContain("JAVA_TOOL_OPTIONS");
    expect(df).toContain("UseContainerSupport");
  });

  it("contains USER 65532:65532", () => {
    expect(df).toContain("USER 65532:65532");
  });
});

describe("generateDockerignore — new families", () => {
  it("python-static ignores __pycache__ and venv", () => {
    const di = generateDockerignore("python-static");
    expect(di).toContain("__pycache__/");
    expect(di).toContain("venv/");
    expect(di).toContain(".git/");
  });

  it("node-static ignores node_modules and dist", () => {
    const di = generateDockerignore("node-static");
    expect(di).toContain("node_modules/");
    expect(di).toContain("coverage/");
    expect(di).toContain(".git/");
  });

  it("java-distroless ignores target and build", () => {
    const di = generateDockerignore("java-distroless");
    expect(di).toContain("target/");
    expect(di).toContain("build/");
    expect(di).toContain(".git/");
  });
});

describe("generateDockerignore", () => {
  it("go-static ignores test files", () => {
    const di = generateDockerignore("go-static");
    expect(di).toContain("*_test.go");
    expect(di).toContain(".git/");
    expect(di).toContain(".env");
  });

  it("rust-static ignores target directory", () => {
    const di = generateDockerignore("rust-static");
    expect(di).toContain("target/debug/");
    expect(di).toContain(".git/");
  });

  it("c-musl contains tarball note", () => {
    const di = generateDockerignore("c-musl");
    expect(di).toContain("tarball");
    expect(di).toContain(".git/");
  });

  it("c-glibc contains tarball note", () => {
    const di = generateDockerignore("c-glibc");
    expect(di).toContain("tarball");
  });

  it("go-cgo ignores go test files", () => {
    const di = generateDockerignore("go-cgo");
    expect(di).toContain("*_test.go");
  });
});

describe("generateVersionsEnv", () => {
  const env = generateVersionsEnv(BASE_INPUT);

  it("contains SERVICE_NAME", () => {
    expect(env).toContain("SERVICE_NAME=myapp");
  });

  it("contains SERVICE_VERSION", () => {
    expect(env).toContain("SERVICE_VERSION=v1.0.0");
  });

  it("contains RUNTIME_UID", () => {
    expect(env).toContain("RUNTIME_UID=65532");
  });
});

describe("generateSmokeTest", () => {
  const smoke = generateSmokeTest(BASE_INPUT);

  it("contains set -euo pipefail", () => {
    expect(smoke).toContain("set -euo pipefail");
  });

  it("checks UID 65532", () => {
    expect(smoke).toContain("65532");
  });

  it("tests for no shell", () => {
    expect(smoke).toContain("no shell");
  });

  it("tests gwshield-init --gws-version", () => {
    expect(smoke).toContain("--gws-version");
  });

  it("has trap cleanup EXIT", () => {
    expect(smoke).toContain("trap cleanup EXIT");
  });
});

describe("generateAllowlistStub", () => {
  const stub = generateAllowlistStub(BASE_INPUT);

  it("contains allowlist header", () => {
    expect(stub).toContain("CVE Allowlist");
    expect(stub).toContain("myapp");
  });

  it("contains allowlist and false_positives keys", () => {
    expect(stub).toContain("allowlist: []");
    expect(stub).toContain("false_positives: []");
  });
});

describe("generateRiskStatementStub", () => {
  const stub = generateRiskStatementStub(BASE_INPUT);

  it("contains Risk Statement heading", () => {
    expect(stub).toContain("Risk Statement");
    expect(stub).toContain("myapp");
  });

  it("mentions compensating controls", () => {
    expect(stub).toContain("Compensating Controls");
    expect(stub).toContain("FROM scratch");
  });
});
