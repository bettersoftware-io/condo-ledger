import { afterEach, describe, expect, it } from "vitest";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import {
  createJournalDialogMachine,
  type JournalDialogIntents,
  type JournalDialogLookups,
  type JournalDialogState,
  type WizardName,
} from "./journalDialogMachine.ts";
import type { Machine } from "./machine.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the journal dialog machine", () => {
  it("starts with no dialog open", () => {
    expect(createDialog().state$.getValue()).toEqual({ open: null });
  });

  it("opens a wizard on a new entry", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("directPaymentCash");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "directPaymentCash", editing: null },
    });
  });

  it("opening another wizard replaces the first", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("genericEntry");
    dialog.intents.openWizard("multiCostPayment");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "multiCostPayment", editing: null },
    });
  });

  it("the delete confirmation replaces a wizard", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("withholdingPayment");
    dialog.intents.openDelete();

    expect(dialog.state$.getValue()).toEqual({ open: { kind: "delete" } });
  });

  it("close clears whatever is open", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("directPaymentBank");
    dialog.intents.close();

    expect(dialog.state$.getValue()).toEqual({ open: null });

    dialog.intents.openDelete();
    dialog.intents.close();

    expect(dialog.state$.getValue()).toEqual({ open: null });
  });

  it("openEdit opens the entry's editor on the entry", () => {
    const dialog = createDialog({ e1: "multiCostPayment" });

    dialog.intents.openEdit("e1");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "multiCostPayment", editing: "e1" },
    });
  });

  it("openEdit of an entry with no editor leaves the dialog as it was", () => {
    const dialog = createDialog({ e1: "genericEntry" });

    dialog.intents.openEdit("e2");

    expect(dialog.state$.getValue()).toEqual({ open: null });

    dialog.intents.openDelete();
    dialog.intents.openEdit("e2");

    expect(dialog.state$.getValue()).toEqual({ open: { kind: "delete" } });
  });

  it("the opening balances item edits the period's opening, in the editor that opening has", () => {
    const dialog = createDialog({ e7: "genericEntry" }, "e7");

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "genericEntry", editing: "e7" },
    });
  });

  it("the opening balances item opens a new opening when the period has none", () => {
    const dialog = createDialog({}, null);

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "openingBalances", editing: null },
    });
  });

  it("the opening balances item leaves the dialog as it was when the opening has no editor", () => {
    const dialog = createDialog({}, "e7");

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({ open: null });
  });

  it("another wizard opens on a new entry whatever the opening", () => {
    const dialog = createDialog({ e7: "openingBalances" }, "e7");

    dialog.intents.openWizard("genericEntry");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "genericEntry", editing: null },
    });
  });
});

describe("the application's journal dialog", () => {
  it("openEdit opens an entry of the selected period in its editor", () => {
    const dialog = createAppDialog(createAppHarness());

    dialog.intents.openEdit("tx8");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "directPaymentCash", editing: "tx8" },
    });
  });

  it("openEdit opens a collection in the collection wizard", () => {
    const dialog = createAppDialog(createAppHarness());

    dialog.intents.openEdit("tx6");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "collection", editing: "tx6" },
    });
  });

  it("openEdit leaves the dialog closed for an entry that cannot be edited, or one the period does not hold", () => {
    const harness = createAppHarness();
    const dialog = createAppDialog(harness);
    const allocation = harness.app.presenters.books.books$
      .getValue()
      ?.entries.find((entry) => {
        return entry.kind === "budgetAllocation";
      });

    expect(allocation).toBeDefined();

    dialog.intents.openEdit(allocation?.id ?? "an allocation");
    dialog.intents.openEdit("tx100");
    dialog.intents.openEdit("nowhere");

    expect(dialog.state$.getValue()).toEqual({ open: null });
  });

  it("the opening balances item edits Saturno 2011's opening in the generic editor: its supplier lines are not on the list", () => {
    const dialog = createAppDialog(createAppHarness());

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "genericEntry", editing: "tx1" },
    });
  });

  it("the opening balances item edits Pozzetto 2013's opening in its own editor", () => {
    const harness = createAppHarness();

    harness.app.presenters.buildings.selectPeriod("p36");

    const dialog = createAppDialog(harness);

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "openingBalances", editing: "tx100" },
    });
  });
});

type Dialog = Machine<JournalDialogState, JournalDialogIntents>;

const created: Dialog[] = [];

/** A dialog over these editors by entry id, and this opening. */
function createDialog(
  editors: Readonly<Record<string, WizardName>> = {},
  opening: string | null = null,
): Dialog {
  const lookups: JournalDialogLookups = {
    editorOf: (entryId: string): WizardName | null => {
      return editors[entryId] ?? null;
    },
    openingEntry: (): string | null => {
      return opening;
    },
  };
  const machine = createJournalDialogMachine(lookups);

  created.push(machine);

  return machine;
}

function createAppDialog(harness: AppHarness): Dialog {
  const machine = harness.app.machines.createJournalDialog();

  created.push(machine);

  return machine;
}
