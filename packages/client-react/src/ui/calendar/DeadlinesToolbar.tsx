import type { ReactElement } from "react";

import type { Deadline } from "@cl/domain";

import { ToolbarButton } from "../ToolbarButton.tsx";
import { TESTIDS } from "../testids.ts";

import "./DeadlinesColumn.css";

/**
 * The deadlines panel's + ✎ −: + adds a deadline on the selected day; ✎ and −
 * act on the selected one, and on one worked out from the books they are
 * disabled, their tooltip saying where to change it. Takes only props, so the
 * compiler memoizes it.
 */
export function DeadlinesToolbar({
  selected,
  onAdd,
  onEdit,
  onDelete,
}: DeadlinesToolbarProps): ReactElement {
  const why = selected === null ? undefined : computedReason(selected);
  const locked = selected === null || why !== undefined;

  return (
    <div className="deadlines-toolbar" data-testid={TESTIDS.deadlinesToolbar}>
      <ToolbarButton
        label="Add deadline"
        icon={<span>+</span>}
        iconOnly
        tone="ok"
        title="Add a deadline on this day"
        onClick={onAdd}
      />
      <ToolbarButton
        label="Edit deadline"
        icon={<span>✎</span>}
        iconOnly
        tone="muted"
        disabled={locked}
        title={why ?? "Edit the deadline"}
        onClick={onEdit}
      />
      <ToolbarButton
        label="Delete deadline"
        icon={<span>−</span>}
        iconOnly
        tone="neg"
        disabled={locked}
        title={why ?? "Delete the deadline"}
        onClick={onDelete}
      />
    </div>
  );
}

export interface DeadlinesToolbarProps {
  selected: Deadline | null;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Why a deadline worked out from the books cannot be changed here; undefined for a typed one. */
function computedReason(deadline: Deadline): string | undefined {
  switch (deadline.source) {
    case "manual":
      return undefined;
    case "installment":
      return "Worked out from the installment: change it in the Installment Schedule";
    case "invoice":
      return "Worked out from the invoice: change it in the Journal";
  }
}
