import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { JournalPort } from "../journalPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface JournalPortHarness {
  port: JournalPort;
  periodId: string;
  unknownPeriodId: string;
  teardown: () => void;
}

export function describeJournalPortContract(
  label: string,
  createHarness: () => JournalPortHarness,
): void {
  describe(`${label} :: JournalPort contract`, () => {
    it("answers a period's entries, all of that period, in number order", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const entries = await firstValueFrom(port.entries(periodId));
        const numbers = entries.map((entry) => {
          return entry.number;
        });

        expect(entries.length).toBeGreaterThan(0);
        expect(
          entries.every((entry) => {
            return entry.periodId === periodId;
          }),
        ).toBe(true);
        expect(numbers).toEqual(
          [...numbers].sort((a, b) => {
            return a - b;
          }),
        );
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.entries(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });
  });
}
