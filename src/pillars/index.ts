/**
 * GWShield Image Builder MCP — The 15 Hardening Pillars
 *
 * Canonical pillar definitions derived from:
 *   - ADR-0005 (Runtime Hardening Model)
 *   - ADR-0004 (CVE Policy)
 *   - ADR-0008 (Trust & Verification Layer)
 *   - CONTRIBUTING.md (Dockerfile Conventions)
 *   - Production Dockerfiles (Redis, Go-Builder, nginx, etc.)
 */

import type { Pillar } from "../types/index.js";

export const PILLARS: readonly Pillar[] = [
  {
    id: "P-01",
    number: 1,
    name: "FROM scratch/distroless Runtime",
    summary:
      "Runtime FROM scratch; distroless only with documented justification",
    description:
      "Runtime stage must use `FROM scratch` wherever technically possible. " +
      "`gcr.io/distroless/*` is permitted only when there is a documented " +
      "technical justification (e.g., glibc dependency for PostgreSQL). " +
      "No other base images are allowed in the runtime stage.",
    enforcement:
      "Final FROM line must be `scratch` or `gcr.io/distroless/*`. " +
      "Any other base requires explicit justification in docs/risk-statement.md.",
    appliesTo: "runtime",
  },
  {
    id: "P-02",
    number: 2,
    name: "Static Binary",
    summary:
      "CGO_ENABLED=0 (Go) or musl-static (C/Rust); no unjustified dynamic deps",
    description:
      "Binaries must be statically linked where the language/runtime supports it. " +
      "Go: CGO_ENABLED=0 produces fully static binaries. " +
      "C/Rust: static link against musl; only the musl loader may appear as a dynamic dependency. " +
      "Verification: `readelf -d <binary> | grep NEEDED` must show only musl loader or empty.",
    enforcement:
      "Go builds must set CGO_ENABLED=0. C builds must link statically against musl. " +
      "A readelf verification step should be present in the builder stage.",
    appliesTo: "both",
  },
  {
    id: "P-03",
    number: 3,
    name: "Non-root UID 65532",
    summary:
      "USER 65532:65532 in final stage; no root start with privilege drop",
    description:
      "All images must run as non-root. The standard identity is: " +
      "UID 65532, GID 65532, username `nonroot`, group `nonroot`, shell `/sbin/nologin`. " +
      "No root start with privilege drop pattern. Non-root from the start.",
    enforcement:
      "Final stage must contain `USER 65532:65532`. " +
      "Deps stage must create the nonroot user via `addgroup -g 65532 -S nonroot && adduser -u 65532 -S -G nonroot -H -s /sbin/nologin nonroot`.",
    appliesTo: "both",
  },
  {
    id: "P-04",
    number: 4,
    name: "No Shell in Runtime",
    summary: "No /bin/sh, no package manager, no curl/wget/nc",
    description:
      "Runtime images must not contain any shell (/bin/sh, /bin/bash), " +
      "package managers (apk, apt, yum), network tools (curl, wget, nc), " +
      "or debug tools (strace, gdb). " +
      "Exception: Builder images retain shell intentionally for downstream RUN steps.",
    enforcement:
      "FROM scratch inherently satisfies this. For distroless, verify no shell is present. " +
      "Smoke test must assert no shell in runtime layer.",
    appliesTo: "runtime",
  },
  {
    id: "P-05",
    number: 5,
    name: "Multi-stage Build with Digest-pinned Bases",
    summary:
      "deps -> banner -> builder -> runtime; all FROM images sha256-pinned",
    description:
      "Builds must use multi-stage patterns with clearly separated concerns: " +
      "(1) deps -- Alpine-based; creates nonroot identity, CA certs, timezone data, runtime dirs. " +
      "(2) banner -- compiles gwshield-init startup shim. " +
      "(3) builder -- compiles the service from source. " +
      "(4) runtime -- FROM scratch; copies only what is needed. " +
      "All FROM images must be pinned by digest (@sha256:...), not just tag.",
    enforcement:
      "Dockerfile must have at least 3 stages (deps, builder, runtime). " +
      "All FROM lines must include @sha256: digest pin.",
    appliesTo: "both",
  },
  {
    id: "P-06",
    number: 6,
    name: "Pinned gwshield Builder Base",
    summary: "Use ghcr.io/gwshield/*-builder images as build base",
    description:
      "Builder stages should use gwshield builder images where applicable: " +
      "ghcr.io/gwshield/go-builder for Go services, " +
      "ghcr.io/gwshield/rust-builder for Rust services, " +
      "ghcr.io/gwshield/python-builder for Python services. " +
      "Alternatively, a direct Alpine builder stage with digest-pinned base is acceptable " +
      "for C services compiled from source.",
    enforcement:
      "Builder FROM should reference ghcr.io/gwshield/* or a digest-pinned Alpine base.",
    appliesTo: "builder",
  },
  {
    id: "P-07",
    number: 7,
    name: "Cosign Keyless Signing",
    summary: "Sigstore OIDC; no long-lived key material",
    description:
      "All published images must be cosign-signed with Sigstore OIDC. " +
      "No long-lived key material. " +
      "Certificate identity: https://github.com/gwshield/images.* " +
      "OIDC issuer: https://token.actions.githubusercontent.com " +
      "Verification must be documented and reproducible.",
    enforcement:
      "CI pipeline must include cosign sign step. " +
      "README must include cosign verify command.",
    appliesTo: "runtime",
  },
  {
    id: "P-08",
    number: 8,
    name: "SBOM Attach",
    summary: "CycloneDX + SPDX bound to image digest",
    description:
      "Every published image must have CycloneDX and SPDX SBOMs attached to the OCI manifest. " +
      "SBOMs must be explicitly bound to the image digest. " +
      "SBOM publication must fail if digest binding is missing.",
    enforcement:
      "CI pipeline must include SBOM generation and attachment steps. " +
      "Digest binding must be verified.",
    appliesTo: "runtime",
  },
  {
    id: "P-09",
    number: 9,
    name: "Trivy Hard CRITICAL Gate",
    summary: "0 unfixed HIGH/CRITICAL at release; allowlist with evidence only",
    description:
      "Zero unfixed HIGH/CRITICAL CVEs at release time. " +
      "Trivy scan gate in CI -- build fails on findings. " +
      "Grype second-opinion scan (weekly). " +
      "Allowlist entries require documented evidence (see P-15).",
    enforcement:
      "CI must run `trivy image --severity HIGH,CRITICAL --exit-code 1`. " +
      "Any allowlisted finding must have a corresponding entry in scan/allowlist.yaml.",
    appliesTo: "runtime",
  },
  {
    id: "P-10",
    number: 10,
    name: "OCI Label Schema",
    summary: "org.opencontainers.image.* + io.gwshield.* labels",
    description:
      "Every image must carry standard OCI labels: " +
      "title, description, version, source, licenses, vendor (Gatewarden). " +
      "Plus gwshield-specific labels: io.gwshield.profile, " +
      "and additional io.gwshield.* labels per service.",
    enforcement:
      "Dockerfile LABEL instruction must include all required OCI labels. " +
      "io.gwshield.profile must match the build profile.",
    appliesTo: "runtime",
  },
  {
    id: "P-11",
    number: 11,
    name: "gwshield-init Banner Injection",
    summary: "Static C wrapper as ENTRYPOINT; exec() to real binary",
    description:
      "Every runtime image (excluding builders) must use the gwshield-init startup shim. " +
      "Statically compiled C binary that prints a startup banner with " +
      "service/version/profile/build metadata, then calls execve() on the real service binary. " +
      "PID 1 is the service itself. " +
      "Supports --gws-version for scripted use (smoke tests) and --gws-exec for runtime override.",
    enforcement:
      "Dockerfile must include a banner build stage compiling gwshield-init.c. " +
      'ENTRYPOINT must be ["/usr/local/bin/gwshield-init"]. ' +
      "CMD provides the service config path or default args.",
    appliesTo: "runtime",
  },
  {
    id: "P-12",
    number: 12,
    name: "Hardened Compiler Flags",
    summary: "-fstack-protector-strong, FORTIFY_SOURCE=2, RELRO, PIE",
    description:
      "All compiled binaries must use hardened flags: " +
      "-O2 optimization, " +
      "-fstack-protector-strong (stack buffer overflow protection), " +
      "-D_FORTIFY_SOURCE=2 (buffer overflow detection), " +
      "-Wformat -Werror=format-security (format string hardening), " +
      "-fPIE (position-independent executable), " +
      "-Wl,-z,relro,-z,now (full RELRO / GOT protection), " +
      "strip --strip-unneeded (remove debug symbols).",
    enforcement:
      "CFLAGS/LDFLAGS in the builder stage must include all hardening flags. " +
      "A strip step must be present after compilation.",
    appliesTo: "builder",
  },
  {
    id: "P-13",
    number: 13,
    name: "Source Tarball with SHA-256 Verification",
    summary: "Build from upstream source; verify tarball hash",
    description:
      "Images are built directly from upstream source tarballs. " +
      "Download from canonical upstream URL. " +
      "SHA-256 verification of the tarball. " +
      "No vendor-supplied base images as starting point. " +
      "Pinned to specific release tags.",
    enforcement:
      "Builder stage must download source via wget/curl with SHA-256 verification. " +
      "versions.env must contain the pinned version and digest.",
    appliesTo: "builder",
  },
  {
    id: "P-14",
    number: 14,
    name: "Per-image Smoke Test",
    summary: "tests/smoke.sh for startup, non-root, no-shell, version check",
    description:
      "Every image must have tests/smoke.sh. " +
      "Shebang: #!/usr/bin/env bash; set -euo pipefail. " +
      "Accepts image ref as $1. " +
      "Tests: startup, non-root UID, no shell in runtime, version string. " +
      "Exit 0 on pass, 1 on fail. " +
      "Cleanup via trap cleanup EXIT.",
    enforcement:
      "tests/smoke.sh must exist and be executable. " +
      "Must test at minimum: startup, UID check, no-shell check, version output.",
    appliesTo: "both",
  },
  {
    id: "P-15",
    number: 15,
    name: "CVE Allowlist + Risk Statement",
    summary: "scan/allowlist.yaml + docs/risk-statement.md with evidence",
    description:
      "Every image must have: " +
      "scan/allowlist.yaml (accepted findings with evidence; false positives documented), " +
      "docs/risk-statement.md (residual risk and compensating controls), " +
      "docs/mitigation-summary.md (delta vs upstream baseline). " +
      "No suppression without documented evidence.",
    enforcement:
      "scan/allowlist.yaml must exist. " +
      "Each entry must include cve, component, severity, verdict, analysis, evidence, review_date.",
    appliesTo: "both",
  },
] as const;

/**
 * Get all pillars
 */
export function getAllPillars(): readonly Pillar[] {
  return PILLARS;
}

/**
 * Get a pillar by ID (e.g., "P-01")
 */
export function getPillarById(id: string): Pillar | undefined {
  return PILLARS.find((p) => p.id === id);
}

/**
 * Get pillars applicable to a given context
 */
export function getPillarsFor(
  context: "runtime" | "builder" | "both",
): readonly Pillar[] {
  return PILLARS.filter(
    (p) => p.appliesTo === context || p.appliesTo === "both",
  );
}
