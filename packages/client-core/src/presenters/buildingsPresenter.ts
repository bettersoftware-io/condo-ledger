import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, combineLatest, map } from "rxjs";

import { type Building, type BuildingsPort, periodLabelText } from "@cl/domain";

export interface PeriodSelection {
  buildingId: string;
  periodId: string;
}

export interface BuildingsPresenter {
  tree$: DefaultedStateObservable<Building[]>;
  selected$: DefaultedStateObservable<PeriodSelection | null>;
  selectPeriod: (periodId: string) => void;
}

/** The sidebar's tree and the one selection every building-scoped screen reads. */
export function createBuildingsPresenter(
  port: BuildingsPort,
): BuildingsPresenter {
  const chosen$ = new BehaviorSubject<string | null>(null);
  const tree$ = state(port.buildings(), []);
  const selected$ = state(
    combineLatest([tree$, chosen$]).pipe(
      map(([tree, chosen]) => {
        return resolve(tree, chosen);
      }),
    ),
    null,
  );

  return {
    tree$,
    selected$,
    selectPeriod: (periodId: string): void => {
      chosen$.next(periodId);
    },
  };
}

/** The chosen period with its building; the first period of the first building when none is chosen. */
function resolve(
  tree: Building[],
  chosen: string | null,
): PeriodSelection | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (chosen === null || period.id === chosen) {
        return { buildingId: building.id, periodId: period.id };
      }
    }
  }

  if (chosen !== null) {
    throw new Error(`missing: the period ${chosen}`);
  }

  return null;
}

/** "{building} / {period} ({address})" of the period (see `periodLabelText`); null when the tree does not hold it. */
export function periodLabelOf(
  tree: Building[],
  periodId: string,
): string | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (period.id === periodId) {
        return periodLabelText(building, period);
      }
    }
  }

  return null;
}
