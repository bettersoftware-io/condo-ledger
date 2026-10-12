import { describe, expect, it } from "vitest";

import { listFor, must } from "./must.ts";

describe("must", () => {
  it("returns a present value", () => {
    expect(must(3, "the count")).toBe(3);
  });

  it("throws naming what was missing, for undefined and for null", () => {
    expect(() => {
      return must(undefined, "the account la1");
    }).toThrow("missing: the account la1");
    expect(() => {
      return must(null, "the period");
    }).toThrow("missing: the period");
  });
});

describe("listFor", () => {
  it("returns the list under a key, creating it when absent", () => {
    const map = new Map<string, number[]>();

    listFor(map, "a").push(1);
    listFor(map, "a").push(2);

    expect(map.get("a")).toEqual([1, 2]);
  });
});
