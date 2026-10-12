import { describe, expect, it } from "vitest";

import { createSplitMachine, reduceSplit } from "./splitMachine.ts";

describe("reduceSplit", () => {
  it("clamps below a fifth", () => {
    expect(
      reduceSplit({ ratio: 0.5 }, { type: "setRatio", ratio: 0.1 }),
    ).toEqual({ ratio: 0.2 });
  });

  it("clamps above four fifths", () => {
    expect(
      reduceSplit({ ratio: 0.5 }, { type: "setRatio", ratio: 0.95 }),
    ).toEqual({ ratio: 0.8 });
  });

  it("keeps a value inside", () => {
    expect(
      reduceSplit({ ratio: 0.5 }, { type: "setRatio", ratio: 0.35 }),
    ).toEqual({ ratio: 0.35 });
  });
});

describe("the split machine", () => {
  it("starts at half and follows setRatio", () => {
    const machine = createSplitMachine();

    expect(machine.state$.getValue()).toEqual({ ratio: 0.5 });

    machine.intents.setRatio(0.3);

    expect(machine.state$.getValue()).toEqual({ ratio: 0.3 });

    machine.dispose();
  });

  it("ignores intents after it is disposed", () => {
    const machine = createSplitMachine();
    const seen: number[] = [];

    machine.state$.subscribe((current) => {
      return seen.push(current.ratio);
    });
    machine.intents.setRatio(0.3);
    machine.dispose();
    machine.intents.setRatio(0.7);

    expect(seen).toEqual([0.5, 0.3]);
  });
});
