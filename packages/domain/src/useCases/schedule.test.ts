import { describe, expect, it } from "vitest";

import type { Account, AccountRole } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { EntryKind, JournalEntry, Posting } from "../entities/journal.ts";
import type { OwnerParty, Party, Restriction } from "../entities/party.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import {
  type ScheduleCell,
  type ScheduleInput,
  type ScheduleNode,
  scheduleOf,
} from "./schedule.ts";

describe("scheduleOf on a small period", () => {
  it("lists the installments in number order", () => {
    const schedule = scheduleOf(createInput(), "2011-06-20");

    expect(
      schedule.installments.map((installment) => {
        return installment.id;
      }),
    ).toEqual(["in1", "in2"]);
  });

  it("puts the units in code order, a one-resident unit as that resident's row, the residents of a shared unit in residency order, and Roundings last", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(outline(root)).toEqual([
      "root root Small 2011",
      "  unit unit:A1 A1",
      "    resident resident:rB owner B",
      "    resident resident:rA owner A",
      "  resident resident:rC B1 owner C",
      "  roundings roundings Roundings",
    ]);
  });

  it("gives a resident row its role, restriction and days, and leaves them blank on the other rows", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(
      [
        root,
        nodeAt(root, "A1"),
        resident(root, "rA"),
        resident(root, "rB"),
      ].map((node) => {
        return [node.role, node.restriction, node.days, node.residentId];
      }),
    ).toEqual([
      ["", null, "", null],
      ["", null, "", null],
      ["PR", { from: "2011-07-01", to: null }, "184/365", "rA"],
      ["PR", { from: null, to: "2011-06-30" }, "181/365", "rB"],
    ]);
    expect(resident(root, "rC").days).toBe("");
    expect(resident(root, "rC").role).toBe("CO");
  });

  it("works each resident's amounts out of the opening, the allocation, the items and the collections", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(
      ["rA", "rB", "rC"].map((id) => {
        return amounts(resident(root, id));
      }),
    ).toEqual([
      [500, 6000, 6500, 6500, 5000, 1500, 0],
      [0, 4000, 4000, 4000, 500, 3500, 1500],
      [-200, 3000, 2800, 0, 0, 0, 0],
    ]);
  });

  it("sums the residents into the unit, and every row and the roundings into the root", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");
    const roundings = nodeAt(root, "Roundings");

    expect(amounts(nodeAt(root, "A1"))).toEqual([
      500, 10000, 10500, 10500, 5500, 5000, 1500,
    ]);
    expect(amounts(roundings)).toEqual([0, -2, -2, 0, 0, 0, 0]);
    expect(roundings.residentId).toBeNull();
    expect(amounts(root)).toEqual([300, 12998, 13298, 10500, 5500, 5000, 1500]);
  });

  it("counts as overdue only the items due before today, not on it", () => {
    expect(scheduleOf(createInput(), "2011-06-20").root.overdue).toBe(1500);
    expect(scheduleOf(createInput(), "2011-06-21").root.overdue).toBe(5000);
    expect(scheduleOf(createInput(), "2011-03-20").root.overdue).toBe(0);
  });

  it("colours a cell settled when paid reaches the amount, partial when some is paid, unsettled when none", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(cellsOf(resident(root, "rA"))).toEqual([
      ["iiA1", 5000, 5000, "settled"],
      ["iiA2", 1500, 0, "unsettled"],
    ]);
    expect(cellsOf(resident(root, "rB"))).toEqual([
      ["iiB1", 2000, 500, "partial"],
      ["iiB2", 2000, 0, "unsettled"],
    ]);
  });

  it("leaves a zero item uncoloured, and a missing item blank", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(cellsOf(resident(root, "rC"))).toEqual([
      ["iiC1", 0, 0, null],
      [null, null, 0, null],
    ]);
  });

  it("says which resident cells may be edited: not a paid item, not a locked installment's, an unpaid one of zero yes; never a blank, a unit's, the root's or Roundings'", () => {
    const input = createInput();
    input.installments = input.installments.map((installment) => {
      return { ...installment, locked: installment.id === "in2" };
    });

    const { root } = scheduleOf(input, "2011-06-20");

    expect(editableOf(resident(root, "rA"))).toEqual([
      "item-paid",
      "installment-locked",
    ]);
    expect(editableOf(resident(root, "rB"))).toEqual([
      "item-paid",
      "installment-locked",
    ]);
    expect(editableOf(resident(root, "rC"))).toEqual(["ok", "no-item"]);
    expect(editableOf(nodeAt(root, "A1"))).toEqual(["no-item", "no-item"]);
    expect(editableOf(root)).toEqual(["no-item", "no-item"]);
    expect(editableOf(nodeAt(root, "Roundings"))).toEqual([
      "no-item",
      "no-item",
    ]);
  });

  it("colours a unit and the root by their residents' sums, and leaves the Roundings cells blank", () => {
    const { root } = scheduleOf(createInput(), "2011-06-20");

    expect(cellsOf(nodeAt(root, "A1"))).toEqual([
      [null, 7000, 5500, "partial"],
      [null, 3500, 0, "unsettled"],
    ]);
    expect(cellsOf(root)).toEqual([
      [null, 7000, 5500, "partial"],
      [null, 3500, 0, "unsettled"],
    ]);
    expect(cellsOf(nodeAt(root, "Roundings"))).toEqual([
      [null, null, 0, null],
      [null, null, 0, null],
    ]);
    expect(
      nodeAt(root, "A1").cells.map((cell) => {
        return cell.installmentId;
      }),
    ).toEqual(["in1", "in2"]);
  });

  it("settles a unit's cell when its residents have paid all of it", () => {
    const input = createInput();
    input.entries.push(createCollection("tx9", "iiB1", 1500));

    const { root } = scheduleOf(input, "2011-06-20");

    expect(cellsOf(nodeAt(root, "A1"))[0]).toEqual([
      null,
      7000,
      7000,
      "settled",
    ]);
  });

  it("gives no budget and no Roundings row when the period has no budget allocation", () => {
    const input = createInput();
    input.entries = input.entries.filter((entry) => {
      return entry.kind !== "budgetAllocation";
    });

    const { root } = scheduleOf(input, "2011-06-20");

    expect(root.children.map(label)).toEqual(["A1", "B1 owner C"]);
    expect(root.budget).toBe(0);
    expect(root.due).toBe(300);
  });
});

describe("scheduleOf on the seed", () => {
  it("adds Pozzetto 2013's root up to the printed schedule, with a Roundings row of −0.54", () => {
    const { root } = scheduleOf(seedInput("p36"), "2026-10-14");

    expect(amounts(root)).toEqual([
      -625099,
      3800000,
      -625099 + 3800000,
      3359188,
      2182598,
      1176590,
      1176590,
    ]);
    expect(lastChild(root).label).toBe("Roundings");
    expect(lastChild(root).budget).toBe(-54);
    expect(lastChild(root).due).toBe(-54);
  });

  it("adds Saturno 2011's root up to the printed schedule, with a Roundings row of 0.01", () => {
    const { root } = scheduleOf(seedInput("p1"), "2026-10-14");

    expect([
      root.previousBalance,
      root.budget,
      root.totalInstallments,
      root.paid,
      root.balance,
    ]).toEqual([28892, 740000, 768892, 327997, 440895]);
    expect(lastChild(root).label).toBe("Roundings");
    expect(lastChild(root).budget).toBe(1);
  });

  it("makes A04 a unit row with r167 then r166, in residency order, and their days", () => {
    const { root } = scheduleOf(seedInput("p36"), "2026-10-14");
    const unit = nodeAt(root, "A04");

    expect(unit.kind).toBe("unit");
    expect(
      unit.children.map((child) => {
        return [child.residentId, child.label, child.days];
      }),
    ).toEqual([
      ["r167", nameOf("p36", "r167"), "18/365"],
      ["r166", nameOf("p36", "r166"), "347/365"],
    ]);
  });

  it("labels a one-resident unit by its code and the resident's name, in unit-code order", () => {
    const { root } = scheduleOf(seedInput("p36"), "2026-10-14");
    const first = must(root.children[0], "the first row");

    expect(first.kind).toBe("resident");
    expect(first.residentId).toBe("r162");
    expect(first.label).toBe(`A01 ${nameOf("p36", "r162")}`);

    const codes = root.children.slice(0, -1).map((child) => {
      return child.label.slice(0, 3);
    });

    expect(codes).toEqual([...codes].sort());
    expect(codes).toHaveLength(18);
  });

  it("colours ii789 partial, and leaves a zero item uncoloured", () => {
    const { root } = scheduleOf(seedInput("p36"), "2026-10-14");
    const zero = must(
      seed.installmentItems.find((item) => {
        return item.amount === 0 && item.installmentId === "in25";
      }),
      "a zero item of p36",
    );

    expect(cellFor(root, "ii789").status).toBe("partial");
    expect(cellFor(root, zero.id).status).toBeNull();
    expect(cellFor(root, zero.id).amount).toBe(0);
  });

  it("keeps ii789 from being edited item-paid, and Saturno 2011's locked in1 installment-locked", () => {
    const pozzetto = scheduleOf(seedInput("p36"), "2026-10-14").root;
    const saturno = scheduleOf(seedInput("p1"), "2026-10-14").root;
    const lockedItem = must(
      seed.installmentItems.find((item) => {
        return item.installmentId === "in1";
      }),
      "an item of in1",
    );

    expect(cellFor(pozzetto, "ii789").editable).toEqual({
      ok: false,
      reason: "item-paid",
    });
    expect(cellFor(saturno, lockedItem.id).editable).toEqual({
      ok: false,
      reason: "installment-locked",
    });
  });

  it("finds nothing overdue on 1 December 2012, before Pozzetto 2013's first due date", () => {
    const { root } = scheduleOf(seedInput("p36"), "2012-12-01");

    expect(root.overdue).toBe(0);
  });

  it("sums A04's residents into its cell for installment 1", () => {
    const { root, installments } = scheduleOf(seedInput("p36"), "2026-10-14");
    const first = must(installments[0], "installment 1");
    const unit = nodeAt(root, "A04");
    const [r167, r166] = unit.children.map((child) => {
      return cellOf(child, first.id);
    });
    const cell = cellOf(unit, first.id);

    expect(first.number).toBe(1);
    expect(cell.amount).toBe(
      (must(r167, "r167").amount ?? 0) + (must(r166, "r166").amount ?? 0),
    );
    expect(cell.paid).toBe(must(r167, "r167").paid + must(r166, "r166").paid);
    expect(cell.amount).toBeGreaterThan(0);
    expect(cell.itemId).toBeNull();
    expect(cell.status).toBe(
      cell.paid >= (cell.amount ?? 0) ? "settled" : "partial",
    );
  });
});

const seed = loadLegacySeed(legacySeedData);

function seedInput(periodId: string): ScheduleInput {
  const building = must(
    seed.buildings.find((candidate) => {
      return candidate.periods.some((period) => {
        return period.id === periodId;
      });
    }),
    `the building of ${periodId}`,
  );

  const period = must(
    building.periods.find((candidate) => {
      return candidate.id === periodId;
    }),
    `the period ${periodId}`,
  );

  const installments = seed.installments.filter((installment) => {
    return installment.periodId === periodId;
  });

  const installmentIds = new Set(
    installments.map((installment) => {
      return installment.id;
    }),
  );

  return {
    periodLabel: `${building.name} ${period.name}`,
    period: { start: period.start, end: period.end },
    accounts: seed.accounts.filter((account) => {
      return account.periodId === periodId;
    }),
    parties: partiesOf(periodId),
    entries: seed.entries.filter((entry) => {
      return entry.periodId === periodId;
    }),
    installments,
    installmentItems: seed.installmentItems.filter((item) => {
      return installmentIds.has(item.installmentId);
    }),
  };
}

function partiesOf(periodId: string): Party[] {
  return must(
    seed.parties.find((list) => {
      return list.periodId === periodId;
    }),
    `the parties of ${periodId}`,
  ).parties;
}

function nameOf(periodId: string, residentId: string): string {
  return must(
    partiesOf(periodId).find((party) => {
      return party.id === residentId;
    }),
    residentId,
  ).name;
}

function outline(node: ScheduleNode, depth = 0): string[] {
  return [
    `${"  ".repeat(depth)}${node.kind} ${node.key} ${node.label}`,
    ...node.children.flatMap((child) => {
      return outline(child, depth + 1);
    }),
  ];
}

function flatten(node: ScheduleNode): ScheduleNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function nodeAt(root: ScheduleNode, nodeLabel: string): ScheduleNode {
  return must(
    flatten(root).find((node) => {
      return node.label === nodeLabel;
    }),
    `the row ${nodeLabel}`,
  );
}

function resident(root: ScheduleNode, residentId: string): ScheduleNode {
  return must(
    flatten(root).find((node) => {
      return node.residentId === residentId;
    }),
    `the row of ${residentId}`,
  );
}

function lastChild(node: ScheduleNode): ScheduleNode {
  return must(node.children.at(-1), "the last row");
}

function label(node: ScheduleNode): string {
  return node.label;
}

function amounts(node: ScheduleNode): number[] {
  return [
    node.previousBalance,
    node.budget,
    node.due,
    node.totalInstallments,
    node.paid,
    node.balance,
    node.overdue,
  ];
}

function cellsOf(node: ScheduleNode): (string | number | null)[][] {
  return node.cells.map((cell) => {
    return [cell.itemId, cell.amount, cell.paid, cell.status];
  });
}

/** Each cell's verdict on an edit: "ok", or the reason it is refused. */
function editableOf(node: ScheduleNode): string[] {
  return node.cells.map((cell) => {
    return cell.editable.ok ? "ok" : cell.editable.reason;
  });
}

function cellOf(node: ScheduleNode, installmentId: string): ScheduleCell {
  return must(
    node.cells.find((cell) => {
      return cell.installmentId === installmentId;
    }),
    `the cell for ${installmentId}`,
  );
}

function cellFor(root: ScheduleNode, itemId: string): ScheduleCell {
  return must(
    flatten(root)
      .flatMap((node) => {
        return node.cells;
      })
      .find((cell) => {
        return cell.itemId === itemId;
      }),
    `the cell of ${itemId}`,
  );
}

function createInput(): ScheduleInput {
  return {
    periodLabel: "Small 2011",
    period: { start: "2011-01-01", end: "2011-12-31" },
    accounts: [
      createAccount("la5", "owners"),
      createAccount("la6", "roundings"),
      createAccount("la9", null),
    ],
    parties: [
      { kind: "supplier", id: "s1", name: "Supplier" },
      createOwner("rC", "B1", "CO", null),
      createOwner("rA", "A1", "PR", { from: "2011-07-01", to: null }),
      createOwner("rB", "A1", "PR", { from: null, to: "2011-06-30" }),
    ],
    entries: [
      createEntry("tx1", "openingBalances", [
        createPosting("la5", 500, 0, "rA"),
        createPosting("la5", 0, 200, "rC"),
        createPosting("la9", 0, 300, null),
      ]),
      createEntry("tx2", "budgetAllocation", [
        createPosting("la5", 6000, 0, "rA"),
        createPosting("la5", 4000, 0, "rB"),
        createPosting("la5", 3000, 0, "rC"),
        createPosting("la6", 0, 2, "rA"),
        createPosting("la9", 0, 12998, null),
      ]),
      createCollection("tx3", "iiA1", 5000),
      createCollection("tx4", "iiB1", 500),
    ],
    installments: [
      createInstallment("in2", 2, "2011-06-20"),
      createInstallment("in1", 1, "2011-03-20"),
    ],
    installmentItems: [
      createItem("iiA1", "in1", "rA", 5000),
      createItem("iiA2", "in2", "rA", 1500),
      createItem("iiB1", "in1", "rB", 2000),
      createItem("iiB2", "in2", "rB", 2000),
      createItem("iiC1", "in1", "rC", 0),
    ],
  };
}

function createAccount(id: string, role: AccountRole | null): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: id,
    order: 0,
    nature: "assetsOrLiabilities",
    type: role === null ? "regular" : "controlUnitResident",
    role,
    budget: null,
  };
}

function createOwner(
  id: string,
  unitCode: string,
  role: string,
  restriction: Restriction | null,
): OwnerParty {
  return {
    kind: "owner",
    id,
    personId: `p${id}`,
    name: `owner ${id.slice(1)}`,
    unitCode,
    startingBalance: cents(0),
    role,
    restriction,
  };
}

function createEntry(
  id: string,
  kind: EntryKind,
  postings: Posting[],
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 1,
    at: "2011-01-01T00:00:00Z",
    kind,
    description: id,
    postings,
    invoiceId: null,
  };
}

function createCollection(
  id: string,
  itemId: string,
  amount: number,
): JournalEntry {
  return createEntry(id, "collection", [
    createPosting("la9", amount, 0, null),
    {
      ...createPosting("la5", 0, amount, "rA"),
      installmentItemId: itemId,
    },
  ]);
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
  residentId: string | null,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: residentId === null ? null : { kind: "owner", id: residentId },
  };
}

function createInstallment(
  id: string,
  number: number,
  dueDate: string,
): Installment {
  return {
    id,
    periodId: "p1",
    number,
    name: `Installment ${number}`,
    dueDate,
    locked: false,
  };
}

function createItem(
  id: string,
  installmentId: string,
  residentId: string,
  amount: number,
): InstallmentItem {
  return { id, installmentId, residentId, amount: cents(amount) };
}
