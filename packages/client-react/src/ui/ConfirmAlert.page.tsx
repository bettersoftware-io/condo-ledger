import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ConfirmAlert, type ConfirmAlertProps } from "./ConfirmAlert.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a confirm alert. */
export interface ConfirmAlertPage {
  title: () => string;
  width: () => string;
  text: () => string;
  errorText: () => string | null;
  yes: () => Promise<void>;
  no: () => Promise<void>;
  pressEscape: () => void;
  /** The text of the button that has the keyboard's focus; null when no button has it. */
  focusedButton: () => string | null;
  /** Whether assistive technology finds an alert dialog named Notice that reads this after its name. */
  isAlertDescribedAs: (description: string) => boolean;
}

export function mountConfirmAlert(
  props: Partial<ConfirmAlertProps>,
): ConfirmAlertPage {
  const user = userEvent.setup();
  const rendered = render(
    <ConfirmAlert
      text="Proceed?"
      error={null}
      onYes={vi.fn()}
      onNo={vi.fn()}
      {...props}
    />,
  );

  return {
    title: (): string => {
      return rendered.getByTestId(TESTIDS.dialogTitle).textContent ?? "";
    },
    width: (): string => {
      return rendered.getByTestId(TESTIDS.dialog).dataset.width ?? "";
    },
    text: (): string => {
      return rendered.getByTestId(TESTIDS.confirmText).textContent ?? "";
    },
    errorText: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmError)?.textContent ?? null;
    },
    yes: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmYes));
    },
    no: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmNo));
    },
    isAlertDescribedAs: (description: string): boolean => {
      return (
        rendered.queryByRole("alertdialog", { name: "Notice", description }) !==
        null
      );
    },
    focusedButton: (): string | null => {
      const active = document.activeElement;

      return active instanceof HTMLButtonElement
        ? (active.textContent ?? "")
        : null;
    },
    pressEscape: (): void => {
      fireEvent.keyDown(rendered.getByTestId(TESTIDS.dialog), {
        key: "Escape",
      });
    },
  };
}
