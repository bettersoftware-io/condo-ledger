import { describe, expect, it } from "vitest";

import { clampPage, PAGE_SIZES, pageCountOf, pageOfIndex } from "./paging.ts";

describe("paging", () => {
  it("offers 10, 25, 50 and 100 to the page", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
  });

  it("counts the pages, never fewer than one", () => {
    expect(pageCountOf(0, 10)).toBe(1);
    expect(pageCountOf(10, 10)).toBe(1);
    expect(pageCountOf(11, 10)).toBe(2);
    expect(pageCountOf(113, 10)).toBe(12);
    expect(pageCountOf(113, 25)).toBe(5);
  });

  it("places an index on its page, from 1", () => {
    expect(pageOfIndex(0, 10)).toBe(1);
    expect(pageOfIndex(9, 10)).toBe(1);
    expect(pageOfIndex(10, 10)).toBe(2);
    expect(pageOfIndex(112, 25)).toBe(5);
  });

  it("clamps a page into 1 to the count", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(-4, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(9, 3)).toBe(3);
  });
});
