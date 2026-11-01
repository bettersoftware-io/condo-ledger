import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { ReactElement } from "react";

import { ToolbarButton } from "./ToolbarButton.tsx";

import "./Paging.css";

/** The four steps `« ‹ › »`: first, previous, next and last, each disabled where it cannot go. */
export function PageArrows({
  page,
  pageCount,
  onPage,
}: PageArrowsProps): ReactElement {
  function first(): void {
    onPage(1);
  }

  function previous(): void {
    onPage(page - 1);
  }

  function next(): void {
    onPage(page + 1);
  }

  function last(): void {
    onPage(pageCount);
  }

  return (
    <div className="paging">
      <ToolbarButton
        label="First page"
        icon={<ChevronsLeft size={14} />}
        tone="muted"
        iconOnly
        disabled={page <= 1}
        onClick={first}
      />
      <ToolbarButton
        label="Previous page"
        icon={<ChevronLeft size={14} />}
        tone="muted"
        iconOnly
        disabled={page <= 1}
        onClick={previous}
      />
      <ToolbarButton
        label="Next page"
        icon={<ChevronRight size={14} />}
        tone="muted"
        iconOnly
        disabled={page >= pageCount}
        onClick={next}
      />
      <ToolbarButton
        label="Last page"
        icon={<ChevronsRight size={14} />}
        tone="muted"
        iconOnly
        disabled={page >= pageCount}
        onClick={last}
      />
    </div>
  );
}

export interface PageArrowsProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}
