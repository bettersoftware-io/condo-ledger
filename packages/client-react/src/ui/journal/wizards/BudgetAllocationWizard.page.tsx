import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "#/ui/testids.ts";

import { BudgetAllocationWizard } from "./BudgetAllocationWizard.tsx";
import {
  type WizardDialogPage,
  wizardDialogPage,
} from "./WizardDialog.page.tsx";

/** What a test can do with, and ask of, the Budget allocation wizard mounted alone. */
export interface BudgetAllocationWizardPage
  extends Pick<
    WizardDialogPage,
    | "title"
    | "contextLine"
    | "fill"
    | "fieldValue"
    | "previewRows"
    | "message"
    | "isSaveDisabled"
    | "save"
    | "cancel"
  > {
  /** The text under the description. */
  helperText: () => string;
  /** The ids the wizard handed over as saved, in order. */
  saved: () => string[];
  /** How many times the wizard asked to close without saving. */
  cancels: () => number;
}

/** Where the wizard is mounted: the seed (the real one by default), its period, and the entries deleted before it opens. */
export interface BudgetAllocationMount {
  seed?: LegacySeed;
  /** The period chosen in the real seed; the seed's first otherwise. */
  periodId?: string;
  deleting?: string[];
}

/** Mounts the wizard alone, as the Journal opens it, once the entries to delete are gone. */
export async function mountBudgetAllocationWizard(
  mount: BudgetAllocationMount = {},
): Promise<BudgetAllocationWizardPage> {
  const user = userEvent.setup();
  const { app } = createAppHarness(mount.seed);
  const saved: string[] = [];
  let cancels = 0;

  if (mount.periodId !== undefined) {
    app.presenters.buildings.selectPeriod(mount.periodId);
  }

  for (const entryId of mount.deleting ?? []) {
    const deleted = await app.presenters.journal.deleteEntry(entryId);

    if (!deleted.ok) {
      throw new Error(
        `the entry ${entryId} was not deleted: ${deleted.reason}`,
      );
    }
  }

  function recordSaved(entryId: string): void {
    saved.push(entryId);
  }

  function recordCancel(): void {
    cancels += 1;
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <BudgetAllocationWizard onSaved={recordSaved} onCancel={recordCancel} />
    </ViewModelProvider>,
  );
  const wizard = wizardDialogPage(rendered, user);

  return {
    title: wizard.title,
    contextLine: wizard.contextLine,
    fill: wizard.fill,
    fieldValue: wizard.fieldValue,
    previewRows: wizard.previewRows,
    message: wizard.message,
    isSaveDisabled: wizard.isSaveDisabled,
    save: wizard.save,
    cancel: wizard.cancel,
    helperText: (): string => {
      return (
        within(rendered.getByTestId(TESTIDS.dialog)).getByTestId(
          TESTIDS.budgetAllocationHelper,
        ).textContent ?? ""
      );
    },
    saved: (): string[] => {
      return saved;
    },
    cancels: (): number => {
      return cancels;
    },
  };
}
