import type { ReactElement } from "react";

import { PAGE_SIZES, type PageSize } from "@cl/client-core";

import { MenuItem } from "./MenuItem.tsx";
import { Popover } from "./shell/Popover.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

import "./Paging.css";

/** The page-size chip and the menu that hangs from it. */
export function PageSizeMenu({
  pageSize,
  open,
  onPageSize,
  onOpen,
  onClose,
}: PageSizeMenuProps): ReactElement {
  function choosingSize(size: PageSize): () => void {
    return (): void => {
      onPageSize(size);
    };
  }

  return (
    <div className="paging-menu-anchor">
      <ToolbarButton
        label="Page size"
        text={`${pageSize} ▾`}
        menuOpen={open}
        onClick={onOpen}
      />
      <Popover open={open} label="Page size" onClose={onClose}>
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
  );
}

export interface PageSizeMenuProps {
  pageSize: PageSize;
  open: boolean;
  onPageSize: (size: PageSize) => void;
  onOpen: () => void;
  onClose: () => void;
}
