import { act, type RenderResult, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { App } from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed, ScheduleNode } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { AppRoot } from "../shell/AppRoot.tsx";
import { TESTIDS } from "../testids.ts";
import {
  type BudgetInstallmentsWizardPage,
  budgetInstallmentsWizardIn,
} from "./BudgetInstallmentsWizard.page.tsx";
import {
  type InstallmentDialogPage,
  installmentDialogIn,
} from "./InstallmentDialog.page.tsx";
import { type ScheduleGridPage, scheduleGridIn } from "./ScheduleGrid.page.tsx";
import {
  type ScheduleToolbarPage,
  scheduleToolbarIn,
} from "./ScheduleToolbar.page.tsx";

/** What a test can do with, and ask of, the Installment Schedule screen. */
export interface InstallmentScheduleScreenPage {
  title: () => string;
  grid: ScheduleGridPage;
  toolbar: ScheduleToolbarPage;
  /** The label of the resident's row, as the schedule names it: a test never spells a person's name. */
  labelOfResident: (residentId: string) => string;
  confirmOpen: () => boolean;
  confirmText: () => string;
  confirmError: () => string | null;
  confirmYes: () => Promise<void>;
  confirmNo: () => Promise<void>;
  toasts: () => string[];
  maximized: () => string | null;
  clickMaximize: () => Promise<void>;
  /** The Create Budget Installments wizard open over the screen. */
  budgetWizard: BudgetInstallmentsWizardPage;
  /** The Edit Installment dialog open over the screen. */
  installmentDialog: InstallmentDialogPage;
  /** Switches to the Journal screen through the sidebar. */
  openJournal: () => Promise<void>;
  /** The installment with this name is renamed in the store, as if from another window. */
  renameElsewhere: (name: string, newName: string) => Promise<void>;
}

/** Where the schedule is mounted: the render, the person, and the application under it. */
export interface ScheduleMount {
  rendered: RenderResult;
  user: ReturnType<typeof userEvent.setup>;
  app: App;
}

/**
 * Mounts the shell on the Installment Schedule over the real seed, on this
 * period (p36 Pozzetto 2013, p1 Saturno 2011), or over the seed given (the
 * schedule seed's p3 has books and no installment).
 */
export function mountInstallmentSchedule(
  periodId: string,
  seed?: LegacySeed,
): InstallmentScheduleScreenPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(seed);

  app.presenters.buildings.selectPeriod(periodId);
  app.navigation.intents.selectMenu("installments");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  return installmentScheduleIn({ rendered, user, app });
}

/** The Installment Schedule in a mounted shell, whichever screen it was mounted on: it is looked for when asked. */
export function installmentScheduleIn({
  rendered,
  user,
  app,
}: ScheduleMount): InstallmentScheduleScreenPage {
  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.installmentScheduleScreen);
  }

  function residentNode(
    node: ScheduleNode,
    residentId: string,
  ): ScheduleNode | null {
    if (node.residentId === residentId) {
      return node;
    }

    for (const child of node.children) {
      const found = residentNode(child, residentId);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  return {
    title: (): string => {
      return within(screen()).getByTestId(TESTIDS.panelTitle).textContent ?? "";
    },
    grid: scheduleGridIn(() => {
      return within(screen()).getByTestId(TESTIDS.treeGrid);
    }, user),
    toolbar: scheduleToolbarIn(screen, user),
    labelOfResident: (residentId: string): string => {
      const root = app.presenters.schedule.schedule$.getValue()?.root;
      const node = root === undefined ? null : residentNode(root, residentId);

      if (node === null) {
        throw new Error(`No row for the resident ${residentId}`);
      }

      return node.label;
    },
    confirmOpen: (): boolean => {
      return rendered.queryByTestId(TESTIDS.confirmText) !== null;
    },
    confirmText: (): string => {
      return rendered.getByTestId(TESTIDS.confirmText).textContent ?? "";
    },
    confirmError: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmError)?.textContent ?? null;
    },
    confirmYes: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmYes));
    },
    confirmNo: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmNo));
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(screen()).getByTestId(TESTIDS.panelMaximize));
    },
    budgetWizard: budgetInstallmentsWizardIn(rendered, user),
    installmentDialog: installmentDialogIn(rendered, user),
    renameElsewhere: async (name: string, newName: string): Promise<void> => {
      const installment = app.presenters.schedule.schedule$
        .getValue()
        ?.installments.find((candidate) => {
          return candidate.name === name;
        });

      if (installment === undefined) {
        throw new Error(`No installment named ${name}`);
      }

      const result = await act(() => {
        return app.presenters.schedule.updateInstallment(installment.id, {
          name: newName,
        });
      });

      if (!result.ok) {
        throw new Error(`The rename was refused: ${result.reason}`);
      }
    },
    openJournal: async (): Promise<void> => {
      await user.click(
        within(rendered.getByTestId(TESTIDS.sidebar)).getByRole("button", {
          name: "Journal & Daybook",
        }),
      );
    },
  };
}
