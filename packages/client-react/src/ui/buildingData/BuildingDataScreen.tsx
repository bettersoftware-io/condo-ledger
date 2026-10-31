import { type ReactElement, useEffect, useRef, useState } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import type { BuildingRow } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { BuildingDataPanel } from "./BuildingDataPanel.tsx";
import { BuildingDialog } from "./BuildingDialog.tsx";
import { BuildingTabs } from "./BuildingTabs.tsx";
import {
  BUILDING_DATA_COLUMN_SPECS,
  SUPPLIERS_COLUMN_SPECS,
} from "./columns.ts";
import { BUILDING_TABS } from "./labels.ts";
import { PeriodDialog } from "./PeriodDialog.tsx";

import "./BuildingDataScreen.css";

/**
 * Building Data & Suppliers: the Building Data grid over the selected row's
 * building, its Building Profile and Building Suppliers tabs, split by a
 * splitter. Reads the view model and hands plain props down. A period's row
 * clicked is the application's period too. The maximize machine is the
 * shell's, so a maximized panel also folds the sidebar. The split reaches
 * the stylesheet as `--split-ratio`, written in an effect. Which dialog is
 * open is this screen's own state: the top ✎ edits the selected building or
 * period, the profile's ✎ its building; each closes when its write is
 * accepted.
 */
export function BuildingDataScreen({
  maximize,
}: BuildingDataScreenProps): ReactElement {
  const {
    useBuildingData,
    useBuildingDataGrid,
    useColumns,
    useSplit,
    useBottomTab,
    useNotices,
  } = useViewModel();
  const { view, select, selectSupplier } = useBuildingData();
  const grid = useBuildingDataGrid();
  const columns = useColumns("buildingData", BUILDING_DATA_COLUMN_SPECS);
  const suppliersColumns = useColumns("suppliers", SUPPLIERS_COLUMN_SPECS);
  const split = useSplit("buildingData");
  const suppliersSplit = useSplit("suppliers");
  const tabs = useBottomTab("buildingData", BUILDING_TABS);
  const { stub, say } = useNotices();
  const [dialog, setDialog] = useState<BuildingDataDialog | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  const ratio = split.state.ratio;
  const maximized = maximize.state.maximized;
  const { selected, building } = view;

  useEffect(() => {
    screen.current?.style.setProperty("--split-ratio", String(ratio));
  }, [ratio]);

  function moveSplitBy(deltaPx: number): void {
    const height = screen.current?.getBoundingClientRect().height ?? 0;

    if (height > 0) {
      split.setRatio(ratio + deltaPx / height);
    }
  }

  function toggleTopMaximized(): void {
    maximize.toggle("top");
  }

  function closeDialog(): void {
    setDialog(null);
  }

  /** The top ✎: it is enabled only with a row selected. */
  function editSelected(): void {
    setDialog(dialogOf(must(selected, "the row to edit")));
  }

  /** The profile's ✎: it is enabled only with a building shown. */
  function editBuilding(): void {
    setDialog({
      kind: "building",
      id: must(building, "the building to edit").id,
    });
  }

  return (
    <div
      ref={screen}
      className="building-data-screen"
      data-testid={TESTIDS.buildingDataScreen}
      data-maximized={maximized ?? "none"}
    >
      <div className="building-data-top">
        <BuildingDataPanel
          rows={grid.state.rows}
          selectedKey={selected?.key ?? null}
          buildingCount={view.rows.length}
          template={columns.state.template}
          maximized={maximized === "top"}
          canEdit={selected !== null}
          onSelect={select}
          onToggle={grid.toggle}
          onExpandAll={grid.expandAll}
          onCollapseAll={grid.collapseAll}
          onResize={columns.resize}
          onToggleMaximize={toggleTopMaximized}
          onEdit={editSelected}
          onStub={stub}
        />
      </div>
      <Splitter direction="horizontal" onDrag={moveSplitBy} />
      <div className="building-data-bottom">
        <BuildingTabs
          active={tabs.state.active}
          building={building}
          suppliers={view.suppliers}
          supplier={view.supplier}
          suppliersTemplate={suppliersColumns.state.template}
          suppliersRatio={suppliersSplit.state.ratio}
          onActivate={tabs.activate}
          onSelectSupplier={selectSupplier}
          onResizeSuppliers={suppliersColumns.resize}
          onSetSuppliersRatio={suppliersSplit.setRatio}
          onEditBuilding={editBuilding}
          onStub={stub}
          onSay={say}
        />
      </div>
      {dialog?.kind === "building" ? (
        <BuildingDialog
          buildingId={dialog.id}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "period" ? (
        <PeriodDialog
          periodId={dialog.id}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
    </div>
  );
}

export interface BuildingDataScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The dialog over the screen: Edit Building or Edit Management / Period, on the record's id. */
interface BuildingDataDialog {
  kind: "building" | "period";
  id: string;
}

/** What the top ✎ opens on a row: its building, or its period. */
function dialogOf(row: BuildingRow): BuildingDataDialog {
  return row.periodId === null
    ? { kind: "building", id: row.buildingId }
    : { kind: "period", id: row.periodId };
}
