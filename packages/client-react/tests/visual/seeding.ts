import { createElement, type ReactElement } from "react";

import type {
  AccountsGridIntents,
  AccountsGridState,
  App,
  BudgetInstallmentsForm,
  BudgetInstallmentsSummary,
  CollectionForm,
  CollectionSummary,
  DirectPaymentForm,
  DirectPaymentKind,
  DirectPaymentSummary,
  GenericEntryForm,
  GenericEntrySummary,
  InvoiceForm,
  InvoicePaymentForm,
  InvoicePaymentSummary,
  InvoiceSummary,
  JournalDialogIntents,
  JournalDialogState,
  JournalGridIntents,
  JournalGridState,
  Machine,
  MultiCostPaymentForm,
  MultiCostPaymentSummary,
  OpeningForm,
  OpeningSummary,
  SidebarIntents,
  SidebarState,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import {
  type AppHarness,
  createAppHarness,
} from "@cl/client-core/testing/appHarness.ts";
import {
  type EntryKind,
  type LegacySeed,
  loadLegacySeed,
  type Result,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { createScheduleSeed } from "@cl/domain/testing/createScheduleSeed.ts";

import type { HostClock, Seeded } from "./host/seeded.ts";
import { Mount } from "./registry.tsx";
import type { NewEntryDialog, Scenario } from "./scenarios.ts";

// How a scenario's data becomes app state. This file is the project's: when a
// feature adds a field to `Scenario`, the lines that deliver it go here. The
// host (`host/`) belongs to the add-on and never needs an edit for a feature:
// it owns the clock, calls `deliver` once the UI has subscribed, and says when
// the picture may be taken.
//
// Two places to put state, and a rule for choosing:
//
// - `app`: what must be true before the first render. A port that answers
//   from memory is given its data when the harness is built; a machine is
//   wrapped so that each one built already holds the scenario's value, set
//   through its own intent.
// - `deliver`: what arrives after the UI is on screen, in order. A wait is
//   `clock.tick(...)`, never a real one.
//
// What is shown is `render`: the registry entry a scenario names in its
// `mount`, in the app's surround (`Mount`, in `registry.tsx`). With no `mount`
// it is undefined, and the host shows the whole app.

/** The application and the deliveries of one scenario. Called once, before the first render. */
export function seedScenario(scenario: Scenario, clock: HostClock): Seeded {
  // The seed is a port's memory, so a renamed account goes in before the
  // harness is built.
  const harness = createAppHarness(seedOf(scenario));
  const { machines } = harness.app;
  const { buildings, accounts } = harness.app.presenters;

  // The mode is a preference the session port answers from memory, so it goes
  // in before the first render, as the person would set it. Nothing may wait:
  // the host's contract is synchronous. The simulator applies the preference
  // at once; a refusal or a failure is rethrown where the visual run sees it,
  // as an uncaught error on the page.
  void harness.ports.session
    .setPreference({ mode: scenario.mode })
    .then(failOnRefusal)
    .catch(reportOnThePage);

  // A part mounted alone builds its machine at its first render, so the
  // period is chosen before it, as the Journal's dialog opens over the period
  // the sidebar already holds. The simulators answer from memory: the books
  // are there when the part mounts.
  if (scenario.mount !== undefined && scenario.periodId !== undefined) {
    buildings.selectPeriod(scenario.periodId);
  }

  const app: App = {
    ...harness.app,
    machines: {
      ...machines,
      // The grid opens the scenario's rows, through its own toggle.
      createAccountsGrid: (): Machine<
        AccountsGridState,
        AccountsGridIntents
      > => {
        const grid = machines.createAccountsGrid();

        if (scenario.expanded !== undefined) {
          openOnly(grid, scenario.expanded);
        }

        return grid;
      },
      // The sidebar starts open as a drawer, through its own intent.
      createSidebar: (): Machine<SidebarState, SidebarIntents> => {
        const sidebar = machines.createSidebar();

        if (scenario.drawerOpen === true) {
          sidebar.intents.open();
        }

        return sidebar;
      },
      // The Journal grid opens the scenario's entries and shows the selected
      // one on its page, through its own intents.
      createJournalGrid: (): Machine<JournalGridState, JournalGridIntents> => {
        const grid = machines.createJournalGrid();

        for (const id of scenario.expandedEntries ?? []) {
          grid.intents.toggle(id);
        }

        if (scenario.selectedEntry !== undefined) {
          grid.intents.reveal(scenario.selectedEntry);
        }

        return grid;
      },
      // The Journal's dialog starts open, through its own intent.
      createJournalDialog: (): Machine<
        JournalDialogState,
        JournalDialogIntents
      > => {
        const dialog = machines.createJournalDialog();
        const wanted = scenario.dialog;

        if (wanted === "delete") {
          dialog.intents.openDelete();
        } else if (wanted !== undefined && "edit" in wanted) {
          dialog.intents.openEdit(wanted.edit);
        } else if (wanted !== undefined) {
          dialog.intents.openWizard(wanted.wizard);
        }

        return dialog;
      },
      // The generic wizard holds the scenario's description and lines, typed
      // one field at a time, as the person types them.
      // An edit's own entry and kind pass through.
      createGenericEntryWizard: (
        editing?: string | null,
        kind?: EntryKind,
      ): Machine<
        WizardState<GenericEntryForm, GenericEntrySummary>,
        WizardIntents<GenericEntryForm>
      > => {
        const wizard = machines.createGenericEntryWizard(editing, kind);
        const wanted = wizardDialog(scenario.dialog);

        if (wanted?.wizard === "genericEntry") {
          wizard.intents.edit({ description: wanted.description });
          wizard.intents.edit({ lines: wanted.lines });
        }

        return wizard;
      },
      // A direct payment holds the scenario's account and amount. Each edit
      // carries only its field, so the description stays the prefilled one.
      createDirectPaymentWizard: (
        kind: DirectPaymentKind,
        editing?: string | null,
      ): Machine<
        WizardState<DirectPaymentForm, DirectPaymentSummary>,
        WizardIntents<DirectPaymentForm>
      > => {
        const wizard = machines.createDirectPaymentWizard(kind, editing);
        const wanted = wizardDialog(scenario.dialog);

        if (wanted?.wizard === kind) {
          wizard.intents.edit({ targetId: wanted.targetId });
          wizard.intents.edit({ amount: wanted.amount });
        }

        return wizard;
      },
      // The New invoice wizard holds the scenario's fields, typed one at a
      // time in the order the scenario writes them, then moves to its step.
      createInvoiceWizard: (
        editing: string | null,
      ): Machine<
        WizardState<InvoiceForm, InvoiceSummary>,
        WizardIntents<InvoiceForm>
      > => {
        const wizard = machines.createInvoiceWizard(editing);
        const wanted = wizardDialog(scenario.dialog);

        if (wanted?.wizard === "invoice") {
          for (const [field, value] of Object.entries(wanted.form)) {
            wizard.intents.edit({ [field]: value });
          }

          moveToStep(wizard, wanted.step);
        }

        // Mounted alone, it stays on step 1 with the fields typed.
        for (const [field, value] of Object.entries(scenario.invoice ?? {})) {
          wizard.intents.edit({ [field]: value });
        }

        return wizard;
      },
      // The multi-cost wizard holds the scenario's fields, typed one at a
      // time: the description, the amount paid, then the lines.
      createMultiCostPaymentWizard: (
        editing?: string | null,
      ): Machine<
        WizardState<MultiCostPaymentForm, MultiCostPaymentSummary>,
        WizardIntents<MultiCostPaymentForm>
      > => {
        const wizard = machines.createMultiCostPaymentWizard(editing);
        const wanted = scenario.multiCost;

        if (wanted !== undefined) {
          wizard.intents.edit({ description: wanted.description });
          wizard.intents.edit({ amount: wanted.amount });
          wizard.intents.edit({ lines: wanted.lines });
        }

        return wizard;
      },
      // The Invoice payment wizard opens on its first step as it is.
      createInvoicePaymentWizard: (
        editing: string | null,
      ): Machine<
        WizardState<InvoicePaymentForm, InvoicePaymentSummary>,
        WizardIntents<InvoicePaymentForm>
      > => {
        return machines.createInvoicePaymentWizard(editing);
      },
      // The Opening balances wizard holds the scenario's rows over its
      // prefill, typed one row at a time, as the list types them.
      createOpeningBalancesWizard: (
        editing: string | null,
      ): Machine<
        WizardState<OpeningForm, OpeningSummary>,
        WizardIntents<OpeningForm>
      > => {
        const wizard = machines.createOpeningBalancesWizard(editing);
        const wanted = wizardDialog(scenario.dialog);

        if (wanted?.wizard === "openingBalances") {
          for (const [key, amount] of Object.entries(wanted.amounts)) {
            const { amounts } = wizard.state$.getValue().form;

            wizard.intents.edit({ amounts: { ...amounts, [key]: amount } });
          }
        }

        return wizard;
      },
      // The collection wizard holds the scenario's owner, moves to step 2,
      // and holds the amount typed there over the one prefilled.
      createCollectionWizard: (
        editing: string | null,
      ): Machine<
        WizardState<CollectionForm, CollectionSummary>,
        WizardIntents<CollectionForm>
      > => {
        const wizard = machines.createCollectionWizard(editing);
        const wanted = scenario.collection;

        if (wanted?.step === 2) {
          wizard.intents.edit({ personId: wanted.personId });
          moveToStep(wizard, 2);
          wizard.intents.edit({ amount: wanted.amount });
        }

        return wizard;
      },
      // The budget wizard holds the scenario's first due date and moves to
      // its step through its own Next.
      createBudgetInstallmentsWizard: (): Machine<
        WizardState<BudgetInstallmentsForm, BudgetInstallmentsSummary>,
        WizardIntents<BudgetInstallmentsForm, Result>
      > => {
        const wizard = machines.createBudgetInstallmentsWizard();
        const wanted = scenario.budgetInstallments;

        if (wanted !== undefined) {
          wizard.intents.edit({ firstDue: wanted.firstDue });
          moveToStep(wizard, wanted.step);
        }

        return wizard;
      },
    },
  };

  return {
    app,
    render:
      scenario.mount === undefined
        ? undefined
        : (): ReactElement => {
            return createElement(Mount, { scenario });
          },
    deliver: (): void => {
      // A part mounted alone has its state before the first render, but for
      // what is read only while it listens: the account's selection, and
      // the notices pressed.
      if (scenario.mount !== undefined) {
        deliverToPart(harness, scenario, clock);

        return;
      }

      // The period first: choosing one starts the selection again at Total.
      // The account's selection is read only while the screen listens, so
      // both arrive after the first render.
      const periodId = pagePeriod(scenario);

      buildings.selectPeriod(periodId);

      // A new opening needs the period without its seeded one: deleted
      // through the port, before the Journal's dialog asks the books for it.
      if (wizardDialog(scenario.dialog)?.wizard === "openingBalances") {
        deleteSeededOpening(harness, periodId);
      }

      if (scenario.selectedKey !== undefined) {
        accounts.select(scenario.selectedKey);
      }

      // The menu last: the Journal's grid and dialog are built when it
      // mounts, over the period already chosen.
      harness.app.navigation.intents.selectMenu(scenario.menu ?? "accounts");

      clock.tick(0);
    },
  };
}

/** What a part mounted alone takes after its first render; with nothing to take, the clock does not move. */
function deliverToPart(
  harness: AppHarness,
  scenario: Scenario,
  clock: HostClock,
): void {
  const stubbed = scenario.stubbed ?? [];

  if (scenario.selectedKey === undefined && stubbed.length === 0) {
    return;
  }

  if (scenario.selectedKey !== undefined) {
    harness.app.presenters.accounts.select(scenario.selectedKey);
  }

  for (const label of stubbed) {
    harness.app.notices.stub(label);
  }

  clock.tick(0);
}

/** The period a page shows: the sidebar always holds one. */
function pagePeriod(scenario: Scenario): string {
  if (scenario.periodId === undefined) {
    throw new Error(
      "a page shows the period the sidebar holds, and this scenario names none",
    );
  }

  return scenario.periodId;
}

/** The scenario's seed, with its accounts renamed. */
function seedOf(scenario: Scenario): LegacySeed {
  const seed =
    scenario.seed === "schedule"
      ? createScheduleSeed()
      : loadLegacySeed(legacySeedData);
  const { renamed } = scenario;

  if (renamed === undefined) {
    return seed;
  }

  return {
    ...seed,
    accounts: seed.accounts.map((account) => {
      return { ...account, name: renamed[account.id] ?? account.name };
    }),
  };
}

/** Toggles every row whose state differs from the wanted set, so exactly those rows are open. */
function openOnly(
  grid: Machine<AccountsGridState, AccountsGridIntents>,
  wanted: readonly string[],
): void {
  const open = new Set(grid.state$.getValue().expanded);
  const want = new Set(wanted);
  const differing = [
    ...[...open].filter((key) => {
      return !want.has(key);
    }),
    ...[...want].filter((key) => {
      return !open.has(key);
    }),
  ];

  for (const key of differing) {
    grid.intents.toggle(key);
  }
}

/** The dialog when it is a wizard on a new entry; null for none, an edit or the delete confirmation. */
function wizardDialog(dialog: Scenario["dialog"]): NewEntryDialog | null {
  if (dialog === undefined || dialog === "delete" || "edit" in dialog) {
    return null;
  }

  return dialog;
}

/**
 * The period's seeded opening entry, deleted through the journal port. The
 * simulator removes it before the promise settles, so the books no longer
 * hold it when the menu mounts. Nothing may wait (the host's contract is
 * synchronous); a refusal is rethrown on the page.
 */
function deleteSeededOpening(harness: AppHarness, periodId: string): void {
  const opening = harness.seed.entries.find((entry) => {
    return entry.periodId === periodId && entry.kind === "openingBalances";
  });

  if (opening === undefined) {
    throw new Error(`the period ${periodId} has no seeded opening entry`);
  }

  void harness.ports.journal
    .deleteEntry(opening.id)
    .then(failOnRefusal)
    .catch(reportOnThePage);
}

/** Moves a wizard on through its own Next until it stands on the step; a step whose verdict holds it back fails the scenario with the reason. */
function moveToStep<TForm, TSummary, TSaved extends Result>(
  wizard: Machine<WizardState<TForm, TSummary>, WizardIntents<TForm, TSaved>>,
  step: number,
): void {
  while (wizard.state$.getValue().step < step) {
    const before = wizard.state$.getValue();

    wizard.intents.next();

    if (wizard.state$.getValue().step === before.step) {
      throw new Error(
        `the scenario could not leave step ${before.step}: ${stepReason(before.stepVerdict)}`,
      );
    }
  }
}

/** Why a step's verdict refuses; a step that stays put on an accepting verdict is told as such. */
function stepReason(verdict: Result): string {
  return verdict.ok
    ? "its verdict accepts, yet the step did not move"
    : verdict.reason;
}

function failOnRefusal(result: Result): void {
  if (!result.ok) {
    throw new Error(`the scenario's write was refused: ${result.reason}`);
  }
}

/** The host's fake clock leaves microtasks alone, so this throw is never held back. */
function reportOnThePage(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}
