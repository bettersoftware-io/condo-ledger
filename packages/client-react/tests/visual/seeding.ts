import type {
  AccountsGridIntents,
  AccountsGridState,
  App,
  GenericEntryForm,
  GenericEntrySummary,
  JournalDialogIntents,
  JournalDialogState,
  JournalGridIntents,
  JournalGridState,
  Machine,
  SidebarIntents,
  SidebarState,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { type LegacySeed, loadLegacySeed, type Result } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import type { HostClock, Seeded } from "./host/seeded.ts";
import type { Scenario } from "./scenarios.ts";

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
        } else if (wanted !== undefined) {
          dialog.intents.openWizard(wanted.wizard);
        }

        return dialog;
      },
      // The generic wizard holds the scenario's description and lines, typed
      // one field at a time, as the person types them.
      createGenericEntryWizard: (): Machine<
        WizardState<GenericEntryForm, GenericEntrySummary>,
        WizardIntents<GenericEntryForm>
      > => {
        const wizard = machines.createGenericEntryWizard();
        const wanted = scenario.dialog;

        if (typeof wanted === "object" && wanted.wizard === "genericEntry") {
          wizard.intents.edit({ description: wanted.description });
          wizard.intents.edit({ lines: wanted.lines });
        }

        return wizard;
      },
    },
  };

  return {
    app,
    deliver: (): void => {
      // The period first: choosing one starts the selection again at Total.
      // The account's selection is read only while the screen listens, so
      // both arrive after the first render.
      buildings.selectPeriod(scenario.periodId);

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

/** The real seed, with the scenario's accounts renamed. */
function seedOf(scenario: Scenario): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);
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

function failOnRefusal(result: Result): void {
  if (!result.ok) {
    throw new Error(`the scenario's mode was refused: ${result.reason}`);
  }
}

/** The host's fake clock leaves microtasks alone, so this throw is never held back. */
function reportOnThePage(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}
