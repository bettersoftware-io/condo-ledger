import { describe, expect, it } from "vitest";

import { createMaximizeMachine, reduceMaximize } from "./maximizeMachine.ts";

describe("reduceMaximize", () => {
  it("maximizes a panel", () => {
    expect(
      reduceMaximize({ maximized: null }, { type: "toggle", panel: "top" }),
    ).toEqual({ maximized: "top" });
  });

  it("restores when the maximized panel is toggled again", () => {
    expect(
      reduceMaximize({ maximized: "top" }, { type: "toggle", panel: "top" }),
    ).toEqual({ maximized: null });
  });

  it("switches to the other panel", () => {
    expect(
      reduceMaximize({ maximized: "top" }, { type: "toggle", panel: "bottom" }),
    ).toEqual({ maximized: "bottom" });
  });

  it("restores on request", () => {
    expect(
      reduceMaximize({ maximized: "bottom" }, { type: "restore" }),
    ).toEqual({ maximized: null });
  });
});

describe("the maximize machine", () => {
  it("starts restored, toggles and restores", () => {
    const machine = createMaximizeMachine();

    expect(machine.state$.getValue()).toEqual({ maximized: null });

    machine.intents.toggle("bottom");

    expect(machine.state$.getValue()).toEqual({ maximized: "bottom" });

    machine.intents.restore();

    expect(machine.state$.getValue()).toEqual({ maximized: null });

    machine.dispose();
  });
});
