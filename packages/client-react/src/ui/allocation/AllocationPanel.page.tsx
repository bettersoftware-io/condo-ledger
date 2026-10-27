import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { AllocationGridState } from "@cl/client-core";
import { type AllocationRow, type Cents, cents } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import {
  AllocationPanel,
  type AllocationPanelProps,
} from "./AllocationPanel.tsx";
import { type PanelPage, panelIn } from "./panelGrid.page.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Allocation panel. */
export interface AllocationPanelPage extends PanelPage {
  /** The mode button's text, its caret included. */
  modeText: () => string;
  clickMode: () => Promise<void>;
  /** The open mode menu's items; none while it is closed. */
  menuItems: () => string[];
  chooseMenuItem: (label: string) => Promise<void>;
  /** Closes the open mode menu with Escape, choosing nothing. */
  closeMenu: () => Promise<void>;
  /** The names of the controls drawn disabled, in order. */
  disabledControls: () => string[];
  clickMaximize: () => Promise<void>;
  maximizeLabel: () => string;
}

/** Mounts the panel alone, in the budget mode, over the columns and rows given. */
export function mountAllocationPanel(
  props: Partial<AllocationPanelProps>,
): AllocationPanelPage {
  const user = userEvent.setup();
  const rendered = render(
    <AllocationPanel
      columns={[]}
      rows={[]}
      mode="budget"
      template=""
      maximized={false}
      onChooseMode={vi.fn()}
      onToggle={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
      onResize={vi.fn()}
      onToggleMaximize={vi.fn()}
      onStub={vi.fn()}
      {...props}
    />,
  );

  return allocationPanelIn(() => {
    return within(rendered.container).getByTestId(TESTIDS.allocationPanel);
  }, user);
}

/** The panel wherever it is drawn: alone, or on the screen. */
export function allocationPanelIn(
  root: () => HTMLElement,
  user: User,
): AllocationPanelPage {
  function modeButton(): HTMLElement {
    return within(root()).getByTestId(TESTIDS.allocationMode);
  }

  return {
    ...panelIn(root, user),
    modeText: (): string => {
      return modeButton().textContent ?? "";
    },
    clickMode: async (): Promise<void> => {
      await user.click(modeButton());
    },
    menuItems: (): string[] => {
      return within(root())
        .queryAllByTestId(TESTIDS.menuItem)
        .map((item) => {
          return item.textContent ?? "";
        });
    },
    chooseMenuItem: async (label: string): Promise<void> => {
      await user.click(within(root()).getByRole("menuitem", { name: label }));
    },
    closeMenu: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    disabledControls: (): string[] => {
      return Array.from(
        root().querySelectorAll<HTMLElement>("button:disabled, input:disabled"),
      ).map((control) => {
        return (
          control.getAttribute("aria-label") ??
          control.closest("label")?.textContent ??
          ""
        );
      });
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(root()).getByTestId(TESTIDS.panelMaximize));
    },
    maximizeLabel: (): string => {
      return (
        within(root())
          .getByTestId(TESTIDS.panelMaximize)
          .getAttribute("aria-label") ?? ""
      );
    },
  };
}

/** A row of the allocation: blank attributes, every amount 0.00, no children. */
export function createAllocationRow(
  key: string,
  overrides: Partial<AllocationRow> = {},
): AllocationRow {
  const zero: Cents = cents(0);

  return {
    key,
    kind: "resident",
    label: key,
    role: "",
    restriction: "",
    days: "",
    amounts: [zero, zero],
    total: zero,
    previousBalance: zero,
    due: zero,
    paid: zero,
    children: [],
    ...overrides,
  };
}

/** The grid machine's rows for these rows of the allocation, every one open, the children after their parent. */
export function createAllocationGridRows(
  nodes: AllocationRow[],
  depth = 0,
): AllocationGridState["rows"] {
  return nodes.flatMap((node) => {
    return [
      {
        key: node.key,
        node,
        depth,
        hasChildren: node.children.length > 0,
        expanded: node.children.length > 0,
      },
      ...createAllocationGridRows(node.children, depth + 1),
    ];
  });
}
