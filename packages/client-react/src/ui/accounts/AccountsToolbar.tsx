import { Printer, Settings } from "lucide-react";
import type { ReactElement } from "react";

import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarCheckbox } from "../ToolbarCheckbox.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { ToolbarSearch } from "../ToolbarSearch.tsx";

/**
 * The prototype's Accounts toolbar: search, hide-empty, the functional
 * accounts, add/edit/delete, expand and collapse all, print and export. What
 * is not built yet posts a notice through `onStub` with the tool's name.
 */
export function AccountsToolbar({
  search,
  hideEmpty,
  onSearch,
  onHideEmpty,
  onExpandAll,
  onCollapseAll,
  onStub,
}: AccountsToolbarProps): ReactElement {
  function stubConfigure(): void {
    onStub("Configure functional accounts");
  }

  function stubAdd(): void {
    onStub("Add account");
  }

  function stubEdit(): void {
    onStub("Edit account");
  }

  function stubDelete(): void {
    onStub("Delete account");
  }

  function stubPrint(): void {
    onStub("Print balances");
  }

  function stubPdf(): void {
    onStub("Export to PDF");
  }

  function stubXls(): void {
    onStub("Export to Excel");
  }

  return (
    <Toolbar>
      <ToolbarSearch
        value={search}
        placeholder="Search account…"
        onChange={onSearch}
      />
      <ToolbarCheckbox
        label="Hide empty accounts"
        checked={hideEmpty}
        onChange={onHideEmpty}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="Configure functional accounts"
        icon={<Settings size={13} />}
        tone="muted"
        iconOnly
        onClick={stubConfigure}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="Add account"
        icon="+"
        tone="ok"
        iconOnly
        onClick={stubAdd}
      />
      <ToolbarButton
        label="Edit account"
        icon="✎"
        tone="muted"
        iconOnly
        onClick={stubEdit}
      />
      <ToolbarButton
        label="Delete account"
        icon="−"
        tone="neg"
        iconOnly
        onClick={stubDelete}
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
        label="Print balances"
        icon={
          <>
            <Printer size={14} />
            <span className="accounts-menu-caret">▾</span>
          </>
        }
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
      <span className="accounts-toolbar-spacer" />
    </Toolbar>
  );
}

export interface AccountsToolbarProps {
  search: string;
  hideEmpty: boolean;
  onSearch: (text: string) => void;
  onHideEmpty: (hide: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}
