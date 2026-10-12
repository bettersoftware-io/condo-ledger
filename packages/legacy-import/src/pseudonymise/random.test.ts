import { describe, expect, it } from "vitest";

import {
  digits,
  fnv1a,
  intBetween,
  mulberry32,
  pick,
  rngFor,
} from "./random.ts";

describe("fnv1a", () => {
  it("matches the published FNV-1a 32-bit test vectors", () => {
    // Vectors from the FNV reference (isthe.com/chongo/tech/comp/fnv):
    // "" → 0x811c9dc5 (the offset basis), "a" → 0xe40c292c, "foobar" → 0xbf9cf968.
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });
});

describe("mulberry32", () => {
  it("returns the same sequence for the same seed, in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];

    expect(seqA).toEqual(seqB);

    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("returns a different sequence for a different seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("rngFor", () => {
  it("is deterministic per table and id", () => {
    expect(rngFor("person", "3")()).toBe(rngFor("person", "3")());
  });

  it("differs between ids and between tables", () => {
    const first = rngFor("person", "3")();

    expect(rngFor("person", "4")()).not.toBe(first);
    expect(rngFor("company", "3")()).not.toBe(first);
  });
});

describe("pick", () => {
  it("returns an element of the list, deterministically", () => {
    const list = ["a", "b", "c", "d"];

    expect(list).toContain(pick(list, rngFor("t", "1")));
    expect(pick(list, rngFor("t", "1"))).toBe(pick(list, rngFor("t", "1")));
  });

  it("reaches every element over many draws", () => {
    const list = ["a", "b", "c"];
    const rng = mulberry32(7);
    const seen = new Set<string>();

    for (let i = 0; i < 100; i++) {
      seen.add(pick(list, rng));
    }

    expect([...seen].sort()).toEqual(list);
  });

  it("refuses an empty list", () => {
    expect(() => {
      return pick([], mulberry32(1));
    }).toThrow(/empty/);
  });
});

describe("digits", () => {
  it("returns exactly n decimal digits, leading zeros allowed", () => {
    const rng = mulberry32(3);

    for (let i = 0; i < 50; i++) {
      expect(digits(12, rng)).toMatch(/^\d{12}$/);
    }

    expect(digits(0, rng)).toBe("");
  });
});

describe("intBetween", () => {
  it("stays within the inclusive bounds and reaches both ends", () => {
    const rng = mulberry32(11);
    const seen = new Set<number>();

    for (let i = 0; i < 200; i++) {
      const n = intBetween(1, 4, rng);

      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      seen.add(n);
    }

    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});
