import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { ScheduleNode } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { AppRoot } from "../shell/AppRoot.tsx";
import { TESTIDS } from "../testids.ts";
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
}

/** Mounts the shell on the Installment Schedule over the real seed, on this period (p36 Pozzetto 2013, p1 Saturno 2011). */
export function mountInstallmentSchedule(
  periodId: string,
): InstallmentScheduleScreenPage {
  const user = userEvent.setup();
  const { app } = createAppHarness();

  app.presenters.buildings.selectPeriod(periodId);
  app.navigation.intents.selectMenu("installments");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

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
  };
}
