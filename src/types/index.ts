/**
 * GWShield Image Builder MCP — Type Definitions
 */

/** Image build family classification */
export type ImageFamily =
  | "go-static"
  | "c-musl"
  | "c-glibc"
  | "go-cgo"
  | "rust-static"
  | "python-static"
  | "node-static"
  | "java-distroless";

/** Image profile variant */
export type ImageProfile =
  | "standard"
  | "tls"
  | "cluster"
  | "cli"
  | "http2"
  | "http3"
  | "dev"
  | "compile-only";

/** Pillar compliance status */
export type PillarStatus =
  | "pass"
  | "warn"
  | "fail"
  | "not-applicable"
  | "manual-check";

/** A single hardening pillar definition */
export interface Pillar {
  id: string;
  number: number;
  name: string;
  summary: string;
  description: string;
  enforcement: string;
  appliesTo: "runtime" | "builder" | "both";
}

/** Input for Dockerfile generation */
export interface GenerateDockerfileInput {
  serviceName: string;
  serviceVersion: string;
  family: ImageFamily;
  profile: ImageProfile;
  sourceUrl?: string;
  sourceSha256?: string;
  builderImage?: string;
  builderTag?: string;
  builderDigest?: string;
  alpineTag?: string;
  alpineDigest?: string;
  extraBuildDeps?: string[];
  extraBuildFlags?: string;
  configFiles?: string[];
  exposePorts?: number[];
  volumes?: string[];
  runtimeDirs?: string[];
  healthcheckCmd?: string[];
  disableFeatures?: string[];
  description?: string;
  /**
   * F-5: Explicit source files/directories to COPY into the build stage.
   * Applies to go-static and rust-static families (user-code patterns).
   *
   * When provided, generates an explicit COPY instruction set with a
   * layer-caching pattern (manifests first, then source).
   *
   * When omitted, falls back to `COPY . /build/` with a # TODO comment
   * prompting the developer to replace it.
   *
   * Not applicable to c-musl / c-glibc: those families download source
   * tarballs inside the container and do not COPY local source files.
   *
   * Examples:
   *   go-static:   ["go.mod", "go.sum", "main.go", "pkg/", "internal/"]
   *   rust-static: ["Cargo.toml", "Cargo.lock", "src/"]
   */
  sourceFiles?: string[];
}

/** Input for Dockerfile validation */
export interface ValidateDockerfileInput {
  dockerfile: string;
  family?: ImageFamily;
}

/** Validation result per pillar */
export interface PillarValidationResult {
  pillarId: string;
  pillarName: string;
  status: PillarStatus;
  detail: string;
  /** 1-indexed line numbers relevant to this finding */
  lines?: number[];
}

/** Full validation result */
export interface ValidationResult {
  pillars: PillarValidationResult[];
  score: number;
  warnings: number;
  maxScore: number;
  summary: string;
}

/** Image family metadata */
export interface FamilyInfo {
  family: ImageFamily;
  runtime: string;
  linking: string;
  examples: string[];
  description: string;
}
