import { type ReactElement, useState } from "react";

import { must } from "@cl/domain/support/must.ts";
import { useViewModel } from "@cl/react-bindings";

import { PeriodDialog } from "../buildingData/PeriodDialog.tsx";
import { BuildingsTree } from "./BuildingsTree.tsx";
import { ManagementMenu } from "./ManagementMenu.tsx";
import { SidebarFrame } from "./SidebarFrame.tsx";

import "./Sidebar.css";

/**
 * The Buildings module's sidebar, in the shell's frame: the buildings and
 * their periods, and the management menu. Reads the tree, the selection, the
 * navigation and the notices; its ✎ opens Edit Management / Period on the
 * selected period, a dialog whose being open is this view's own state. Its
 * size and fold come from the shell, which keeps them while the person visits
 * another module.
 */
export function Sidebar({
  width,
  open,
  maximized,
  onResize,
  onOpen,
  onClose,
  onRestore,
}: SidebarProps): ReactElement {
  const { useBuildingsTree, useSelectedPeriod, useNavigation, useNotices } =
    useViewModel();
  const buildings = useBuildingsTree();
  const { selected, selectPeriod } = useSelectedPeriod();
  const navigation = useNavigation();
  const { stub } = useNotices();
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);

  function stubAddManagement(): void {
    stub("Add management");
  }

  /** The ✎ is enabled only with a period selected. */
  function editManagement(): void {
    setEditingPeriod(must(selected, "the period to edit").periodId);
  }

  function closePeriodDialog(): void {
    setEditingPeriod(null);
  }

  function stubDeleteManagement(): void {
    stub("Delete management");
  }

  function stubRefresh(): void {
    stub("Refresh");
  }

  return (
    <>
      <SidebarFrame
        width={width}
        open={open}
        maximized={maximized}
        railLabel="MANAGEMENT"
        railTitle="Open management"
        onResize={onResize}
        onOpen={onOpen}
        onClose={onClose}
        onRestore={onRestore}
      >
        <section className="sidebar-card sidebar-card-grow">
          <header className="sidebar-card-header">Select Management</header>
          <div className="sidebar-tools">
            <button
              type="button"
              className="sidebar-tool"
              data-tone="ok"
              aria-label="Add management"
              onClick={stubAddManagement}
            >
              +
            </button>
            <button
              type="button"
              className="sidebar-tool"
              aria-label="Edit management"
              disabled={selected === null}
              onClick={editManagement}
            >
              ✎
            </button>
            <button
              type="button"
              className="sidebar-tool"
              data-tone="neg"
              aria-label="Delete management"
              onClick={stubDeleteManagement}
            >
              −
            </button>
            <span className="sidebar-tools-spacer" />
            <button
              type="button"
              className="sidebar-tool"
              aria-label="Refresh"
              onClick={stubRefresh}
            >
              ⟳
            </button>
          </div>
          <div className="sidebar-card-body">
            <BuildingsTree
              buildings={buildings}
              selectedPeriodId={selected?.periodId ?? null}
              onSelectPeriod={selectPeriod}
            />
          </div>
        </section>
        <section className="sidebar-card">
          <header className="sidebar-card-header">Management Menu</header>
          <ManagementMenu
            active={navigation.state.menu}
            onSelect={navigation.selectMenu}
          />
        </section>
      </SidebarFrame>
      {editingPeriod === null ? null : (
        <PeriodDialog
          periodId={editingPeriod}
          onSaved={closePeriodDialog}
          onCancel={closePeriodDialog}
        />
      )}
    </>
  );
}

export interface SidebarProps {
  width: number;
  /** The drawer, in compact mode. */
  open: boolean;
  /** A panel of the main area fills the screen: the rail stands in for the sidebar. */
  maximized: boolean;
  onResize: (px: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onRestore: () => void;
}
