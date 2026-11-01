import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import type { PageSize } from "@cl/client-core";

import { PageSizeMenu } from "./PageSizeMenu.tsx";
import { PageText } from "./PageText.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

import "./Paging.css";

/**
 * A toolbar's paging group: previous and next, each disabled at its end,
 * "Page n of m" between them, and the page-size chip with its menu. Whether
 * the menu is open is the toolbar's, which holds every menu it has.
 */
export function Paging({
  page,
  pageCount,
  pageSize,
  sizesOpen,
  onPage,
  onPageSize,
  onOpenSizes,
  onCloseSizes,
}: PagingProps): ReactElement {
  function previous(): void {
    onPage(page - 1);
  }

  function next(): void {
    onPage(page + 1);
  }

  return (
    <div className="paging">
      <ToolbarButton
        label="Previous page"
        icon={<ChevronLeft size={14} />}
        tone="muted"
        iconOnly
        disabled={page <= 1}
        onClick={previous}
      />
      <PageText page={page} pageCount={pageCount} />
      <ToolbarButton
        label="Next page"
        icon={<ChevronRight size={14} />}
        tone="muted"
        iconOnly
        disabled={page >= pageCount}
        onClick={next}
      />
      <PageSizeMenu
        pageSize={pageSize}
        open={sizesOpen}
        onPageSize={onPageSize}
        onOpen={onOpenSizes}
        onClose={onCloseSizes}
      />
    </div>
  );
}

export interface PagingProps {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  /** Whether the page-size menu is open. */
  sizesOpen: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
  onOpenSizes: () => void;
  onCloseSizes: () => void;
}
