import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { PageSize } from "@cl/client-core";
import type { ContactView } from "@cl/domain";

import { PageArrows } from "../PageArrows.tsx";
import { PageSizeMenu } from "../PageSizeMenu.tsx";
import { PageText } from "../PageText.tsx";
import { Panel } from "../Panel.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { CONTACTS_COLUMNS } from "./columns.ts";
import { categoryCell, contactCells, languageCell } from "./contactCells.tsx";
import { NO_CONTACT_MATCHES } from "./labels.ts";

import "./ContactsPanel.css";

/**
 * The Contact List: the page of the registry the filters let through, by
 * name, with the paging toolbar above it (`« ‹ › »`, print, export, the page
 * and the total, the page size, refresh). A click selects a contact. Print,
 * export and refresh post their notice. Whether the page-size menu is open is
 * this view's own state. Takes only props, so the compiler memoizes it.
 */
export function ContactsPanel({
  contacts,
  selectedId,
  page,
  pageCount,
  pageSize,
  total,
  template,
  maximized,
  onSelect,
  onPage,
  onPageSize,
  onResize,
  onToggleMaximize,
  onStub,
}: ContactsPanelProps): ReactElement {
  const [sizesOpen, setSizesOpen] = useState(false);

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function openSizes(): void {
    setSizesOpen(true);
  }

  function closeSizes(): void {
    setSizesOpen(false);
  }

  function chooseSize(size: PageSize): void {
    setSizesOpen(false);
    onPageSize(size);
  }

  return (
    <div className="contacts-panel" data-testid={TESTIDS.contactsPanel}>
      <Panel
        title="Contact List"
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      >
        <div className="contacts-panel-body">
          <Toolbar>
            <PageArrows page={page} pageCount={pageCount} onPage={onPage} />
            <ToolbarDivider />
            <ToolbarButton
              label="Print"
              icon={<Printer size={14} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Print")}
            />
            <ToolbarButton
              label="Export to PDF"
              icon={PDF_GLYPH}
              iconOnly
              onClick={stubbing("Export to PDF")}
            />
            <ToolbarButton
              label="Export to Excel"
              icon={XLS_GLYPH}
              iconOnly
              onClick={stubbing("Export to Excel")}
            />
            <span className="contacts-panel-spacer" />
            <PageText
              page={page}
              pageCount={pageCount}
              detail={`${total} contacts total`}
            />
            <PageSizeMenu
              pageSize={pageSize}
              open={sizesOpen}
              onPageSize={chooseSize}
              onOpen={openSizes}
              onClose={closeSizes}
            />
            <ToolbarButton
              label="Refresh"
              icon={<RotateCw size={13} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Refresh")}
            />
          </Toolbar>
          <div className="contacts-panel-grid">
            <TreeGrid
              columns={CONTACTS_COLUMNS}
              template={template}
              rows={contacts.map((contact) => {
                return rowDataOf(contact, selectedId);
              })}
              emptyMessage={NO_CONTACT_MATCHES}
              // The list is flat: no row has a caret to toggle.
              onToggle={onSelect}
              onSelect={onSelect}
              onResize={onResize}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

export interface ContactsPanelProps {
  /** The page's contacts. */
  contacts: ContactView[];
  /** The selected contact's id; null with none. */
  selectedId: string | null;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  /** The contacts the filters let through, of every page. */
  total: number;
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** Whether the panel fills the screen. */
  maximized: boolean;
  /** Selects a contact by id. */
  onSelect: (contactId: string) => void;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
  onResize: (index: number, px: number) => void;
  onToggleMaximize: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

function rowDataOf(
  contact: ContactView,
  selectedId: string | null,
): TreeGridRowData {
  return {
    key: contact.id,
    depth: 0,
    hasChildren: false,
    expanded: false,
    selected: contact.id === selectedId,
    emphasis: false,
    zebra: false,
    icon: null,
    label: contact.name,
    cells: [
      ...contactCells(contact),
      languageCell(contact),
      categoryCell(contact),
    ],
  };
}
