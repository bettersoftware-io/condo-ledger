import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can ask of the Installment Schedule. */
export interface InstallmentSchedulePage {
  /** The labels of the schedule's rows shown, top to bottom, read in one step: a unit of several residents (`B1`) over their names. */
  rowLabels: () => Promise<string[]>;
}

export function createInstallmentSchedulePage(
  page: Page,
): InstallmentSchedulePage {
  const rows = page
    .getByTestId(TESTIDS.installmentScheduleScreen)
    .getByTestId(TESTIDS.treeGridRow);

  return {
    rowLabels: async (): Promise<string[]> => {
      return rows.evaluateAll((elements) => {
        return elements.map((element) => {
          return (
            element.querySelector(".tree-grid-text")?.textContent?.trim() ?? ""
          );
        });
      });
    },
  };
}
