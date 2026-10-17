import { describe, expect, it } from "vitest";

import type { ClockPort } from "../clockPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface ClockPortHarness {
  port: ClockPort;
  teardown: () => void;
}

export function describeClockPortContract(
  label: string,
  createHarness: () => ClockPortHarness,
): void {
  describe(`${label} :: ClockPort contract`, () => {
    it("answers a valid moment", () => {
      const { port, teardown } = createHarness();

      try {
        expect(Number.isNaN(port.now().getTime())).toBe(false);
      } finally {
        teardown();
      }
    });

    it("never answers an earlier moment than it did before", () => {
      const { port, teardown } = createHarness();

      try {
        const first = port.now().getTime();
        const second = port.now().getTime();

        expect(second).toBeGreaterThanOrEqual(first);
      } finally {
        teardown();
      }
    });
  });
}
