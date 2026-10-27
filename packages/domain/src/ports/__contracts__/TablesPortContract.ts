import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { TableDraft } from "#/useCases/validateTable.ts";

import type { TablesPort } from "../tablesPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface TablesPortHarness {
  port: TablesPort;
  /** A period with tables, a linked one and an unlinked one, and units. */
  periodId: string;
  unknownPeriodId: string;
  /** A table an account of the period links to. */
  linkedTableId: string;
  /** The account that links it. */
  linkingAccountId: string;
  /** A table nothing links to, with a coefficient for unitId. */
  unlinkedTableId: string;
  unitId: string;
  /** Every unit of the period. */
  unitIds: string[];
  teardown: () => void;
}

export function describeTablesPortContract(
  label: string,
  createHarness: () => TablesPortHarness,
): void {
  describe(`${label} :: TablesPort contract`, () => {
    it("answers a period's tables, all of that period, in order", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const tables = await firstValueFrom(port.tables(periodId));

        expect(tables.length).toBeGreaterThan(1);
        expect(
          tables.every((table) => {
            return table.periodId === periodId;
          }),
        ).toBe(true);
        expect(
          tables.map((table) => {
            return table.order;
          }),
        ).toEqual(
          tables
            .map((table) => {
              return table.order;
            })
            .sort((a, b) => {
              return a - b;
            }),
        );
      } finally {
        teardown();
      }
    });

    it("answers the coefficients of the period's tables, and of no other", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const ids = new Set(
          (await firstValueFrom(port.tables(periodId))).map((table) => {
            return table.id;
          }),
        );
        const coefficients = await firstValueFrom(port.coefficients(periodId));

        expect(coefficients.length).toBeGreaterThan(0);
        expect(
          coefficients.every((coefficient) => {
            return ids.has(coefficient.tableId);
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
          firstValueFrom(port.tables(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
        await expect(
          firstValueFrom(port.coefficients(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
        await expect(
          port.addTable(unknownPeriodId, createDraft("Any")),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
      } finally {
        teardown();
      }
    });

    it("adds a table with a 0 coefficient for every unit, and emits again", async () => {
      const { port, periodId, unitIds, teardown } = createHarness();

      try {
        const added = await port.addTable(periodId, createDraft("Test"));

        expect(added.ok).toBe(true);

        const id = added.ok ? added.value.id : "";
        const tables = await firstValueFrom(port.tables(periodId));
        const coefficients = (
          await firstValueFrom(port.coefficients(periodId))
        ).filter((coefficient) => {
          return coefficient.tableId === id;
        });

        expect(
          tables.find((table) => {
            return table.id === id;
          }),
        ).toMatchObject({ periodId, name: "Test", order: 9, notes: "n" });
        expect(
          coefficients
            .map((coefficient) => {
              return coefficient.unitId;
            })
            .sort(),
        ).toEqual([...unitIds].sort());
        expect(
          coefficients.every((coefficient) => {
            return coefficient.value === 0;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("refuses a blank name and a name another table has", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const taken = (await firstValueFrom(port.tables(periodId)))[0]?.name;

        expect(await port.addTable(periodId, createDraft("  "))).toEqual({
          ok: false,
          reason: "blank-name",
        });
        expect(await port.addTable(periodId, createDraft(taken ?? ""))).toEqual(
          { ok: false, reason: "name-taken" },
        );
      } finally {
        teardown();
      }
    });

    it("edits a table, and refuses what validateTable refuses", async () => {
      const { port, periodId, unlinkedTableId, teardown } = createHarness();

      try {
        expect(
          await port.editTable(unlinkedTableId, createDraft("Renamed")),
        ).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.tables(periodId))).find((table) => {
            return table.id === unlinkedTableId;
          }),
        ).toMatchObject({ name: "Renamed", order: 9, notes: "n" });
        expect(await port.editTable(unlinkedTableId, createDraft(""))).toEqual({
          ok: false,
          reason: "blank-name",
        });
      } finally {
        teardown();
      }
    });

    it("deletes an unlinked table with its coefficients", async () => {
      const { port, periodId, unlinkedTableId, teardown } = createHarness();

      try {
        expect(await port.deleteTable(unlinkedTableId)).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.tables(periodId))).some((table) => {
            return table.id === unlinkedTableId;
          }),
        ).toBe(false);
        expect(
          (await firstValueFrom(port.coefficients(periodId))).some(
            (coefficient) => {
              return coefficient.tableId === unlinkedTableId;
            },
          ),
        ).toBe(false);
      } finally {
        teardown();
      }
    });

    it("refuses to delete a linked table, naming the account that links it", async () => {
      const { port, periodId, linkedTableId, linkingAccountId, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.tables(periodId));

        expect(await port.deleteTable(linkedTableId)).toEqual({
          ok: false,
          reason: "table-linked",
          detail: linkingAccountId,
        });
        expect(await firstValueFrom(port.tables(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("sets a coefficient, and emits again", async () => {
      const { port, periodId, unlinkedTableId, unitId, teardown } =
        createHarness();

      try {
        expect(
          await port.setCoefficient(unlinkedTableId, unitId, 123456),
        ).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.coefficients(periodId))).find(
            (coefficient) => {
              return (
                coefficient.tableId === unlinkedTableId &&
                coefficient.unitId === unitId
              );
            },
          ),
        ).toEqual({ tableId: unlinkedTableId, unitId, value: 123456 });
      } finally {
        teardown();
      }
    });

    it("refuses a coefficient that is negative or not whole, and keeps the old one", async () => {
      const { port, periodId, unlinkedTableId, unitId, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.coefficients(periodId));

        expect(await port.setCoefficient(unlinkedTableId, unitId, -1)).toEqual({
          ok: false,
          reason: "not-a-coefficient",
        });
        expect(await port.setCoefficient(unlinkedTableId, unitId, 1.5)).toEqual(
          { ok: false, reason: "not-a-coefficient" },
        );
        expect(await firstValueFrom(port.coefficients(periodId))).toEqual(
          before,
        );
      } finally {
        teardown();
      }
    });

    it("rejects, naming the id, for a table or a unit it does not have", async () => {
      const { port, unlinkedTableId, unitId, teardown } = createHarness();

      try {
        await expect(
          port.editTable("dt-none", createDraft("Any")),
        ).rejects.toThrow("missing: the table dt-none");
        await expect(port.deleteTable("dt-none")).rejects.toThrow(
          "missing: the table dt-none",
        );
        await expect(port.setCoefficient("dt-none", unitId, 1)).rejects.toThrow(
          "missing: the table dt-none",
        );
        await expect(
          port.setCoefficient(unlinkedTableId, "u-none", 1),
        ).rejects.toThrow("missing: the unit u-none");
      } finally {
        teardown();
      }
    });
  });
}

function createDraft(name: string): TableDraft {
  return { name, order: 9, notes: "n" };
}
