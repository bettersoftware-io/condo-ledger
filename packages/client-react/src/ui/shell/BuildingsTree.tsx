import { BuildingComplex, Folder } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { Building } from "@cl/domain";

import { periodLabel } from "./labels.tsx";

import "./Sidebar.css";

/**
 * The buildings with their periods. A building row folds its periods away; a
 * period row selects that period for the whole app. Which buildings are
 * folded is the view's own state: nothing else reads it.
 */
export function BuildingsTree({
  buildings,
  selectedPeriodId,
  onSelectPeriod,
}: BuildingsTreeProps): ReactElement {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());

  function togglingBuilding(buildingId: string): () => void {
    return (): void => {
      const next = new Set(folded);

      if (next.has(buildingId)) {
        next.delete(buildingId);
      } else {
        next.add(buildingId);
      }

      setFolded(next);
    };
  }

  function selectingPeriod(periodId: string): () => void {
    return (): void => {
      onSelectPeriod(periodId);
    };
  }

  return (
    <div className="buildings-tree" role="tree" aria-label="Buildings">
      {buildings.map((building) => {
        const open = !folded.has(building.id);

        return (
          <div key={building.id} role="none">
            <button
              type="button"
              className="buildings-tree-building"
              role="treeitem"
              aria-level={1}
              aria-expanded={open}
              aria-selected={false}
              onClick={togglingBuilding(building.id)}
            >
              <span className="buildings-tree-caret" aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
              <BuildingComplex size={13} aria-hidden="true" />
              <span className="buildings-tree-label">{`${building.name} (Building)`}</span>
            </button>
            {open
              ? building.periods.map((period) => {
                  return (
                    <button
                      key={period.id}
                      type="button"
                      className="buildings-tree-period"
                      role="treeitem"
                      aria-level={2}
                      aria-selected={period.id === selectedPeriodId}
                      onClick={selectingPeriod(period.id)}
                    >
                      <Folder size={13} aria-hidden="true" />
                      <span className="buildings-tree-label">
                        {periodLabel(period)}
                      </span>
                    </button>
                  );
                })
              : null}
          </div>
        );
      })}
    </div>
  );
}

export interface BuildingsTreeProps {
  buildings: Building[];
  selectedPeriodId: string | null;
  onSelectPeriod: (periodId: string) => void;
}
