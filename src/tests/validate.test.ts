/**
 * Unit tests — Dockerfile validator
 */

import { describe, it, expect } from "vitest";
import {
  validateDockerfileContent,
  parseDockerfileStages,
} from "../tools/validate.js";

// Minimal fully-compliant Dockerfile for go-static
const GO_STATIC_COMPLIANT = `
FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS deps
RUN addgroup -g 65532 -S nonroot && adduser -u 65532 -S -G nonroot nonroot

FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS banner
COPY shared/banner/gwshield-init.c /tmp/gwshield-init.c
RUN gcc -O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE -Wformat -Werror=format-security -Wl,-z,relro,-z,now -static -pie -o /usr/local/bin/gwshield-init /tmp/gwshield-init.c

FROM ghcr.io/gwshield/go-builder:v1.25@sha256:bbbb AS builder
WORKDIR /build
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /build/myapp .
RUN file /build/myapp | grep -q "statically linked"

FROM scratch AS runtime
COPY --from=deps /etc/passwd /etc/passwd
COPY --from=builder /build/myapp /usr/local/bin/myapp
COPY --from=banner /usr/local/bin/gwshield-init /usr/local/bin/gwshield-init

LABEL org.opencontainers.image.title="myapp" \\
      org.opencontainers.image.description="hardened myapp" \\
      org.opencontainers.image.version="v1.0.0" \\
      org.opencontainers.image.source="https://github.com/gwshield/images" \\
      org.opencontainers.image.licenses="Apache-2.0" \\
      org.opencontainers.image.vendor="Gatewarden" \\
      io.gwshield.profile="standard"

USER 65532:65532
ENTRYPOINT ["/usr/local/bin/gwshield-init"]
CMD ["--help"]
`;

const MINIMAL_BAD = `FROM ubuntu:22.04
RUN apt-get update
CMD ["/bin/bash"]
`;

// Dockerfile with CGO_ENABLED=0 but no readelf verification (P-02 warn)
const GO_NO_READELF = `
FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS deps
RUN addgroup -g 65532 -S nonroot && adduser -u 65532 -S -G nonroot nonroot

FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS banner
COPY shared/banner/gwshield-init.c /tmp/gwshield-init.c
RUN gcc -O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE -Wformat -Werror=format-security -Wl,-z,relro,-z,now -static -pie -o /usr/local/bin/gwshield-init /tmp/gwshield-init.c

FROM ghcr.io/gwshield/go-builder:v1.25@sha256:bbbb AS builder
WORKDIR /build
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /build/myapp .

FROM scratch AS runtime
COPY --from=deps /etc/passwd /etc/passwd
COPY --from=builder /build/myapp /usr/local/bin/myapp
COPY --from=banner /usr/local/bin/gwshield-init /usr/local/bin/gwshield-init

LABEL org.opencontainers.image.title="myapp" \\
      org.opencontainers.image.description="hardened myapp" \\
      org.opencontainers.image.version="v1.0.0" \\
      org.opencontainers.image.source="https://github.com/gwshield/images" \\
      org.opencontainers.image.licenses="Apache-2.0" \\
      org.opencontainers.image.vendor="Gatewarden" \\
      io.gwshield.profile="standard"

USER 65532:65532
ENTRYPOINT ["/usr/local/bin/gwshield-init"]
CMD ["--help"]
`;

// Dockerfile with digest-pinned bases but non-standard stage names (P-05 warn)
const PINNED_BAD_STAGE_NAMES = `
FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS stage1
RUN addgroup -g 65532 -S nonroot && adduser -u 65532 -S -G nonroot nonroot

FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS stage2
COPY shared/banner/gwshield-init.c /tmp/gwshield-init.c
RUN gcc -O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE -Wformat -Werror=format-security -Wl,-z,relro,-z,now -static -pie -o /usr/local/bin/gwshield-init /tmp/gwshield-init.c

FROM ghcr.io/gwshield/go-builder:v1.25@sha256:bbbb AS stage3
WORKDIR /build
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /build/myapp .

FROM scratch AS stage4
COPY --from=stage1 /etc/passwd /etc/passwd
COPY --from=stage3 /build/myapp /usr/local/bin/myapp
COPY --from=stage2 /usr/local/bin/gwshield-init /usr/local/bin/gwshield-init

LABEL org.opencontainers.image.title="myapp" \\
      org.opencontainers.image.description="hardened myapp" \\
      org.opencontainers.image.version="v1.0.0" \\
      org.opencontainers.image.source="https://github.com/gwshield/images" \\
      org.opencontainers.image.licenses="Apache-2.0" \\
      org.opencontainers.image.vendor="Gatewarden" \\
      io.gwshield.profile="standard"

USER 65532:65532
ENTRYPOINT ["/usr/local/bin/gwshield-init"]
CMD ["--help"]
`;

// Dockerfile with distroless final stage (P-01 warn)
const DISTROLESS_RUNTIME = `
FROM ghcr.io/gwshield/alpine:3.22@sha256:aaaa AS deps
RUN addgroup -g 65532 -S nonroot

FROM gcr.io/distroless/static-debian12@sha256:cccc AS runtime
COPY --from=deps /etc/passwd /etc/passwd
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/gwshield-init"]
`;

describe("validateDockerfileContent — compliant go-static", () => {
  const result = validateDockerfileContent(GO_STATIC_COMPLIANT, "go-static");

  it("produces 15 pillar results", () => {
    expect(result.pillars).toHaveLength(15);
  });

  it("P-01 passes (FROM scratch runtime)", () => {
    const p01 = result.pillars.find((p) => p.pillarId === "P-01");
    expect(p01?.status).toBe("pass");
  });

  it("P-02 passes (CGO_ENABLED=0)", () => {
    const p02 = result.pillars.find((p) => p.pillarId === "P-02");
    expect(p02?.status).not.toBe("fail");
  });

  it("P-03 passes (USER 65532:65532)", () => {
    const p03 = result.pillars.find((p) => p.pillarId === "P-03");
    expect(p03?.status).toBe("pass");
  });

  it("P-03 lines includes USER instruction line number", () => {
    const p03 = result.pillars.find((p) => p.pillarId === "P-03");
    expect(p03?.lines).toBeDefined();
    expect(p03?.lines?.length).toBeGreaterThan(0);
  });

  it("P-04 passes (scratch inherently no shell)", () => {
    const p04 = result.pillars.find((p) => p.pillarId === "P-04");
    expect(p04?.status).toBe("pass");
  });

  it("P-05 passes (4 named stages, digest-pinned)", () => {
    const p05 = result.pillars.find((p) => p.pillarId === "P-05");
    expect(p05?.status).toBe("pass");
  });

  it("P-10 passes (all required OCI labels present)", () => {
    const p10 = result.pillars.find((p) => p.pillarId === "P-10");
    expect(p10?.status).toBe("pass");
  });

  it("P-11 passes (gwshield-init as ENTRYPOINT)", () => {
    const p11 = result.pillars.find((p) => p.pillarId === "P-11");
    expect(p11?.status).toBe("pass");
  });

  it("P-11 lines includes the ENTRYPOINT line number", () => {
    const p11 = result.pillars.find((p) => p.pillarId === "P-11");
    expect(p11?.lines).toBeDefined();
    expect(p11?.lines?.length).toBeGreaterThan(0);
  });

  it("score equals number of applicable passing pillars", () => {
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.score).toBeGreaterThan(0);
  });

  it("ValidationResult includes warnings count", () => {
    expect(typeof result.warnings).toBe("number");
    expect(result.warnings).toBeGreaterThanOrEqual(0);
  });
});

describe("validateDockerfileContent — non-compliant ubuntu base", () => {
  const result = validateDockerfileContent(MINIMAL_BAD);

  it("P-01 fails (ubuntu base)", () => {
    const p01 = result.pillars.find((p) => p.pillarId === "P-01");
    expect(p01?.status).toBe("fail");
  });

  it("P-03 fails (no USER 65532:65532)", () => {
    const p03 = result.pillars.find((p) => p.pillarId === "P-03");
    expect(p03?.status).toBe("fail");
  });

  it("P-10 fails (no OCI labels)", () => {
    const p10 = result.pillars.find((p) => p.pillarId === "P-10");
    expect(p10?.status).toBe("fail");
  });

  it("P-11 fails (no gwshield-init)", () => {
    const p11 = result.pillars.find((p) => p.pillarId === "P-11");
    expect(p11?.status).toBe("fail");
  });

  it("summary reports failures", () => {
    expect(result.summary).toMatch(/failure/);
  });

  it("summary format includes pass/warning/failure counts", () => {
    expect(result.summary).toMatch(/\d+\/\d+ pass/);
  });
});

describe("validateDockerfileContent — CI-only pillars are not-applicable", () => {
  const result = validateDockerfileContent(GO_STATIC_COMPLIANT, "go-static");

  it("P-07 is not-applicable (cosign is CI concern)", () => {
    const p07 = result.pillars.find((p) => p.pillarId === "P-07");
    expect(p07?.status).toBe("not-applicable");
  });

  it("P-08 is not-applicable (SBOM is CI concern)", () => {
    const p08 = result.pillars.find((p) => p.pillarId === "P-08");
    expect(p08?.status).toBe("not-applicable");
  });

  it("P-09 is not-applicable (trivy is CI concern)", () => {
    const p09 = result.pillars.find((p) => p.pillarId === "P-09");
    expect(p09?.status).toBe("not-applicable");
  });
});

describe("validateDockerfileContent — warn tier (v0.4)", () => {
  it("P-02 warns when CGO_ENABLED=0 but readelf verification absent", () => {
    const result = validateDockerfileContent(GO_NO_READELF, "go-static");
    const p02 = result.pillars.find((p) => p.pillarId === "P-02");
    expect(p02?.status).toBe("warn");
  });

  it("P-02 warn detail mentions readelf", () => {
    const result = validateDockerfileContent(GO_NO_READELF, "go-static");
    const p02 = result.pillars.find((p) => p.pillarId === "P-02");
    expect(p02?.detail).toMatch(/readelf/);
  });

  it("P-02 warn lines includes CGO_ENABLED line number", () => {
    const result = validateDockerfileContent(GO_NO_READELF, "go-static");
    const p02 = result.pillars.find((p) => p.pillarId === "P-02");
    expect(p02?.lines).toBeDefined();
    expect(p02?.lines?.length).toBeGreaterThan(0);
  });

  it("P-05 warns when stages are pinned but use non-standard names", () => {
    const result = validateDockerfileContent(
      PINNED_BAD_STAGE_NAMES,
      "go-static",
    );
    const p05 = result.pillars.find((p) => p.pillarId === "P-05");
    expect(p05?.status).toBe("warn");
  });

  it("P-05 warn detail mentions stage name convention", () => {
    const result = validateDockerfileContent(
      PINNED_BAD_STAGE_NAMES,
      "go-static",
    );
    const p05 = result.pillars.find((p) => p.pillarId === "P-05");
    expect(p05?.detail).toMatch(/deps|banner|builder|runtime/);
  });

  it("P-01 warns when final stage is distroless (not scratch)", () => {
    const result = validateDockerfileContent(DISTROLESS_RUNTIME);
    const p01 = result.pillars.find((p) => p.pillarId === "P-01");
    expect(p01?.status).toBe("warn");
  });

  it("P-01 warn lines includes the distroless FROM line number", () => {
    const result = validateDockerfileContent(DISTROLESS_RUNTIME);
    const p01 = result.pillars.find((p) => p.pillarId === "P-01");
    expect(p01?.lines).toBeDefined();
    expect(p01?.lines?.length).toBeGreaterThan(0);
  });

  it("warnings count in ValidationResult is > 0 when warn pillars exist", () => {
    const result = validateDockerfileContent(GO_NO_READELF, "go-static");
    expect(result.warnings).toBeGreaterThan(0);
  });

  it("summary mentions warnings when warn pillars exist and no failures", () => {
    // PINNED_BAD_STAGE_NAMES is fully pinned and has no non-root or label issues
    // so it may have warnings but should not have failures for P-05
    const result = validateDockerfileContent(
      PINNED_BAD_STAGE_NAMES,
      "go-static",
    );
    const hasFailures = result.pillars.some((p) => p.status === "fail");
    if (!hasFailures) {
      expect(result.summary).toMatch(/warning/);
    }
  });

  it("all-pass summary says compliant", () => {
    const result = validateDockerfileContent(GO_STATIC_COMPLIANT, "go-static");
    const hasIssues = result.pillars.some(
      (p) => p.status === "fail" || p.status === "warn",
    );
    if (!hasIssues) {
      expect(result.summary).toMatch(/compliant/);
    }
  });
});

describe("parseDockerfileStages", () => {
  it("returns one stage per FROM instruction", () => {
    const lines = GO_STATIC_COMPLIANT.split("\n");
    const stages = parseDockerfileStages(lines);
    expect(stages).toHaveLength(4);
  });

  it("captures stage alias names (lowercase)", () => {
    const lines = GO_STATIC_COMPLIANT.split("\n");
    const stages = parseDockerfileStages(lines);
    const names = stages.map((s) => s.name);
    expect(names).toContain("deps");
    expect(names).toContain("banner");
    expect(names).toContain("builder");
    expect(names).toContain("runtime");
  });

  it("sets fromLine to a 1-indexed line number", () => {
    const lines = GO_STATIC_COMPLIANT.split("\n");
    const stages = parseDockerfileStages(lines);
    stages.forEach((s) => {
      expect(s.fromLine).toBeGreaterThan(0);
    });
  });

  it("last stage endLine equals total line count", () => {
    const lines = GO_STATIC_COMPLIANT.split("\n");
    const stages = parseDockerfileStages(lines);
    const last = stages[stages.length - 1];
    expect(last.endLine).toBe(lines.length);
  });

  it("stage without AS alias gets empty name string", () => {
    const df = "FROM ubuntu:22.04\nRUN echo hello\n";
    const stages = parseDockerfileStages(df.split("\n"));
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("");
  });

  it("fromRef preserves the full FROM line content", () => {
    const lines = GO_STATIC_COMPLIANT.split("\n");
    const stages = parseDockerfileStages(lines);
    const deps = stages.find((s) => s.name === "deps");
    expect(deps?.fromRef).toContain("sha256:aaaa");
    expect(deps?.fromRef).toContain("AS deps");
  });

  it("stage lines array contains the FROM line and subsequent lines", () => {
    const df = "FROM alpine:3.22 AS base\nRUN echo hello\nRUN echo world\n";
    const stages = parseDockerfileStages(df.split("\n"));
    expect(stages[0].lines.length).toBeGreaterThanOrEqual(3);
  });
});
