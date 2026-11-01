import { type ReactElement, useEffect, useRef } from "react";

import { addressTextOf, type ContactRow, type ContactView } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { CONTACT_KIND_ICONS, CONTACT_KIND_LABELS } from "../contactLabels.ts";
import { Fieldset } from "../Fieldset.tsx";
import { Scheda } from "../Scheda.tsx";
import { SheetField } from "../SheetField.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { SUPPLIERS_COLUMNS } from "./columns.ts";
import { STATUS_LABELS } from "./labels.ts";

import "./BuildingSuppliers.css";

/**
 * The Building Suppliers tab: the building's suppliers, `Name / Company |
 * Contact category`, beside the selected one's sheet (its kind, status and
 * code; COMPANY DATA; CONTACTS, the email in the accent), split by a
 * splitter whose ratio reaches the stylesheet as `--suppliers-split`,
 * written in an effect. A click selects a supplier. Read only: suppliers are
 * edited in Contacts. Takes only props, so the compiler memoizes it.
 */
export function BuildingSuppliers({
  suppliers,
  supplier,
  template,
  ratio,
  onSelect,
  onResize,
  onSetRatio,
}: BuildingSuppliersProps): ReactElement {
  const split = useRef<HTMLDivElement>(null);

  useEffect(() => {
    split.current?.style.setProperty("--suppliers-split", String(ratio));
  }, [ratio]);

  function moveSplitBy(deltaPx: number): void {
    // A splitter is dragged only on the tab it is drawn on.
    const { width } = must(
      split.current,
      "the tab of the splitter",
    ).getBoundingClientRect();

    // A tab not laid out yet has no width to share.
    if (width > 0) {
      onSetRatio(ratio + deltaPx / width);
    }
  }

  return (
    <div
      ref={split}
      className="building-suppliers"
      data-testid={TESTIDS.buildingSuppliers}
    >
      <div className="building-suppliers-list">
        <TreeGrid
          columns={SUPPLIERS_COLUMNS}
          template={template}
          rows={suppliers.map((contact) => {
            return rowDataOf(contact, supplier?.id ?? null);
          })}
          emptyMessage="This building has no suppliers."
          // The list is flat: no row has a caret to toggle.
          onToggle={onSelect}
          onSelect={onSelect}
          onResize={onResize}
        />
      </div>
      <Splitter direction="vertical" onDrag={moveSplitBy} />
      <div className="building-suppliers-sheet">
        {supplier === null ? null : <SupplierSheet supplier={supplier} />}
      </div>
    </div>
  );
}

export interface BuildingSuppliersProps {
  /** The building's suppliers, by category, then name. */
  suppliers: ContactView[];
  /** The one whose sheet is shown; null with none. */
  supplier: ContactView | null;
  /** The list's grid-template-columns, from its columns machine. */
  template: string;
  /** The list's share of the width. */
  ratio: number;
  /** Selects a supplier by its contact's id. */
  onSelect: (contactId: string) => void;
  onResize: (index: number, px: number) => void;
  onSetRatio: (ratio: number) => void;
}

interface SupplierSheetProps {
  supplier: ContactView;
}

function SupplierSheet({ supplier }: SupplierSheetProps): ReactElement {
  const active = supplier.status === "active";
  const { contact } = supplier;
  const registeredOffice =
    contact.kind === "company" ? contact.registeredOffice : null;
  const taxDomicile = contact.kind === "company" ? contact.taxDomicile : null;

  return (
    <Scheda>
      <SheetField
        label="Contact type"
        value={`${CONTACT_KIND_ICONS[supplier.kind]} ${CONTACT_KIND_LABELS[supplier.kind]}`}
      />
      <SheetField
        label="Status"
        value={
          active ? `✓ ${STATUS_LABELS.active}` : STATUS_LABELS[supplier.status]
        }
        tone={active ? "ok" : undefined}
      />
      <SheetField label="Code" value={supplier.code} tone="mono" />
      <Fieldset legend="COMPANY DATA">
        <SheetField
          label="Company name"
          value={contact.kind === "company" ? contact.companyName : null}
        />
        <SheetField
          label="Registered office"
          value={
            registeredOffice === null ? null : addressTextOf(registeredOffice)
          }
        />
        <SheetField
          label="Tax domicile"
          value={taxDomicile === null ? null : addressTextOf(taxDomicile)}
        />
      </Fieldset>
      <Fieldset legend="CONTACTS">
        <SheetField label="Phone" value={firstRowOf(contact.rows, "phone")} />
        <SheetField
          label="Email"
          value={firstRowOf(contact.rows, "email")}
          tone="accent"
        />
      </Fieldset>
    </Scheda>
  );
}

/** The value of the contact's first row of the type; null when it has none. */
function firstRowOf(
  rows: ContactRow[],
  type: ContactRow["type"],
): string | null {
  return (
    rows.find((row) => {
      return row.type === type;
    })?.value ?? null
  );
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
      <span key="category" className="building-suppliers-category">
        {contact.category}
      </span>,
    ],
  };
}
