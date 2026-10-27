import { describe, expect, it, vi } from "vitest";

import {
  createTableView,
  mountThousandthTablesPanel,
} from "./ThousandthTablesPanel.page.tsx";

describe("ThousandthTablesPanel", () => {
  it("draws a table's name, its restriction, a blank counter and its total", () => {
    const page = mountThousandthTablesPanel({
      tables: [
        createTableView("dt1", { total: 10000000 }),
        createTableView("dt3", { restriction: "Scala A", total: 220 }),
        createTableView("dt5"),
      ],
    });

    expect(page.title()).toBe("Thousandth Tables");
    expect(page.grid.rowTexts("Table dt1")).toEqual([
      "Table dt1",
      "",
      "",
      "1,000.0000",
    ]);
    expect(page.grid.rowTexts("Table dt3")).toEqual([
      "Table dt3",
      "Scala A",
      "",
      "0.0220",
    ]);
    expect(page.grid.rowTexts("Table dt5")[3]).toBe("0.0000");
  });

  it("marks the selected table, and a click selects another", async () => {
    const onSelect = vi.fn();
    const page = mountThousandthTablesPanel({
      tables: [createTableView("dt1"), createTableView("dt2")],
      selectedTableId: "dt2",
      onSelect,
    });

    expect(page.grid.selectedLabels()).toEqual(["Table dt2"]);

    await page.grid.clickRow("Table dt1");

    expect(onSelect).toHaveBeenCalledWith("dt1");
  });

  it("offers the design's tools, each one not built yet posting its notice", async () => {
    const onStub = vi.fn();
    const page = mountThousandthTablesPanel({ onStub });

    expect(page.toolLabels()).toEqual([
      "New Thousandth Table",
      "Edit Thousandth Table",
      "Delete Thousandth Table",
      "Print",
      "Export to PDF",
      "Export to Excel",
    ]);

    for (const label of page.toolLabels()) {
      await page.clickTool(label);
    }

    await page.clickLegend();

    expect(onStub.mock.calls).toEqual([
      ["New Thousandth Table"],
      ["Edit Thousandth Table"],
      ["Delete Thousandth Table"],
      ["Print"],
      ["Export to PDF"],
      ["Export to Excel"],
      ["Legend"],
    ]);
  });
});
