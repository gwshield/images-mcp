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
  "python-static": {
    family: "python-static",
    runtime: "gcr.io/distroless/python3-debian12",
    linking: "CPython interpreter + compiled .pyc wheels, no pip/setuptools",
    examples: ["gunicorn", "uvicorn", "flask", "fastapi", "celery"],
    description:
      "Python services packaged as compiled .pyc wheels with a distroless Python " +
      "runtime. The builder stage uses ghcr.io/gwshield/python-builder to install " +
      "dependencies into a venv, pre-compile all .py to .pyc, and strip test/docs " +
      "from site-packages. Runtime is distroless/python3-debian12 with no pip, " +
      "no shell, and no package manager.",
  },
  "node-static": {
    family: "node-static",
    runtime: "gcr.io/distroless/nodejs20-debian12",
    linking: "Node.js runtime, production node_modules only",
    examples: ["express", "fastify", "nestjs", "next.js"],
    description:
      "Node.js services with production-only node_modules copied from a dedicated " +
      "dependency stage. Builder stage uses ghcr.io/gwshield/node-builder. " +
      "Runtime is distroless/nodejs20-debian12 — no npm, no shell, no package manager. " +
      "Only compiled/transpiled output and production node_modules are included.",
  },
  "java-distroless": {
    family: "java-distroless",
    runtime: "gcr.io/distroless/java21-debian12",
    linking: "JVM bytecode, JRE runtime only",
    examples: ["spring-boot", "quarkus", "micronaut", "kafka"],
    description:
      "JVM services packaged as a fat JAR or exploded layers. Builder stage uses " +
      "ghcr.io/gwshield/java-builder (JDK 21). Runtime is distroless/java21-debian12 " +
      "which includes only the JRE and CA certificates — no JDK, no shell, no package " +
      "manager. Requires documented justification per P-01 (JVM dependency).",
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
    if (lang === "python" || lang === "py") return FAMILIES["python-static"];
    if (
      lang === "node" ||
      lang === "nodejs" ||
      lang === "javascript" ||
      lang === "typescript"
    )
      return FAMILIES["node-static"];
    if (lang === "java" || lang === "kotlin" || lang === "jvm")
      return FAMILIES["java-distroless"];
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
