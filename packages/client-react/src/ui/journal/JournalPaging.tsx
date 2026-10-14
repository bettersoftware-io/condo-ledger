import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import { PAGE_SIZES, type PageSize } from "@cl/client-core";

import { MenuItem } from "../MenuItem.tsx";
import { Popover } from "../shell/Popover.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { TESTIDS } from "../testids.ts";

/**
 * The Journal toolbar's paging group: previous and next, each disabled at its
 * end, "Page n of m" between them, and the page-size chip with its menu.
 * Whether the menu is open is the toolbar's, which holds every menu it has.
 */
export function JournalPaging({
  page,
  pageCount,
  pageSize,
  sizesOpen,
  onPage,
  onPageSize,
  onOpenSizes,
  onCloseSizes,
}: JournalPagingProps): ReactElement {
  function previous(): void {
    onPage(page - 1);
  }

  function next(): void {
    onPage(page + 1);
  }

  function choosingSize(size: PageSize): () => void {
    return (): void => {
      onPageSize(size);
    };
  }

  return (
    <div className="journal-paging">
      <ToolbarButton
        label="Previous page"
        icon={<ChevronLeft size={14} />}
        tone="muted"
        iconOnly
        disabled={page <= 1}
        onClick={previous}
      />
      <span className="journal-page-text" data-testid={TESTIDS.journalPageText}>
        Page <b>{page}</b> of {pageCount}
      </span>
      <ToolbarButton
        label="Next page"
        icon={<ChevronRight size={14} />}
        tone="muted"
        iconOnly
        disabled={page >= pageCount}
        onClick={next}
      />
      <div className="journal-menu-anchor" data-align="right">
        <ToolbarButton
          label="Page size"
          text={`${pageSize} ▾`}
          menuOpen={sizesOpen}
          onClick={onOpenSizes}
        />
        <Popover open={sizesOpen} label="Page size" onClose={onCloseSizes}>
          {PAGE_SIZES.map((size) => {
            return (
              <MenuItem
                key={size}
                label={String(size)}
                onClick={choosingSize(size)}
              />
            );
          })}
        </Popover>
      </div>
    </div>
  );
}

export interface JournalPagingProps {
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
