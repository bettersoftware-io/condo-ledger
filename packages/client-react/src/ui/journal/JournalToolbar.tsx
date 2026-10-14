import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { PageSize, WizardName } from "@cl/client-core";
import type { EntryKind } from "@cl/domain";

import { MenuItem } from "../MenuItem.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Popover } from "../shell/Popover.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { ToolbarSearch } from "../ToolbarSearch.tsx";
import { EntryIcon } from "./EntryIcon.tsx";
import { JournalPaging } from "./JournalPaging.tsx";

/**
 * The design's Journal toolbar: search, the Add transaction menu, edit and
 * delete, expand and collapse all, print and export, and the paging group.
 * Which menu is open is this view's own state, as the top bar's pickers are.
 * What is not built yet posts a notice through `onStub` with its name.
 */
export function JournalToolbar({
  search,
  canDelete,
  page,
  pageCount,
  pageSize,
  onSearch,
  onAdd,
  onStub,
  onDelete,
  onExpandAll,
  onCollapseAll,
  onPage,
  onPageSize,
}: JournalToolbarProps): ReactElement {
  const [menu, setMenu] = useState<Menu | null>(null);

  function openAdd(): void {
    setMenu("add");
  }

  function openSizes(): void {
    setMenu("sizes");
  }

  function closeMenu(): void {
    setMenu(null);
  }

  function choosing(item: AddItem): () => void {
    return (): void => {
      setMenu(null);

      if (item.wizard === null) {
        onStub(item.label);
      } else {
        onAdd(item.wizard);
      }
    };
  }

  function chooseSize(size: PageSize): void {
    setMenu(null);
    onPageSize(size);
  }

  function stubEdit(): void {
    onStub("Edit entry");
  }

  function stubPrint(): void {
    onStub("Print journal");
  }

  function stubPdf(): void {
    onStub("Export to PDF");
  }

  function stubXls(): void {
    onStub("Export to Excel");
  }

  function stubRefresh(): void {
    onStub("Refresh");
  }

  return (
    <Toolbar>
      <ToolbarSearch
        value={search}
        placeholder="Search entry…"
        onChange={onSearch}
      />
      <div className="journal-menu-anchor">
        <ToolbarButton
          label="Add transaction"
          icon="+"
          text="▾"
          tone="ok"
          menuOpen={menu === "add"}
          onClick={openAdd}
        />
        <Popover
          open={menu === "add"}
          label="Add transaction"
          width="wide"
          onClose={closeMenu}
        >
          {ADD_ITEMS.map((item) => {
            return (
              <MenuItem
                key={item.label}
                label={item.label}
                icon={<EntryIcon kind={item.kind} />}
                onClick={choosing(item)}
              />
            );
          })}
        </Popover>
      </div>
      <ToolbarButton
        label="Edit entry"
        icon="✎"
        tone="muted"
        iconOnly
        onClick={stubEdit}
      />
      <ToolbarButton
        label="Delete entry"
        icon="−"
        tone="neg"
        iconOnly
        disabled={!canDelete}
        onClick={onDelete}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="Expand all"
        icon="⊞"
        tone="muted"
        iconOnly
        onClick={onExpandAll}
      />
      <ToolbarButton
        label="Collapse all"
        icon="⊟"
        tone="muted"
        iconOnly
        onClick={onCollapseAll}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="Print journal"
        icon={<Printer size={14} />}
        tone="muted"
        iconOnly
        onClick={stubPrint}
      />
      <ToolbarButton
        label="Export to PDF"
        icon={PDF_GLYPH}
        iconOnly
        onClick={stubPdf}
      />
      <ToolbarButton
        label="Export to Excel"
        icon={XLS_GLYPH}
        iconOnly
        onClick={stubXls}
      />
      <span className="journal-toolbar-spacer" />
      <JournalPaging
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        sizesOpen={menu === "sizes"}
        onPage={onPage}
        onPageSize={chooseSize}
        onOpenSizes={openSizes}
        onCloseSizes={closeMenu}
      />
      <ToolbarButton
        label="Refresh"
        icon={<RotateCw size={13} />}
        tone="muted"
        iconOnly
        onClick={stubRefresh}
      />
    </Toolbar>
  );
}

export interface JournalToolbarProps {
  search: string;
  /** An entry is selected. */
  canDelete: boolean;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  onSearch: (text: string) => void;
  /** Opens a built wizard. */
  onAdd: (wizard: WizardName) => void;
  /** A tool or a menu item that is not built yet, by name. */
  onStub: (label: string) => void;
  onDelete: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
}

type Menu = "add" | "sizes";

/** A row of the Add transaction menu: its wizard, or null while the flow is not built. */
interface AddItem {
  label: string;
  /** The kind of entry it writes, for its icon. */
  kind: EntryKind;
  wizard: WizardName | null;
}

/** In the design's order. */
const ADD_ITEMS: readonly AddItem[] = [
  { label: "New invoice", kind: "invoice", wizard: null },
  { label: "Record collection", kind: "collection", wizard: null },
  { label: "Invoice payment", kind: "invoicePayment", wizard: null },
  {
    label: "Direct purchase via bank",
    kind: "directPaymentBank",
    wizard: "directPaymentBank",
  },
  {
    label: "Direct purchase with cash",
    kind: "directPaymentCash",
    wizard: "directPaymentCash",
  },
  {
    label: "Withholding-tax payment",
    kind: "withholdingPayment",
    wizard: "withholdingPayment",
  },
  { label: "Opening balances", kind: "openingBalances", wizard: null },
  { label: "Budget allocation", kind: "budgetAllocation", wizard: null },
  { label: "Generic entry", kind: "generic", wizard: "genericEntry" },
  {
    label: "Direct payment to multiple cost accounts",
    kind: "directPaymentBank",
    wizard: "multiCostPayment",
  },
];
