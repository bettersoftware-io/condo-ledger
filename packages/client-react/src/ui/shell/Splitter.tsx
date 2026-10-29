import { type PointerEvent, type ReactElement, useRef } from "react";

import { TESTIDS } from "../testids.ts";

import "./Splitter.css";

/**
 * A 12px hit area with a pill, dragged to resize what sits beside it. Pointer
 * capture keeps the drag on the splitter, so nothing listens on the document.
 *
 * Each move reports the travel along the splitter's axis since the move
 * before (the first since the press), so the owner adds it to the size it
 * holds now: `resize(width + delta)`.
 */
export function Splitter({ direction, onDrag }: SplitterProps): ReactElement {
  const last = useRef(0);

  function startDrag(event: PointerEvent<HTMLDivElement>): void {
    last.current = positionOf(event, direction);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function reportTravel(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const position = positionOf(event, direction);
    const delta = position - last.current;
    last.current = position;
    onDrag(delta);
  }

  /** On the pointer let go, or cancelled by the browser (a touch it takes for a scroll): the drag ends either way. */
  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className="splitter"
      data-direction={direction}
      data-testid={TESTIDS.splitter}
      onPointerDown={startDrag}
      onPointerMove={reportTravel}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="splitter-pill" />
    </div>
  );
}

export interface SplitterProps {
  /** `vertical`: a bar between side-by-side panes, dragged left and right. */
  direction: "vertical" | "horizontal";
  onDrag: (deltaPx: number) => void;
}

function positionOf(
  event: PointerEvent<HTMLDivElement>,
  direction: SplitterProps["direction"],
): number {
  return direction === "vertical" ? event.clientX : event.clientY;
}
