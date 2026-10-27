import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type {
  AllocationRow,
  CoefficientNode,
  Language,
  LegacySeed,
} from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { AppRoot } from "../shell/AppRoot.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";
import {
  type AllocationPanelPage,
  allocationPanelIn,
} from "./AllocationPanel.page.tsx";
import {
  type CoefficientsPanelPage,
  coefficientsPanelIn,
} from "./CoefficientsPanel.page.tsx";
import {
  type ThousandthTablesPanelPage,
  thousandthTablesPanelIn,
} from "./ThousandthTablesPanel.page.tsx";

/** How the screen's two splits stand: the tables' row's share of the height, and the tables' share of that row. */
interface SplitRatios {
  rows: number;
  columns: number;
}

/** What a test can do with, and ask of, the Thousandth Tables & Allocation screen. */
export interface TablesAllocationScreenPage {
  /** The three panels' titles, in the order drawn. */
  titles: () => string[];
  tables: ThousandthTablesPanelPage;
  coefficients: CoefficientsPanelPage;
  allocation: AllocationPanelPage;
  /** The label of the unit's row in the selected table's coefficients: a test never spells a person's name. */
  labelOfUnit: (unitId: string) => string;
  /** The label of the resident's row in the allocation shown. */
  labelOfResident: (residentId: string) => string;
  toasts: () => string[];
  /** The person picks another language, as the top bar's picker does. */
  pickLanguage: (language: Language) => Promise<void>;
  /** Which panel fills the screen: bottom (the Allocation) or none. */
  maximized: () => string | null;
  splitRatios: () => SplitRatios;
  /** Drags the splitter above the Allocation on a screen of the given height. */
  dragRowsSplitter: (by: number, screenHeight: number) => void;
  /** Drags the splitter between the tables and their coefficients on a row of the given width. */
  dragColumnsSplitter: (by: number, rowWidth: number) => void;
}

/**
 * Mounts the shell on Thousandth Tables & Allocation over the real seed, on
 * this period (p1 Saturno 2011, p36 Pozzetto 2013), or over the seed given
 * on its first period, if it has one.
 */
export function mountTablesAllocation(
  periodId: string | null,
  seed?: LegacySeed,
): TablesAllocationScreenPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(seed);

  if (periodId !== null) {
    app.presenters.buildings.selectPeriod(periodId);
  }

  app.navigation.intents.selectMenu("thousandths");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.tablesAllocationScreen);
  }

  function inScreen(testId: string): () => HTMLElement {
    return (): HTMLElement => {
      return within(screen()).getByTestId(testId);
    };
  }

  function top(): HTMLElement {
    const row = screen().querySelector<HTMLElement>(".allocation-top");

    if (row === null) {
      throw new Error("missing: the tables' row");
    }

    return row;
  }

  function selectedTableId(): string | null {
    const panel = rendered.getByTestId(TESTIDS.thousandthTablesPanel);
    const selected = within(panel)
      .queryAllByTestId(TESTIDS.treeGridRow)
      .find((row) => {
        return row.getAttribute("aria-selected") === "true";
      });
    const name = selected?.querySelector(".tree-grid-text")?.textContent;

    return (
      app.presenters.allocation.tables$.getValue().find((view) => {
        return view.table.name === name;
      })?.table.id ?? null
    );
  }

  function splitter(direction: string): HTMLElement {
    const found = within(screen())
      .getAllByTestId(TESTIDS.splitter)
      .find((candidate) => {
        return candidate.getAttribute("data-direction") === direction;
      });

    if (found === undefined) {
      throw new Error(`missing: the ${direction} splitter`);
    }

    return found;
  }

  function ratioOf(element: HTMLElement, property: string): number {
    return Number.parseFloat(element.style.getPropertyValue(property));
  }

  return {
    titles: (): string[] => {
      return within(screen())
        .getAllByTestId(TESTIDS.panelTitle)
        .map((title) => {
          return title.textContent ?? "";
        });
    },
    tables: thousandthTablesPanelIn(
      inScreen(TESTIDS.thousandthTablesPanel),
      user,
    ),
    coefficients: coefficientsPanelIn(
      inScreen(TESTIDS.coefficientsPanel),
      user,
    ),
    allocation: allocationPanelIn(inScreen(TESTIDS.allocationPanel), user),
    labelOfUnit: (unitId: string): string => {
      const nodes = app.presenters.allocation
        .coefficients$(selectedTableId())
        .getValue();

      return labelIn(nodes, `unit:${unitId}`);
    },
    labelOfResident: (residentId: string): string => {
      // A resident's label is the same in either mode.
      const root = app.presenters.allocation
        .allocation$("budget")
        .getValue()?.root;

      return labelIn(
        root === undefined ? [] : [root],
        `resident:${residentId}`,
      );
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    pickLanguage: async (language: Language): Promise<void> => {
      await act(async () => {
        await app.presenters.session.setLanguage(language);
      });
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    splitRatios: (): SplitRatios => {
      return {
        rows: ratioOf(screen(), "--rows-split"),
        columns: ratioOf(screen(), "--columns-split"),
      };
    },
    dragRowsSplitter: (by: number, screenHeight: number): void => {
      screen().getBoundingClientRect = (): DOMRect => {
        return { height: screenHeight } as DOMRect;
      };

      dragSplitterElement(splitter("horizontal"), [by]);
    },
    dragColumnsSplitter: (by: number, rowWidth: number): void => {
      top().getBoundingClientRect = (): DOMRect => {
        return { width: rowWidth } as DOMRect;
      };

      dragSplitterElement(splitter("vertical"), [by]);
    },
  };
}

/** A node of the coefficients or of the allocation: a key and the nodes under it. */
type Labelled = CoefficientNode | AllocationRow;

/** The label of the node with this key, wherever it is in the trees. */
function labelIn(nodes: Labelled[], key: string): string {
  const found = findLabel(nodes, key);

  if (found === null) {
    throw new Error(`No row for ${key}`);
  }

  return found;
}

function findLabel(nodes: Labelled[], key: string): string | null {
  for (const node of nodes) {
    if (node.key === key) {
      return node.label;
    }

    const children: Labelled[] = node.children;
    const found = findLabel(children, key);

    if (found !== null) {
      return found;
    }
  }

  return null;
}
