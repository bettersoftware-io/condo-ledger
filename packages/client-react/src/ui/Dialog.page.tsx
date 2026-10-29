import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useState } from "react";
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
  /** Whether the last key pressed on the card was kept from the browser's own handling. */
  lastKeyWasKept: () => boolean;
  /** Presses the key in the body's field with this name. */
  pressIn: (fieldName: string, key: string) => void;
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

  let kept = false;

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
      kept = !fireEvent.keyDown(card(), { key });
    },
    lastKeyWasKept: (): boolean => {
      return kept;
    },
    pressIn: (fieldName: string, key: string): void => {
      const field = rendered.getByLabelText(fieldName);

      fireEvent.keyDown(field, { key });
    },
    clickScrim: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.dialogClose));
    },
    clickTitle: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.dialogTitle));
    },
  };
}

/** What a test can do with, and ask of, a dialog its page opens and closes. */
export interface OpenedDialogPage {
  /** Clicks the page's button that opens the dialog. */
  open: () => Promise<void>;
  isOpen: () => boolean;
  /** Presses a key where the focus is, as a person would. */
  press: (key: string) => Promise<void>;
  /** Presses Tab, or Shift+Tab, where the focus is. */
  tab: (backwards?: boolean) => Promise<void>;
  /** The accessible name of what has the focus: a field's label, a button's text; the dialog's own name when the card has it. */
  focused: () => string | null;
  /** Clicks a button in the dialog's footer by its text. */
  click: (button: string) => Promise<void>;
  /** Whether the button that opened the dialog has the focus. */
  openerHasFocus: () => boolean;
  /** Whether the field after the dialog, where Done puts the focus, has it. */
  fieldAfterHasFocus: () => boolean;
  /** How many times the button that opened the dialog has taken the focus. */
  openerFocuses: () => number;
}

/**
 * Mounts a page with a button that opens a dialog, and a field after it.
 * The dialog holds a pair of radio buttons, Credit checked, then two fields;
 * Escape asks to close it, and Save closes it
 * the way a wizard closes on its own: its owner stops drawing it. Done
 * closes it as a screen that moves the focus itself does: the field after
 * the dialog takes the focus, then the dialog goes.
 */
export function mountOpenedDialog(): OpenedDialogPage {
  const user = userEvent.setup();
  let openerFocuses = 0;

  function countOpenerFocus(): void {
    openerFocuses += 1;
  }

  const rendered = render(<DialogHost />);

  function opener(): HTMLElement {
    return rendered.getByRole("button", { name: OPENER });
  }

  // A listener of the page's own, not React's: React hears no event while
  // it commits, and a dialog that goes gives the focus back as it commits.
  opener().addEventListener("focus", countOpenerFocus);

  return {
    open: async (): Promise<void> => {
      await user.click(opener());
    },
    isOpen: (): boolean => {
      return rendered.queryByRole("dialog") !== null;
    },
    press: async (key: string): Promise<void> => {
      await user.keyboard(`{${key}}`);
    },
    tab: async (backwards = false): Promise<void> => {
      await user.tab({ shift: backwards });
    },
    focused: (): string | null => {
      const active = document.activeElement;

      if (!(active instanceof HTMLElement) || active === document.body) {
        return null;
      }

      return (
        active.getAttribute("aria-label") ??
        (active.getAttribute("role") === "dialog"
          ? "the card"
          : (active.textContent ?? ""))
      );
    },
    click: async (button: string): Promise<void> => {
      await user.click(rendered.getByRole("button", { name: button }));
    },
    openerHasFocus: (): boolean => {
      return document.activeElement === opener();
    },
    openerFocuses: (): number => {
      return openerFocuses;
    },
    fieldAfterHasFocus: (): boolean => {
      return document.activeElement === rendered.getByLabelText(FIELD_AFTER);
    },
  };
}

/** What a test can do with two dialogs, one over the other. */
export interface StackedDialogsPage {
  /** Presses a key on the card of the dialog with this name. */
  pressOn: (dialog: string, key: string) => void;
}

/** Mounts a dialog named Inner inside one named Outer, as a confirmation over a wizard. */
export function mountStackedDialogs(
  onCloseOuter: () => void,
  onCloseInner: () => void,
): StackedDialogsPage {
  const rendered = render(
    <Dialog title="Outer" onClose={onCloseOuter} footer={null}>
      <Dialog title="Inner" onClose={onCloseInner} footer={null}>
        <p>Proceed?</p>
      </Dialog>
    </Dialog>,
  );

  return {
    pressOn: (dialog: string, key: string): void => {
      fireEvent.keyDown(rendered.getByRole("dialog", { name: dialog }), {
        key,
      });
    },
  };
}

const OPENER = "Open";

const FIELD_AFTER = "After the dialog";

/** A page that opens a dialog and draws it while it is open. */
function DialogHost(): ReactElement {
  const [open, setOpen] = useState(false);

  function openDialog(): void {
    setOpen(true);
  }

  function closeDialog(): void {
    setOpen(false);
  }

  function closeToTheFieldAfter(): void {
    document
      .querySelector<HTMLElement>(`[aria-label="${FIELD_AFTER}"]`)
      ?.focus();
    setOpen(false);
  }

  return (
    <div>
      <button type="button" onClick={openDialog}>
        {OPENER}
      </button>
      {open ? (
        <Dialog
          title="Generic entry"
          onClose={closeDialog}
          footer={
            <>
              <button type="button" disabled>
                Back
              </button>
              <button type="button" onClick={closeDialog}>
                Save
              </button>
              <button type="button" onClick={closeToTheFieldAfter}>
                Done
              </button>
            </>
          }
        >
          <input type="radio" name="side" aria-label="Debit" />
          <input type="radio" name="side" aria-label="Credit" defaultChecked />
          <input aria-label="Description" />
          <input aria-label="Amount" />
        </Dialog>
      ) : null}
      <input aria-label={FIELD_AFTER} />
    </div>
  );
}
