/**
 * GWShield Image Builder MCP — Dockerfile Validation against 15 Pillars
 *
 * v0.4: line citations, warn tier, per-stage context, stricter checks.
 */

import type {
  ImageFamily,
  PillarValidationResult,
  ValidationResult,
} from "../types/index.js";
import { getAllPillars } from "../pillars/index.js";

// ---------------------------------------------------------------------------
// Stage parser
// ---------------------------------------------------------------------------

/** A single parsed Dockerfile stage */
export interface StageInfo {
  /** Stage alias (e.g. "deps", "builder", "runtime"); empty string if unnamed */
  name: string;
  /** Full FROM line (original casing) */
  fromRef: string;
  /** 1-indexed line number of the FROM instruction */
  fromLine: number;
  /** 1-indexed line number of the last line in this stage (inclusive) */
  endLine: number;
  /** Stage lines, 1-indexed offsets mapped to content */
  lines: { lineNo: number; content: string }[];
}

/**
 * Split a Dockerfile into its constituent stages.
 * Returns one StageInfo per FROM instruction.
 */
export function parseDockerfileStages(rawLines: string[]): StageInfo[] {
  const stages: StageInfo[] = [];
  let current: StageInfo | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1; // 1-indexed
    const raw = rawLines[i];
    const trimmed = raw.trim();

    if (/^FROM\s/i.test(trimmed)) {
      if (current) {
        current.endLine = lineNo - 1;
        stages.push(current);
      }
      // Parse: FROM <ref> [AS <name>]
      const asMatch = trimmed.match(/\bAS\s+(\S+)\s*$/i);
      current = {
        name: asMatch ? asMatch[1].toLowerCase() : "",
        fromRef: trimmed,
        fromLine: lineNo,
        endLine: lineNo,
        lines: [{ lineNo, content: raw }],
      };
    } else if (current) {
      current.lines.push({ lineNo, content: raw });
    }
  }

  if (current) {
    current.endLine = rawLines.length;
    stages.push(current);
  }

  return stages;
}

// ---------------------------------------------------------------------------
// Line-search helpers
// ---------------------------------------------------------------------------

/** Return 1-indexed line numbers matching a case-insensitive regex in rawLines */
function findLines(rawLines: string[], pattern: RegExp): number[] {
  return rawLines
    .map((l, i) => ({ lineNo: i + 1, content: l }))
    .filter(({ content }) => pattern.test(content))
    .map(({ lineNo }) => lineNo);
}

/** Return the first 1-indexed line number matching a regex, or undefined */
function firstLine(rawLines: string[], pattern: RegExp): number | undefined {
  return findLines(rawLines, pattern)[0];
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateDockerfileContent(
  dockerfile: string,
  family?: ImageFamily,
): ValidationResult {
  const rawLines = dockerfile.split("\n");
  const results: PillarValidationResult[] = [];
  const stages = parseDockerfileStages(rawLines);

  // Pre-computed sets used across multiple checks
  const fromLines = rawLines
    .map((l, i) => ({ lineNo: i + 1, content: l.trim() }))
    .filter(({ content }) => /^FROM\s/i.test(content));

  const lastFromEntry =
    fromLines.length > 0 ? fromLines[fromLines.length - 1] : null;
  const lastFromLower = lastFromEntry?.content.toLowerCase() ?? "";

  const isScratch = lastFromLower.includes("scratch");
  const isDistroless = lastFromLower.includes("distroless");

  // Families that use source code COPY rather than tarball download
  const sourceCopyFamilies: ImageFamily[] = [
    "go-static",
    "rust-static",
    "python-static",
    "node-static",
    "java-distroless",
    "go-cgo",
  ];

  // -------------------------------------------------------------------------
  // P-01: FROM scratch/distroless Runtime
  // -------------------------------------------------------------------------
  {
    let status: PillarValidationResult["status"];
    let detail: string;
    const lines: number[] = lastFromEntry ? [lastFromEntry.lineNo] : [];

    if (fromLines.length === 0) {
      status = "fail";
      detail = "No FROM instruction found.";
    } else if (isScratch) {
      status = "pass";
      detail = `Final stage uses FROM scratch (line ${lastFromEntry!.lineNo}).`;
    } else if (isDistroless) {
      status = "warn";
      detail =
        `Final stage uses distroless (line ${lastFromEntry!.lineNo}). ` +
        "Ensure justification is documented in docs/risk-statement.md.";
    } else {
      status = "fail";
      detail =
        `Final FROM is not scratch or distroless (line ${lastFromEntry!.lineNo}): ` +
        `${lastFromEntry!.content.trim()}`;
    }

    results.push({
      pillarId: "P-01",
      pillarName: "FROM scratch/distroless Runtime",
      status,
      detail,
      lines,
    });
  }

  // -------------------------------------------------------------------------
  // P-02: Static Binary
  // -------------------------------------------------------------------------
  {
    // Search only in non-comment, non-blank lines inside RUN instructions
    const runLines = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .filter(({ content }) => /^\s*RUN\b/i.test(content) || /^\s+/.test(content));

    const cgoLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /CGO_ENABLED\s*=\s*0/i.test(content));

    const muslLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /\bmusl\b|-static\b/i.test(content));

    const readelfLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /\breadelf\b/i.test(content));

    const hasCgoDisabled = !!cgoLine;
    const hasMuslLink = !!muslLine;
    const hasReadelf = !!readelfLine;
    const citedLines: number[] = [];
    if (cgoLine) citedLines.push(cgoLine.lineNo);
    if (muslLine && !cgoLine) citedLines.push(muslLine.lineNo);
    if (readelfLine) citedLines.push(readelfLine.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (hasCgoDisabled) {
      if (hasReadelf) {
        status = "pass";
        detail = `CGO_ENABLED=0 (line ${cgoLine!.lineNo}). readelf verification present (line ${readelfLine!.lineNo}).`;
      } else {
        status = "warn";
        detail =
          `CGO_ENABLED=0 found (line ${cgoLine!.lineNo}). ` +
          "Consider adding a readelf verification step to confirm static linking.";
      }
    } else if (hasMuslLink) {
      if (hasReadelf) {
        status = "pass";
        detail = `musl/static linking detected (line ${muslLine!.lineNo}). readelf verification present (line ${readelfLine!.lineNo}).`;
      } else {
        status = "warn";
        detail =
          `musl/static linking detected (line ${muslLine!.lineNo}). ` +
          "Consider adding readelf verification.";
      }
    } else {
      status = "fail";
      detail =
        "No static linking evidence found. Set CGO_ENABLED=0 (Go) or link against musl (C/Rust).";
    }

    results.push({
      pillarId: "P-02",
      pillarName: "Static Binary",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-03: Non-root UID 65532
  // -------------------------------------------------------------------------
  {
    const userLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /^\s*USER\s+65532:65532\s*$/i.test(content));

    const adduserLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /adduser.*65532|65532.*adduser/i.test(content));

    const addgroupLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /addgroup.*65532|65532.*addgroup/i.test(content));

    const citedLines: number[] = [];
    if (userLine) citedLines.push(userLine.lineNo);
    if (adduserLine) citedLines.push(adduserLine.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (userLine) {
      const hasNonrootSetup = !!(adduserLine || addgroupLine);
      status = "pass";
      detail =
        `USER 65532:65532 (line ${userLine.lineNo}).` +
        (hasNonrootSetup
          ? ` nonroot user creation present (line ${(adduserLine ?? addgroupLine)!.lineNo}).`
          : " No adduser/addgroup block found — ensure user is created in deps stage.");
    } else {
      status = "fail";
      detail = "USER 65532:65532 not found in final stage.";
    }

    results.push({
      pillarId: "P-03",
      pillarName: "Non-root UID 65532",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-04: No Shell in Runtime
  // -------------------------------------------------------------------------
  {
    let status: PillarValidationResult["status"];
    let detail: string;
    const lines: number[] = lastFromEntry ? [lastFromEntry.lineNo] : [];

    if (isScratch) {
      status = "pass";
      detail = "FROM scratch inherently has no shell.";
    } else if (isDistroless) {
      status = "pass";
      detail =
        "Distroless base has no shell. Smoke test should assert no /bin/sh present.";
    } else {
      status = "manual-check";
      detail =
        "Runtime base is not scratch or distroless. Manual verification required: " +
        "confirm no /bin/sh, package managers, or network tools exist in the final layer.";
    }

    results.push({
      pillarId: "P-04",
      pillarName: "No Shell in Runtime",
      status,
      detail,
      lines,
    });
  }

  // -------------------------------------------------------------------------
  // P-05: Multi-stage Build with Digest-pinned Bases
  // -------------------------------------------------------------------------
  {
    const stageCount = fromLines.length;
    const expectedStageNames = ["deps", "banner", "builder", "runtime"];
    const foundStageNames = stages.map((s) => s.name);

    const missingStageNames = expectedStageNames.filter(
      (n) => !foundStageNames.includes(n),
    );

    const pinnableFroms = fromLines.filter(
      (l) => !l.content.toLowerCase().includes("scratch"),
    );
    const unpinnedFroms = pinnableFroms.filter(
      (l) => !l.content.includes("sha256:") && !l.content.includes("${"),
    );
    const allPinned = unpinnedFroms.length === 0;

    const unpinnedLines = unpinnedFroms.map((l) => l.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (stageCount < 3) {
      status = "fail";
      detail = `Only ${stageCount} stage(s) found; minimum 3 required (deps, builder, runtime).`;
    } else if (!allPinned && missingStageNames.length > 0) {
      status = "fail";
      detail =
        `${stageCount} stages found. ` +
        `${unpinnedFroms.length} FROM line(s) missing digest pins (lines: ${unpinnedLines.join(", ")}). ` +
        `Missing stage names: ${missingStageNames.join(", ")}.`;
    } else if (!allPinned) {
      status = "fail";
      detail =
        `${stageCount} stages found. ` +
        `${unpinnedFroms.length} FROM line(s) missing sha256 digest pins (lines: ${unpinnedLines.join(", ")}).`;
    } else if (missingStageNames.length > 0) {
      status = "warn";
      detail =
        `${stageCount} stages with all bases pinned. ` +
        `Standard stage names not found: ${missingStageNames.join(", ")}. ` +
        "Rename stages to deps/banner/builder/runtime for consistency.";
    } else {
      status = "pass";
      detail =
        `${stageCount} stages (${foundStageNames.join(", ")}), all non-scratch bases digest-pinned.`;
    }

    results.push({
      pillarId: "P-05",
      pillarName: "Multi-stage Build with Digest-pinned Bases",
      status,
      detail,
      lines: unpinnedLines.length > 0 ? unpinnedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-06: Pinned gwshield Builder Base
  // -------------------------------------------------------------------------
  {
    const gwshieldLines = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .filter(({ content }) =>
        /ghcr\.io\/gwshield|gwshield\/(go|rust|python|node|java)-builder|gwshield\/alpine/i.test(
          content,
        ),
      );

    const citedLines = gwshieldLines.map((l) => l.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (gwshieldLines.length > 0) {
      status = "pass";
      detail =
        `gwshield builder/base image reference found on line(s): ${citedLines.join(", ")}.`;
    } else {
      status = "manual-check";
      detail =
        "No gwshield builder reference found. " +
        "Acceptable alternatives: digest-pinned Alpine base or official distroless base.";
    }

    results.push({
      pillarId: "P-06",
      pillarName: "Pinned gwshield Builder Base",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

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
    detail: "SBOM attachment is a CI pipeline concern, not a Dockerfile concern.",
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
  {
    const requiredLabels = [
      "org.opencontainers.image.title",
      "org.opencontainers.image.description",
      "org.opencontainers.image.version",
      "org.opencontainers.image.source",
      "org.opencontainers.image.licenses",
      "org.opencontainers.image.vendor",
      "io.gwshield.profile",
    ];

    const labelLines = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .filter(({ content }) => /^\s*LABEL\b/i.test(content));

    // Collect all text from LABEL blocks (including continuation lines)
    const labelBlockStart = labelLines.length > 0 ? labelLines[0].lineNo : 0;

    // Check presence against full lowercased content (labels can span lines)
    const fullLower = dockerfile.toLowerCase();
    const foundLabels = requiredLabels.filter((lbl) =>
      fullLower.includes(lbl.toLowerCase()),
    );
    const missingLabels = requiredLabels.filter(
      (lbl) => !fullLower.includes(lbl.toLowerCase()),
    );

    const citedLines = labelLines.map((l) => l.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (missingLabels.length === 0) {
      status = "pass";
      detail = `All ${requiredLabels.length} required OCI labels present.`;
    } else if (foundLabels.length > 0) {
      status = "fail";
      detail = `Missing label(s): ${missingLabels.join(", ")}`;
    } else {
      status = "fail";
      detail = "No OCI labels found. Add a LABEL instruction with all required fields.";
    }

    results.push({
      pillarId: "P-10",
      pillarName: "OCI Label Schema",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-11: gwshield-init Banner Injection
  // -------------------------------------------------------------------------
  {
    const entrypointLines = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .filter(({ content }) => /^\s*ENTRYPOINT\b/i.test(content));

    const gwshieldEntrypoint = entrypointLines.find(({ content }) =>
      /gwshield-init/i.test(content),
    );

    const gwshieldRefLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /gwshield-init/i.test(content));

    const bannerStageLine = stages.find((s) => s.name === "banner")
      ? stages.find((s) => s.name === "banner")!.fromLine
      : undefined;

    const citedLines: number[] = [];
    if (gwshieldEntrypoint) citedLines.push(gwshieldEntrypoint.lineNo);
    else if (gwshieldRefLine) citedLines.push(gwshieldRefLine.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (gwshieldEntrypoint) {
      status = "pass";
      detail =
        `gwshield-init set as ENTRYPOINT (line ${gwshieldEntrypoint.lineNo}).` +
        (bannerStageLine
          ? ` Banner build stage present (line ${bannerStageLine}).`
          : " No 'banner' stage found — ensure gwshield-init is compiled in a dedicated stage.");
    } else if (gwshieldRefLine) {
      status = "manual-check";
      detail =
        `gwshield-init referenced (line ${gwshieldRefLine.lineNo}) but not confirmed as ENTRYPOINT.`;
    } else {
      status = "fail";
      detail =
        "No gwshield-init reference found. Add a banner stage compiling gwshield-init.c " +
        'and set ENTRYPOINT ["/usr/local/bin/gwshield-init"].';
    }

    results.push({
      pillarId: "P-11",
      pillarName: "gwshield-init Banner Injection",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-12: Hardened Compiler Flags
  // -------------------------------------------------------------------------
  {
    // Go with CGO_ENABLED=0 uses no C compiler — not applicable
    const hasCgoDisabled = rawLines.some((l) =>
      /CGO_ENABLED\s*=\s*0/i.test(l),
    );
    const hasMakeOrCc = rawLines.some((l) =>
      /\bmake\b|\bcc\b|\bgcc\b|\bclang\b/i.test(l),
    );
    const isGoOnly = hasCgoDisabled && !hasMakeOrCc;

    const hardFlags = [
      { flag: "-fstack-protector-strong", pattern: /fstack-protector-strong/ },
      { flag: "-D_FORTIFY_SOURCE=2", pattern: /FORTIFY_SOURCE\s*=\s*2/i },
      { flag: "-Wl,-z,relro", pattern: /-z[, ]relro/ },
      { flag: "-Wl,-z,now", pattern: /-z[, ]now/ },
      { flag: "-fPIE", pattern: /-f[Pp][Ii][Ee]/ },
    ];

    const stripLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /\bstrip\b.*--strip-unneeded|\bstrip\b/i.test(content));

    const foundFlags = hardFlags.filter(({ pattern }) =>
      rawLines.some((l) => pattern.test(l)),
    );
    const missingFlags = hardFlags.filter(
      ({ pattern }) => !rawLines.some((l) => pattern.test(l)),
    );

    // Find the line with the most hardening flags for citation
    const cflagsLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /fstack-protector|FORTIFY_SOURCE/i.test(content));

    const citedLines: number[] = [];
    if (cflagsLine) citedLines.push(cflagsLine.lineNo);
    if (stripLine) citedLines.push(stripLine.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (isGoOnly) {
      status = "not-applicable";
      detail = "Go with CGO_ENABLED=0 does not use C compiler flags.";
    } else if (foundFlags.length === hardFlags.length && stripLine) {
      status = "pass";
      detail =
        `All ${hardFlags.length} hardening flags present. strip step found (line ${stripLine.lineNo}).`;
    } else if (foundFlags.length === hardFlags.length && !stripLine) {
      status = "warn";
      detail =
        `All ${hardFlags.length} hardening flags present but no strip step found. ` +
        "Add strip --strip-unneeded after compilation.";
    } else if (foundFlags.length >= 3) {
      const missing = missingFlags.map((f) => f.flag).join(", ");
      status = "warn";
      detail =
        `${foundFlags.length}/${hardFlags.length} hardening flags found. ` +
        `Missing: ${missing}.` +
        (stripLine ? "" : " strip step also missing.");
    } else if (foundFlags.length > 0) {
      const missing = missingFlags.map((f) => f.flag).join(", ");
      status = "fail";
      detail =
        `Only ${foundFlags.length}/${hardFlags.length} hardening flags found. ` +
        `Missing: ${missing}.`;
    } else {
      status = "fail";
      detail =
        "No hardening compiler flags found. " +
        "Required: -fstack-protector-strong, -D_FORTIFY_SOURCE=2, -Wl,-z,relro, -Wl,-z,now, -fPIE. " +
        "Also add strip --strip-unneeded after compilation.";
    }

    results.push({
      pillarId: "P-12",
      pillarName: "Hardened Compiler Flags",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-13: Source Tarball with SHA-256 Verification
  // -------------------------------------------------------------------------
  {
    const isSourceCopyFamily =
      family !== undefined && sourceCopyFamilies.includes(family);

    const downloadLine = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) => /\bwget\b|\bcurl\b/i.test(content));

    const sha256Line = rawLines
      .map((l, i) => ({ lineNo: i + 1, content: l }))
      .find(({ content }) =>
        /sha256|checksum|versions\.env/i.test(content),
      );

    const citedLines: number[] = [];
    if (downloadLine) citedLines.push(downloadLine.lineNo);
    if (sha256Line) citedLines.push(sha256Line.lineNo);

    let status: PillarValidationResult["status"];
    let detail: string;

    if (isSourceCopyFamily) {
      status = "not-applicable";
      detail = `${family} family uses source code COPY, not tarball download.`;
    } else if (downloadLine && sha256Line) {
      status = "pass";
      detail =
        `Source download (line ${downloadLine.lineNo}) with SHA-256 reference (line ${sha256Line.lineNo}).`;
    } else if (downloadLine && !sha256Line) {
      status = "fail";
      detail =
        `Source download found (line ${downloadLine.lineNo}) but no SHA-256 verification detected. ` +
        "Add sha256sum check after download.";
    } else {
      status = "manual-check";
      detail =
        "No source download found. Ensure source is fetched and SHA-256 verified, or confirm family is set correctly.";
    }

    results.push({
      pillarId: "P-13",
      pillarName: "Source Tarball with SHA-256 Verification",
      status,
      detail,
      lines: citedLines.length > 0 ? citedLines : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // P-14: Per-image Smoke Test (file concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-14",
    pillarName: "Per-image Smoke Test",
    status: "not-applicable",
    detail:
      "Smoke test is a separate file (tests/smoke.sh), not a Dockerfile concern. " +
      "Use generate_smoke_test to create one.",
  });

  // -------------------------------------------------------------------------
  // P-15: CVE Allowlist + Risk Statement (file concern)
  // -------------------------------------------------------------------------
  results.push({
    pillarId: "P-15",
    pillarName: "CVE Allowlist + Risk Statement",
    status: "not-applicable",
    detail:
      "Allowlist and risk statement are separate files. " +
      "Ensure scan/allowlist.yaml and docs/risk-statement.md exist.",
  });

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------
  const applicablePillars = results.filter(
    (r) => r.status !== "not-applicable",
  );
  const passed = applicablePillars.filter((r) => r.status === "pass");
  const warned = applicablePillars.filter((r) => r.status === "warn");
  const failed = applicablePillars.filter((r) => r.status === "fail");

  const score = passed.length;
  const warnings = warned.length;
  const maxScore = applicablePillars.length;

  let summary: string;
  if (failed.length === 0 && warnings === 0) {
    summary = `All ${maxScore} applicable pillars pass. Dockerfile is compliant.`;
  } else if (failed.length === 0) {
    summary = `${score}/${maxScore} pass, ${warnings} warning(s). Address warnings to reach full compliance.`;
  } else {
    summary =
      `${score}/${maxScore} pass, ${warnings} warning(s), ${failed.length} failure(s). ` +
      `Fix failures first.`;
  }

  return { pillars: results, score, warnings, maxScore, summary };
}
