import { describe, expect, it } from "vitest";

import { listFor, must } from "./must.ts";

describe("must", () => {
  it("returns a present value", () => {
    expect(must(1)).toBe(1);
  });

  it("throws on undefined", () => {
    expect(() => {
      must(undefined);
    }).toThrow();
  });
});

describe("listFor", () => {
  it("creates and stores a missing list", () => {
    const map = new Map<string, number[]>();
    const list = listFor(map, "a");

    expect(list).toEqual([]);
    expect(map.get("a")).toBe(list);
  });

  it("returns the existing list so callers append to it", () => {
    const map = new Map<string, number[]>([["a", [1]]]);

    listFor(map, "a").push(2);

    expect(map.get("a")).toEqual([1, 2]);
  });
});
