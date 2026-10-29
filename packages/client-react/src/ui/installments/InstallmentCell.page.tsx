import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { cents } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import {
  InstallmentCell,
  type InstallmentCellProps,
} from "./InstallmentCell.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, one installment cell. */
export interface InstallmentCellPage {
  text: () => string;
  /** The settlement it is coloured by; null when it has no colour. */
  status: () => string | null;
  /** The tooltip: why it cannot be edited; null when it has none. */
  title: () => string | null;
  /** Whether a click opens its editor. */
  isEditable: () => boolean;
  isBold: () => boolean;
  click: () => Promise<void>;
  isEditing: () => boolean;
  /** The text the editor holds. */
  editorText: () => string;
  /** Whether the open editor is a text box by this name. */
  isEditorNamed: (name: string) => boolean;
  /** Replaces the editor's text. */
  type: (text: string) => Promise<void>;
  /** Presses Enter in the editor, and lets the verdict it waits for arrive. */
  pressEnter: () => Promise<void>;
  pressEscape: () => Promise<void>;
  errorText: () => string | null;
}

/** Mounts one cell alone, with an unpaid, editable amount unless the props say otherwise. */
export function mountInstallmentCell(
  props: Partial<InstallmentCellProps>,
): InstallmentCellPage {
  const user = userEvent.setup();
  const rendered = render(
    <InstallmentCell
      label="Installment 1 of Resident r1"
      amount={cents(1000)}
      status="unsettled"
      emphasis={false}
      editable={true}
      refusal={null}
      editing={false}
      error={null}
      onEdit={vi.fn()}
      onCommit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

  return installmentCellIn(() => {
    return within(rendered.container).getByTestId(TESTIDS.installmentCell);
  }, user);
}

/** One installment cell wherever it is drawn: alone, or in a grid's row. */
export function installmentCellIn(
  cell: () => HTMLElement,
  user: User,
): InstallmentCellPage {
  function editor(): HTMLInputElement {
    return within(cell()).getByTestId<HTMLInputElement>(TESTIDS.inlineEditor);
  }

  return {
    text: (): string => {
      return cell().textContent ?? "";
    },
    status: (): string | null => {
      return cell().getAttribute("data-status");
    },
    title: (): string | null => {
      return cell().getAttribute("title");
    },
    isEditable: (): boolean => {
      return cell().tagName === "BUTTON";
    },
    isBold: (): boolean => {
      return (
        within(cell())
          .getByTestId(TESTIDS.money)
          .getAttribute("data-emphasis") === "true"
      );
    },
    click: async (): Promise<void> => {
      await user.click(cell());
    },
    isEditing: (): boolean => {
      return within(cell()).queryByTestId(TESTIDS.inlineEditor) !== null;
    },
    editorText: (): string => {
      return editor().value;
    },
    isEditorNamed: (name: string): boolean => {
      return within(cell()).queryByRole("textbox", { name }) !== null;
    },
    type: async (text: string): Promise<void> => {
      await user.clear(editor());
      await user.type(editor(), text);
    },
    pressEnter: async (): Promise<void> => {
      editor().focus();
      await user.keyboard("{Enter}");
    },
    pressEscape: async (): Promise<void> => {
      editor().focus();
      await user.keyboard("{Escape}");
    },
    errorText: (): string | null => {
      return (
        within(cell()).queryByTestId(TESTIDS.inlineEditorError)?.textContent ??
        null
      );
    },
  };
}
