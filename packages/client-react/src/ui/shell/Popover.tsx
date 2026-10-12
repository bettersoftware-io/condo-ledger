import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import "./Popover.css";

/**
 * A small menu under the button that opened it: a labelled list of options
 * over a scrim. A click on the scrim or Escape closes it. Its parent is the
 * positioned box it hangs from.
 */
export function Popover({
  open,
  label,
  width = "narrow",
  onClose,
  children,
}: PopoverProps): ReactElement | null {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      panel.current?.focus();
    }
  }, [open]);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      onClose();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="popover-scrim"
        aria-label={`Close ${label}`}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        className="popover"
        data-width={width}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={closeOnEscape}
      >
        <div className="popover-label" aria-hidden="true">
          {label}
        </div>
        {children}
      </div>
    </>
  );
}

export interface PopoverProps {
  open: boolean;
  /** The section label at its head, and its accessible name. */
  label: string;
  /** 172px (`narrow`) or 184px (`wide`), as the README's two popovers. */
  width?: "narrow" | "wide";
  onClose: () => void;
  children: ReactNode;
}
