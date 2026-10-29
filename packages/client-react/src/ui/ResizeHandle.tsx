import { type PointerEvent, type ReactElement, useRef } from "react";

import { TESTIDS } from "./testids.ts";

import "./TreeGrid.css";

/** The 11px hit area over a header boundary. Pointer capture keeps the drag on the handle, so nothing listens on the document. */
export function ResizeHandle({
  index,
  onResize,
}: ResizeHandleProps): ReactElement {
  const startX = useRef(0);
  const startWidth = useRef(0);

  function down(event: PointerEvent<HTMLSpanElement>): void {
    const left = event.currentTarget.parentElement?.previousElementSibling;
    startX.current = event.clientX;
    /* v8 ignore next -- a handle sits in the second header cell or later, which always has a left neighbour; the fallback only satisfies the types */
    startWidth.current = left?.getBoundingClientRect().width ?? 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLSpanElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      onResize(
        index,
        Math.round(startWidth.current + event.clientX - startX.current),
      );
    }
  }

  /** On the pointer let go, or cancelled by the browser: the drag ends either way. */
  function up(event: PointerEvent<HTMLSpanElement>): void {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <span
      className="tree-grid-resize"
      data-testid={TESTIDS.treeGridResize}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}

export interface ResizeHandleProps {
  index: number;
  onResize: (index: number, px: number) => void;
}
