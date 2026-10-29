import { type ReactElement, useState } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  ScheduleGridRow,
} from "@cl/client-core";
import type { Cents, Installment, Result } from "@cl/domain";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { Panel } from "../Panel.tsx";
import { TESTIDS } from "../testids.ts";
import { BudgetInstallmentsWizard } from "./BudgetInstallmentsWizard.tsx";
import { scheduleColumnSpecs } from "./columns.ts";
import { InstallmentDialog } from "./InstallmentDialog.tsx";
import { scheduleReasonText } from "./reasons.ts";
import { ScheduleGrid } from "./ScheduleGrid.tsx";
import { ScheduleToolbar } from "./ScheduleToolbar.tsx";
import { useScheduleWrite } from "./useScheduleWrite.ts";

import "./InstallmentScheduleScreen.css";

/**
 * Installment Schedule: the period's installments, one row per unit and
 * resident, in one panel. Reads the view model and hands plain props down.
 * The maximize machine is the shell's, so a maximized panel also folds the
 * sidebar. Which dialog is open is this screen's own state: Delete asks
 * here, and shows a refusal in its question; Create budget installments and
 * Edit open their own dialogs, which close when their write is accepted.
 */
export function InstallmentScheduleScreen({
  maximize,
}: InstallmentScheduleScreenProps): ReactElement {
  const { useSchedule, useScheduleGrid, useNotices } = useViewModel();
  const { schedule, deleteInstallment, setItemAmount } = useSchedule();
  const grid = useScheduleGrid();
  const { stub } = useNotices();
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null);
  const deleting = useScheduleWrite(
    closeDialog,
    "the installment was not deleted",
  );
  const installments = schedule?.installments ?? [];
  const maximized = maximize.state.maximized;

  function toggleMaximized(): void {
    maximize.toggle("top");
  }

  function openBudgetWizard(): void {
    setDialog({ kind: "budget" });
  }

  function openEdit(installmentId: string): void {
    setDialog({ kind: "edit", installmentId });
  }

  function openDelete(installment: Installment): void {
    deleting.forget();
    setDialog({ kind: "delete", installment });
  }

  function closeDialog(): void {
    setDialog(null);
  }

  function confirmDeleteOf(installment: Installment): () => void {
    return (): void => {
      deleting.run(() => {
        return deleteInstallment(installment.id);
      });
    };
  }

  return (
    <div
      className="schedule-screen"
      data-testid={TESTIDS.installmentScheduleScreen}
      data-maximized={maximized ?? "none"}
    >
      <Panel
        title="Installment Schedule"
        maximized={maximized === "top"}
        onToggleMaximize={toggleMaximized}
      >
        <div className="schedule-body">
          <ScheduleToolbar
            installments={installments}
            onCreateBudget={openBudgetWizard}
            onEdit={openEdit}
            onDelete={openDelete}
            onExpandAll={grid.expandAll}
            onCollapseAll={grid.collapseAll}
            onStub={stub}
          />
          <div className="schedule-grid">
            <ScheduleGridArea
              rows={grid.state.rows}
              installments={installments}
              onToggle={grid.toggle}
              onSetItemAmount={setItemAmount}
            />
          </div>
        </div>
      </Panel>
      {dialog?.kind === "delete" ? (
        <ConfirmAlert
          text={`Delete the installment “${dialog.installment.name}”? This cannot be undone.`}
          error={
            deleting.refusal === null
              ? null
              : scheduleReasonText(deleting.refusal)
          }
          onYes={confirmDeleteOf(dialog.installment)}
          onNo={closeDialog}
        />
      ) : null}
      {dialog?.kind === "budget" ? (
        <BudgetInstallmentsWizard
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "edit" ? (
        <InstallmentDialog
          // The dialog's machine is built for the installment it opens on.
          key={dialog.installmentId}
          installmentId={dialog.installmentId}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
    </div>
  );
}

export interface InstallmentScheduleScreenProps {
  /** The shell's: whether the schedule fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The dialog over the schedule: the budget wizard, an installment's edit, or the question before one goes. */
type ScheduleDialog =
  | BudgetWizardDialog
  | EditInstallmentDialog
  | DeleteInstallmentDialog;

interface BudgetWizardDialog {
  kind: "budget";
}

interface EditInstallmentDialog {
  kind: "edit";
  installmentId: string;
}

interface DeleteInstallmentDialog {
  kind: "delete";
  installment: Installment;
}

interface ScheduleGridAreaProps {
  rows: ScheduleGridRow[];
  installments: Installment[];
  onToggle: (key: string) => void;
  onSetItemAmount: (itemId: string, amount: Cents) => Promise<Result>;
}

/** The grid with the column widths kept for its count of installments. */
function ScheduleGridArea({
  rows,
  installments,
  onToggle,
  onSetItemAmount,
}: ScheduleGridAreaProps): ReactElement {
  const { useColumns } = useViewModel();
  const columns = useColumns(
    "schedule",
    scheduleColumnSpecs(installments.length),
  );

  return (
    <ScheduleGrid
      rows={rows}
      installments={installments}
      template={columns.state.template}
      onToggle={onToggle}
      onResize={columns.resize}
      onSetItemAmount={onSetItemAmount}
    />
  );
}
