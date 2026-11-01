import { describe, expect, it } from "vitest";

import type { Contact, ContactCategory } from "#/entities/contact.ts";

import {
  validateCategory,
  validateCategoryDelete,
} from "./validateCategory.ts";

describe("validateCategory", () => {
  it("accepts a new name", () => {
    expect(validateCategory("Gardener", categories, null)).toEqual({
      ok: true,
    });
  });

  it("refuses a blank name", () => {
    expect(validateCategory("  ", categories, null)).toEqual({
      ok: false,
      reason: "blank-name",
    });
  });

  it("allows 63 characters and refuses 64", () => {
    expect(validateCategory("a".repeat(63), categories, null)).toEqual({
      ok: true,
    });
    expect(validateCategory("a".repeat(64), categories, null)).toEqual({
      ok: false,
      reason: "name-too-long",
    });
  });

  it("refuses the name of another category, by case, and allows its own", () => {
    expect(validateCategory(" plumber ", categories, "mc1")).toEqual({
      ok: false,
      reason: "category-name-taken",
      detail: "plumber",
    });
    expect(validateCategory("PLUMBER", categories, "mc2")).toEqual({
      ok: true,
    });
  });
});

describe("validateCategoryDelete", () => {
  it("refuses a category with contacts, the count as detail", () => {
    const contacts = [
      { categoryId: "mc1" },
      { categoryId: "mc1" },
      { categoryId: "mc2" },
    ] as Contact[];

    expect(validateCategoryDelete(electrician, contacts)).toEqual({
      ok: false,
      reason: "category-not-empty",
      detail: "2",
    });
  });

  it("passes an empty category", () => {
    expect(validateCategoryDelete(electrician, [])).toEqual({ ok: true });
  });
});

const electrician: ContactCategory = { id: "mc1", name: "Electrician" };
const categories: ContactCategory[] = [
  electrician,
  { id: "mc2", name: "Plumber" },
];
