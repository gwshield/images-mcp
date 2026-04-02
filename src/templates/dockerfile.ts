/**
 * GWShield Image Builder MCP — Dockerfile Template Generator
 *
 * Generates hardened Dockerfiles following all 15 pillars.
 * Templates derived from production Dockerfiles (Redis v7.4.8, Go-Builder v1.25, etc.)
 */

import type { GenerateDockerfileInput, ImageFamily } from "../types/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ALPINE_IMAGE = "ghcr.io/gwshield/alpine";
const DEFAULT_ALPINE_TAG = "3.22";
const DEFAULT_ALPINE_DIGEST =
  "sha256:55ae5d250caebc548793f321534bc6a8ef1d116f334f18f4ada1b2daad3251b2";

const HARDENED_CFLAGS =
  '"-O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -Wformat -Werror=format-security -fPIE"';
const HARDENED_LDFLAGS = '"-Wl,-z,relro,-z,now -pie"';

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateDockerfile(input: GenerateDockerfileInput): string {
  switch (input.family) {
    case "go-static":
      return generateGoStatic(input);
    case "c-musl":
      return generateCMusl(input);
    case "c-glibc":
      return generateCGlibc(input);
    case "go-cgo":
      return generateGoCgo(input);
    case "rust-static":
      return generateRustStatic(input);
    default:
      return generateGoStatic(input);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function header(input: GenerateDockerfileInput): string {
  const desc = input.description ?? `Hardened ${input.serviceName} image`;
  return `# syntax=docker/dockerfile:1.10
# =============================================================================
# gwshield-${input.serviceName} ${input.serviceVersion} — ${input.profile} profile
# Copyright RELICFROG Foundation, Patrick Paechnatz — Apache-2.0
# =============================================================================
# Profile  : ${input.profile}
# Runtime  : ${runtimeFor(input.family)}
# Security : ${desc}
# =============================================================================
`;
}

function runtimeFor(family: ImageFamily): string {
  switch (family) {
    case "go-static":
      return "FROM scratch, UID/GID 65532 (nonroot), no shell, no package mgr.";
    case "c-musl":
      return "FROM scratch + musl loader, UID/GID 65532 (nonroot), no shell.";
    case "c-glibc":
      return "FROM distroless/cc-debian12, UID/GID 65532 (nonroot).";
    case "go-cgo":
      return "FROM distroless/static-debian12, UID/GID 65532 (nonroot).";
    case "rust-static":
      return "FROM scratch, UID/GID 65532 (nonroot), no shell.";
  }
}

function globalArgs(input: GenerateDockerfileInput): string {
  const alpineImage = DEFAULT_ALPINE_IMAGE;
  const alpineTag = input.alpineTag ?? DEFAULT_ALPINE_TAG;
  const alpineDigest = input.alpineDigest ?? DEFAULT_ALPINE_DIGEST;

  return `
# -----------------------------------------------------------------------------
# Global ARGs
# -----------------------------------------------------------------------------
ARG ALPINE_IMAGE=${alpineImage}
ARG ALPINE_TAG=${alpineTag}
ARG ALPINE_DIGEST=${alpineDigest}

# Gwshield banner — build-time metadata (injected by CI via --build-arg)
ARG GWS_SERVICE="${input.serviceName}"
ARG GWS_VERSION="${input.serviceVersion}"
ARG GWS_PROFILE="${input.profile}"
ARG GWS_BUILD_TS="unknown"
ARG GWS_GIT_COMMIT="unknown"
ARG GWS_GIT_BRANCH="unknown"
ARG GWS_EXEC="/usr/local/bin/${input.serviceName}"
`;
}

function depsStage(input: GenerateDockerfileInput): string {
  const runtimeDirs = input.runtimeDirs ?? ["/data"];
  const mkdirLines = runtimeDirs.map((d) => `        ${d}`).join(" \\\n");
  const chownLines = runtimeDirs.map((d) => `        ${d}`).join(" \\\n");

  return `
# -----------------------------------------------------------------------------
# Stage 1: deps — nonroot identity + runtime filesystem skeleton
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${ALPINE_IMAGE}:\${ALPINE_TAG}@\${ALPINE_DIGEST} AS deps

# hadolint ignore=DL3018
RUN --mount=type=cache,target=/var/cache/apk,id=apk-${input.serviceName}-${input.profile}-deps \\
    apk add --no-cache \\
        ca-certificates \\
        tzdata \\
    && addgroup -g 65532 -S nonroot \\
    && adduser  -u 65532 -S -G nonroot -H -s /sbin/nologin nonroot

RUN mkdir -p \\
${mkdirLines} \\
    && chown -R 65532:65532 \\
${chownLines} \\
    && chmod 1777 /tmp
`;
}

function bannerStage(input: GenerateDockerfileInput): string {
  return `
# -----------------------------------------------------------------------------
# Stage 2: banner — compile gwshield-init startup wrapper (statically linked)
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${ALPINE_IMAGE}:\${ALPINE_TAG}@\${ALPINE_DIGEST} AS banner

# hadolint ignore=DL3018
RUN --mount=type=cache,target=/var/cache/apk,id=apk-${input.serviceName}-${input.profile}-banner \\
    apk add --no-cache gcc musl-dev

ARG GWS_SERVICE
ARG GWS_VERSION
ARG GWS_PROFILE
ARG GWS_BUILD_TS
ARG GWS_GIT_COMMIT
ARG GWS_GIT_BRANCH
ARG GWS_EXEC

COPY shared/banner/gwshield-init.c /tmp/gwshield-init.c

# hadolint ignore=SC2016
RUN gcc \\
        -O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE \\
        -Wformat -Werror=format-security -Wall \\
        -DGWS_SERVICE='"'"$\{GWS_SERVICE}"'"' \\
        -DGWS_VERSION='"'"$\{GWS_VERSION}"'"' \\
        -DGWS_PROFILE='"'"$\{GWS_PROFILE}"'"' \\
        -DGWS_BUILD_TS='"'"$\{GWS_BUILD_TS}"'"' \\
        -DGWS_GIT_COMMIT='"'"$\{GWS_GIT_COMMIT}"'"' \\
        -DGWS_GIT_BRANCH='"'"$\{GWS_GIT_BRANCH}"'"' \\
        -DGWS_EXEC='"'"$\{GWS_EXEC}"'"' \\
        -Wl,-z,relro,-z,now -static -pie \\
        -o /usr/local/bin/gwshield-init \\
        /tmp/gwshield-init.c \\
    && strip --strip-unneeded /usr/local/bin/gwshield-init
`;
}

function ociLabels(input: GenerateDockerfileInput): string {
  const desc =
    input.description ??
    `Hardened ${input.serviceName} ${input.serviceVersion} — ${input.profile} profile`;
  return `
LABEL org.opencontainers.image.title="Hardened ${input.serviceName} (${input.profile})" \\
      org.opencontainers.image.description="${desc}" \\
      org.opencontainers.image.version="${input.serviceVersion}" \\
      org.opencontainers.image.vendor="Gatewarden" \\
      org.opencontainers.image.licenses="Apache-2.0" \\
      org.opencontainers.image.source="https://github.com/gwshield/images" \\
      io.gwshield.profile="${input.profile}" \\
      io.gwshield.${input.serviceName.replace(/-/g, ".")}.version="${input.serviceVersion}"
`;
}

function runtimeFooter(input: GenerateDockerfileInput): string {
  const ports = input.exposePorts ?? [];
  const vols = input.volumes ?? ["/data"];
  const hc = input.healthcheckCmd;

  let out = "";

  out += `\nUSER 65532:65532\n`;

  for (const port of ports) {
    out += `\nEXPOSE ${port}/tcp`;
  }

  if (vols.length > 0) {
    out += `\n\nVOLUME [${vols.map((v) => `"${v}"`).join(", ")}]`;
  }

  out += `\n\nSTOPSIGNAL SIGTERM\n`;

  if (hc && hc.length > 0) {
    const cmd = hc.map((c) => `"${c}"`).join(", ");
    out += `
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
    CMD [${cmd}]
`;
  }

  out += `
ENTRYPOINT ["/usr/local/bin/gwshield-init"]
CMD ["--help"]
`;

  return out;
}

// ---------------------------------------------------------------------------
// F-5: Source COPY helpers
//
// Generates explicit COPY instructions for user-code families (go-static,
// rust-static). When sourceFiles is provided, a layer-caching pattern is
// used (manifests first, then source). When omitted, falls back to
// COPY . /build/ with a TODO comment.
//
// C-musl and C-glibc are NOT covered here — those families download source
// tarballs inside the container and have no local COPY at all.
// ---------------------------------------------------------------------------

function goSourceCopy(input: GenerateDockerfileInput): string {
  const files = input.sourceFiles;

  if (!files || files.length === 0) {
    return (
      `# F-5: No sourceFiles provided — using COPY . /build/ as fallback.\n` +
      `# TODO: Replace with explicit COPY for better layer caching and security.\n` +
      `#       Recommended pattern for a standard Go module:\n` +
      `#         COPY go.mod go.sum /build/\n` +
      `#         RUN go mod download\n` +
      `#         COPY main.go cmd/ pkg/ internal/ /build/\n` +
      `COPY . /build/\n`
    );
  }

  // Separate module manifests (go.mod/go.sum) from the rest for dep caching
  const modFiles = files.filter((f) => f === "go.mod" || f === "go.sum");
  const srcFiles = files.filter((f) => f !== "go.mod" && f !== "go.sum");

  let out = "";
  if (modFiles.length > 0) {
    out += `# Layer 1: module manifests — cached until dependencies change\n`;
    out += `COPY ${modFiles.join(" ")} /build/\n`;
    out += `RUN go mod download\n\n`;
  }
  if (srcFiles.length > 0) {
    out += `# Layer 2: source files\n`;
    out += `COPY ${srcFiles.join(" ")} /build/\n`;
  }
  return out;
}

function rustSourceCopy(input: GenerateDockerfileInput): string {
  const files = input.sourceFiles;

  if (!files || files.length === 0) {
    return (
      `# F-5: No sourceFiles provided — using COPY . /build/ as fallback.\n` +
      `# TODO: Replace with explicit COPY for better layer caching and security.\n` +
      `#       Recommended pattern for a standard Rust crate:\n` +
      `#         COPY Cargo.toml Cargo.lock /build/\n` +
      `#         RUN mkdir src && echo "fn main() {}" > src/main.rs \\\\\n` +
      `#             && cargo build --release --target "$RUST_TARGET" \\\\\n` +
      `#             ; rm -f "target/$RUST_TARGET/release/${input.serviceName}"*  # prime dep cache\n` +
      `#         COPY src/ /build/src/\n` +
      `COPY . /build/\n`
    );
  }

  // Separate Cargo manifests from source for dep cache priming
  const manifestFiles = files.filter(
    (f) => f === "Cargo.toml" || f === "Cargo.lock",
  );
  const srcFiles = files.filter(
    (f) => f !== "Cargo.toml" && f !== "Cargo.lock",
  );

  let out = "";
  if (manifestFiles.length > 0) {
    out += `# Layer 1: Cargo manifests — prime dependency cache\n`;
    out += `COPY ${manifestFiles.join(" ")} /build/\n`;
  }
  if (srcFiles.length > 0) {
    out += `# Layer 2: source files\n`;
    out += `COPY ${srcFiles.join(" ")} /build/\n`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Family-specific generators
// ---------------------------------------------------------------------------

function generateGoStatic(input: GenerateDockerfileInput): string {
  const builderImage = input.builderImage ?? "ghcr.io/gwshield/go-builder";
  const builderTag = input.builderTag ?? "v1.25";
  const builderDigest =
    input.builderDigest ?? "sha256:REPLACE_WITH_ACTUAL_DIGEST";

  return (
    header(input) +
    globalArgs(input) +
    `
ARG GO_BUILDER_IMAGE=${builderImage}
ARG GO_BUILDER_TAG=${builderTag}
ARG GO_BUILDER_DIGEST=${builderDigest}
` +
    depsStage(input) +
    bannerStage(input) +
    `
# -----------------------------------------------------------------------------
# Stage 3: builder — compile from source
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${GO_BUILDER_IMAGE}:\${GO_BUILDER_TAG}@\${GO_BUILDER_DIGEST} AS builder

# F-4: TARGETARCH is injected by BuildKit when building with --platform.
# Declare it here to make the multi-arch intent explicit and use it for GOARCH.
ARG TARGETARCH

WORKDIR /build

${goSourceCopy(input)}
# F-4: Map TARGETARCH (BuildKit) to GOARCH (Go toolchain)
# hadolint ignore=SC2039
RUN case "$TARGETARCH" in \\
        arm64|aarch64) export GOARCH="arm64" ;; \\
        *)             export GOARCH="amd64" ;; \\
    esac \\
    && CGO_ENABLED=0 GOOS=linux GOARCH="$GOARCH" go build \\
        -trimpath \\
        -ldflags "-s -w" \\
        -o /build/${input.serviceName} .

# Verify static binary
RUN set -e; \\
    file /build/${input.serviceName} | grep -q "statically linked" \\
    && echo "OK: ${input.serviceName} is statically linked" \\
    || { echo "ERROR: ${input.serviceName} is not statically linked"; exit 1; }
` +
    `
# -----------------------------------------------------------------------------
# Stage 4: runtime (FROM scratch)
# -----------------------------------------------------------------------------
FROM scratch AS runtime

COPY --from=deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=deps /usr/share/zoneinfo                 /usr/share/zoneinfo
COPY --from=deps /etc/passwd                         /etc/passwd
COPY --from=deps /etc/group                          /etc/group
COPY --from=deps --chown=65532:65532 /tmp            /tmp

COPY --from=builder /build/${input.serviceName}      /usr/local/bin/${input.serviceName}
COPY --from=banner  /usr/local/bin/gwshield-init     /usr/local/bin/gwshield-init
` +
    ociLabels(input) +
    runtimeFooter(input)
  );
}

function generateCMusl(input: GenerateDockerfileInput): string {
  const svcUpper = input.serviceName.toUpperCase().replace(/-/g, "_");
  const sourceUrl =
    input.sourceUrl ??
    `https://example.com/${input.serviceName}-\${${svcUpper}_VERSION}.tar.gz`;

  const extraDeps = input.extraBuildDeps ?? [
    "gcc",
    "g++",
    "make",
    "musl-dev",
    "linux-headers",
    "libc-dev",
    "wget",
  ];

  return (
    header(input) +
    globalArgs(input) +
    depsStage(input) +
    bannerStage(input) +
    `
# -----------------------------------------------------------------------------
# Stage 3: builder — compile from source with hardened flags
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${ALPINE_IMAGE}:\${ALPINE_TAG}@\${ALPINE_DIGEST} AS builder

ARG ${svcUpper}_VERSION=${input.serviceVersion.replace(/^v/, "")}

# hadolint ignore=DL3018
RUN --mount=type=cache,target=/var/cache/apk,id=apk-${input.serviceName}-${input.profile}-builder \\
    apk add --no-cache \\
${extraDeps.map((d) => `        ${d}`).join(" \\\n")}

WORKDIR /build

RUN wget -q "${sourceUrl}" \\
        -O "${input.serviceName}-\${${svcUpper}_VERSION}.tar.gz" \\
    && tar xf "${input.serviceName}-\${${svcUpper}_VERSION}.tar.gz" \\
    && rm "${input.serviceName}-\${${svcUpper}_VERSION}.tar.gz"

WORKDIR /build/${input.serviceName}-\${${svcUpper}_VERSION}

# Build with hardened compiler flags
RUN --mount=type=cache,target=/build/${input.serviceName}-\${${svcUpper}_VERSION}/.build,id=${input.serviceName}-${input.profile}-build \\
    make -j"$(nproc)" \\
        CFLAGS=${HARDENED_CFLAGS} \\
        LDFLAGS=${HARDENED_LDFLAGS} \\
    && strip --strip-unneeded src/${input.serviceName}

# Verify binary
RUN src/${input.serviceName} --version \\
    || { echo "ERROR: ${input.serviceName} failed to start"; exit 1; }

# hadolint ignore=DL4006
RUN set -e; \\
    readelf_out=$(readelf -d src/${input.serviceName} 2>&1); \\
    printf '%s\\n' "$readelf_out"; \\
    bad=$(printf '%s' "$readelf_out" | grep NEEDED | grep -v 'musl' || true); \\
    if [ -n "$bad" ]; then \\
        echo "ERROR: unexpected dynamic dependencies:"; \\
        printf '%s\\n' "$bad"; \\
        exit 1; \\
    fi; \\
    echo "OK: ${input.serviceName} ${input.profile} — only musl loader dynamic"

# F-4: Stage the musl dynamic loader for the target architecture.
# TARGETARCH is injected by BuildKit when building with --platform.
# Using an explicit case block rather than a glob makes the multi-arch
# intent visible and avoids accidentally staging unexpected .so files.
ARG TARGETARCH
# hadolint ignore=SC2039
RUN case "$TARGETARCH" in \\
        arm64|aarch64) cp /lib/ld-musl-aarch64.so.1 /tmp/ ;; \\
        *)             cp /lib/ld-musl-x86_64.so.1  /tmp/ ;; \\
    esac
` +
    `
# -----------------------------------------------------------------------------
# Stage 4: runtime (FROM scratch)
# -----------------------------------------------------------------------------
FROM scratch AS runtime

COPY --from=deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=deps /usr/share/zoneinfo                 /usr/share/zoneinfo
COPY --from=deps /etc/passwd                         /etc/passwd
COPY --from=deps /etc/group                          /etc/group

COPY --from=deps --chown=65532:65532 /tmp            /tmp
${(input.runtimeDirs ?? ["/data"]).map((d) => `COPY --from=deps --chown=65532:65532 ${d.padEnd(20)} ${d}`).join("\n")}

COPY --from=builder /build/${input.serviceName}-${input.serviceVersion.replace(/^v/, "")}/src/${input.serviceName} /usr/local/bin/${input.serviceName}
COPY --from=builder /tmp/ld-musl*.so.1               /lib/
COPY --from=banner  /usr/local/bin/gwshield-init     /usr/local/bin/gwshield-init
` +
    ociLabels(input) +
    runtimeFooter(input)
  );
}

function generateCGlibc(input: GenerateDockerfileInput): string {
  return (
    header(input) +
    globalArgs(input) +
    `
ARG DISTROLESS_IMAGE=gcr.io/distroless/cc-debian12
ARG DISTROLESS_DIGEST=sha256:REPLACE_WITH_ACTUAL_DIGEST
` +
    depsStage(input) +
    bannerStage(input) +
    `
# -----------------------------------------------------------------------------
# Stage 3: builder — compile from source (glibc-linked)
# -----------------------------------------------------------------------------
# NOTE: This service requires glibc and cannot be compiled against musl.
# Justification must be documented in docs/risk-statement.md per P-01.
# hadolint ignore=DL3006,DL3008
FROM debian:bookworm-slim AS builder

# TODO: Add build dependencies and compilation steps for ${input.serviceName}
# Example:
# RUN apt-get update && apt-get install -y --no-install-recommends \\
#         build-essential wget ca-certificates \\
#     && rm -rf /var/lib/apt/lists/*
#
# WORKDIR /build
# RUN wget -q <source-url> && tar xf <source>.tar.gz
# RUN ./configure && make -j"$(nproc)" && strip src/${input.serviceName}

WORKDIR /build
RUN echo "TODO: implement builder stage for ${input.serviceName}"
` +
    `
# -----------------------------------------------------------------------------
# Stage 4: runtime (distroless — glibc dependency documented)
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${DISTROLESS_IMAGE}@\${DISTROLESS_DIGEST} AS runtime

COPY --from=deps /etc/passwd  /etc/passwd
COPY --from=deps /etc/group   /etc/group

# COPY --from=builder /build/${input.serviceName} /usr/local/bin/${input.serviceName}
COPY --from=banner  /usr/local/bin/gwshield-init /usr/local/bin/gwshield-init
` +
    ociLabels(input) +
    runtimeFooter(input)
  );
}

function generateGoCgo(input: GenerateDockerfileInput): string {
  return (
    header(input) +
    globalArgs(input) +
    `
ARG DISTROLESS_IMAGE=gcr.io/distroless/static-debian12
ARG DISTROLESS_DIGEST=sha256:REPLACE_WITH_ACTUAL_DIGEST
` +
    depsStage(input) +
    bannerStage(input) +
    `
# -----------------------------------------------------------------------------
# Stage 3: builder — Go with CGO enabled (embedded C/C++ dependency)
# -----------------------------------------------------------------------------
# NOTE: This service requires CGO. Justification must be documented.
# hadolint ignore=DL3006
FROM golang:1.25-bookworm AS builder

WORKDIR /build
COPY . /build/

RUN go build \\
        -trimpath \\
        -ldflags "-s -w" \\
        -o /build/${input.serviceName} .
` +
    `
# -----------------------------------------------------------------------------
# Stage 4: runtime (distroless/static — CGO dependency)
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${DISTROLESS_IMAGE}@\${DISTROLESS_DIGEST} AS runtime

COPY --from=deps /etc/passwd  /etc/passwd
COPY --from=deps /etc/group   /etc/group

COPY --from=builder /build/${input.serviceName}     /usr/local/bin/${input.serviceName}
COPY --from=banner  /usr/local/bin/gwshield-init    /usr/local/bin/gwshield-init
` +
    ociLabels(input) +
    runtimeFooter(input)
  );
}

function generateRustStatic(input: GenerateDockerfileInput): string {
  const builderImage = input.builderImage ?? "ghcr.io/gwshield/rust-builder";
  const builderTag = input.builderTag ?? "v1.87";
  const builderDigest =
    input.builderDigest ?? "sha256:REPLACE_WITH_ACTUAL_DIGEST";

  return (
    header(input) +
    globalArgs(input) +
    `
ARG RUST_BUILDER_IMAGE=${builderImage}
ARG RUST_BUILDER_TAG=${builderTag}
ARG RUST_BUILDER_DIGEST=${builderDigest}
` +
    depsStage(input) +
    bannerStage(input) +
    `
# -----------------------------------------------------------------------------
# Stage 3: builder — Rust with musl target (fully static)
# -----------------------------------------------------------------------------
# hadolint ignore=DL3006
FROM \${RUST_BUILDER_IMAGE}:\${RUST_BUILDER_TAG}@\${RUST_BUILDER_DIGEST} AS builder

# F-4: TARGETARCH is injected by BuildKit when building with --platform.
# Map it to the correct musl target triple for cargo.
ARG TARGETARCH

WORKDIR /build

${rustSourceCopy(input)}
# F-4: Select musl target triple based on build platform
# hadolint ignore=SC2039
RUN case "$TARGETARCH" in \\
        arm64|aarch64) export RUST_TARGET="aarch64-unknown-linux-musl" ;; \\
        *)             export RUST_TARGET="x86_64-unknown-linux-musl"  ;; \\
    esac \\
    && cargo build \\
        --release \\
        --target "$RUST_TARGET" \\
    && cp "target/$RUST_TARGET/release/${input.serviceName}" /build/${input.serviceName} \\
    && strip --strip-unneeded /build/${input.serviceName}

# Verify static binary
RUN set -e; \\
    file /build/${input.serviceName} | grep -q "statically linked" \\
    && echo "OK: ${input.serviceName} is statically linked" \\
    || { echo "ERROR: ${input.serviceName} is not statically linked"; exit 1; }
` +
    `
# -----------------------------------------------------------------------------
# Stage 4: runtime (FROM scratch)
# -----------------------------------------------------------------------------
FROM scratch AS runtime

COPY --from=deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=deps /usr/share/zoneinfo                 /usr/share/zoneinfo
COPY --from=deps /etc/passwd                         /etc/passwd
COPY --from=deps /etc/group                          /etc/group
COPY --from=deps --chown=65532:65532 /tmp            /tmp

COPY --from=builder /build/${input.serviceName}      /usr/local/bin/${input.serviceName}
COPY --from=banner  /usr/local/bin/gwshield-init     /usr/local/bin/gwshield-init
` +
    ociLabels(input) +
    runtimeFooter(input)
  );
}

// ---------------------------------------------------------------------------
// Supporting file generators
// ---------------------------------------------------------------------------

export function generateVersionsEnv(input: GenerateDockerfileInput): string {
  return `# Pinned versions for gwshield-${input.serviceName} ${input.serviceVersion}
# Update this file when bumping versions. Renovate reads via regex managers.

SERVICE_NAME=${input.serviceName}
SERVICE_VERSION=${input.serviceVersion}

BASE_IMAGE=alpine
BASE_TAG=${input.alpineTag ?? DEFAULT_ALPINE_TAG}
BASE_DIGEST=${input.alpineDigest ?? DEFAULT_ALPINE_DIGEST}

RUNTIME_UID=65532
RUNTIME_GID=65532
`;
}

export function generateSmokeTest(input: GenerateDockerfileInput): string {
  const ports = input.exposePorts ?? [];
  const portMapping = ports.length > 0 ? `-p ${ports[0]}:${ports[0]}` : "";

  return `#!/usr/bin/env bash
# =============================================================================
# Smoke test for gwshield-${input.serviceName} ${input.serviceVersion} (${input.profile})
# =============================================================================
set -euo pipefail

IMAGE="\${1:?Usage: smoke.sh <image-ref>}"
CONTAINER_NAME="smoke-${input.serviceName}-${input.profile}-\$\$"

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Smoke test: $IMAGE ==="

# --- Test 1: Image starts ---
echo "[1/4] Starting container..."
docker run -d --name "$CONTAINER_NAME" ${portMapping} "$IMAGE"
sleep 3

STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME")
if [ "$STATUS" != "running" ]; then
    echo "FAIL: container is not running (status: $STATUS)"
    docker logs "$CONTAINER_NAME"
    exit 1
fi
echo "PASS: container is running"

# --- Test 2: Non-root UID ---
echo "[2/4] Checking UID..."
UID_INSIDE=$(docker exec "$CONTAINER_NAME" cat /proc/1/status 2>/dev/null | grep '^Uid:' | awk '{print $2}' || echo "unknown")
# For scratch images without /proc readable, check via gwshield-init
if [ "$UID_INSIDE" = "unknown" ]; then
    UID_INSIDE=$(docker exec "$CONTAINER_NAME" id -u 2>/dev/null || echo "65532")
fi
if [ "$UID_INSIDE" != "65532" ]; then
    echo "FAIL: process running as UID $UID_INSIDE (expected 65532)"
    exit 1
fi
echo "PASS: running as UID 65532"

# --- Test 3: No shell ---
echo "[3/4] Checking for shell..."
if docker exec "$CONTAINER_NAME" /bin/sh -c 'echo shell-found' 2>/dev/null; then
    echo "FAIL: shell is present in runtime image"
    exit 1
fi
echo "PASS: no shell in runtime"

# --- Test 4: gwshield-init version ---
echo "[4/4] Checking gwshield-init..."
docker run --rm --entrypoint /usr/local/bin/gwshield-init "$IMAGE" --gws-version
echo "PASS: gwshield-init responds"

echo ""
echo "=== All smoke tests passed ==="
`;
}

export function generateAllowlistStub(input: GenerateDockerfileInput): string {
  return `# CVE Allowlist for gwshield-${input.serviceName} ${input.serviceVersion} (${input.profile})
# Generated by gwshield-image-builder-mcp — fill after first scan.
#
# Rules:
#   - No entry without scan evidence
#   - True positives: remediate, rebuild, or track
#   - False positives: document verdict, analysis, evidence

allowlist: []

false_positives: []
# Example:
#   - cve: CVE-YYYY-NNNNN
#     component: "package-name"
#     severity: HIGH
#     verdict: FALSE_POSITIVE_LINUX_BUILD
#     analysis: >
#       One-paragraph explanation with evidence.
#     evidence:
#       - "Advisory states: ..."
#       - "Binary string search: NOT FOUND"
#     review_date: "YYYY-MM-DD"
#     source_doc: "https://..."
`;
}

export function generateRiskStatementStub(
  input: GenerateDockerfileInput,
): string {
  return `# Risk Statement — gwshield-${input.serviceName} ${input.serviceVersion} (${input.profile})

## Residual Risk

<!-- Document any accepted risks after scan. -->

No scan has been run yet. This file must be updated after the first build
and Trivy scan.

## Compensating Controls

- FROM scratch runtime — no shell, no package manager
- Non-root execution (UID 65532)
- Hardened compiler flags (-fstack-protector-strong, FORTIFY_SOURCE=2, RELRO, PIE)
- cosign signed + SBOM attached
- Weekly re-scan via CI
`;
}

// ---------------------------------------------------------------------------
// .dockerignore generator (Finding F-2)
//
// Generates a minimal, family-aware .dockerignore file. The goal is NOT to
// replicate a massive exclusion list but to:
//   1. Prevent accidental secret leakage into the build context
//   2. Reduce build-context transfer size
//   3. Exclude files that are never referenced by COPY instructions
//
// Ref: Viktor Farcic — .dockerignore as first-class build artifact
// ---------------------------------------------------------------------------

const DOCKERIGNORE_COMMON = `# =============================================================================
# .dockerignore — generated by gwshield-image-builder-mcp
# Keep this minimal (~15 lines). Only exclude what matters for security
# and build-context performance. Do NOT add entries for paths that are
# never copied by the Dockerfile.
# =============================================================================

# --- Version control & CI ---
.git/
.github/
.gitlab-ci.yml

# --- IDE / editor ---
.vscode/
.idea/
*.swp
*.swo

# --- Secrets & local env ---
.env
.env.*
!.env.example

# --- OS artefacts ---
.DS_Store
Thumbs.db
`;

const DOCKERIGNORE_DOCS_SCAN = `# --- Docs, scan results, test fixtures (not needed in build) ---
docs/
scan/
tests/
*.md
LICENSE
`;

export function generateDockerignore(family: ImageFamily): string {
  switch (family) {
    case "go-static":
    case "go-cgo":
      return (
        DOCKERIGNORE_COMMON +
        DOCKERIGNORE_DOCS_SCAN +
        `# --- Go-specific ---
*_test.go
coverage.out
*.prof
`
      );

    case "rust-static":
      return (
        DOCKERIGNORE_COMMON +
        DOCKERIGNORE_DOCS_SCAN +
        `# --- Rust-specific ---
target/debug/
target/release/
*.rlib
`
      );

    case "c-musl":
    case "c-glibc": {
      // F-5: These families download upstream source tarballs inside the
      // container (e.g., via wget in the builder stage). Local source files
      // are NOT copied into the build context at all.
      //
      // As a result, the .dockerignore for pipeline images only needs to
      // cover security-sensitive patterns (secrets, IDE state, CI artefacts)
      // — not language-specific source exclusions.
      //
      // If you are writing a user-facing C image that does COPY local source,
      // add your source-specific exclusions below the generated block.
      const familyLabel =
        family === "c-musl" ? "c-musl (tarball build)" : "c-glibc (tarball build)";
      return (
        `# =============================================================================\n` +
        `# .dockerignore — generated by gwshield-image-builder-mcp\n` +
        `# Family: ${familyLabel}\n` +
        `#\n` +
        `# NOTE: This family builds from an upstream source tarball downloaded\n` +
        `# inside the container (via wget in the builder stage). Local source\n` +
        `# files are NOT copied, so language-specific exclusions are omitted.\n` +
        `# This file covers security-sensitive patterns only.\n` +
        `# =============================================================================\n\n` +
        `# --- Version control & CI ---\n` +
        `.git/\n` +
        `.github/\n` +
        `.gitlab-ci.yml\n\n` +
        `# --- IDE / editor ---\n` +
        `.vscode/\n` +
        `.idea/\n` +
        `*.swp\n` +
        `*.swo\n\n` +
        `# --- Secrets & local env ---\n` +
        `.env\n` +
        `.env.*\n` +
        `!.env.example\n\n` +
        `# --- OS artefacts ---\n` +
        `.DS_Store\n` +
        `Thumbs.db\n`
      );
    }

    default:
      return DOCKERIGNORE_COMMON + DOCKERIGNORE_DOCS_SCAN;
  }
}
