import { describe, expect, it, vi } from "vitest";

import { cents } from "@cl/domain";

import {
  createAllocationGridRows,
  createAllocationRow,
  mountAllocationPanel,
} from "./AllocationPanel.page.tsx";

describe("AllocationPanel", () => {
  it("heads the fixed columns, one per account, then the totals", () => {
    const page = mountAllocationPanel({ columns: ["General", "Water"] });

    expect(page.title()).toBe("Allocation");
    expect(page.grid.headers()).toEqual([
      "Groups / Units / Owners",
      "Role",
      "Restr. period",
      "Days",
      "General",
      "Water",
      "Total",
      "Prev. bal.",
      "Total due",
      "Paid",
    ]);
  });

  it("draws a resident's role, dates, days and amounts, a negative one as such", () => {
    const page = mountAllocationPanel({
      columns: ["General", "Water"],
      rows: createAllocationGridRows([
        createAllocationRow("r1", {
          role: "PR",
          restriction: "01/05/2011 - 31/05/2011",
          days: "31/365",
          amounts: [cents(28000), cents(-1)],
          total: cents(27999),
          previousBalance: cents(3000),
          due: cents(30999),
          paid: cents(0),
        }),
      ]),
    });

    expect(page.grid.rowTexts("r1")).toEqual([
      "r1",
      "PR",
      "01/05/2011 - 31/05/2011",
      "31/365",
      "280.00",
      "-0.01",
      "279.99",
      "30.00",
      "309.99",
      "0.00",
    ]);
    expect(page.grid.isAggregate("r1")).toBe(false);
  });

  it("draws the root and a unit with residents bold, and Roundings aside with no balances", () => {
    const page = mountAllocationPanel({
      columns: ["General", "Water"],
      rows: createAllocationGridRows([
        createAllocationRow("root", {
          kind: "root",
          children: [
            createAllocationRow("A2", {
              kind: "unit",
              children: [createAllocationRow("r2"), createAllocationRow("r3")],
            }),
            createAllocationRow("Roundings", {
              kind: "roundings",
              previousBalance: null,
              due: null,
              paid: null,
            }),
          ],
        }),
      ]),
    });

    expect(page.grid.isAggregate("root")).toBe(true);
    expect(page.grid.isAggregate("A2")).toBe(true);
    expect(page.grid.isAside("Roundings")).toBe(true);
    expect(page.grid.isAside("r2")).toBe(false);
    expect(page.grid.rowTexts("Roundings").slice(-3)).toEqual(["", "", ""]);
  });

  it("rows do not select", async () => {
    const page = mountAllocationPanel({
      rows: createAllocationGridRows([createAllocationRow("r1")]),
    });

    await page.grid.clickRow("r1");

    expect(page.grid.selectedLabels()).toEqual([]);
  });

  it("names the mode on its button, and its menu chooses the other", async () => {
    const onChooseMode = vi.fn();
    const page = mountAllocationPanel({ mode: "finalBalance", onChooseMode });

    expect(page.modeText()).toBe("Final balance ▾");

    await page.clickMode();
    await page.chooseMenuItem("Budget allocation");

    expect(onChooseMode).toHaveBeenCalledWith("budget");
    expect(page.menuItems()).toEqual([]);

    await page.clickMode();
    await page.chooseMenuItem("Final-balance allocation");

    expect(onChooseMode).toHaveBeenLastCalledWith("finalBalance");
  });

  it("Escape closes the mode menu, choosing nothing", async () => {
    const onChooseMode = vi.fn();
    const page = mountAllocationPanel({ onChooseMode });

    await page.clickMode();
    await page.closeMenu();

    expect(page.menuItems()).toEqual([]);
    expect(onChooseMode).not.toHaveBeenCalled();
  });

  it("draws the grouping and Include installments disabled, and the rest of its tools", async () => {
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    const onStub = vi.fn();
    const page = mountAllocationPanel({ onExpandAll, onCollapseAll, onStub });

    expect(page.disabledControls()).toEqual([
      "Group rows by",
      "Group cols by",
      "Include installments",
    ]);

    for (const label of [
      "Refresh",
      "Expand all",
      "Collapse all",
      "Print",
      "Export to PDF",
      "Export to Excel",
    ]) {
      await page.clickTool(label);
    }

    expect(onExpandAll).toHaveBeenCalledOnce();
    expect(onCollapseAll).toHaveBeenCalledOnce();
    expect(onStub.mock.calls).toEqual([
      ["Refresh"],
      ["Print"],
      ["Export to PDF"],
      ["Export to Excel"],
    ]);
  });

  it("maximizes through its header", async () => {
    const onToggleMaximize = vi.fn();
    const page = mountAllocationPanel({ maximized: true, onToggleMaximize });

    expect(page.maximizeLabel()).toBe("Restore");

    await page.clickMaximize();

    expect(onToggleMaximize).toHaveBeenCalledOnce();
  });
});
