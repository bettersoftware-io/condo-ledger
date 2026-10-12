import { describe, expect, it } from "vitest";

import { createSidebarMachine, reduceSidebar } from "./sidebarMachine.ts";

describe("reduceSidebar", () => {
  it("clamps the width below", () => {
    expect(reduceSidebar(start, { type: "resize", px: 100 })).toEqual({
      width: 180,
      open: false,
    });
  });

  it("clamps the width above", () => {
    expect(reduceSidebar(start, { type: "resize", px: 900 })).toEqual({
      width: 440,
      open: false,
    });
  });

  it("keeps a width inside", () => {
    expect(reduceSidebar(start, { type: "resize", px: 300 })).toEqual({
      width: 300,
      open: false,
    });
  });

  it("opens and closes without touching the width", () => {
    expect(reduceSidebar(start, { type: "open" })).toEqual({
      width: 272,
      open: true,
    });
    expect(
      reduceSidebar({ width: 272, open: true }, { type: "close" }),
    ).toEqual({ width: 272, open: false });
  });

  const start = { width: 272, open: false };
});

describe("the sidebar machine", () => {
  it("starts closed at 272 and follows its intents", () => {
    const machine = createSidebarMachine();

    expect(machine.state$.getValue()).toEqual({ width: 272, open: false });

    machine.intents.open();
    machine.intents.resize(320);

    expect(machine.state$.getValue()).toEqual({ width: 320, open: true });

    machine.intents.close();

    expect(machine.state$.getValue()).toEqual({ width: 320, open: false });

    machine.dispose();
  });
});
