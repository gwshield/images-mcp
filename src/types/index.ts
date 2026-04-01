/**
 * GWShield Image Builder MCP — Type Definitions
 */

/** Image build family classification */
export type ImageFamily =
  | "go-static"
  | "c-musl"
  | "c-glibc"
  | "go-cgo"
  | "rust-static";

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
export type PillarStatus = "pass" | "fail" | "not-applicable" | "manual-check";

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
}

/** Full validation result */
export interface ValidationResult {
  pillars: PillarValidationResult[];
  score: number;
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
