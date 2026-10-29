import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import { useFocusReturn } from "../focus.ts";

import "./Popover.css";

/**
 * A small menu under the button that opened it: a labelled list of options
 * over a scrim, after WAI-ARIA's menu button. It opens with the focus on its
 * first item; the arrow keys, Home and End move between the items; Escape, a
 * click on the scrim or Tab closes it. When it closes, the focus goes back to
 * the button. Its parent is the positioned box it hangs from.
 */
export function Popover({
  open,
  label,
  width = "narrow",
  onClose,
  children,
}: PopoverProps): ReactElement | null {
  const panel = useRef<HTMLDivElement>(null);

  useFocusReturn(panel, open);

  useEffect(() => {
    if (open && panel.current !== null) {
      const first = itemsOf(panel.current)[0];
      (first ?? panel.current).focus();
    }
  }, [open]);

  function moveOrClose(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();

      return;
    }

    if (event.key === "Tab") {
      onClose();

      return;
    }

    const items = itemsOf(event.currentTarget);
    const next = nextItem(event.key, items);

    if (next !== null) {
      event.preventDefault();
      next.focus();
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
        onKeyDown={moveOrClose}
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
  /**
   * 172px (`narrow`) or 184px (`wide`), as the README's two popovers; a
   * `wide` one grows to its longest item rather than wrap it.
   */
  width?: "narrow" | "wide";
  onClose: () => void;
  children: ReactNode;
}

/** The menu's items, of any of the three menu item roles, in order. */
function itemsOf(menu: HTMLElement): HTMLElement[] {
  return [
    ...menu.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
    ),
  ];
}

/** The item a key moves the focus to, wrapping at the ends; null for a key that moves nothing. */
function nextItem(key: string, items: HTMLElement[]): HTMLElement | null {
  const active = document.activeElement;
  const at = active instanceof HTMLElement ? items.indexOf(active) : -1;
  const index = indexAfter(key, at, items.length);

  return index === null ? null : (items[index] ?? null);
}

/** Where a key moves from the item at `at` (-1 for none) among `count` items. */
function indexAfter(key: string, at: number, count: number): number | null {
  switch (key) {
    case "ArrowDown":
      return (at + 1) % count;
    case "ArrowUp":
      return at <= 0 ? count - 1 : at - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
