import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { TableView } from "@cl/client-core";

import { TESTIDS } from "../testids.ts";
import { type PanelPage, panelIn } from "./panelGrid.page.tsx";
import {
  ThousandthTablesPanel,
  type ThousandthTablesPanelProps,
} from "./ThousandthTablesPanel.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Thousandth Tables panel. */
export type ThousandthTablesPanelPage = PanelPage;

/** Mounts the panel alone, over the tables given and no selection. */
export function mountThousandthTablesPanel(
  props: Partial<ThousandthTablesPanelProps>,
): ThousandthTablesPanelPage {
  const user = userEvent.setup();
  const rendered = render(
    <ThousandthTablesPanel
      tables={[]}
      selectedTableId={null}
      template=""
      onSelect={vi.fn()}
      onResize={vi.fn()}
      onStub={vi.fn()}
      {...props}
    />,
  );

  return thousandthTablesPanelIn(() => {
    return within(rendered.container).getByTestId(
      TESTIDS.thousandthTablesPanel,
    );
  }, user);
}

/** The panel wherever it is drawn: alone, or on the screen. */
export function thousandthTablesPanelIn(
  root: () => HTMLElement,
  user: User,
): ThousandthTablesPanelPage {
  return panelIn(root, user);
}

/** A table of the panel: its view as the presenter gives it. */
export function createTableView(
  id: string,
  overrides: Partial<TableView> = {},
): TableView {
  return {
    table: {
      id,
      periodId: "p1",
      name: `Table ${id}`,
      order: 1,
      notes: "",
      restrictionGroupId: null,
    },
    total: 0,
    restriction: "",
    ...overrides,
  };
}
