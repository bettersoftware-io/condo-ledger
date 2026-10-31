import { Printer } from "lucide-react";
import type { ReactElement } from "react";

import type { TreeGridState } from "@cl/client-core";
import type { OwnersRow, Unit } from "@cl/domain";

import { LegendButton } from "../allocation/LegendButton.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { TabbedPanel } from "../TabbedPanel.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TESTIDS } from "../testids.ts";
import { UNIT_TABS } from "./labels.ts";
import { UnitOwnersGrid } from "./UnitOwnersGrid.tsx";
import { UnitProfile } from "./UnitProfile.tsx";

import "./UnitTabs.css";

/**
 * The Units screen's bottom panel: the Unit Profile and Unit Owners tabs of
 * the selected unit, or of the selected resident's, under one toolbar. `+`
 * adds an owner to the unit, ✎ and − act on the selected owner on Unit
 * Owners and on the unit on Unit Profile, each only when there is one;
 * print, export and the Legend post their notice. With no unit (the root, a group, the rounding row) the tabs
 * say "Select a unit.". Takes only props, so the compiler memoizes it.
 */
export function UnitTabs({
  active,
  unit,
  location,
  ownerRows,
  ownersTemplate,
  selectedResidentId,
  onActivate,
  onSelectOwner,
  onToggleOwner,
  onResizeOwners,
  canAddOwner,
  canEdit,
  canDelete,
  onAddOwner,
  onEdit,
  onDelete,
  onStub,
}: UnitTabsProps): ReactElement {
  const owners = active === "Unit Owners";

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  return (
    <div className="unit-tabs" data-testid={TESTIDS.unitTabs}>
      <TabbedPanel
        label="Selected unit"
        tabs={UNIT_TABS}
        active={active}
        onActivate={onActivate}
      >
        <div className="unit-tabs-body">
          <Toolbar>
            <ToolbarButton
              label="Add owner"
              icon="+"
              tone="ok"
              iconOnly
              disabled={!canAddOwner}
              onClick={onAddOwner}
            />
            <ToolbarButton
              label={owners ? "Edit owner" : "Edit unit"}
              icon="✎"
              tone="muted"
              iconOnly
              disabled={!canEdit}
              onClick={onEdit}
            />
            <ToolbarButton
              label={owners ? "Remove owner" : "Delete unit"}
              icon="−"
              tone="neg"
              iconOnly
              disabled={!canDelete}
              onClick={onDelete}
            />
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
            <span className="unit-tabs-spacer" />
            <LegendButton onStub={onStub} />
          </Toolbar>
          <div className="unit-tabs-content">
            {unit === null ? (
              <p
                className="unit-tabs-hint"
                data-testid={TESTIDS.unitsSelectHint}
              >
                Select a unit.
              </p>
            ) : owners ? (
              <UnitOwnersGrid
                rows={ownerRows}
                template={ownersTemplate}
                selectedResidentId={selectedResidentId}
                onSelect={onSelectOwner}
                onToggle={onToggleOwner}
                onResize={onResizeOwners}
              />
            ) : (
              <UnitProfile unit={unit} location={location} />
            )}
          </div>
        </div>
      </TabbedPanel>
    </div>
  );
}

export interface UnitTabsProps {
  /** The tab in front: one of UNIT_TABS. */
  active: string;
  /** The selected unit, or the selected resident's; null with none. */
  unit: Unit | null;
  /** Where the unit stands among the groups. */
  location: string;
  /** The Unit Owners grid machine's rows. */
  ownerRows: TreeGridState<OwnersRow>["rows"];
  /** The Unit Owners grid's template, from its columns machine. */
  ownersTemplate: string;
  /** The resident the Units screen selects; null with none. */
  selectedResidentId: string | null;
  onActivate: (tab: string) => void;
  /** Selects a resident by their row's key. */
  onSelectOwner: (key: string) => void;
  onToggleOwner: (key: string) => void;
  onResizeOwners: (index: number, px: number) => void;
  /** There is a unit to add an owner to. */
  canAddOwner: boolean;
  /** There is an owner (Unit Owners) or a unit (Unit Profile) to edit. */
  canEdit: boolean;
  /** There is an owner (Unit Owners) or a unit (Unit Profile) to remove. */
  canDelete: boolean;
  onAddOwner: () => void;
  /** Edits the selected owner on Unit Owners, the unit on Unit Profile. */
  onEdit: () => void;
  /** Removes the selected owner on Unit Owners, deletes the unit on Unit Profile. */
  onDelete: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}
