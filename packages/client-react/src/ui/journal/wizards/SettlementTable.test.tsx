import { describe, expect, it } from "vitest";

import type { SettlementRow } from "@cl/client-core";
import { cents } from "@cl/domain";

import { mountSettlementTable } from "./SettlementTable.page.tsx";

describe("SettlementTable", () => {
  it("draws the design's columns and one row per item paid, amounts en-US", () => {
    const page = mountSettlementTable({
      rows: [
        createRow("ii1", "Rata 9", "A01", "2013-09-20", 113498, 113498),
        createRow("ii2", "Rata 10", "A01", "2013-10-20", 13498, 6502),
      ],
    });

    expect(page.columns()).toEqual([
      "Installment",
      "Unit",
      "Due",
      "Owed",
      "Paid now",
    ]);
    expect(page.rows()).toEqual([
      ["Rata 9", "A01", "20/09/2013", "1,134.98", "1,134.98"],
      ["Rata 10", "A01", "20/10/2013", "134.98", "65.02"],
    ]);
  });

  it("marks partial the last row only when it is", () => {
    const partial = mountSettlementTable({
      rows: [
        createRow("ii1", "Rata 9", "A01", "2013-09-20", 13498, 13498),
        createRow("ii2", "Rata 10", "A01", "2013-10-20", 13498, 6502),
      ],
    });

    expect(partial.partialRows()).toEqual([1]);

    const exact = mountSettlementTable({
      rows: [
        createRow("ii3", "Rata 9", "A02", "2013-09-20", 13498, 13498),
        createRow("ii4", "Rata 10", "A02", "2013-10-20", 13498, 13498),
      ],
    });

    expect(exact.partialRows()).toEqual([]);
  });

  it("marks every row the settlement pays in part: a hand split has two", () => {
    const page = mountSettlementTable({
      rows: [
        createRow("ii5", "Rata nr. 1", "A4", "2011-03-15", 96114, 92684),
        createRow("ii10", "Rata nr. 1", "B4", "2011-03-15", 7402, 7316),
      ],
    });

    expect(page.partialRows()).toEqual([0, 1]);
  });

  it("with nothing paid, has its columns and no row", () => {
    const page = mountSettlementTable({ rows: [] });

    expect(page.columns()).toHaveLength(5);
    expect(page.rows()).toEqual([]);
  });
});

function createRow(
  itemId: string,
  installment: string,
  unitCode: string,
  dueDate: string,
  owed: number,
  paidNow: number,
): SettlementRow {
  return {
    itemId,
    installment,
    unitCode,
    dueDate,
    owed: cents(owed),
    paidNow: cents(paidNow),
    partial: paidNow < owed,
  };
}
