import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { Dialog, type DialogProps } from "./Dialog.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a dialog. */
export interface DialogPage {
  title: () => string;
  /** Whether assistive technology finds a dialog by this name. */
  isNamed: (name: string) => boolean;
  isModal: () => boolean;
  /** Whether the card shows this text, in its body or its footer. */
  shows: (text: string) => boolean;
  width: () => string;
  isCardFocused: () => boolean;
  press: (key: string) => void;
  clickScrim: () => Promise<void>;
  clickTitle: () => Promise<void>;
}

export function mountDialog(props: Partial<DialogProps>): DialogPage {
  const user = userEvent.setup();
  const rendered = render(
    <Dialog
      title="Dialog"
      onClose={vi.fn()}
      footer={<span>Footer</span>}
      {...props}
    >
      {props.children ?? <p>Body</p>}
    </Dialog>,
  );

  function card(): HTMLElement {
    return rendered.getByTestId(TESTIDS.dialog);
  }

  return {
    title: (): string => {
      return rendered.getByTestId(TESTIDS.dialogTitle).textContent ?? "";
    },
    isNamed: (name: string): boolean => {
      return rendered.queryByRole("dialog", { name }) !== null;
    },
    isModal: (): boolean => {
      return card().getAttribute("aria-modal") === "true";
    },
    shows: (text: string): boolean => {
      return (card().textContent ?? "").includes(text);
    },
    width: (): string => {
      return card().dataset.width ?? "";
    },
    isCardFocused: (): boolean => {
      return document.activeElement === card();
    },
    press: (key: string): void => {
      fireEvent.keyDown(card(), { key });
    },
    clickScrim: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.dialogClose));
    },
    clickTitle: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.dialogTitle));
    },
  };
}
