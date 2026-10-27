import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { CoefficientsGridState } from "@cl/client-core";
import type { CoefficientNode, Result } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import {
  CoefficientsPanel,
  type CoefficientsPanelProps,
} from "./CoefficientsPanel.tsx";
import { type PanelPage, panelIn } from "./panelGrid.page.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Table Coefficients panel. */
export interface CoefficientsPanelPage extends PanelPage {
  /** Opens the editor of the unit's coefficient. */
  clickCoefficient: (label: string) => Promise<void>;
  /** Whether the row's coefficient opens an editor on a click. */
  isEditable: (label: string) => boolean;
  editorOpen: () => boolean;
  /** The open editor's text. */
  editorText: () => string;
  /** Replaces the open editor's text. */
  typeCoefficient: (text: string) => Promise<void>;
  pressEnter: () => Promise<void>;
  pressEscape: () => Promise<void>;
  /** Leaves the open editor by clicking outside it, as the person does. */
  blur: () => Promise<void>;
  /** What the open editor says is wrong, if anything. */
  editorError: () => string | null;
}

/** Mounts the panel alone, over the rows given. */
export function mountCoefficientsPanel(
  props: Partial<CoefficientsPanelProps>,
): CoefficientsPanelPage {
  const user = userEvent.setup();
  const rendered = render(
    <CoefficientsPanel
      rows={[]}
      template=""
      onToggle={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
      onResize={vi.fn()}
      onSetCoefficient={vi.fn()}
      onStub={vi.fn()}
      {...props}
    />,
  );

  return coefficientsPanelIn(() => {
    return within(rendered.container).getByTestId(TESTIDS.coefficientsPanel);
  }, user);
}

/** The panel wherever it is drawn: alone, or on the screen. */
export function coefficientsPanelIn(
  root: () => HTMLElement,
  user: User,
): CoefficientsPanelPage {
  function rowOf(label: string): HTMLElement {
    const row = within(root())
      .queryAllByTestId(TESTIDS.treeGridRow)
      .find((candidate) => {
        return (
          candidate.querySelector(".tree-grid-text")?.textContent === label
        );
      });

    if (row === undefined) {
      throw new Error(`No row labelled ${label}`);
    }

    return row;
  }

  function editor(): HTMLInputElement {
    return within(root()).getByTestId<HTMLInputElement>(TESTIDS.inlineEditor);
  }

  return {
    ...panelIn(root, user),
    clickCoefficient: async (label: string): Promise<void> => {
      await user.click(
        within(rowOf(label)).getByTestId(TESTIDS.coefficientCell),
      );
    },
    isEditable: (label: string): boolean => {
      return (
        within(rowOf(label)).queryByTestId(TESTIDS.coefficientCell) !== null
      );
    },
    editorOpen: (): boolean => {
      return within(root()).queryByTestId(TESTIDS.inlineEditor) !== null;
    },
    editorText: (): string => {
      return editor().value;
    },
    typeCoefficient: async (text: string): Promise<void> => {
      await user.clear(editor());
      await user.type(editor(), text);
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    blur: async (): Promise<void> => {
      await user.click(document.body);
    },
    editorError: (): string | null => {
      return (
        within(root()).queryByTestId(TESTIDS.inlineEditorError)?.textContent ??
        null
      );
    },
  };
}

/** Coefficient writes whose verdicts wait for a release. */
export interface HeldVerdicts {
  /** Stands for the panel's write: answers when released. */
  save: () => Promise<Result>;
  /** Hands every waiting write this verdict, and lets React render what follows. */
  release: (result: Result) => Promise<void>;
}

export function holdVerdicts(): HeldVerdicts {
  const waiting: ((result: Result) => void)[] = [];

  return {
    save: async (): Promise<Result> => {
      return await new Promise<Result>((resolve) => {
        waiting.push(resolve);
      });
    },
    release: async (result: Result): Promise<void> => {
      await act(async () => {
        for (const resolve of waiting.splice(0)) {
          resolve(result);
        }

        await Promise.resolve();
      });
    },
  };
}

/** The grid machine's rows for these nodes, every one open, the nodes' children after them. */
export function createCoefficientRows(
  nodes: CoefficientNode[],
  depth = 0,
): CoefficientsGridState["rows"] {
  return nodes.flatMap((node) => {
    return [
      {
        key: node.key,
        node,
        depth,
        hasChildren: node.children.length > 0,
        expanded: node.children.length > 0,
      },
      ...createCoefficientRows(node.children, depth + 1),
    ];
  });
}

/** A unit's coefficient, or a group's sum over its children. */
export function createCoefficientNode(
  key: string,
  overrides: Partial<CoefficientNode> = {},
): CoefficientNode {
  return {
    key,
    kind: key.startsWith("group:") ? "group" : "unit",
    label: key,
    period: "",
    value: 0,
    children: [],
    ...overrides,
  };
}
