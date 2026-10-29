import { act, render, within } from "@testing-library/react";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { AccountDetails } from "./AccountDetails.tsx";
import {
  type AllocationTablesGridPage,
  allocationTablesGridIn,
} from "./AllocationTablesGrid.page.tsx";

/** What a test can do with, and ask of, the selected account's details. */
export interface AccountDetailsPage {
  /** Selects an account app-wide, as a click on its row would. */
  select: (key: string) => Promise<void>;
  labels: () => string[];
  valueOf: (label: string) => string;
  toneOf: (label: string) => string | undefined;
  hasGroup: (legend: string) => boolean;
  textOf: (legend: string) => string;
  /** Whether the row's checkbox, named by the row's label, is checked and can be changed. */
  checkboxOf: (label: string) => CheckboxState;
  /** The ALLOCATION TABLES mini-grid, while the account has tables. */
  tables: AllocationTablesGridPage;
}

interface CheckboxState {
  checked: boolean;
  disabled: boolean;
}

/** Mounts the details over the real application on the small books, or on the seed given; on its first period, or the one given. */
export function mountAccountDetails(
  seed: LegacySeed = createSmallSeed(),
  periodId: string | null = null,
): AccountDetailsPage {
  const { app } = createAppHarness(seed);

  if (periodId !== null) {
    app.presenters.buildings.selectPeriod(periodId);
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AccountDetails />
    </ViewModelProvider>,
  );

  function rows(): HTMLElement[] {
    return rendered.queryAllByTestId(TESTIDS.schedaRow);
  }

  function labelOf(row: HTMLElement): string {
    return row.querySelector(".scheda-label")?.textContent ?? "";
  }

  function valueElement(label: string): HTMLElement {
    const value = rows()
      .find((row) => {
        return labelOf(row) === label;
      })
      ?.querySelector<HTMLElement>(".scheda-value");

    if (value === null || value === undefined) {
      throw new Error(`no row labelled ${label}`);
    }

    return value;
  }

  function group(legend: string): HTMLElement {
    return rendered.getByRole("group", { name: legend });
  }

  return {
    select: async (key: string): Promise<void> => {
      await act(async () => {
        app.presenters.accounts.select(key);
      });
    },
    labels: (): string[] => {
      return rows().map(labelOf);
    },
    valueOf: (label: string): string => {
      return valueElement(label).textContent ?? "";
    },
    toneOf: (label: string): string | undefined => {
      return valueElement(label).dataset.tone;
    },
    hasGroup: (legend: string): boolean => {
      return rendered.queryByRole("group", { name: legend }) !== null;
    },
    textOf: (legend: string): string => {
      return (
        group(legend).querySelector(".account-details-note")?.textContent ?? ""
      );
    },
    tables: allocationTablesGridIn(() => {
      return rendered.container;
    }),
    checkboxOf: (label: string): CheckboxState => {
      const box = within(valueElement(label)).getByRole("checkbox", {
        name: label,
      });

      if (!(box instanceof HTMLInputElement)) {
        throw new Error(`no checkbox on ${label}`);
      }

      return { checked: box.checked, disabled: box.disabled };
    },
  };
}
