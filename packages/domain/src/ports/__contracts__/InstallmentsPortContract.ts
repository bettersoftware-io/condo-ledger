import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { type Cents, cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";

import type {
  InstallmentsDraft,
  InstallmentsPort,
} from "../installmentsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface InstallmentsPortHarness {
  port: InstallmentsPort;
  /** A period with a schedule: the paid and the unpaid installment are its. */
  periodId: string;
  unknownPeriodId: string;
  /** A period with a budget allocation entry and no installments. */
  emptyPeriodId: string;
  /** A batch emptyPeriodId accepts, its due dates in order. */
  draft: InstallmentsDraft;
  /** By resident: what the domain plans on each installment of draft, in draft's order. */
  plannedAmounts: Map<string, Cents[]>;
  /** A batch emptyPeriodId refuses, and why. */
  refusedDraft: InstallmentsDraft;
  refusedReason: string;
  /** An unlocked installment with an item, paidItemId, that a collection of the period pays. */
  paidInstallmentId: string;
  paidItemId: string;
  /** An unlocked installment nothing has paid, due after the paid one, and one of its items. */
  unpaidInstallmentId: string;
  unpaidItemId: string;
  teardown: () => void;
}

export function describeInstallmentsPortContract(
  label: string,
  createHarness: () => InstallmentsPortHarness,
): void {
  describe(`${label} :: InstallmentsPort contract`, () => {
    it("answers a period's installments, all of that period, in number order", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const installments = await firstValueFrom(port.installments(periodId));

        expect(installments.length).toBeGreaterThan(0);
        expect(
          installments.every((installment) => {
            return installment.periodId === periodId;
          }),
        ).toBe(true);
        expectRanked(installments);
      } finally {
        teardown();
      }
    });

    it("answers the items of the period's installments, and of no other", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const ids = idsOf(await firstValueFrom(port.installments(periodId)));
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

    it("creates a batch on a period with no schedule: the installments numbered by due date, and the items the domain plans", async () => {
      const { port, emptyPeriodId, draft, plannedAmounts, teardown } =
        createHarness();

      try {
        expect(await firstValueFrom(port.installments(emptyPeriodId))).toEqual(
          [],
        );
        expect(await port.createInstallments(emptyPeriodId, draft)).toEqual({
          ok: true,
        });

        const installments = await firstValueFrom(
          port.installments(emptyPeriodId),
        );
        const items = await firstValueFrom(port.items(emptyPeriodId));

        expect(installments).toEqual(
          draft.installments.map((planned, index) => {
            return {
              id: expect.any(String),
              periodId: emptyPeriodId,
              number: index + 1,
              name: planned.name,
              dueDate: planned.dueDate,
              locked: false,
            };
          }),
        );
        expect(amountsByResident(installments, items)).toEqual(plannedAmounts);
      } finally {
        teardown();
      }
    });

    it("refuses a batch with the domain's reason and leaves the schedule as it was", async () => {
      const { port, emptyPeriodId, refusedDraft, refusedReason, teardown } =
        createHarness();

      try {
        expect(
          await port.createInstallments(emptyPeriodId, refusedDraft),
        ).toEqual({ ok: false, reason: refusedReason });
        expect(await firstValueFrom(port.installments(emptyPeriodId))).toEqual(
          [],
        );
        expect(await firstValueFrom(port.items(emptyPeriodId))).toEqual([]);
      } finally {
        teardown();
      }
    });

    it("rejects a batch for a period it does not have", async () => {
      const { port, unknownPeriodId, draft, teardown } = createHarness();

      try {
        await expect(
          port.createInstallments(unknownPeriodId, draft),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("renames an installment and moves its due date, and numbers the period again by due date", async () => {
      const {
        port,
        periodId,
        paidInstallmentId,
        unpaidInstallmentId,
        teardown,
      } = createHarness();

      try {
        const before = await firstValueFrom(port.installments(periodId));
        const paid = installmentOf(before, paidInstallmentId);
        const earlier = `${Number(paid.dueDate.slice(0, 4)) - 1}-01-01`;

        expect(installmentOf(before, unpaidInstallmentId).number).toBe(
          paid.number + 1,
        );
        expect(
          await port.updateInstallment(unpaidInstallmentId, {
            name: "Renamed",
            dueDate: earlier,
          }),
        ).toEqual({ ok: true });

        const after = await firstValueFrom(port.installments(periodId));

        expect(installmentOf(after, unpaidInstallmentId)).toMatchObject({
          name: "Renamed",
          dueDate: earlier,
          number: 1,
        });
        expect(installmentOf(after, paidInstallmentId).number).toBe(
          paid.number + 1,
        );
        expectRanked(after);
      } finally {
        teardown();
      }
    });

    it("locks an installment, then refuses to rename it with installment-locked, and unlocks it", async () => {
      const { port, periodId, unpaidInstallmentId, teardown } = createHarness();

      try {
        expect(
          await port.updateInstallment(unpaidInstallmentId, { locked: true }),
        ).toEqual({ ok: true });

        const locked = await firstValueFrom(port.installments(periodId));

        expect(installmentOf(locked, unpaidInstallmentId).locked).toBe(true);
        expect(
          await port.updateInstallment(unpaidInstallmentId, { name: "Other" }),
        ).toEqual({ ok: false, reason: "installment-locked" });
        expect(await firstValueFrom(port.installments(periodId))).toEqual(
          locked,
        );
        expect(
          await port.updateInstallment(unpaidInstallmentId, { locked: false }),
        ).toEqual({ ok: true });
        expect(
          installmentOf(
            await firstValueFrom(port.installments(periodId)),
            unpaidInstallmentId,
          ).locked,
        ).toBe(false);
      } finally {
        teardown();
      }
    });

    it("deletes an installment nothing has paid, with its items, and numbers the rest again", async () => {
      const { port, periodId, unpaidInstallmentId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.installments(periodId));

        expect(await port.deleteInstallment(unpaidInstallmentId)).toEqual({
          ok: true,
        });

        const after = await firstValueFrom(port.installments(periodId));

        expect(after).toHaveLength(before.length - 1);
        expect(idsOf(after).has(unpaidInstallmentId)).toBe(false);
        expect(
          (await firstValueFrom(port.items(periodId))).some((item) => {
            return item.installmentId === unpaidInstallmentId;
          }),
        ).toBe(false);
        expectRanked(after);
      } finally {
        teardown();
      }
    });

    it("refuses to delete an installment a collection has paid, with installment-paid, and leaves the schedule as it was", async () => {
      const { port, periodId, paidInstallmentId, teardown } = createHarness();

      try {
        const installments = await firstValueFrom(port.installments(periodId));
        const items = await firstValueFrom(port.items(periodId));

        expect(await port.deleteInstallment(paidInstallmentId)).toEqual({
          ok: false,
          reason: "installment-paid",
        });
        expect(await firstValueFrom(port.installments(periodId))).toEqual(
          installments,
        );
        expect(await firstValueFrom(port.items(periodId))).toEqual(items);
      } finally {
        teardown();
      }
    });

    it("sets the amount of an item nothing has paid", async () => {
      const { port, periodId, unpaidItemId, teardown } = createHarness();

      try {
        expect(await port.setItemAmount(unpaidItemId, cents(12345))).toEqual({
          ok: true,
        });
        expect(
          itemOf(await firstValueFrom(port.items(periodId)), unpaidItemId)
            .amount,
        ).toBe(12345);
      } finally {
        teardown();
      }
    });

    it("refuses to set a paid item's amount with item-paid, and leaves the items as they were", async () => {
      const { port, periodId, paidItemId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.items(periodId));

        expect(await port.setItemAmount(paidItemId, cents(1))).toEqual({
          ok: false,
          reason: "item-paid",
        });
        expect(await firstValueFrom(port.items(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("every subscriber hears an accepted write", async () => {
      const { port, periodId, unpaidInstallmentId, unpaidItemId, teardown } =
        createHarness();
      const installmentsSeen: Installment[][] = [];
      const itemsSeen: InstallmentItem[][] = [];
      const installments = port
        .installments(periodId)
        .subscribe((installments) => {
          installmentsSeen.push(installments);
        });

      const items = port.items(periodId).subscribe((items) => {
        itemsSeen.push(items);
      });

      try {
        await port.updateInstallment(unpaidInstallmentId, { name: "Heard" });
        await port.setItemAmount(unpaidItemId, cents(777));

        expect(installmentsSeen.length).toBeGreaterThan(1);
        expect(
          installmentOf(installmentsSeen.at(-1) ?? [], unpaidInstallmentId)
            .name,
        ).toBe("Heard");
        expect(itemsSeen.length).toBeGreaterThan(1);
        expect(itemOf(itemsSeen.at(-1) ?? [], unpaidItemId).amount).toBe(777);
      } finally {
        installments.unsubscribe();
        items.unsubscribe();
        teardown();
      }
    });

    it("rejects a write naming an installment or an item it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(
          port.updateInstallment("nope", { name: "X" }),
        ).rejects.toThrow("nope");
        await expect(port.deleteInstallment("nope")).rejects.toThrow("nope");
        await expect(port.setItemAmount("nope", cents(1))).rejects.toThrow(
          "nope",
        );
      } finally {
        teardown();
      }
    });
  });
}

/** By resident: the items' amounts, in the order of their installments' numbers. */
function amountsByResident(
  installments: Installment[],
  items: InstallmentItem[],
): Map<string, Cents[]> {
  const byResident = new Map<string, Cents[]>();

  for (const installment of [...installments].sort((a, b) => {
    return a.number - b.number;
  })) {
    for (const item of items) {
      if (item.installmentId === installment.id) {
        byResident.set(item.residentId, [
          ...(byResident.get(item.residentId) ?? []),
          item.amount,
        ]);
      }
    }
  }

  return byResident;
}

/** Listed in number order, 1…n, each number the installment's rank by due date, then by id. */
function expectRanked(installments: Installment[]): void {
  expect(numbersOf(installments)).toEqual(
    installments.map((_, index) => {
      return index + 1;
    }),
  );
  expect(numbersOf(installments)).toEqual(ranks(installments));
}

/** 1…n by due date, then by id: what each installment's number must be. */
function ranks(installments: Installment[]): number[] {
  const ranked = [...installments].sort((a, b) => {
    return (
      a.dueDate.localeCompare(b.dueDate) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  });

  return installments.map((installment) => {
    return ranked.indexOf(installment) + 1;
  });
}

function numbersOf(installments: Installment[]): number[] {
  return installments.map((installment) => {
    return installment.number;
  });
}

function idsOf(installments: Installment[]): Set<string> {
  return new Set(
    installments.map((installment) => {
      return installment.id;
    }),
  );
}

function installmentOf(installments: Installment[], id: string): Installment {
  const found = installments.find((installment) => {
    return installment.id === id;
  });

  if (found === undefined) {
    throw new Error(`missing: the installment ${id} in the port's answer`);
  }

  return found;
}

function itemOf(items: InstallmentItem[], id: string): InstallmentItem {
  const found = items.find((item) => {
    return item.id === id;
  });

  if (found === undefined) {
    throw new Error(`missing: the item ${id} in the port's answer`);
  }

  return found;
}
