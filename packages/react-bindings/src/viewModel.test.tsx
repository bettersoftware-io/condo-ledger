import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  cents,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
  loadLegacySeed,
  type Result,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";

import {
  mountUnderProvider,
  mountWithoutProvider,
  type Seen,
} from "./viewModel.page.tsx";

describe("the view model", () => {
  it("reads the buildings and the selected period", () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(
      page.read().buildings.map((building) => {
        return building.id;
      }),
    ).toEqual(["c1"]);
    expect(page.read().period.selected).toEqual({
      buildingId: "c1",
      periodId: "p1",
    });
  });

  it("selectPeriod moves the selection", async () => {
    const page = mountUnderProvider(createTwoPeriodSeed());

    await page.send((seen) => {
      seen.period.selectPeriod("p2");
    });

    expect(page.read().period.selected).toEqual({
      buildingId: "c1",
      periodId: "p2",
    });
  });

  it("reads the accounts tree of the selected period", () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().tree?.debit).toBe(212619);
  });

  it("the navigation is shared between two readers", async () => {
    const page = mountUnderProvider(createSmallSeed(), 2);

    expect(page.read(1).navigation.state.menu).toBe("accounts");

    await page.send((seen) => {
      seen.navigation.selectMenu("journal");
    });

    expect(page.read(0).navigation.state.menu).toBe("journal");
    expect(page.read(1).navigation.state.menu).toBe("journal");
  });

  it("reads the session and changes a preference", async () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().session.principal).toEqual(DESIGN_PRINCIPAL);
    expect(page.read().session.firm).toEqual(DESIGN_FIRM);

    await page.send((seen) => {
      return seen.session.setMode("dark");
    });
    await page.send((seen) => {
      return seen.session.setTheme("sage");
    });
    await page.send((seen) => {
      return seen.session.setLanguage("it");
    });

    expect(page.read().session.preferences).toMatchObject({
      mode: "dark",
      theme: "sage",
      language: "it",
    });
  });

  it("reads the amounts' locale, which follows the language", async () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().amountLocale).toBe("en-US");

    await page.send((seen) => {
      return seen.session.setLanguage("fr");
    });

    expect(page.read().amountLocale).toBe("fr-FR");
  });

  it("starts on Total, and a selected account brings its ledger and details", async () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().account.key).toBe("total");
    expect(page.read().ledger?.lines).toHaveLength(20);

    await page.send((seen) => {
      seen.account.select("la21");
    });

    expect(page.read().account.key).toBe("la21");
    expect(page.read().account.node?.key).toBe("la21");
    expect(page.read().ledger?.lines).toHaveLength(1);
    expect(page.read().details?.path).toBe(
      "Total › Costs › Spese generali › Ascensore",
    );
  });

  it("sets a budget the details then show", async () => {
    const page = mountUnderProvider(createSmallSeed());

    await page.send((seen) => {
      seen.account.select("la21");
    });
    await page.send((seen) => {
      return seen.setBudget("la21", cents(120000));
    });

    expect(page.read().details?.budget).toBe(120000);
  });

  it("raises a notice for a stub and clears it", async () => {
    const page = mountUnderProvider(createSmallSeed());

    await page.send((seen) => {
      seen.notices.stub("Print");
    });

    expect(page.read().notices.notices).toEqual([
      { id: 1, text: "Print: not yet available" },
    ]);

    await page.send((seen) => {
      seen.notices.clear(1);
    });

    expect(page.read().notices.notices).toEqual([]);
  });

  it("hands every reader the same grids, columns, split and tab, and each its own dialogs, wizards and shell parts", async () => {
    const page = mountUnderProvider(createSmallSeed(), 2);
    const before = ownStatesOf(page.read(1));

    await page.send((seen) => {
      seen.grid.toggle("la10");
      seen.columns.resize(1, 120);
      seen.split.setRatio(0.3);
      seen.bottomTab.activate("Details");
      seen.journalGrid.toggle("e1");
      seen.maximize.toggle("top");
      seen.sidebar.open();
      seen.journalDialog.openDelete();
      seen.directPayment.edit({ amount: "1" });
      seen.multiCostPayment.edit({ amount: "2" });
      seen.genericEntry.edit({ description: "Prova" });
    });

    for (const reader of [0, 1]) {
      expect(page.read(reader).grid.state.expanded).toContain("la10");
      expect(page.read(reader).columns.state.widths).toEqual([null, 120]);
      expect(page.read(reader).split.state).toEqual({ ratio: 0.3 });
      expect(page.read(reader).bottomTab.state).toEqual({ active: "Details" });
      expect(page.read(reader).journalGrid.state.expanded).toEqual(["e1"]);
    }

    expect(page.read(0).maximize.state).toEqual({ maximized: "top" });
    expect(page.read(0).sidebar.state.open).toBe(true);
    expect(page.read(0).journalDialog.state.open).toEqual({ kind: "delete" });
    expect(page.read(0).directPayment.state.form.amount).toBe("1");
    expect(page.read(0).multiCostPayment.state.form.amount).toBe("2");
    expect(page.read(0).genericEntry.state.form.description).toBe("Prova");
    expect(ownStatesOf(page.read(1))).toEqual(before);
  });

  it("reads the selected period's journal entries and the context the wizards show", async () => {
    const page = mountUnderProvider(createSmallSeed());

    await page.send((seen) => {
      seen.period.selectPeriod("p1");
    });

    expect(page.read().journalEntries).toHaveLength(9);
    expect(page.read().journalGrid.state.total).toBe(9);
    expect(page.read().journalContext).toEqual({
      building: "Pozzetto",
      period: "2013",
      address: "Via Roma, 1, 33100 Udine",
    });
  });

  it("deletes an entry, which leaves the journal", async () => {
    const page = mountUnderProvider(createSmallSeed());
    let answer: Result | null = null;

    await page.send(async (seen) => {
      answer = await seen.deleteEntry("e8");
    });

    expect(answer).toEqual({ ok: true });
    expect(
      page.read().journalEntries.map((entry) => {
        return entry.id;
      }),
    ).not.toContain("e8");
    expect(page.read().journalEntries).toHaveLength(8);
  });

  it("the journal dialog reads back the wizard it opened", async () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().journalDialog.state.open).toBeNull();

    await page.send((seen) => {
      seen.journalDialog.openWizard("genericEntry");
    });

    expect(page.read().journalDialog.state.open).toEqual({
      kind: "wizard",
      wizard: "genericEntry",
      editing: null,
    });
  });

  it("the new wizards mount their machines, each over the selected period", () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().invoice.state.editing).toBeNull();
    expect(page.read().invoice.state.form.supplierId).toBeNull();
    expect(page.read().invoicePayment.state.editing).toBeNull();
    expect(page.read().invoicePayment.state.summary.open).toEqual([]);
    expect(page.read().openingBalances.state.editing).toBeNull();
    expect(
      page.read().openingBalances.state.summary.rows.length,
    ).toBeGreaterThan(0);
  });

  it("the collection wizard mounts over the selected period and shows the collection it edits", () => {
    const fresh = mountUnderProvider(createSmallSeed());

    expect(fresh.read().collection.state.editing).toBeNull();
    expect(fresh.read().collection.state.form.personId).toBeNull();

    const editing = mountUnderProvider(
      loadLegacySeed(legacySeedData),
      1,
      null,
      "tx6",
    );

    expect(editing.read().collection.state).toMatchObject({
      editing: "tx6",
      step: 2,
      form: { personId: "md6", accountId: "la4", amount: "1000.00" },
    });
  });

  it("the schedule hooks mount over the selected period and show p36's root budget", async () => {
    const page = mountUnderProvider(
      loadLegacySeed(legacySeedData),
      1,
      null,
      null,
      "in5",
    );

    expect(page.read().schedule.schedule?.root.budget).toBe(740000);
    expect(page.read().installmentDialog?.state.form).toMatchObject({
      name: "Installment 2",
      dueDate: "15/07/2011",
      locked: false,
    });

    await page.send((seen) => {
      seen.period.selectPeriod("p36");
    });

    expect(page.read().schedule.schedule?.root.budget).toBe(3800000);
    expect(page.read().scheduleGrid.state.rows[0]?.node.kind).toBe("root");
    expect(page.read().budgetInstallments.state.editing).toBeNull();
  });

  it("the installment dialog hook edits and saves its installment, through the schedule", async () => {
    const page = mountUnderProvider(
      loadLegacySeed(legacySeedData),
      1,
      null,
      null,
      "in5",
    );
    let answer: Result | null = null;

    await page.send((seen) => {
      seen.installmentDialog?.edit({ name: "Seconda" });
    });

    expect(page.read().installmentDialog?.state.form.name).toBe("Seconda");

    await page.send(async (seen) => {
      answer = (await seen.installmentDialog?.save()) ?? null;
    });

    expect(answer).toEqual({ ok: true });
    expect(
      page.read().schedule.schedule?.installments.map((installment) => {
        return installment.name;
      }),
    ).toContain("Seconda");
  });

  it("the allocation hooks mount over the selected period: p1's tables, its first table's coefficients and its budget allocation", () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData));
    const { allocation, coefficientsGrid, allocationGrid } = page.read();

    expect(
      allocation.tables.map((view) => {
        return view.table.id;
      }),
    ).toEqual(["dt1", "dt2", "dt3", "dt4", "dt5"]);
    expect(allocation.selectedTableId).toBe("dt1");
    expect(allocation.mode).toBe("budget");
    expect(allocation.allocation?.root.total).toBe(740000);
    expect(coefficientsGrid.state.rows[0]?.key).toBe("group:ug1");
    expect(allocationGrid.state.rows[0]?.node.kind).toBe("root");
  });

  it("a table selected and a mode chosen reach every reader and both grids", async () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData), 2);

    await page.send((seen) => {
      seen.allocation.selectTable("dt3");
      seen.allocation.chooseMode("finalBalance");
    });

    for (const reader of [0, 1]) {
      const { allocation, coefficientsGrid, allocationGrid } =
        page.read(reader);

      expect(allocation.selectedTableId).toBe("dt3");
      expect(allocation.mode).toBe("finalBalance");
      expect(allocation.allocation?.root.total).toBe(245519);
      expect(
        coefficientsGrid.state.rows.map((row) => {
          return row.key;
        }),
      ).toEqual(["group:ug1", "unit:u1", "unit:u2", "unit:u3", "unit:u4"]);
      expect(allocationGrid.state.rows[0]?.node.total).toBe(245519);
    }
  });

  it("every reader opens and closes the same grids' rows", async () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData), 2);

    await page.send((seen) => {
      seen.coefficientsGrid.toggle("group:ug1");
      seen.allocationGrid.collapseAll();
    });

    for (const reader of [0, 1]) {
      expect(page.read(reader).coefficientsGrid.state.rows).toHaveLength(6);
      expect(page.read(reader).allocationGrid.state.rows).toHaveLength(1);
    }
  });

  it("the allocation's writes reach the tables: a coefficient read in the session's locale, a table added through the dialog and deleted", async () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData));
    const answers: Result[] = [];

    await page.send(async (seen) => {
      answers.push(await seen.allocation.setCoefficient("dt1", "u1", "200"));
      answers.push(await seen.allocation.setCoefficient("dt1", "u2", "-1"));
    });

    expect(answers).toEqual([
      { ok: true },
      { ok: false, reason: "not-a-coefficient" },
    ]);
    expect(page.read().allocation.tables[0]?.total).toBe(11000000);

    await page.send((seen) => {
      seen.tableDialog.edit({ name: "Test" });
    });
    await page.send(async (seen) => {
      answers.push(await seen.tableDialog.save());
    });

    expect(page.read().allocation.tables.at(-1)?.table.name).toBe("Test");

    await page.send(async (seen) => {
      answers.push(await seen.allocation.deleteTable("dt-new-1"));
    });

    expect(answers.slice(2)).toEqual([
      { ok: true, value: { id: "dt-new-1" } },
      { ok: true },
    ]);
    expect(page.read().allocation.tables).toHaveLength(5);
  });

  it("the Budget allocation wizard mounts over p1, which refuses a second allocation; the allocation names an account by its path", () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData));

    expect(page.read().budgetAllocation.state).toMatchObject({
      form: { description: "Budget allocation (no.1)" },
      verdict: { ok: false, reason: "allocation-exists" },
    });
    expect(page.read().allocation.accountPath("la28")).toBe(
      "Total › Costs › General expenses",
    );
  });

  it("the table dialog hook opens a new table on the next order, and its save answers the new table's id", async () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData));
    const answers: Result[] = [];

    expect(page.read().tableDialog.state.form).toEqual({
      name: "",
      order: "6",
      notes: "",
    });

    await page.send((seen) => {
      seen.tableDialog.edit({ name: "Test" });
    });
    await page.send(async (seen) => {
      answers.push(await seen.tableDialog.save());
    });

    expect(answers).toEqual([{ ok: true, value: { id: "dt-new-1" } }]);
    expect(page.read().allocation.tables.at(-1)?.table.name).toBe("Test");
  });

  it("the units hooks mount over the selected period: p1's eight units, A1 selected with its crumb, and both grids' rows", () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData));
    const { units, unitsGrid, unitOwnersGrid } = page.read();

    expect(units.view?.list.unitCount).toBe(8);
    expect(units.view?.selected?.key).toBe("unit:u1");
    expect(units.view?.location).toBe("Stairwell A");
    expect(units.crumb).toBe("A1");
    expect(unitsGrid.state.rows[0]?.key).toBe("root");
    expect(unitOwnersGrid.state.rows[0]?.key).toBe("period:u1");
  });

  it("a row selected reaches every reader, its crumb and the owners grid; every reader opens and closes the same rows", async () => {
    const page = mountUnderProvider(loadLegacySeed(legacySeedData), 2);

    await page.send((seen) => {
      seen.units.select("unit:u5");
      seen.unitsGrid.collapseAll();
    });

    for (const reader of [0, 1]) {
      const { units, unitsGrid, unitOwnersGrid } = page.read(reader);

      expect(units.view?.unit?.code).toBe("B1");
      expect(units.crumb).toBe("B1");
      expect(unitsGrid.state.rows).toHaveLength(1);
      expect(unitOwnersGrid.state.rows[0]?.key).toBe("period:u5");
    }
  });

  it("the unit dialog hook opens Edit Unit on its unit, and its save reaches the Units grid", async () => {
    const page = mountUnderProvider(
      loadLegacySeed(legacySeedData),
      1,
      null,
      null,
      null,
      "u1",
    );
    let answer: Result | null = null;

    expect(page.read().unitDialog?.state.form.code).toBe("A1");

    await page.send((seen) => {
      seen.unitDialog?.edit({ floor: "2" });
    });
    await page.send(async (seen) => {
      answer = (await seen.unitDialog?.save()) ?? null;
    });

    expect(answer).toEqual({ ok: true });
    expect(
      page.read().units.view?.list.root.children[0]?.children[0],
    ).toMatchObject({ key: "unit:u1", floor: "2" });
  });

  it("a wizard hook given an entry to edit shows that entry's form", () => {
    const page = mountUnderProvider(createSmallSeed(), 1, "e6");

    expect(page.read().genericEntry.state).toMatchObject({
      editing: "e6",
      form: { description: "Arrotondamento" },
    });
  });

  it("a wizard hook's edit changes its state, on the selected period's books", async () => {
    const page = mountUnderProvider(createSmallSeed());

    expect(page.read().directPayment.state.summary).toEqual({
      paidFrom: "Cassa",
    });

    await page.send((seen) => {
      seen.directPayment.edit({ targetId: "la21", amount: "12.50" });
      seen.multiCostPayment.edit({ amount: "3" });
      seen.genericEntry.edit({ description: "Giroconto" });
    });

    expect(page.read().directPayment.state).toMatchObject({
      form: { targetId: "la21", amount: "12.50" },
      verdict: { ok: true },
      touched: true,
    });
    expect(page.read().multiCostPayment.state.form.amount).toBe("3");
    expect(page.read().genericEntry.state.form.description).toBe("Giroconto");
  });

  it("tells a component with no provider above it what is missing", () => {
    // React prints the error it catches; the message is asserted below instead.
    const printed = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => {
      printed.mockRestore();
    });

    expect(() => {
      mountWithoutProvider();
    }).toThrow("useViewModel needs a <ViewModelProvider> above it in the tree");
  });
});

/** The states of the machines a reader gets of its own. */
function ownStatesOf(seen: Seen): unknown[] {
  return [
    seen.maximize.state,
    seen.sidebar.state,
    seen.journalDialog.state,
    seen.directPayment.state.form,
    seen.multiCostPayment.state.form,
    seen.genericEntry.state.form,
  ];
}
