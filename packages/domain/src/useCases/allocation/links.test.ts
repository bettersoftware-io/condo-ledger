import { describe, expect, it } from "vitest";

import { createAccount, createLink } from "#/testing/createAllocationInput.ts";

import { appliedLinksOf } from "./links.ts";

describe("appliedLinksOf", () => {
  it("answers an account's own links, not inherited", () => {
    const own = createLink("el1", "la1", "dt1", "both");
    const accounts = [createAccount("la1", null, "grouping", null, [own])];

    expect(appliedLinksOf(accounts, "la1")).toEqual({
      links: [own],
      inherited: false,
    });
  });

  it("answers the nearest ancestor's links for an account with none, inherited", () => {
    const near = createLink("el2", "la2", "dt2", "budget");
    const far = createLink("el1", "la1", "dt1", "both");
    const accounts = [
      createAccount("la1", null, "grouping", null, [far]),
      createAccount("la2", "la1", "grouping", null, [near]),
      createAccount("la3", "la2", "regular", null, []),
    ];

    expect(appliedLinksOf(accounts, "la3")).toEqual({
      links: [near],
      inherited: true,
    });
  });

  it("answers none when no account up the chain has links, or the account is unknown", () => {
    const accounts = [
      createAccount("la1", null, "grouping", null, []),
      createAccount("la2", "la1", "regular", null, []),
    ];

    expect(appliedLinksOf(accounts, "la2")).toEqual({
      links: [],
      inherited: false,
    });
    expect(appliedLinksOf(accounts, "la9")).toEqual({
      links: [],
      inherited: false,
    });
  });
});
