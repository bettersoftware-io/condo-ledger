import { type Observable, of, throwError } from "rxjs";

import type { JournalEntry } from "#/entities/journal.ts";
import type { JournalPort } from "#/ports/journalPort.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's journal, a period at a time, in number order. Errors on an unknown period: it never answers empty for a wrong key. */
export function createJournalSimulator(seed: LegacySeed): JournalPort {
  const periodIds = new Set(
    seed.buildings.flatMap((building) => {
      return building.periods.map((period) => {
        return period.id;
      });
    }),
  );

  return {
    entries: (periodId: string): Observable<JournalEntry[]> => {
      if (!periodIds.has(periodId)) {
        return throwError(() => {
          return new Error(`missing: the period ${periodId}`);
        });
      }

      return of(
        seed.entries
          .filter((entry) => {
            return entry.periodId === periodId;
          })
          .sort((a, b) => {
            return a.number - b.number;
          }),
      );
    },
  };
}
