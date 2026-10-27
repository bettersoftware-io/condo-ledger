import { describe, expect, it } from "vitest";

import {
  createAllocationTableRow,
  mountAllocationTablesGrid,
} from "./AllocationTablesGrid.page.tsx";

describe("AllocationTablesGrid", () => {
  it("heads its columns as the design does", () => {
    const page = mountAllocationTablesGrid([createAllocationTableRow("el1")]);

    expect(page.headers()).toEqual([
      "%",
      "Table",
      "PR/NP/LE",
      "US/CF",
      "CO",
      "SC",
      "Table restr. on group",
    ]);
  });

  it("draws each link: its share, its table, each role's percentage, a dash for a blank and -None- for the group", () => {
    const page = mountAllocationTablesGrid([
      createAllocationTableRow("el1", { table: "Generale" }),
      createAllocationTableRow("el2", {
        table: "Riscaldamento",
        percentage: 3000,
        roles: { 1: 5000, 2: 1250, 3: 5000, 4: null },
      }),
    ]);

    expect(page.rows()).toEqual([
      ["-", "Generale", "100%", "-", "-", "-", "-None-"],
      ["30%", "Riscaldamento", "50%", "12.5%", "50%", "-", "-None-"],
    ]);
  });

  it("writes a fractional percentage in the locale", () => {
    const page = mountAllocationTablesGrid(
      [createAllocationTableRow("el1", { percentage: 3333 })],
      "it-IT",
    );

    expect(page.rows()[0]?.[0]).toBe("33,33%");
  });
});
