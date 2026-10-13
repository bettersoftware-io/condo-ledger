import { describe, expect, it } from "vitest";

import {
  createNavigationMachine,
  reduceNavigation,
} from "./navigationMachine.ts";

describe("reduceNavigation", () => {
  it("replaces the module", () => {
    expect(
      reduceNavigation(start, { type: "selectModule", module: "contacts" }),
    ).toEqual({
      module: "contacts",
      menu: "accounts",
    });
  });

  it("replaces the menu", () => {
    expect(
      reduceNavigation(start, { type: "selectMenu", menu: "journal" }),
    ).toEqual({
      module: "buildings",
      menu: "journal",
    });
  });

  const start = { module: "buildings", menu: "accounts" } as const;
});

describe("the navigation machine", () => {
  it("starts in the buildings' accounts and follows its intents", () => {
    const machine = createNavigationMachine();

    expect(machine.state$.getValue()).toEqual({
      module: "buildings",
      menu: "accounts",
    });

    machine.intents.selectMenu("units");
    machine.intents.selectModule("calendar");

    expect(machine.state$.getValue()).toEqual({
      module: "calendar",
      menu: "units",
    });

    machine.dispose();
  });
});
