import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

import { TESTIDS } from "./testids.ts";

import "./Dialog.css";

/**
 * A modal card over a scrim: the title bar, the body, the footer. The card
 * takes the focus when it mounts; Escape, or a click on the scrim, closes it.
 * Its parent decides whether it is open: it draws only while mounted.
 */
export function Dialog({
  title,
  width = "default",
  onClose,
  footer,
  children,
}: DialogProps): ReactElement {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    card.current?.focus();
  }, []);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      onClose();
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
      <div
        ref={card}
        className="dialog-card"
        data-testid={TESTIDS.dialog}
        data-width={width}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={closeOnEscape}
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
  onClose: () => void;
  /** The footer's content: its buttons take the `dialog-button` class. */
  footer: ReactNode;
  children: ReactNode;
}
