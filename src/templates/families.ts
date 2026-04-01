/**
 * GWShield Image Builder MCP — Image Family Definitions
 */

import type { FamilyInfo, ImageFamily } from "../types/index.js";

export const FAMILIES: Record<ImageFamily, FamilyInfo> = {
  "go-static": {
    family: "go-static",
    runtime: "scratch",
    linking: "CGO_ENABLED=0, fully static",
    examples: ["traefik", "caddy", "nats", "consul", "vault", "prometheus"],
    description:
      "Go services compiled with CGO_ENABLED=0 produce fully static binaries " +
      "with zero external dependencies. Runtime is FROM scratch with no loader needed.",
  },
  "c-musl": {
    family: "c-musl",
    runtime: "scratch + musl loader",
    linking: "musl static link, dynamic musl loader",
    examples: ["nginx", "redis", "valkey", "haproxy"],
    description:
      "C services compiled against musl libc on Alpine. The binary links statically " +
      "against all libraries except musl itself. Runtime is FROM scratch with only " +
      "the musl dynamic loader (/lib/ld-musl-*.so.1) copied in.",
  },
  "c-glibc": {
    family: "c-glibc",
    runtime: "gcr.io/distroless/cc-debian12",
    linking: "glibc dynamic",
    examples: ["postgres", "mysql"],
    description:
      "C services that require glibc and cannot be compiled against musl. " +
      "Runtime uses distroless/cc-debian12 which provides the minimal glibc runtime. " +
      "Requires documented justification per P-01.",
  },
  "go-cgo": {
    family: "go-cgo",
    runtime: "gcr.io/distroless/static-debian12 or cc-debian12",
    linking: "CGO enabled, embedded C/C++",
    examples: ["pomerium", "otel-collector"],
    description:
      "Go services that require CGO (embedded C/C++ like Envoy proxy in Pomerium). " +
      "Cannot use CGO_ENABLED=0. Runtime uses distroless with minimal C library support.",
  },
  "rust-static": {
    family: "rust-static",
    runtime: "scratch",
    linking: "musl target, fully static",
    examples: ["ripgrep", "fd", "bat", "delta"],
    description:
      "Rust services compiled with --target x86_64-unknown-linux-musl for a fully " +
      "static binary. Runtime is FROM scratch with no loader needed.",
  },
};

/**
 * Suggest the best image family for a given service
 */
export function suggestFamily(
  serviceName: string,
  language?: string,
): FamilyInfo {
  const name = serviceName.toLowerCase();

  // Check known examples first
  for (const info of Object.values(FAMILIES)) {
    if (info.examples.some((ex) => name.includes(ex))) {
      return info;
    }
  }

  // Fall back to language hint
  if (language) {
    const lang = language.toLowerCase();
    if (lang === "go" || lang === "golang") return FAMILIES["go-static"];
    if (lang === "c" || lang === "c++") return FAMILIES["c-musl"];
    if (lang === "rust") return FAMILIES["rust-static"];
  }

  // Default to go-static (most common)
  return FAMILIES["go-static"];
}

/**
 * Get family info by key
 */
export function getFamily(family: ImageFamily): FamilyInfo {
  return FAMILIES[family];
}
