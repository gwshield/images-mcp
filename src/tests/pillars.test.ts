/**
 * Unit tests — pillars module
 */

import { describe, it, expect } from "vitest";
import {
  getAllPillars,
  getPillarById,
  getPillarsFor,
} from "../pillars/index.js";

describe("getAllPillars", () => {
  it("returns exactly 15 pillars", () => {
    expect(getAllPillars()).toHaveLength(15);
  });

  it("pillar IDs are P-01 through P-15", () => {
    const ids = getAllPillars().map((p) => p.id);
    for (let i = 1; i <= 15; i++) {
      expect(ids).toContain(`P-${String(i).padStart(2, "0")}`);
    }
  });

  it("every pillar has required fields", () => {
    for (const p of getAllPillars()) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.summary).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.enforcement).toBeTruthy();
      expect(["runtime", "builder", "both"]).toContain(p.appliesTo);
    }
  });
});

describe("getPillarById", () => {
  it("returns the correct pillar for P-01", () => {
    const p = getPillarById("P-01");
    expect(p).toBeDefined();
    expect(p!.name).toBe("FROM scratch/distroless Runtime");
  });

  it("returns undefined for unknown ID", () => {
    expect(getPillarById("P-99")).toBeUndefined();
  });
});

describe("getPillarsFor", () => {
  it("runtime context returns pillars with appliesTo=runtime or both", () => {
    const pillars = getPillarsFor("runtime");
    for (const p of pillars) {
      expect(["runtime", "both"]).toContain(p.appliesTo);
    }
  });

  it("builder context returns pillars with appliesTo=builder or both", () => {
    const pillars = getPillarsFor("builder");
    for (const p of pillars) {
      expect(["builder", "both"]).toContain(p.appliesTo);
    }
  });

  it("both context returns only pillars with appliesTo=both", () => {
    const pillars = getPillarsFor("both");
    for (const p of pillars) {
      expect(p.appliesTo).toBe("both");
    }
  });
});
