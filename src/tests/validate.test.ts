/**
 * Unit tests — Dockerfile validator
 */

import { describe, it, expect } from "vitest";
import { validateDockerfileContent } from "../tools/validate.js";

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

  it("P-04 passes (scratch inherently no shell)", () => {
    const p04 = result.pillars.find((p) => p.pillarId === "P-04");
    expect(p04?.status).toBe("pass");
  });

  it("P-05 passes (4 stages, digest-pinned)", () => {
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

  it("score equals number of applicable passing pillars", () => {
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.score).toBeGreaterThan(0);
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
    expect(result.summary).toMatch(/need attention/);
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
