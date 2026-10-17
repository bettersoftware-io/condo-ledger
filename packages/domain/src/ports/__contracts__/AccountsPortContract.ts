import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Account } from "#/entities/account.ts";
import { cents } from "#/entities/cents.ts";

import type { AccountsPort } from "../accountsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface AccountsPortHarness {
  port: AccountsPort;
  periodId: string;
  unknownPeriodId: string;
  /** A regular account of nature expenses: the one kind a budget may be set on. */
  costLeafId: string;
  groupingId: string;
  teardown: () => void;
}

export function describeAccountsPortContract(
  label: string,
  createHarness: () => AccountsPortHarness,
): void {
  describe(`${label} :: AccountsPort contract`, () => {
    it("answers a period's accounts, all of that period, at once", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const accounts = await firstValueFrom(port.accounts(periodId));

        expect(accounts.length).toBeGreaterThan(0);
        expect(
          accounts.every((account) => {
            return account.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's parties", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        expect(
          Array.isArray(await firstValueFrom(port.parties(periodId))),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's withholding catalogue, every code of that period", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const catalogue = await firstValueFrom(port.withholdingTaxes(periodId));

        expect(catalogue.length).toBeGreaterThan(0);
        expect(
          catalogue.every((tax) => {
            return tax.periodId === periodId;
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
          firstValueFrom(port.accounts(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
        await expect(
          firstValueFrom(port.parties(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
        await expect(
          firstValueFrom(port.withholdingTaxes(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("sets a budget on a cost leaf and tells every subscriber", async () => {
      const { port, periodId, costLeafId, teardown } = createHarness();
      const seen: Account[][] = [];
      const subscription = port.accounts(periodId).subscribe((accounts) => {
        seen.push(accounts);
      });

      try {
        expect(await port.setBudget(costLeafId, cents(123456))).toEqual({
          ok: true,
        });
        expect(
          seen.at(-1)?.find((account) => {
            return account.id === costLeafId;
          })?.budget,
        ).toBe(123456);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a budget on a grouping, with the domain's reason, changing nothing", async () => {
      const { port, periodId, groupingId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.accounts(periodId));

        expect(await port.setBudget(groupingId, cents(1))).toEqual({
          ok: false,
          reason: "not-a-leaf",
        });
        expect(await firstValueFrom(port.accounts(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("fails for an account it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(port.setBudget("nope", cents(1))).rejects.toThrow("nope");
      } finally {
        teardown();
      }
    });
  });
}
