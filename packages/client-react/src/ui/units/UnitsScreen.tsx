import { type ReactElement, useEffect, useRef, useState } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  UnitsView,
} from "@cl/client-core";
import type {
  OwnerParty,
  PeriodDates,
  Result,
  Unit,
  UnitGroup,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { useDialogWrite } from "../useDialogWrite.ts";
import { UNIT_OWNERS_COLUMN_SPECS, UNITS_COLUMN_SPECS } from "./columns.ts";
import { GroupDialog } from "./GroupDialog.tsx";
import { UNIT_TABS } from "./labels.ts";
import { OwnerDialog } from "./OwnerDialog.tsx";
import { UnitDialog } from "./UnitDialog.tsx";
import { type UnitsAddition, UnitsPanel } from "./UnitsPanel.tsx";
import { UnitTabs } from "./UnitTabs.tsx";
import { unitsReasonText } from "./unitsReasons.ts";

import "./UnitsScreen.css";

/**
 * Units, Owners & Personal Balance: the Units grid over the selected unit's
 * Unit Profile and Unit Owners tabs, split by a splitter. Reads the view
 * model and hands plain props down. The selection is the application's: a
 * row of the grid, or an owner of the Unit Owners tab, selects the same way.
 * The maximize machine is the shell's, so a maximized Units panel also folds
 * the sidebar. The split reaches the stylesheet as `--split-ratio`, written
 * in an effect as the tree grid writes its template. Which dialog is open is
 * this screen's own state: `+▾`, `+` and ✎ open the group, unit or owner
 * dialog, which closes when its write is accepted; − asks first, naming what
 * goes, and shows a refusal in its question with the row still selected.
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
  const { view, select, deleteGroup, deleteUnit, deleteResident } = useUnits();
  const grid = useUnitsGrid();
  const ownersGrid = useUnitOwnersGrid();
  const columns = useColumns("units", UNITS_COLUMN_SPECS);
  const ownersColumns = useColumns("unitOwners", UNIT_OWNERS_COLUMN_SPECS);
  const split = useSplit("units");
  const tabs = useBottomTab("units", UNIT_TABS);
  const { stub } = useNotices();
  const [dialog, setDialog] = useState<UnitsDialog | null>(null);
  const removing = useDialogWrite(closeDialog, "the record was not deleted");
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

  function closeDialog(): void {
    setDialog(null);
  }

  /** The view the tools act on: they are enabled only with one. */
  function shown(): UnitsView {
    return must(view, "the units view");
  }

  function openAdd(what: UnitsAddition): void {
    setDialog({ kind: what, editing: null, period: shown().period });
  }

  function openAddOwner(): void {
    openAdd("owner");
  }

  function editing(target: EditTarget | null): () => void {
    return (): void => {
      const { kind, id } = must(target, "the record to edit");

      setDialog({ kind, editing: id, period: shown().period });
    };
  }

  function asking(target: DeleteTarget | null): () => void {
    return (): void => {
      removing.forget();
      setDialog({
        kind: "delete",
        target: must(target, "the record to delete"),
      });
    };
  }

  function confirmDeleteOf(target: DeleteTarget): () => void {
    return (): void => {
      removing.run(() => {
        return deleteOf(target);
      });
    };
  }

  function deleteOf(target: DeleteTarget): Promise<Result> {
    switch (target.kind) {
      case "group":
        return deleteGroup(target.group.id);
      case "unit":
        return deleteUnit(target.unit.id);
      case "resident":
        return deleteResident(target.resident.id);
    }
  }

  const owners = tabs.state.active === "Unit Owners";
  const topEdit = topEditOf(view);
  const topDelete = topDeleteOf(view);
  const bottomEdit = bottomEditOf(view, owners);
  const bottomDelete = bottomDeleteOf(view, owners);

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
          canAdd={view !== null}
          canAddOwner={view?.unit != null}
          canEdit={topEdit !== null}
          canDelete={topDelete !== null}
          onAdd={openAdd}
          onEdit={editing(topEdit)}
          onDelete={asking(topDelete)}
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
          canAddOwner={view?.unit != null}
          canEdit={bottomEdit !== null}
          canDelete={bottomDelete !== null}
          onAddOwner={openAddOwner}
          onEdit={editing(bottomEdit)}
          onDelete={asking(bottomDelete)}
          onStub={stub}
        />
      </div>
      {dialog?.kind === "group" ? (
        <GroupDialog
          editing={dialog.editing}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "unit" ? (
        <UnitDialog
          editing={dialog.editing}
          period={dialog.period}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "owner" ? (
        <OwnerDialog
          editing={dialog.editing}
          period={dialog.period}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmAlert
          text={questionOf(dialog.target)}
          error={
            removing.refusal === null ? null : unitsReasonText(removing.refusal)
          }
          onYes={confirmDeleteOf(dialog.target)}
          onNo={closeDialog}
        />
      ) : null}
    </div>
  );
}

export interface UnitsScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The dialog over the screen: a group, a unit or an owner, new or edited, or the question before one goes. */
type UnitsDialog = RecordDialog | DeleteDialog;

interface RecordDialog {
  kind: UnitsAddition;
  /** The id of the record edited; null for a new one. */
  editing: string | null;
  /** The period the dialog opened in, for the reasons that name its dates. */
  period: PeriodDates;
}

interface DeleteDialog {
  kind: "delete";
  target: DeleteTarget;
}

/** What ✎ opens: the dialog's kind and the record's id. */
interface EditTarget {
  kind: UnitsAddition;
  id: string;
}

/** What − asks about: a group, a unit, or a resident of a unit. */
type DeleteTarget = GroupTarget | UnitTarget | ResidentTarget;

interface GroupTarget {
  kind: "group";
  group: UnitGroup;
}

interface UnitTarget {
  kind: "unit";
  unit: Unit;
}

interface ResidentTarget {
  kind: "resident";
  resident: OwnerParty;
}

/** The top ✎: the selected group, the selected resident, else the selected unit; nothing on the root and the rounding row. */
function topEditOf(view: UnitsView | null): EditTarget | null {
  const target = topDeleteOf(view) ?? groupOf(view);

  return target === null ? null : editOf(target);
}

/** The top −: an empty group, the selected resident, else the selected unit; nothing on the root, the rounding row and a group with something in it. */
function topDeleteOf(view: UnitsView | null): DeleteTarget | null {
  if (view?.group != null) {
    return view.groupDeletable ? groupOf(view) : null;
  }

  return view?.selected?.kind === "resident" ? residentOf(view) : unitOf(view);
}

/** The bottom ✎: the selected owner on Unit Owners, the unit on Unit Profile. */
function bottomEditOf(
  view: UnitsView | null,
  owners: boolean,
): EditTarget | null {
  const target = bottomDeleteOf(view, owners);

  return target === null ? null : editOf(target);
}

/** The bottom −: the selected owner on Unit Owners, the unit on Unit Profile. */
function bottomDeleteOf(
  view: UnitsView | null,
  owners: boolean,
): DeleteTarget | null {
  return owners ? residentOf(view) : unitOf(view);
}

function groupOf(view: UnitsView | null): GroupTarget | null {
  return view?.group == null ? null : { kind: "group", group: view.group };
}

function unitOf(view: UnitsView | null): UnitTarget | null {
  return view?.unit == null ? null : { kind: "unit", unit: view.unit };
}

function residentOf(view: UnitsView | null): ResidentTarget | null {
  return view?.resident == null
    ? null
    : { kind: "resident", resident: view.resident };
}

/** The dialog that edits what − would ask about. */
function editOf(target: DeleteTarget): EditTarget {
  switch (target.kind) {
    case "group":
      return { kind: "group", id: target.group.id };
    case "unit":
      return { kind: "unit", id: target.unit.id };
    case "resident":
      return { kind: "owner", id: target.resident.id };
  }
}

/** The question before a delete, naming what goes. */
function questionOf(target: DeleteTarget): string {
  switch (target.kind) {
    case "group":
      return `Delete the group ${target.group.code} - ${target.group.name}?`;
    case "unit":
      return `Delete the unit ${target.unit.code}?`;
    case "resident":
      return `Remove ${target.resident.name} from ${target.resident.unitCode}?`;
  }
}
