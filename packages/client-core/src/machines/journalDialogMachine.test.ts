import { afterEach, describe, expect, it } from "vitest";

import {
  createJournalDialogMachine,
  type JournalDialogIntents,
  type JournalDialogState,
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

  it("opens a wizard", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("directPaymentCash");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "directPaymentCash" },
    });
  });

  it("opening another wizard replaces the first", () => {
    const dialog = createDialog();

    dialog.intents.openWizard("genericEntry");
    dialog.intents.openWizard("multiCostPayment");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "multiCostPayment" },
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
});

function createDialog(): Dialog {
  const machine = createJournalDialogMachine();

  created.push(machine);

  return machine;
}

type Dialog = Machine<JournalDialogState, JournalDialogIntents>;

const created: Dialog[] = [];
