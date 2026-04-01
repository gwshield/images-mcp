/**
 * GWShield Image Builder MCP — Dockerfile Validation against 15 Pillars
 */

import type {
  ImageFamily,
  PillarValidationResult,
  ValidationResult,
} from "../types/index.js";
import { getAllPillars } from "../pillars/index.js";

export function validateDockerfileContent(
  dockerfile: string,
  family?: ImageFamily,
): ValidationResult {
  const lines = dockerfile.split("\n");
  const content = dockerfile.toLowerCase();
  const results: PillarValidationResult[] = [];

  // -------------------------------------------------------------------------
  // P-01: FROM scratch/distroless Runtime
  // -------------------------------------------------------------------------
  const fromLines = lines.filter((l) => l.trim().match(/^FROM\s/i));
  const lastFrom = fromLines.length > 0 ? fromLines[fromLines.length - 1] : "";
  const lastFromLower = lastFrom.toLowerCase();
  const isScratch = lastFromLower.includes("scratch");
  const isDistroless = lastFromLower.includes("distroless");

  results.push({
    pillarId: "P-01",
    pillarName: "FROM scratch/distroless Runtime",
    status:
      isScratch || isDistroless
        ? "pass"
        : fromLines.length === 0
          ? "fail"
          : "fail",
    detail: isScratch
      ? "Final stage uses FROM scratch."
      : isDistroless
        ? "Final stage uses distroless. Ensure justification is documented."
        : `Final FROM is: ${lastFrom.trim()}. Expected scratch or distroless.`,
  });

  // -------------------------------------------------------------------------
  // P-02: Static Binary
  // -------------------------------------------------------------------------
  const hasCgoDisabled = content.includes("cgo_enabled=0");
  const hasMuslLink = content.includes("musl") || content.includes("-static");
  const hasReadelf = content.includes("readelf");

  results.push({
    pillarId: "P-02",
    pillarName: "Static Binary",
    status:
      hasCgoDisabled || hasMuslLink
        ? hasReadelf
          ? "pass"
          : "manual-check"
        : "fail",
    detail: hasCgoDisabled
      ? "CGO_ENABLED=0 found." +
        (hasReadelf
          ? " readelf verification present."
          : " Consider adding readelf verification.")
      : hasMuslLink
        ? "musl/static linking detected." +
          (hasReadelf
            ? " readelf verification present."
            : " Consider adding readelf verification.")
        : "No static linking evidence found. Set CGO_ENABLED=0 (Go) or link against musl (C).",
  });

  // -------------------------------------------------------------------------
  // P-03: Non-root UID 65532
  // -------------------------------------------------------------------------
  const hasUser65532 = content.includes("user 65532:65532");
  const hasAdduser = content.includes("adduser") && content.includes("65532");

  results.push({
    pillarId: "P-03",
    pillarName: "Non-root UID 65532",
    status: hasUser65532 ? "pass" : "fail",
    detail: hasUser65532
      ? "USER 65532:65532 found." +
        (hasAdduser ? " nonroot user creation present." : "")
      : "Missing USER 65532:65532 in final stage.",
  });

  // -------------------------------------------------------------------------
  // P-04: No Shell in Runtime
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-04",
    pillarName: "No Shell in Runtime",
    status: isScratch ? "pass" : isDistroless ? "pass" : "manual-check",
    detail: isScratch
      ? "FROM scratch inherently has no shell."
      : isDistroless
        ? "Distroless typically has no shell."
        : "Cannot verify — runtime base is not scratch or distroless.",
  });

  // -------------------------------------------------------------------------
  // P-05: Multi-stage Build with Digest-pinned Bases
  // -------------------------------------------------------------------------
  const stageCount = fromLines.length;
  const digestPinned = fromLines.filter((l) => l.includes("sha256:"));
  // The final FROM scratch doesn't need a digest
  const pinnableFroms = fromLines.filter(
    (l) => !l.toLowerCase().includes("scratch"),
  );
  const allPinned =
    pinnableFroms.length === 0 ||
    pinnableFroms.every((l) => l.includes("sha256:") || l.includes("${"));

  results.push({
    pillarId: "P-05",
    pillarName: "Multi-stage Build with Digest-pinned Bases",
    status:
      stageCount >= 3 && allPinned
        ? "pass"
        : stageCount >= 3
          ? "manual-check"
          : "fail",
    detail:
      `${stageCount} stages found (minimum 3). ` +
      `${digestPinned.length} FROM lines have sha256 digest pins. ` +
      (allPinned
        ? "All non-scratch bases are pinned or use ARGs."
        : "Some FROM lines are missing digest pins."),
  });

  // -------------------------------------------------------------------------
  // P-06: Pinned gwshield Builder Base
  // -------------------------------------------------------------------------
  const hasGwshieldBuilder =
    content.includes("ghcr.io/gwshield") ||
    content.includes("gwshield/go-builder") ||
    content.includes("gwshield/rust-builder") ||
    content.includes("gwshield/python-builder") ||
    content.includes("gwshield/alpine");

  results.push({
    pillarId: "P-06",
    pillarName: "Pinned gwshield Builder Base",
    status: hasGwshieldBuilder ? "pass" : "manual-check",
    detail: hasGwshieldBuilder
      ? "gwshield builder/base image reference found."
      : "No gwshield builder reference. Using a digest-pinned Alpine base is also acceptable.",
  });

  // -------------------------------------------------------------------------
  // P-07: Cosign Keyless Signing (CI concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-07",
    pillarName: "Cosign Keyless Signing",
    status: "not-applicable",
    detail: "Signing is a CI pipeline concern, not a Dockerfile concern.",
  });

  // -------------------------------------------------------------------------
  // P-08: SBOM Attach (CI concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-08",
    pillarName: "SBOM Attach",
    status: "not-applicable",
    detail:
      "SBOM attachment is a CI pipeline concern, not a Dockerfile concern.",
  });

  // -------------------------------------------------------------------------
  // P-09: Trivy Hard CRITICAL Gate (CI concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-09",
    pillarName: "Trivy Hard CRITICAL Gate",
    status: "not-applicable",
    detail:
      "Trivy scanning is a CI pipeline concern. Ensure scan/allowlist.yaml exists.",
  });

  // -------------------------------------------------------------------------
  // P-10: OCI Label Schema
  // -------------------------------------------------------------------------
  const requiredLabels = [
    "org.opencontainers.image.title",
    "org.opencontainers.image.description",
    "org.opencontainers.image.version",
    "org.opencontainers.image.source",
    "org.opencontainers.image.licenses",
    "org.opencontainers.image.vendor",
    "io.gwshield.profile",
  ];
  const foundLabels = requiredLabels.filter((label) =>
    content.includes(label.toLowerCase()),
  );
  const missingLabels = requiredLabels.filter(
    (label) => !content.includes(label.toLowerCase()),
  );

  results.push({
    pillarId: "P-10",
    pillarName: "OCI Label Schema",
    status: missingLabels.length === 0 ? "pass" : "fail",
    detail:
      missingLabels.length === 0
        ? `All ${requiredLabels.length} required OCI labels present.`
        : `Missing labels: ${missingLabels.join(", ")}`,
  });

  // -------------------------------------------------------------------------
  // P-11: gwshield-init Banner Injection
  // -------------------------------------------------------------------------
  const hasGwshieldInit = content.includes("gwshield-init");
  const hasEntrypoint =
    content.includes("entrypoint") && content.includes("gwshield-init");

  results.push({
    pillarId: "P-11",
    pillarName: "gwshield-init Banner Injection",
    status: hasEntrypoint ? "pass" : hasGwshieldInit ? "manual-check" : "fail",
    detail: hasEntrypoint
      ? "gwshield-init is set as ENTRYPOINT."
      : hasGwshieldInit
        ? "gwshield-init referenced but not confirmed as ENTRYPOINT."
        : "No gwshield-init reference found. Add banner build stage and ENTRYPOINT.",
  });

  // -------------------------------------------------------------------------
  // P-12: Hardened Compiler Flags
  // -------------------------------------------------------------------------
  const hardeningFlags = [
    "fstack-protector-strong",
    "fortify_source=2",
    "z,relro",
    "z,now",
  ];
  const foundFlags = hardeningFlags.filter((f) => content.includes(f));
  const isGoOnly = hasCgoDisabled && !content.includes("make");

  results.push({
    pillarId: "P-12",
    pillarName: "Hardened Compiler Flags",
    status: isGoOnly
      ? "not-applicable"
      : foundFlags.length >= 3
        ? "pass"
        : foundFlags.length > 0
          ? "manual-check"
          : "fail",
    detail: isGoOnly
      ? "Go with CGO_ENABLED=0 does not use C compiler flags."
      : `${foundFlags.length}/${hardeningFlags.length} hardening flags found: ${foundFlags.join(", ") || "none"}`,
  });

  // -------------------------------------------------------------------------
  // P-13: Source Tarball with SHA-256 Verification
  // -------------------------------------------------------------------------
  const hasWget = content.includes("wget") || content.includes("curl");
  const hasSha256 =
    content.includes("sha256") ||
    content.includes("checksum") ||
    content.includes("versions.env");
  const isBuilder = family === "go-static" || family === "rust-static";

  results.push({
    pillarId: "P-13",
    pillarName: "Source Tarball with SHA-256 Verification",
    status: isBuilder
      ? "not-applicable"
      : hasWget
        ? hasSha256
          ? "pass"
          : "manual-check"
        : "manual-check",
    detail: isBuilder
      ? "Builder-image family uses pre-compiled toolchain, not source tarballs."
      : hasWget
        ? hasSha256
          ? "Source download + SHA-256 reference found."
          : "Source download found but no SHA-256 verification detected."
        : "No source download found. Ensure source is fetched and verified.",
  });

  // -------------------------------------------------------------------------
  // P-14: Per-image Smoke Test (file concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-14",
    pillarName: "Per-image Smoke Test",
    status: "not-applicable",
    detail:
      "Smoke test is a separate file (tests/smoke.sh), not a Dockerfile concern. Use generate_smoke_test to create one.",
  });

  // -------------------------------------------------------------------------
  // P-15: CVE Allowlist + Risk Statement (file concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-15",
    pillarName: "CVE Allowlist + Risk Statement",
    status: "not-applicable",
    detail:
      "Allowlist and risk statement are separate files. Ensure scan/allowlist.yaml and docs/risk-statement.md exist.",
  });

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------
  const applicablePillars = results.filter(
    (r) => r.status !== "not-applicable",
  );
  const passed = applicablePillars.filter((r) => r.status === "pass");
  const failed = applicablePillars.filter((r) => r.status === "fail");

  const score = passed.length;
  const maxScore = applicablePillars.length;

  const summary =
    failed.length === 0
      ? `All ${maxScore} applicable pillars pass. Dockerfile is compliant.`
      : `${failed.length} pillar(s) need attention. ${score}/${maxScore} applicable pillars pass.`;

  return { pillars: results, score, maxScore, summary };
}
