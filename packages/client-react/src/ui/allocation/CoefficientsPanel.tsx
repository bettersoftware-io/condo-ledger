import { RotateCw } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";

import {
  type CoefficientsGridState,
  tenThousandthsText,
} from "@cl/client-core";
import type { Result } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { InlineEditor } from "../InlineEditor.tsx";
import { Panel } from "../Panel.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { allocationReasonText } from "./allocationReasons.ts";
import { Coefficient } from "./Coefficient.tsx";
import { COEFFICIENTS_COLUMNS } from "./columns.ts";
import { LegendButton } from "./LegendButton.tsx";

import "./allocationPanels.css";
import "./CoefficientsPanel.css";

/**
 * Table Coefficients: the selected table's groups and units, a group bold
 * with the sum of its units. A unit's coefficient is edited in place: a click
 * opens the editor on it, Enter or a blur hands the text to the write, Escape
 * cancels; a refusal stays in the editor with its words. Which unit is being
 * edited, and what is wrong with its text, is this view's own state. Takes
 * only props and the locale, so the compiler memoizes it.
 */
export function CoefficientsPanel({
  rows,
  template,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onResize,
  onSetCoefficient,
  onStub,
}: CoefficientsPanelProps): ReactElement {
  const [edit, setEdit] = useState<CoefficientEdit>(NOT_EDITING);
  const locale = useLocale();

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function editingOf(key: string): () => void {
    return (): void => {
      setEdit({ editing: key, error: null });
    };
  }

  /** The commit of the editor on row `key`, which opened showing `before`. */
  function committingOf(key: string, before: string): (text: string) => void {
    return (text: string): void => {
      // Leaving the text as it was is a cancel: nothing to write.
      if (text === before) {
        settleOf(key, NOT_EDITING);

        return;
      }

      // A keypress waits for nothing: the new coefficient comes back on the
      // tables' stream, and the verdict is shown when it arrives.
      void onSetCoefficient(unitIdOf(key), text)
        .then(showingVerdictOf(key))
        .catch(reportUnsaved);
    };
  }

  function showingVerdictOf(key: string): (result: Result) => void {
    return (result: Result): void => {
      settleOf(
        key,
        result.ok
          ? NOT_EDITING
          : { editing: key, error: allocationReasonText(result) },
      );
    };
  }

  /** Applies what a commit on row `key` decided, unless another row's editor has opened since. */
  function settleOf(key: string, next: CoefficientEdit): void {
    setEdit((current) => {
      return current.editing === key ? next : current;
    });
  }

  function cancelEdit(): void {
    setEdit(NOT_EDITING);
  }

  function coefficientCellOf(row: GridRow): ReactNode {
    const { node } = row;

    if (node.kind === "group") {
      return <Coefficient key="coefficient" value={node.value} emphasis />;
    }

    if (edit.editing === row.key) {
      const before = tenThousandthsText(node.value, locale);

      return (
        <InlineEditor
          key="coefficient"
          value={before}
          error={edit.error}
          onCommit={committingOf(row.key, before)}
          onCancel={cancelEdit}
        />
      );
    }

    return (
      <button
        key="coefficient"
        type="button"
        className="coefficients-cell"
        data-testid={TESTIDS.coefficientCell}
        onClick={editingOf(row.key)}
      >
        <Coefficient value={node.value} />
      </button>
    );
  }

  return (
    <div className="allocation-panel" data-testid={TESTIDS.coefficientsPanel}>
      <Panel title="Table Coefficients" meta={<LegendButton onStub={onStub} />}>
        <div className="allocation-panel-body">
          <div className="allocation-panel-grid">
            <TreeGrid
              columns={COEFFICIENTS_COLUMNS}
              template={template}
              rows={rows.map((row) => {
                return rowDataOf(row, coefficientCellOf(row));
              })}
              emptyMessage="No table is selected."
              onToggle={onToggle}
              // Only the tables select: a click on a coefficient's row does nothing.
              onSelect={ignore}
              onResize={onResize}
            />
          </div>
          <div className="allocation-panel-foot">
            <Toolbar>
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
              <span className="allocation-spacer" />
              <ToolbarButton
                label="Refresh"
                icon={<RotateCw size={13} />}
                tone="muted"
                iconOnly
                onClick={stubbing("Refresh")}
              />
            </Toolbar>
          </div>
        </div>
      </Panel>
    </div>
  );
}

type GridRow = CoefficientsGridState["rows"][number];

export interface CoefficientsPanelProps {
  /** The grid machine's rows of the selected table's coefficients. */
  rows: GridRow[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResize: (index: number, px: number) => void;
  /** Saves the unit's coefficient in the selected table from the text typed; the verdict comes back. */
  onSetCoefficient: (unitId: string, text: string) => Promise<Result>;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

/** The unit whose coefficient is being edited, by its row's key, and what is wrong with its text. */
interface CoefficientEdit {
  editing: string | null;
  error: string | null;
}

const NOT_EDITING: CoefficientEdit = { editing: null, error: null };

/** A group's row is an aggregate: bold, on the zebra background. */
function rowDataOf(row: GridRow, coefficient: ReactNode): TreeGridRowData {
  const { node } = row;
  const group = node.kind === "group";

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: false,
    emphasis: group,
    zebra: group,
    icon: null,
    label: node.label,
    cells: [
      <span key="period" className="allocation-text">
        {node.period}
      </span>,
      coefficient,
    ],
  };
}

/** The domain keys a unit's node `unit:{unitId}`. */
function unitIdOf(key: string): string {
  return key.slice("unit:".length);
}

function ignore(): void {
  // Nothing: see the grid's onSelect.
}

/* v8 ignore next 3 -- the simulator answers every coefficient write: only a real store fails otherwise */
function reportUnsaved(error: unknown): void {
  console.error("the coefficient was not saved", error);
}
