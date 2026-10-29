import { type KeyboardEvent, type RefObject, useLayoutEffect } from "react";

/**
 * While `active`, remembers what had the focus before, and gives the focus
 * back to it when `active` ends or the owner unmounts: a menu or a dialog
 * returns the keyboard to the button that opened it. It gives nothing back
 * when the focus has meanwhile gone somewhere outside the container on
 * purpose (a screen that moves it to its grid as a dialog closes).
 *
 * A layout effect, so that what had the focus is read before any effect of
 * the container's own content moves it.
 */
export function useFocusReturn(
  container: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const before = document.activeElement;
    const root = container.current;

    return (): void => {
      giveFocusBack(before, root);
    };
  }, [active, container]);
}

/**
 * Keeps Tab and Shift+Tab inside `root`: past its last stop the focus goes
 * to its first, and before its first to its last; from `root` itself, Tab
 * goes to the first and Shift+Tab to the last. With no stop at all, the
 * focus stays where it is. A key other than Tab is left alone.
 */
export function keepTabWithin(
  event: KeyboardEvent<HTMLElement>,
  root: HTMLElement,
): void {
  if (event.key !== "Tab") {
    return;
  }

  const stops = tabStopsIn(root);
  const first = stops[0];
  const last = stops.at(-1);

  if (first === undefined || last === undefined) {
    event.preventDefault();

    return;
  }

  const current = document.activeElement;

  if (event.shiftKey && (current === first || current === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (current === last || current === root)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The elements inside `root` the Tab key stops on, in document order: the
 * enabled controls and anything with a tab index of 0 or more, and of a
 * group of radio buttons only the one Tab reaches (the checked one, or the
 * first when none is).
 */
function tabStopsIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((element) => {
    return element.tabIndex >= 0 && isRadioStop(element, root);
  });
}

const TABBABLE = [
  "a[href]",
  "button:not(:disabled)",
  'input:not(:disabled):not([type="hidden"])',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]",
].join(", ");

function isRadioStop(element: HTMLElement, root: HTMLElement): boolean {
  if (
    !(element instanceof HTMLInputElement) ||
    element.type !== "radio" ||
    element.name === ""
  ) {
    return true;
  }

  const group = [
    ...root.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]:not(:disabled)',
    ),
  ].filter((radio) => {
    return radio.name === element.name;
  });

  const checked = group.find((radio) => {
    return radio.checked;
  });

  return element === (checked ?? group[0]);
}

function giveFocusBack(before: Element | null, root: HTMLElement | null): void {
  const now = document.activeElement;
  const focusLeftOnPurpose =
    now !== null && now !== document.body && root?.contains(now) !== true;

  if (focusLeftOnPurpose || !(before instanceof HTMLElement)) {
    return;
  }

  if (before.isConnected) {
    before.focus();
  }
}
