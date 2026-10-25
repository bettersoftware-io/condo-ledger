import { type Observable, of, throwError } from "rxjs";

import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { InstallmentsPort } from "#/ports/installmentsPort.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's installments and the items of those installments. */
interface PeriodSchedule {
  installments: Installment[];
  items: InstallmentItem[];
}

/** The installment schedule of every seeded period; it never changes. Errors on an unknown id: it never answers empty for a wrong key. */
export function createInstallmentsSimulator(
  seed: LegacySeed,
): InstallmentsPort {
  const periods = new Map<string, PeriodSchedule>();

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      const installments = seed.installments.filter((installment) => {
        return installment.periodId === period.id;
      });

      const ids = new Set(
        installments.map((installment) => {
          return installment.id;
        }),
      );

      periods.set(period.id, {
        installments,
        items: seed.installmentItems.filter((item) => {
          return ids.has(item.installmentId);
        }),
      });
    }
  }

  return {
    installments: (periodId: string): Observable<Installment[]> => {
      const schedule = periods.get(periodId);

      return schedule === undefined
        ? missing(periodId)
        : of(schedule.installments);
    },
    items: (periodId: string): Observable<InstallmentItem[]> => {
      const schedule = periods.get(periodId);

      return schedule === undefined ? missing(periodId) : of(schedule.items);
    },
  };
}

function missing<T>(periodId: string): Observable<T> {
  return throwError(() => {
    return new Error(`missing: the period ${periodId}`);
  });
}
