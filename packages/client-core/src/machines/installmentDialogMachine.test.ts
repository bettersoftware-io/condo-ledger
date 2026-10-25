import { afterEach, describe, expect, it } from "vitest";

import {
  type Installment,
  type InstallmentPatch,
  ok,
  type Result,
  type ScheduleContext,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { currentBooks } from "#/testing/harnessBooks.ts";

import {
  createInstallmentDialog,
  type InstallmentDialogIntents,
  type InstallmentDialogState,
} from "./installmentDialogMachine.ts";
import type { Machine } from "./machine.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the Edit Installment dialog", () => {
  it("opens on the installment's name, due date and lock, accepted and untouched", () => {
    const { machine } = createDialog("in5");

    expect(machine.state$.getValue()).toEqual({
      form: { name: "Rata nr. 2", dueDate: "15/07/2011", locked: false },
      dueDate: "2011-07-15",
      verdict: { ok: true },
      touched: false,
      saving: false,
    });
  });

  it.each([
    [{ name: "  " }, "blank-name"],
    [{ name: "Rata nr. 3" }, "name-taken"],
    [{ dueDate: "30/02/2011" }, "invalid-due-date"],
    [{ dueDate: "2011-08-15" }, "invalid-due-date"],
    [{ dueDate: "" }, "invalid-due-date"],
    [{ name: "Rata due" }, null],
    [{ dueDate: "15/08/2011" }, null],
    [{ dueDate: "15/8" }, null],
  ])("answers %j with %s", (patch, reason) => {
    const { machine } = createDialog("in5");

    machine.intents.edit(patch);

    const { verdict, touched } = machine.state$.getValue();

    expect(verdict.ok ? null : verdict.reason).toBe(reason);
    expect(touched).toBe(true);
  });

  it("saves a rename and a new due date: the books then hold them", async () => {
    const { machine, harness } = createDialog("in5");

    machine.intents.edit({ name: " Rata due ", dueDate: "15/8" });

    expect(machine.state$.getValue().dueDate).toBe("2011-08-15");

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(installmentOf(harness, "in5")).toMatchObject({
      name: "Rata due",
      dueDate: "2011-08-15",
      locked: false,
    });
  });

  it("on a locked installment, refuses a new name or due date installment-locked, and saves an unlock", async () => {
    const { machine, harness } = createDialog("in1");

    expect(machine.state$.getValue().form).toEqual({
      name: "Rata nr. 1",
      dueDate: "15/03/2011",
      locked: true,
    });

    machine.intents.edit({ name: "Renamed" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "installment-locked",
    });
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "installment-locked",
    });
    expect(installmentOf(harness, "in1").name).toBe("Rata nr. 1");

    machine.intents.edit({ name: "Rata nr. 1", dueDate: "15/04/2011" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "installment-locked",
    });

    machine.intents.edit({ dueDate: "15/3/2011", locked: false });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(installmentOf(harness, "in1").locked).toBe(false);
  });

  it("on a locked installment, saves an unlock with a new name and due date in one save", async () => {
    const { machine, harness } = createDialog("in1");

    machine.intents.edit({
      locked: false,
      name: "Renamed",
      dueDate: "15/04/2011",
    });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(installmentOf(harness, "in1")).toMatchObject({
      name: "Renamed",
      dueDate: "2011-04-15",
      locked: false,
    });
  });

  it("writes only what changed, and nothing twice while a save runs", async () => {
    const harness = createAppHarness();
    const patches: InstallmentPatch[] = [];

    const resolvers: ((result: Result) => void)[] = [];

    const machine = track(
      createInstallmentDialog(
        installmentOf(harness, "in5"),
        (patch) => {
          patches.push(patch);

          return new Promise<Result>((resolve) => {
            resolvers.push(resolve);
          });
        },
        contextOf(harness),
      ),
    );

    machine.intents.edit({ name: "Rata due" });

    const first = machine.intents.save();

    expect(machine.state$.getValue().saving).toBe(true);
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "saving",
    });

    must(resolvers[0], "the running save")(ok());
    await expect(first).resolves.toEqual({ ok: true });
    expect(patches).toEqual([{ name: "Rata due" }]);
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it.each([
    [{ name: "Rata due" }, { name: "Rata due" }],
    [{ dueDate: "15/08/2011" }, { dueDate: "2011-08-15" }],
    [{ locked: true }, { locked: true }],
  ])("answers %j by writing %j alone", async (edit, patch) => {
    const harness = createAppHarness();
    const patches: InstallmentPatch[] = [];
    const machine = track(
      createInstallmentDialog(
        installmentOf(harness, "in5"),
        (written) => {
          patches.push(written);

          return Promise.resolve(ok());
        },
        contextOf(harness),
      ),
    );

    machine.intents.edit(edit);

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(patches).toEqual([patch]);
  });

  it("is not built for an installment the selected period does not hold", () => {
    const harness = createAppHarness();

    expect(() => {
      return harness.app.machines.createInstallmentDialog("in-none");
    }).toThrow("missing: the installment in-none");
  });
});

type Dialog = Machine<InstallmentDialogState, InstallmentDialogIntents>;

interface CreatedDialog {
  machine: Dialog;
  harness: AppHarness;
}

/** The dialog over one of Saturno 2011's installments, through the application. */
function createDialog(installmentId: string): CreatedDialog {
  const harness = createAppHarness();

  return {
    machine: track(harness.app.machines.createInstallmentDialog(installmentId)),
    harness,
  };
}

function installmentOf(harness: AppHarness, id: string): Installment {
  return must(
    currentBooks(harness).installments.find((installment) => {
      return installment.id === id;
    }),
    `the installment ${id}`,
  );
}

function contextOf(harness: AppHarness): ScheduleContext {
  const books = currentBooks(harness);

  return {
    installments: books.installments,
    items: books.installmentItems,
    entries: books.entries,
    budgetFound: true,
  };
}

function track(machine: Dialog): Dialog {
  created.push(machine);

  return machine;
}

const created: Dialog[] = [];
