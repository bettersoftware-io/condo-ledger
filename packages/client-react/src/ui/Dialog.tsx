import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

import { keepTabWithin, useFocusReturn } from "./focus.ts";
import { TESTIDS } from "./testids.ts";

import "./Dialog.css";

/**
 * A modal card over a scrim, after WAI-ARIA's dialog: the title bar, the
 * body, the footer. The card takes the focus when it mounts, and Tab stays
 * inside it; Escape, or a click on the scrim, closes it. When it goes, the
 * focus goes back to what had it before, unless its owner has put the focus
 * somewhere else. Enter in a text field of the card does what `onEnter`
 * says, when it says anything. A key pressed in a dialog stacked inside this
 * one is that dialog's alone. Its parent decides whether it is open: it
 * draws only while mounted.
 */
export function Dialog({
  title,
  width = "default",
  role = "dialog",
  describedBy,
  onClose,
  onEnter,
  footer,
  children,
}: DialogProps): ReactElement {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusReturn(card, true);

  useEffect(() => {
    card.current?.focus();
  }, []);

  function closeOrConfirm(event: KeyboardEvent<HTMLDivElement>): void {
    if (!isOwnKey(event)) {
      return;
    }

    keepTabWithin(event, event.currentTarget);

    if (event.key === "Escape") {
      onClose();

      return;
    }

    if (
      event.key === "Enter" &&
      onEnter !== undefined &&
      isTextField(event.target)
    ) {
      event.preventDefault();
      onEnter();
    }
  }

  return (
    <div className="dialog-layer" data-width={width}>
      <button
        type="button"
        className="dialog-scrim"
        data-testid={TESTIDS.dialogClose}
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onClick={onClose}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useAriaPropsSupportedByRole: the role is `dialog` or `alertdialog`, both interactive and both taking aria-modal and a description; Biome reads no role out of a prop */}
      <div
        ref={card}
        className="dialog-card"
        data-testid={TESTIDS.dialog}
        data-width={width}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={closeOrConfirm}
      >
        <div
          id={titleId}
          className="dialog-title"
          data-testid={TESTIDS.dialogTitle}
        >
          {title}
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  );
}

export interface DialogProps {
  title: string;
  /** 380px (`alert`), 560px (`default`) or 680px (`wizard`), as the README's dialogs. */
  width?: "alert" | "default" | "wizard";
  /** `alertdialog` for a question that interrupts the person and wants an answer. */
  role?: "dialog" | "alertdialog";
  /** The id of what the card says, read after its name (an alert's question). */
  describedBy?: string;
  onClose: () => void;
  /** Enter in a text field of the card: what the primary button does. */
  onEnter?: () => void;
  /** The footer's content: its buttons take the `dialog-button` class. */
  footer: ReactNode;
  children: ReactNode;
}

/** Whether the key was pressed in this card, not in a dialog stacked inside it. */
function isOwnKey(event: KeyboardEvent<HTMLDivElement>): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('[aria-modal="true"]') === event.currentTarget
  );
}

/** A field the person types a line of text into: Enter there means "go on", not a new line. */
function isTextField(target: EventTarget): boolean {
  return target instanceof HTMLInputElement && target.type === "text";
}
