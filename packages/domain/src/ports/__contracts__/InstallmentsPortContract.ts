import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { InstallmentsPort } from "../installmentsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface InstallmentsPortHarness {
  port: InstallmentsPort;
  /** A period with a schedule. */
  periodId: string;
  unknownPeriodId: string;
  teardown: () => void;
}

export function describeInstallmentsPortContract(
  label: string,
  createHarness: () => InstallmentsPortHarness,
): void {
  describe(`${label} :: InstallmentsPort contract`, () => {
    it("answers a period's installments, all of that period", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const installments = await firstValueFrom(port.installments(periodId));

        expect(installments.length).toBeGreaterThan(0);
        expect(
          installments.every((installment) => {
            return installment.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers the items of the period's installments, and of no other", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const ids = new Set(
          (await firstValueFrom(port.installments(periodId))).map(
            (installment) => {
              return installment.id;
            },
          ),
        );
        const items = await firstValueFrom(port.items(periodId));

        expect(items.length).toBeGreaterThan(0);
        expect(
          items.every((item) => {
            return ids.has(item.installmentId);
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.installments(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
        await expect(
          firstValueFrom(port.items(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
      } finally {
        teardown();
      }
    });
  });
}
