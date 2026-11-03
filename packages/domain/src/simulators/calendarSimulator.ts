import { BehaviorSubject, map, type Observable } from "rxjs";

import type { Building } from "#/entities/building.ts";
import type { ManualDeadline } from "#/entities/deadline.ts";
import {
  type Added,
  accepted,
  ok,
  type Result,
  type ResultOf,
} from "#/entities/result.ts";
import type { CalendarPort } from "#/ports/calendarPort.ts";
import { must } from "#/support/must.ts";
import {
  type DeadlineDraft,
  validateDeadline,
} from "#/useCases/calendar/validateDeadline.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/**
 * The seed's hand-entered deadlines, with what is written kept in memory. A
 * write is judged against `buildings()` as it stands then. New deadlines are
 * `ce<n>` (the highest number held plus one). Throws on an id it does not
 * hold.
 */
export function createCalendarSimulator(
  seed: LegacySeed,
  buildings: () => Building[],
): CalendarPort {
  const deadlines$ = new BehaviorSubject<ManualDeadline[]>(seed.deadlines);

  function deadlineIn(id: string): ManualDeadline {
    return must(
      deadlines$.getValue().find((deadline) => {
        return deadline.id === id;
      }),
      `the deadline ${id}`,
    );
  }

  function addDeadline(draft: DeadlineDraft): ResultOf<Added> {
    const verdict = validateDeadline(draft, buildings());

    if (!verdict.ok) {
      return verdict;
    }

    const held = deadlines$.getValue();
    const id = `ce${highestNumber(held) + 1}`;

    deadlines$.next([...held, stored(id, draft)]);

    return accepted({ id });
  }

  function editDeadline(id: string, draft: DeadlineDraft): Result {
    deadlineIn(id);

    const verdict = validateDeadline(draft, buildings());

    if (verdict.ok) {
      deadlines$.next(
        deadlines$.getValue().map((deadline) => {
          return deadline.id === id ? stored(id, draft) : deadline;
        }),
      );
    }

    return verdict;
  }

  function deleteDeadline(id: string): Result {
    deadlineIn(id);
    deadlines$.next(
      deadlines$.getValue().filter((deadline) => {
        return deadline.id !== id;
      }),
    );

    return ok();
  }

  return {
    deadlines: (): Observable<ManualDeadline[]> => {
      return deadlines$.pipe(
        map((all) => {
          return [...all].sort(byDayTimeNumber);
        }),
      );
    },
    // A throw inside the executor is a rejection, as the port promises.
    addDeadline: (draft: DeadlineDraft): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addDeadline(draft));
      });
    },
    editDeadline: (id: string, draft: DeadlineDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editDeadline(id, draft));
      });
    },
    deleteDeadline: (id: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteDeadline(id));
      });
    },
  };
}

/** The draft as the port holds it: with its id and its description trimmed. */
function stored(id: string, draft: DeadlineDraft): ManualDeadline {
  return { ...draft, id, description: draft.description.trim() };
}

function byDayTimeNumber(a: ManualDeadline, b: ManualDeadline): number {
  // No time sorts as "", before every "HH:MM".
  const keyA = `${a.date} ${a.time ?? ""}`;
  const keyB = `${b.date} ${b.time ?? ""}`;

  if (keyA === keyB) {
    return numberOf(a.id) - numberOf(b.id);
  }

  return keyA < keyB ? -1 : 1;
}

function numberOf(id: string): number {
  return Number(/^ce(\d+)$/.exec(id)?.[1] ?? 0);
}

/** The highest number among the ids `ce<n>`; 0 with none. */
function highestNumber(deadlines: ManualDeadline[]): number {
  return Math.max(
    0,
    ...deadlines.map((deadline) => {
      return numberOf(deadline.id);
    }),
  );
}
