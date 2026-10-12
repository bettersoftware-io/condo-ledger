import { describe, expect, it } from "vitest";

import type { Building } from "@cl/domain";

import { periodLabel } from "./labels.tsx";

describe("periodLabel", () => {
  it.each([
    ["ordinary", "2013 (Ordinary)"],
    ["extra", "2013 (Extraordinary)"],
    ["auxiliary", "2013 (Auxiliary)"],
  ] as const)("names a %s period", (type, label) => {
    expect(periodLabel(createPeriod(type))).toBe(label);
  });
});

function createPeriod(
  type: Building["periods"][number]["type"],
): Building["periods"][number] {
  return {
    id: "p1",
    name: "2013",
    type,
    start: "2013-01-01",
    end: "2013-12-31",
    closed: false,
  };
}
