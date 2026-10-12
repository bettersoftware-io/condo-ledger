import { describe, expect, it } from "vitest";

import { createBottomTabMachine, reduceBottomTab } from "./bottomTabMachine.ts";

describe("reduceBottomTab", () => {
  it("activates a known tab", () => {
    expect(reduce({ active: "a" }, { type: "activate", tab: "b" })).toEqual({
      active: "b",
    });
  });

  it("ignores an unknown tab", () => {
    expect(reduce({ active: "a" }, { type: "activate", tab: "z" })).toEqual({
      active: "a",
    });
  });

  const reduce = reduceBottomTab(["a", "b"]);
});

describe("the bottom tab machine", () => {
  it("starts on the first tab and follows activate", () => {
    const machine = createBottomTabMachine(["entries", "details"]);

    expect(machine.state$.getValue()).toEqual({ active: "entries" });

    machine.intents.activate("details");

    expect(machine.state$.getValue()).toEqual({ active: "details" });

    machine.intents.activate("nope");

    expect(machine.state$.getValue()).toEqual({ active: "details" });

    machine.dispose();
  });

  it("refuses an empty list of tabs", () => {
    expect(() => {
      return createBottomTabMachine([]);
    }).toThrow("a tabbed panel needs at least one tab");
  });
});
