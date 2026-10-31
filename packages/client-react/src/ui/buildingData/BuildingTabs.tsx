import { Printer } from "lucide-react";
import type { ReactElement } from "react";

import type { Building, Contact } from "@cl/domain";

import { LegendButton } from "../allocation/LegendButton.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { TabbedPanel } from "../TabbedPanel.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TESTIDS } from "../testids.ts";
import { BuildingProfile } from "./BuildingProfile.tsx";
import { BuildingSuppliers } from "./BuildingSuppliers.tsx";
import { BUILDING_TABS, SUPPLIERS_NOTICE } from "./labels.ts";

import "./BuildingTabs.css";

/**
 * The Building Data screen's bottom panel: the selected row's building, its
 * Building Profile and Building Suppliers tabs under one toolbar. On the
 * profile ✎ edits the building, and `+` and − post their notice; on the
 * suppliers `+`, ✎ and − say that suppliers are edited in Contacts. Print,
 * export and the Legend post their notice. With no building the tabs say
 * "Select a building.". Takes only props, so the compiler memoizes it.
 */
export function BuildingTabs({
  active,
  building,
  suppliers,
  supplier,
  suppliersTemplate,
  suppliersRatio,
  onActivate,
  onSelectSupplier,
  onResizeSuppliers,
  onSetSuppliersRatio,
  onEditBuilding,
  onStub,
  onSay,
}: BuildingTabsProps): ReactElement {
  const onSuppliers = active === "Building Suppliers";

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function sayingSuppliers(): void {
    onSay(SUPPLIERS_NOTICE);
  }

  return (
    <div className="building-tabs" data-testid={TESTIDS.buildingTabs}>
      <TabbedPanel
        label="Selected building"
        tabs={BUILDING_TABS}
        active={active}
        onActivate={onActivate}
      >
        <div className="building-tabs-body">
          <Toolbar>
            {onSuppliers ? (
              <>
                <ToolbarButton
                  label="Add supplier"
                  icon="+"
                  tone="ok"
                  iconOnly
                  onClick={sayingSuppliers}
                />
                <ToolbarButton
                  label="Edit supplier"
                  icon="✎"
                  tone="muted"
                  iconOnly
                  onClick={sayingSuppliers}
                />
                <ToolbarButton
                  label="Remove supplier"
                  icon="−"
                  tone="neg"
                  iconOnly
                  onClick={sayingSuppliers}
                />
              </>
            ) : (
              <>
                <ToolbarButton
                  label="Add building"
                  icon="+"
                  tone="ok"
                  iconOnly
                  onClick={stubbing("Add building")}
                />
                <ToolbarButton
                  label="Edit building"
                  icon="✎"
                  tone="muted"
                  iconOnly
                  disabled={building === null}
                  onClick={onEditBuilding}
                />
                <ToolbarButton
                  label="Delete building"
                  icon="−"
                  tone="neg"
                  iconOnly
                  onClick={stubbing("Delete building")}
                />
              </>
            )}
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
            <span className="building-tabs-spacer" />
            <LegendButton onStub={onStub} />
          </Toolbar>
          <div className="building-tabs-content">
            {building === null ? (
              <p
                className="building-tabs-hint"
                data-testid={TESTIDS.buildingSelectHint}
              >
                Select a building.
              </p>
            ) : onSuppliers ? (
              <BuildingSuppliers
                suppliers={suppliers}
                supplier={supplier}
                template={suppliersTemplate}
                ratio={suppliersRatio}
                onSelect={onSelectSupplier}
                onResize={onResizeSuppliers}
                onSetRatio={onSetSuppliersRatio}
              />
            ) : (
              <BuildingProfile building={building} />
            )}
          </div>
        </div>
      </TabbedPanel>
    </div>
  );
}

export interface BuildingTabsProps {
  /** The tab in front: one of BUILDING_TABS. */
  active: string;
  /** The selected row's building; null with none. */
  building: Building | null;
  suppliers: Contact[];
  supplier: Contact | null;
  /** The suppliers' list's grid-template-columns, from its columns machine. */
  suppliersTemplate: string;
  /** The suppliers' list's share of the tab's width. */
  suppliersRatio: number;
  onActivate: (tab: string) => void;
  onSelectSupplier: (contactId: string) => void;
  onResizeSuppliers: (index: number, px: number) => void;
  onSetSuppliersRatio: (ratio: number) => void;
  /** Opens Edit Building on the building shown. */
  onEditBuilding: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
  /** A notice in its own words. */
  onSay: (text: string) => void;
}
