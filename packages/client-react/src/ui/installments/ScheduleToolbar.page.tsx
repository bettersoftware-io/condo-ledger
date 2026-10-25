import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { TESTIDS } from "../testids.ts";
import {
  ScheduleToolbar,
  type ScheduleToolbarProps,
} from "./ScheduleToolbar.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the schedule's toolbar. */
export interface ScheduleToolbarPage {
  groupByText: () => string;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  /** Whether the tool says it opens a menu, and whether that menu is open. */
  toolMenu: (label: string) => string | null;
  /** The open menu's items. */
  menuItems: () => string[];
  /** What the open menu says when it has no item; null when it has items or none is open. */
  menuEmptyText: () => string | null;
  clickMenuItem: (label: string) => Promise<void>;
  /** Presses Escape where the keyboard is: in an open menu, it closes. */
  pressEscape: () => Promise<void>;
}

/** Mounts the toolbar alone, over no installment unless the props say otherwise. */
export function mountScheduleToolbar(
  props: Partial<ScheduleToolbarProps>,
): ScheduleToolbarPage {
  const user = userEvent.setup();
  const rendered = render(
    <ScheduleToolbar
      installments={[]}
      onCreateBudget={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
      onStub={vi.fn()}
      {...props}
    />,
  );

  return scheduleToolbarIn(() => {
    return rendered.container;
  }, user);
}

/** The toolbar wherever it is drawn: alone, or on the screen. */
export function scheduleToolbarIn(
  root: () => HTMLElement,
  user: User,
): ScheduleToolbarPage {
  function tool(label: string): HTMLButtonElement {
    return within(root()).getByRole<HTMLButtonElement>("button", {
      name: label,
    });
  }

  return {
    groupByText: (): string => {
      return (
        within(root()).getByTestId(TESTIDS.scheduleGroupBy).textContent ?? ""
      );
    },
    toolLabels: (): string[] => {
      return within(root())
        .getAllByTestId(TESTIDS.toolbarButton)
        .map((button) => {
          return button.getAttribute("aria-label") ?? "";
        });
    },
    clickTool: async (label: string): Promise<void> => {
      await user.click(tool(label));
    },
    toolMenu: (label: string): string | null => {
      const button = tool(label);
      const popup = button.getAttribute("aria-haspopup");

      return popup === null
        ? null
        : `${popup} ${button.getAttribute("aria-expanded") === "true" ? "open" : "closed"}`;
    },
    menuItems: (): string[] => {
      return within(root())
        .queryAllByTestId(TESTIDS.menuItem)
        .map((item) => {
          return item.textContent ?? "";
        });
    },
    menuEmptyText: (): string | null => {
      return (
        within(root()).queryByTestId(TESTIDS.scheduleMenuEmpty)?.textContent ??
        null
      );
    },
    clickMenuItem: async (label: string): Promise<void> => {
      await user.click(within(root()).getByRole("menuitem", { name: label }));
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
  };
}
