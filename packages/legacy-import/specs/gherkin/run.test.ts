import { beforeEach, describe, expect, it } from "vitest";

import { defineStep, resetSteps, runStep } from "./run.ts";

describe("step registry", () => {
  beforeEach(() => {
    return resetSteps();
  });

  it("matches a step by regex and passes captured args + world", async () => {
    const calls: string[] = [];
    defineStep(/^I add (\d+) and (\d+)$/, (world, a, b) => {
      (world as SumWorld).sum = Number(a) + Number(b);
      calls.push(`${a}+${b}`);
    });
    const world: Record<string, unknown> = {};
    await runStep(world, { text: "I add 2 and 40" });
    expect(world.sum).toBe(42);
    expect(calls).toEqual(["2+40"]);
  });

  it("throws on an undefined step", async () => {
    await expect(runStep({}, { text: "nothing matches this" })).rejects.toThrow(
      /Undefined step/,
    );
  });
});

interface SumWorld {
  sum?: number;
}
