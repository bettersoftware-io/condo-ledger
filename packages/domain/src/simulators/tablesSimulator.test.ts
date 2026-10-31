import { BehaviorSubject, firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Unit } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import { createTablesSeed } from "../testing/createTablesSeed.ts";
import { legacySeedData } from "./seed/legacySeed.generated.ts";
import { loadLegacySeed } from "./seed/legacySeed.ts";
import { createTablesSimulator } from "./tablesSimulator.ts";

describe("tables simulator", () => {
  it("gives what it adds ids of its own, never a seeded one", async () => {
    const tables = createTablesSimulator(createTablesSeed());

    await tables.addTable("p1", { name: "A", order: 3, notes: "" });
    await tables.addTable("p1", { name: "B", order: 4, notes: "" });

    expect(
      (await firstValueFrom(tables.tables("p1"))).map((table) => {
        return table.id;
      }),
    ).toEqual(["dt1", "dt2", "dt-new-1", "dt-new-2"]);
  });

  it("puts an edited table in its new place", async () => {
    const tables = createTablesSimulator(createTablesSeed());

    await tables.editTable("dt1", { name: "Property", order: 3, notes: "" });

    expect(
      (await firstValueFrom(tables.tables("p1"))).map((table) => {
        return table.id;
      }),
    ).toEqual(["dt2", "dt1"]);
  });

  it("lets a table go once the account that linked it is gone, as the reader answers", async () => {
    const seed = createTablesSeed();
    let accounts = seed.accounts;
    const tables = createTablesSimulator(seed, () => {
      return accounts;
    });

    expect(await tables.deleteTable("dt1")).toMatchObject({
      reason: "table-linked",
    });
    accounts = accounts.map((account) => {
      return { ...account, links: [] };
    });
    expect(await tables.deleteTable("dt1")).toEqual({ ok: true });
  });

  it("adds a coefficient the table lacks, the units still lacking one reading 0", async () => {
    const seed = createTablesSeed();
    const tables = createTablesSimulator({
      ...seed,
      coefficients: seed.coefficients.filter((coefficient) => {
        return coefficient.tableId !== "dt2";
      }),
    });

    await tables.setCoefficient("dt2", "uA01", 7);

    expect(
      (await firstValueFrom(tables.coefficients("p1"))).filter(
        (coefficient) => {
          return coefficient.tableId === "dt2";
        },
      ),
    ).toEqual([
      { tableId: "dt2", unitId: "uA01", value: 7 },
      { tableId: "dt2", unitId: "uA02", value: 0 },
      { tableId: "dt2", unitId: "uB01", value: 0 },
    ]);
  });

  it("reads the units from the reader: a new one reads 0 in every table and takes a coefficient, one no longer listed loses its own, and the coefficients emit again each time", async () => {
    const seed = createTablesSeed();
    const units$ = new BehaviorSubject<Unit[]>(seed.units);
    const tables = createTablesSimulator(seed, undefined, () => {
      return units$;
    });
    const seen: string[][] = [];
    const subscription = tables.coefficients("p1").subscribe((coefficients) => {
      seen.push(
        coefficients.map((coefficient) => {
          return `${coefficient.tableId} ${coefficient.unitId} ${coefficient.value}`;
        }),
      );
    });
    const first = must(seed.units[0], "the seed's first unit");

    units$.next([...seed.units, { ...first, id: "u-new-1", code: "Z1" }]);
    expect(await tables.setCoefficient("dt2", "u-new-1", 7)).toEqual({
      ok: true,
    });
    units$.next(
      units$.getValue().filter((unit) => {
        return unit.id !== "uA01";
      }),
    );
    subscription.unsubscribe();

    expect(seen.slice(1)).toEqual([
      [
        "dt1 uA01 50000",
        "dt1 uA02 30000",
        "dt1 uB01 20000",
        "dt2 uA01 0",
        "dt2 uA02 60000",
        "dt2 uB01 40000",
        "dt1 u-new-1 0",
        "dt2 u-new-1 0",
      ],
      [
        "dt1 uA01 50000",
        "dt1 uA02 30000",
        "dt1 uB01 20000",
        "dt2 uA01 0",
        "dt2 uA02 60000",
        "dt2 uB01 40000",
        "dt2 u-new-1 7",
        "dt1 u-new-1 0",
      ],
      [
        "dt1 uA02 30000",
        "dt1 uB01 20000",
        "dt2 uA02 60000",
        "dt2 uB01 40000",
        "dt2 u-new-1 7",
        "dt1 u-new-1 0",
      ],
    ]);
    await expect(tables.setCoefficient("dt1", "uA01", 1)).rejects.toThrow(
      "missing: the unit uA01",
    );
  });

  it("over the real seed refuses to delete dt14, and gives a new table 18 zero coefficients in p36", async () => {
    const seed = loadLegacySeed(legacySeedData);
    const tables = createTablesSimulator(seed);

    expect(await tables.deleteTable("dt14")).toMatchObject({
      ok: false,
      reason: "table-linked",
      detail: "la172",
    });

    const added = await tables.addTable("p36", {
      name: "Test",
      order: 99,
      notes: "",
    });
    const id = added.ok ? added.value.id : "";
    const zeros = (await firstValueFrom(tables.coefficients("p36"))).filter(
      (coefficient) => {
        return coefficient.tableId === id;
      },
    );

    expect(zeros).toHaveLength(18);
    expect(
      zeros.every((coefficient) => {
        return coefficient.value === 0;
      }),
    ).toBe(true);
  });
});
