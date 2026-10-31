import { type ReactElement, useEffect, useRef } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { UNIT_OWNERS_COLUMN_SPECS, UNITS_COLUMN_SPECS } from "./columns.ts";
import { UNIT_TABS } from "./labels.ts";
import { type UnitsAddition, UnitsPanel } from "./UnitsPanel.tsx";
import { UnitTabs } from "./UnitTabs.tsx";

import "./UnitsScreen.css";

/**
 * Units, Owners & Personal Balance: the Units grid over the selected unit's
 * Unit Profile and Unit Owners tabs, split by a splitter. Reads the view
 * model and hands plain props down. The selection is the application's: a
 * row of the grid, or an owner of the Unit Owners tab, selects the same way.
 * The maximize machine is the shell's, so a maximized Units panel also folds
 * the sidebar. The split reaches the stylesheet as `--split-ratio`, written
 * in an effect as the tree grid writes its template. The writes' tools post
 * their notice until their dialogs are on screen.
 */
export function UnitsScreen({ maximize }: UnitsScreenProps): ReactElement {
  const {
    useUnits,
    useUnitsGrid,
    useUnitOwnersGrid,
    useColumns,
    useSplit,
    useBottomTab,
    useNotices,
  } = useViewModel();
  const { view, select } = useUnits();
  const grid = useUnitsGrid();
  const ownersGrid = useUnitOwnersGrid();
  const columns = useColumns("units", UNITS_COLUMN_SPECS);
  const ownersColumns = useColumns("unitOwners", UNIT_OWNERS_COLUMN_SPECS);
  const split = useSplit("units");
  const tabs = useBottomTab("units", UNIT_TABS);
  const { stub } = useNotices();
  const screen = useRef<HTMLDivElement>(null);
  const ratio = split.state.ratio;
  const maximized = maximize.state.maximized;
  const selected = view?.selected ?? null;

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

  function stubbing(label: string): () => void {
    return (): void => {
      stub(label);
    };
  }

  function stubAdd(what: UnitsAddition): void {
    stub(ADDITIONS[what]);
  }

  const owners = tabs.state.active === "Unit Owners";

  return (
    <div
      ref={screen}
      className="units-screen"
      data-testid={TESTIDS.unitsScreen}
      data-maximized={maximized ?? "none"}
    >
      <div className="units-top">
        <UnitsPanel
          rows={grid.state.rows}
          selectedKey={selected?.key ?? null}
          unitCount={view?.list.unitCount ?? null}
          template={columns.state.template}
          maximized={maximized === "top"}
          onSelect={select}
          onToggle={grid.toggle}
          onExpandAll={grid.expandAll}
          onCollapseAll={grid.collapseAll}
          onResize={columns.resize}
          onToggleMaximize={toggleTopMaximized}
          onAdd={stubAdd}
          onEdit={stubbing("Edit")}
          onDelete={stubbing("Delete")}
          onStub={stub}
        />
      </div>
      <Splitter direction="horizontal" onDrag={moveSplitBy} />
      <div className="units-bottom">
        <UnitTabs
          active={tabs.state.active}
          unit={view?.unit ?? null}
          location={view?.location ?? ""}
          ownerRows={ownersGrid.state.rows}
          ownersTemplate={ownersColumns.state.template}
          selectedResidentId={selected?.residentId ?? null}
          onActivate={tabs.activate}
          onSelectOwner={select}
          onToggleOwner={ownersGrid.toggle}
          onResizeOwners={ownersColumns.resize}
          onAddOwner={stubbing("Add owner")}
          onEdit={stubbing(owners ? "Edit owner" : "Edit unit")}
          onDelete={stubbing(owners ? "Remove owner" : "Delete unit")}
          onStub={stub}
        />
      </div>
    </div>
  );
}

export interface UnitsScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The `+▾` items' names, for their notice. */
const ADDITIONS: Record<UnitsAddition, string> = {
  group: "New group",
  unit: "New unit",
  owner: "New owner",
};
