import { fireEvent, render } from "@testing-library/react";

import { TESTIDS } from "../testids.ts";
import { Splitter, type SplitterProps } from "./Splitter.tsx";

/** What a test can do with, and ask of, a splitter. */
export interface SplitterPage {
  /** Presses on the splitter, moves by the given pixels along its axis, and lets go. */
  dragSplitter: (by: number) => void;
  /** Presses, moves to each position in turn (each measured from the press), and lets go. */
  dragSplitterThrough: (steps: number[]) => void;
  /** Moves over the splitter by the given pixels without pressing first. */
  hoverSplitter: (by: number) => void;
  /** Presses, moves by the given pixels, and the browser cancels the pointer (a touch taken over by a scroll, say). */
  dragSplitterAndCancel: (by: number) => void;
  direction: () => string | null;
}

export function mountSplitter(props: SplitterProps): SplitterPage {
  polyfillPointerCapture();
  const rendered = render(<Splitter {...props} />);

  function splitter(): HTMLElement {
    return rendered.getByTestId(TESTIDS.splitter);
  }

  return {
    dragSplitter: (by: number): void => {
      dragSplitterElement(splitter(), [by]);
    },
    dragSplitterThrough: (steps: number[]): void => {
      dragSplitterElement(splitter(), steps);
    },
    dragSplitterAndCancel: (by: number): void => {
      const element = splitter();
      fireEvent.pointerDown(element, pointerAt(element, START));
      fireEvent.pointerMove(element, pointerAt(element, START + by));
      fireEvent.pointerCancel(element, pointerAt(element, START + by));
    },
    hoverSplitter: (by: number): void => {
      fireEvent.pointerMove(splitter(), pointerAt(splitter(), START + by));
    },
    direction: (): string | null => {
      return splitter().getAttribute("data-direction");
    },
  };
}

/** Drags a splitter some other page drew: press, move to each position in turn along its axis (each measured from the press), let go. */
export function dragSplitterElement(
  splitter: HTMLElement,
  steps: number[],
): void {
  polyfillPointerCapture();
  dragThrough(splitter, steps);
}

const START = 100;

function dragThrough(splitter: HTMLElement, steps: number[]): void {
  fireEvent.pointerDown(splitter, pointerAt(splitter, START));

  for (const step of steps) {
    fireEvent.pointerMove(splitter, pointerAt(splitter, START + step));
  }

  fireEvent.pointerUp(
    splitter,
    pointerAt(splitter, START + (steps.at(-1) ?? 0)),
  );
}

interface PointerAt {
  clientX: number;
  clientY: number;
  pointerId: number;
}

/** A pointer at the given position along the splitter's axis; the other axis stays put. */
function pointerAt(splitter: HTMLElement, position: number): PointerAt {
  const vertical = splitter.getAttribute("data-direction") === "vertical";

  return {
    clientX: vertical ? position : START,
    clientY: vertical ? START : position,
    pointerId: 1,
  };
}

/** jsdom has no pointer capture: a flag on the element stands in for it. For any page that drags a handle holding the pointer. */
function polyfillPointerCapture(): void {
  const captured = new WeakSet<Element>();

  HTMLElement.prototype.setPointerCapture = function setPointerCapture(
    this: HTMLElement,
  ): void {
    captured.add(this);
  };

  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(
    this: HTMLElement,
  ): void {
    captured.delete(this);
  };

  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(
    this: HTMLElement,
  ): boolean {
    return captured.has(this);
  };
}
