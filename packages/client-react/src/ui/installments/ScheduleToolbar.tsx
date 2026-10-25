import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { Installment } from "@cl/domain";

import { MenuItem } from "../MenuItem.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Popover } from "../shell/Popover.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TESTIDS } from "../testids.ts";

import "./ScheduleToolbar.css";

/**
 * The design's Installment Schedule toolbar: the grouping (by unit only, as
 * the legacy combo was disabled), the Add, Edit and Delete menus, expand and
 * collapse all, print and export, and refresh. Which menu is open is this
 * view's own state. What is not built yet posts a notice through `onStub`
 * with its name.
 */
export function ScheduleToolbar({
  installments,
  onCreateBudget,
  onEdit,
  onDelete,
  onExpandAll,
  onCollapseAll,
  onStub,
}: ScheduleToolbarProps): ReactElement {
  const [menu, setMenu] = useState<Menu | null>(null);
  const deletable = installments.filter((installment) => {
    return !installment.locked;
  });

  function openAdd(): void {
    setMenu("add");
  }

  function openEdit(): void {
    setMenu("edit");
  }

  function openDelete(): void {
    setMenu("delete");
  }

  function closeMenu(): void {
    setMenu(null);
  }

  function stubbing(label: string): () => void {
    return (): void => {
      setMenu(null);
      onStub(label);
    };
  }

  function createBudget(): void {
    setMenu(null);
    onCreateBudget();
  }

  function editing(id: string): () => void {
    return (): void => {
      setMenu(null);
      onEdit(id);
    };
  }

  function deleting(installment: Installment): () => void {
    return (): void => {
      setMenu(null);
      onDelete(installment);
    };
  }

  return (
    <Toolbar>
      <span className="schedule-group-by" data-testid={TESTIDS.scheduleGroupBy}>
        Group rows by: <strong>By unit</strong>
      </span>
      <ToolbarDivider />
      <div className="schedule-menu-anchor">
        <ToolbarButton
          label="Add installments"
          icon="+"
          text="▾"
          tone="ok"
          menuOpen={menu === "add"}
          onClick={openAdd}
        />
        <Popover
          open={menu === "add"}
          label="Add installments"
          width="wide"
          onClose={closeMenu}
        >
          <MenuItem
            label="Create advance installment"
            icon="＋"
            onClick={stubbing("Create advance installment")}
          />
          <MenuItem
            label="Create budget installments"
            icon="≣"
            onClick={createBudget}
          />
          <MenuItem
            label="Create adjustment installment"
            icon="±"
            onClick={stubbing("Create adjustment installment")}
          />
        </Popover>
      </div>
      <div className="schedule-menu-anchor">
        <ToolbarButton
          label="Edit installments"
          icon="✎"
          text="▾"
          tone="muted"
          menuOpen={menu === "edit"}
          onClick={openEdit}
        />
        <Popover
          open={menu === "edit"}
          label="Edit installments"
          width="wide"
          onClose={closeMenu}
        >
          {installments.length === 0 ? (
            <MenuEmpty text="No installments to edit." />
          ) : (
            installments.map((installment) => {
              return (
                <MenuItem
                  key={installment.id}
                  label={`Edit "${installment.name}"`}
                  onClick={editing(installment.id)}
                />
              );
            })
          )}
        </Popover>
      </div>
      <div className="schedule-menu-anchor">
        <ToolbarButton
          label="Delete installments"
          icon="−"
          text="▾"
          tone="neg"
          menuOpen={menu === "delete"}
          onClick={openDelete}
        />
        <Popover
          open={menu === "delete"}
          label="Delete installments"
          width="wide"
          onClose={closeMenu}
        >
          {deletable.length === 0 ? (
            <MenuEmpty text="No installments to delete." />
          ) : (
            deletable.map((installment) => {
              return (
                <MenuItem
                  key={installment.id}
                  label={`Delete "${installment.name}"`}
                  onClick={deleting(installment)}
                />
              );
            })
          )}
        </Popover>
      </div>
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
        label="Print schedule"
        icon={<Printer size={14} />}
        tone="muted"
        iconOnly
        onClick={stubbing("Print schedule")}
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
      <span className="schedule-toolbar-spacer" />
      <ToolbarButton
        label="Refresh"
        icon={<RotateCw size={13} />}
        tone="muted"
        iconOnly
        onClick={stubbing("Refresh")}
      />
    </Toolbar>
  );
}

export interface ScheduleToolbarProps {
  /** The period's installments, in number order. */
  installments: Installment[];
  /** Opens the Create budget installments wizard. */
  onCreateBudget: () => void;
  /** Opens the installment's Edit dialog. */
  onEdit: (installmentId: string) => void;
  /** Asks before the installment goes. */
  onDelete: (installment: Installment) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** A tool or a menu item that is not built yet, by name. */
  onStub: (label: string) => void;
}

type Menu = "add" | "edit" | "delete";

interface MenuEmptyProps {
  text: string;
}

/** What a menu with nothing to offer says in place of its items. */
function MenuEmpty({ text }: MenuEmptyProps): ReactElement {
  return (
    <div
      className="schedule-menu-empty"
      data-testid={TESTIDS.scheduleMenuEmpty}
    >
      {text}
    </div>
  );
}
