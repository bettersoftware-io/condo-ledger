import { describe, expect, it, vi } from "vitest";

import type { ScheduleGridRow } from "@cl/client-core";
import {
  cents,
  type Installment,
  type Restriction,
  type Result,
  type ScheduleCell,
  type ScheduleNode,
} from "@cl/domain";

import { holdVerdicts, mountScheduleGrid } from "./ScheduleGrid.page.tsx";

describe("ScheduleGrid", () => {
  it("heads the README's columns, an installment's on two lines with 🔒 when locked", () => {
    const page = mountScheduleGrid({ installments: createInstallments() });

    expect(page.headers()).toEqual([
      "Groups / Units / Owners",
      "Role",
      "Restr. period",
      "Days",
      "Prev. bal.",
      "Total budget",
      "Total due",
      "1 20/01/2013",
      "2 🔒 20/02/2013",
      "Total inst.",
      "Paid",
      "Inst. bal.",
      "Overdue",
    ]);
  });

  it("explains Total due in its header's tooltip", () => {
    const page = mountScheduleGrid({ installments: createInstallments() });

    expect(page.headerTitle("Total due")).toBe(
      "Previous balance + budget share",
    );
    expect(page.headerTitle("Paid")).toBeNull();
  });

  it("draws a resident's row: role, restriction, days, the amounts and one cell per installment", () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [
        createRow(
          createResident("r1", {
            restriction: { from: "2013-02-01", to: "2013-06-30" },
            days: "150/365",
          }),
        ),
      ],
    });

    expect(page.rowTexts("Resident r1")).toEqual([
      "Resident r1",
      "PR",
      "01/02/2013 - 30/06/2013",
      "150/365",
      "-10.00",
      "1,200.00",
      "1,190.00",
      "100.00",
      "",
      "100.00",
      "40.00",
      "60.00",
      "60.00",
    ]);
  });

  it("writes an open restriction against the financial year's start or end, and none as blank", () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [
        createRow(
          createResident("r1", {
            restriction: { from: "2013-01-19", to: null },
          }),
        ),
        createRow(
          createResident("r2", {
            restriction: { from: null, to: "2013-01-18" },
          }),
        ),
        createRow(
          createResident("r3", { restriction: { from: null, to: null } }),
        ),
        createRow(createResident("r4", { restriction: null })),
      ],
    });

    expect(page.rowTexts("Resident r1")[2]).toBe("19/01/2013 - end of FY");
    expect(page.rowTexts("Resident r2")[2]).toBe("start of FY - 18/01/2013");
    expect(page.rowTexts("Resident r3")[2]).toBe("");
    expect(page.rowTexts("Resident r4")[2]).toBe("");
  });

  it("Roundings shows only its Total budget and Total due", () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createRoundings())],
    });

    expect(page.rowTexts("Roundings")).toEqual([
      "Roundings",
      "",
      "",
      "",
      "",
      "-0.54",
      "-0.54",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("the root and a unit are aggregates, bold on the zebra; their cells are bold and not editable", () => {
    const resident = createResident("r1");
    const unit = createNode("unit:A04", "unit", "A04", [resident]);
    const root = createNode("root", "root", "Building 2013", [unit]);
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [
        createRow(root, 0, true),
        createRow(unit, 1, true),
        createRow(resident, 2),
      ],
    });

    expect(page.isAggregate("Building 2013")).toBe(true);
    expect(page.isAggregate("A04")).toBe(true);
    expect(page.isAggregate("Resident r1")).toBe(false);
    expect(page.cell("A04", "1 20/01/2013").isBold()).toBe(true);
    expect(page.cell("A04", "1 20/01/2013").isEditable()).toBe(false);
    expect(page.cell("A04", "1 20/01/2013").title()).toBeNull();
    expect(page.childrenOf("Building 2013")).toEqual(["A04"]);
    expect(page.childrenOf("A04")).toEqual(["Resident r1"]);
  });

  it("a cell the domain refuses offers no editor, and its tooltip gives the reason", () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [
        createRow(
          createResident("r1", { editable: createRefusal("item-paid") }),
        ),
      ],
    });
    const cell = page.cell("Resident r1", "1 20/01/2013");

    expect(cell.isEditable()).toBe(false);
    expect(cell.title()).toBe(
      "A collection has paid this amount: delete that collection first.",
    );
  });

  it("an edit commits the amount typed for the cell's item, and closes on the verdict", async () => {
    const onSetItemAmount = vi.fn(createAccepted);
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1"))],
      onSetItemAmount,
    });
    const cell = page.cell("Resident r1", "1 20/01/2013");

    await cell.click();

    expect(cell.isEditorNamed("Installment 1 of Resident r1")).toBe(true);

    await cell.type("1,234.50");
    await cell.pressEnter();

    expect(onSetItemAmount).toHaveBeenCalledExactlyOnceWith(
      "ii-r1-1",
      cents(123450),
    );
    expect(cell.isEditing()).toBe(false);
  });

  it("a refused amount keeps the editor open with the reason", async () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1"))],
      onSetItemAmount: vi.fn(async (): Promise<Result> => {
        return { ok: false, reason: "negative-amount" };
      }),
    });
    const cell = page.cell("Resident r1", "1 20/01/2013");

    await cell.click();
    await cell.type("-5");
    await cell.pressEnter();

    expect(cell.isEditing()).toBe(true);
    expect(cell.errorText()).toBe("An amount cannot be negative.");
  });

  it("text that is not an amount is refused before anything is written", async () => {
    const onSetItemAmount = vi.fn(createAccepted);
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1"))],
      onSetItemAmount,
    });
    const cell = page.cell("Resident r1", "1 20/01/2013");

    await cell.click();
    await cell.type("ten");
    await cell.pressEnter();

    expect(onSetItemAmount).not.toHaveBeenCalled();
    expect(cell.errorText()).toBe("Enter an amount");
  });

  it("leaving the text as it was writes nothing and closes; Escape cancels", async () => {
    const onSetItemAmount = vi.fn(createAccepted);
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1"))],
      onSetItemAmount,
    });
    const cell = page.cell("Resident r1", "1 20/01/2013");

    await cell.click();
    await cell.pressEnter();

    expect(cell.isEditing()).toBe(false);

    await cell.click();
    await cell.type("5");
    await cell.pressEscape();

    expect(cell.isEditing()).toBe(false);
    expect(onSetItemAmount).not.toHaveBeenCalled();
  });

  it("a verdict that arrives after another cell's editor opened leaves that editor open", async () => {
    const held = holdVerdicts();
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1")), createRow(createResident("r2"))],
      onSetItemAmount: held.save,
    });
    const first = page.cell("Resident r1", "1 20/01/2013");
    const second = page.cell("Resident r2", "1 20/01/2013");

    await first.click();
    await first.type("7");
    await first.pressEnter();
    await second.click();
    await held.release({ ok: true });

    expect(second.isEditing()).toBe(true);
  });

  it("a row is selected by a click", async () => {
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(createResident("r1")), createRow(createResident("r2"))],
    });

    await page.clickRow("Resident r2");

    expect(page.isSelected("Resident r2")).toBe(true);
    expect(page.isSelected("Resident r1")).toBe(false);
  });

  it("toggles a node through its caret", async () => {
    const onToggle = vi.fn();
    const unit = createNode("unit:A04", "unit", "A04", [createResident("r1")]);
    const page = mountScheduleGrid({
      installments: createInstallments(),
      rows: [createRow(unit, 0, true)],
      onToggle,
    });

    await page.clickCaret("A04");

    expect(onToggle).toHaveBeenCalledExactlyOnceWith("unit:A04");
  });

  it("says so with no period", () => {
    expect(mountScheduleGrid({}).emptyMessage()).toBe("No period is selected.");
  });
});

/** Two installments: 1 on 20/01/2013, and 2 on 20/02/2013, locked. */
function createInstallments(): Installment[] {
  return [
    {
      id: "in1",
      periodId: "p1",
      number: 1,
      name: "Rata 1",
      dueDate: "2013-01-20",
      locked: false,
    },
    {
      id: "in2",
      periodId: "p1",
      number: 2,
      name: "Rata 2",
      dueDate: "2013-02-20",
      locked: true,
    },
  ];
}

interface ResidentOptions {
  restriction?: Restriction | null;
  days?: string;
  /** The domain's verdict on editing the item of installment 1; editable when left out. */
  editable?: Result;
}

/** A resident owing 100.00 on installment 1, 40.00 of it paid, and nothing on 2. */
function createResident(
  id: string,
  options: ResidentOptions = {},
): ScheduleNode {
  return {
    ...createNode(`resident:${id}`, "resident", `Resident ${id}`, []),
    residentId: id,
    role: "PR",
    restriction: options.restriction ?? null,
    days: options.days ?? "",
    previousBalance: cents(-1000),
    budget: cents(120000),
    due: cents(119000),
    cells: [
      {
        ...createCell("in1", `ii-${id}-1`, 10000, 4000),
        editable: options.editable ?? { ok: true },
      },
      createCell("in2", null, null, 0),
    ],
    totalInstallments: cents(10000),
    paid: cents(4000),
    balance: cents(6000),
    overdue: cents(6000),
  };
}

function createRoundings(): ScheduleNode {
  return {
    ...createNode("roundings", "roundings", "Roundings", []),
    budget: cents(-54),
    due: cents(-54),
    cells: [createCell("in1", null, null, 0), createCell("in2", null, null, 0)],
  };
}

function createNode(
  key: string,
  kind: ScheduleNode["kind"],
  label: string,
  children: ScheduleNode[],
): ScheduleNode {
  return {
    key,
    kind,
    label,
    residentId: null,
    role: "",
    restriction: null,
    days: "",
    previousBalance: cents(0),
    budget: cents(0),
    due: cents(0),
    cells: [
      createCell("in1", null, 10000, 4000),
      createCell("in2", null, 0, 0),
    ],
    totalInstallments: cents(10000),
    paid: cents(4000),
    balance: cents(6000),
    overdue: cents(6000),
    children,
  };
}

function createCell(
  installmentId: string,
  itemId: string | null,
  owed: number | null,
  paid: number,
): ScheduleCell {
  return {
    installmentId,
    itemId,
    amount: owed === null ? null : cents(owed),
    paid: cents(paid),
    status: owed === null || owed === 0 ? null : "partial",
    editable: itemId === null ? createRefusal("no-item") : { ok: true },
  };
}

function createRow(
  node: ScheduleNode,
  depth = 0,
  expanded = false,
): ScheduleGridRow {
  return {
    key: node.key,
    node,
    depth,
    hasChildren: node.children.length > 0,
    expanded,
  };
}

function createRefusal(reason: string): Result {
  return { ok: false, reason };
}

async function createAccepted(): Promise<Result> {
  return { ok: true };
}
