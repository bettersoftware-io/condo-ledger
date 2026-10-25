import { describe, expect, it, vi } from "vitest";

import type { Installment } from "@cl/domain";

import { mountScheduleToolbar } from "./ScheduleToolbar.page.tsx";

describe("ScheduleToolbar", () => {
  it("groups by unit, as static text, then the design's tools", () => {
    const page = mountScheduleToolbar({});

    expect(page.groupByText()).toBe("Group rows by: By unit");
    expect(page.toolLabels()).toEqual([
      "Add installments",
      "Edit installments",
      "Delete installments",
      "Expand all",
      "Collapse all",
      "Print schedule",
      "Export to PDF",
      "Export to Excel",
      "Refresh",
    ]);
  });

  it("the Add menu lists the three ways to add, and closes on a choice", async () => {
    const page = mountScheduleToolbar({});

    expect(page.toolMenu("Add installments")).toBe("menu closed");

    await page.clickTool("Add installments");

    expect(page.toolMenu("Add installments")).toBe("menu open");
    expect(page.menuItems()).toEqual([
      "＋Create advance installment",
      "≣Create budget installments",
      "±Create adjustment installment",
    ]);

    await page.clickMenuItem("Create budget installments");

    expect(page.menuItems()).toEqual([]);
  });

  it("Create budget installments opens its wizard; advance and adjustment are not built yet", async () => {
    const onCreateBudget = vi.fn();
    const onStub = vi.fn();
    const page = mountScheduleToolbar({ onCreateBudget, onStub });

    await page.clickTool("Add installments");
    await page.clickMenuItem("Create budget installments");
    await page.clickTool("Add installments");
    await page.clickMenuItem("Create advance installment");
    await page.clickTool("Add installments");
    await page.clickMenuItem("Create adjustment installment");

    expect(onCreateBudget).toHaveBeenCalledOnce();
    expect(onStub.mock.calls).toEqual([
      ["Create advance installment"],
      ["Create adjustment installment"],
    ]);
  });

  it("the Edit menu has one item per installment, and hands its id over", async () => {
    const onEdit = vi.fn();
    const page = mountScheduleToolbar({
      installments: [
        createInstallment("in1", "First", true),
        createInstallment("in2", "Second", false),
      ],
      onEdit,
    });

    await page.clickTool("Edit installments");

    expect(page.menuItems()).toEqual(['Edit "First"', 'Edit "Second"']);

    await page.clickMenuItem('Edit "First"');

    expect(onEdit).toHaveBeenCalledExactlyOnceWith("in1");
    expect(page.menuItems()).toEqual([]);
  });

  it("the Delete menu lists only the unlocked installments, and hands the one chosen over", async () => {
    const onDelete = vi.fn();
    const second = createInstallment("in2", "Second", false);
    const page = mountScheduleToolbar({
      installments: [createInstallment("in1", "First", true), second],
      onDelete,
    });

    await page.clickTool("Delete installments");

    expect(page.menuItems()).toEqual(['Delete "Second"']);

    await page.clickMenuItem('Delete "Second"');

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(second);
  });

  it("says so when there is nothing to edit or delete", async () => {
    const page = mountScheduleToolbar({
      installments: [createInstallment("in1", "First", true)],
    });

    await page.clickTool("Delete installments");

    expect(page.menuItems()).toEqual([]);
    expect(page.menuEmptyText()).toBe("No installments to delete.");

    const empty = mountScheduleToolbar({});

    await empty.clickTool("Edit installments");

    expect(empty.menuEmptyText()).toBe("No installments to edit.");
  });

  it("an open menu closes on Escape, choosing nothing", async () => {
    const onEdit = vi.fn();
    const page = mountScheduleToolbar({
      installments: [createInstallment("in1", "First", false)],
      onEdit,
    });

    await page.clickTool("Edit installments");
    await page.pressEscape();

    expect(page.toolMenu("Edit installments")).toBe("menu closed");
    expect(page.menuItems()).toEqual([]);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("expands and collapses all", async () => {
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    const page = mountScheduleToolbar({ onExpandAll, onCollapseAll });

    await page.clickTool("Collapse all");
    await page.clickTool("Expand all");

    expect(onCollapseAll).toHaveBeenCalledOnce();
    expect(onExpandAll).toHaveBeenCalledOnce();
  });

  it("print, export and refresh are not built yet", async () => {
    const onStub = vi.fn();
    const page = mountScheduleToolbar({ onStub });

    await page.clickTool("Print schedule");
    await page.clickTool("Export to PDF");
    await page.clickTool("Export to Excel");
    await page.clickTool("Refresh");

    expect(onStub.mock.calls).toEqual([
      ["Print schedule"],
      ["Export to PDF"],
      ["Export to Excel"],
      ["Refresh"],
    ]);
  });
});

function createInstallment(
  id: string,
  name: string,
  locked: boolean,
): Installment {
  return {
    id,
    periodId: "p1",
    number: Number(id.slice(2)),
    name,
    dueDate: "2013-01-20",
    locked,
  };
}
