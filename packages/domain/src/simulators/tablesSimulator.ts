import { BehaviorSubject, type Observable, throwError } from "rxjs";

import type { Account } from "#/entities/account.ts";
import { accepted, ok, type Result, type ResultOf } from "#/entities/result.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { TableAdded, TablesPort } from "#/ports/tablesPort.ts";
import { must } from "#/support/must.ts";
import {
  type TableDraft,
  validateCoefficient,
  validateTable,
  validateTableDelete,
} from "#/useCases/validateTable.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's tables and coefficients, kept in memory, and the ids of its units. */
interface PeriodTables {
  periodId: string;
  tables$: BehaviorSubject<ThousandthTable[]>;
  coefficients$: BehaviorSubject<Coefficient[]>;
  unitIds: string[];
}

/**
 * The seed's thousandth tables, a period at a time, with what is written kept
 * in memory. A delete is judged against the accounts as `accountsOf` answers
 * them now; left out, the seed's accounts. New tables are `dt-new-<n>`.
 * Throws on an unknown id: it never answers empty for a wrong key.
 */
export function createTablesSimulator(
  seed: LegacySeed,
  accountsOf: (periodId: string) => Account[] = (
    periodId: string,
  ): Account[] => {
    return seed.accounts.filter((account) => {
      return account.periodId === periodId;
    });
  },
): TablesPort {
  const periods = new Map<string, PeriodTables>();
  let tablesAdded = 0;

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      const tables = seed.tables.filter((table) => {
        return table.periodId === period.id;
      });

      const ids = new Set(
        tables.map((table) => {
          return table.id;
        }),
      );

      periods.set(period.id, {
        periodId: period.id,
        tables$: new BehaviorSubject(ranked(tables)),
        coefficients$: new BehaviorSubject(
          seed.coefficients.filter((coefficient) => {
            return ids.has(coefficient.tableId);
          }),
        ),
        unitIds: seed.units
          .filter((unit) => {
            return unit.periodId === period.id;
          })
          .map((unit) => {
            return unit.id;
          }),
      });
    }
  }

  function stateOf(periodId: string): PeriodTables {
    return must(periods.get(periodId), `the period ${periodId}`);
  }

  function holderOfTable(tableId: string): PeriodTables {
    for (const state of periods.values()) {
      if (
        state.tables$.getValue().some((table) => {
          return table.id === tableId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the table ${tableId}`);
  }

  function add(state: PeriodTables, draft: TableDraft): ResultOf<TableAdded> {
    const verdict = validateTable(state.tables$.getValue(), draft, null);

    if (!verdict.ok) {
      return verdict;
    }

    tablesAdded += 1;

    const id = `dt-new-${tablesAdded}`;

    // The coefficients land before their table, so no reader sees a coefficient name a table it cannot find.
    state.coefficients$.next([
      ...state.coefficients$.getValue(),
      ...state.unitIds.map((unitId): Coefficient => {
        return { tableId: id, unitId, value: 0 };
      }),
    ]);
    state.tables$.next(
      ranked([
        ...state.tables$.getValue(),
        {
          id,
          periodId: state.periodId,
          name: draft.name.trim(),
          order: draft.order,
          notes: draft.notes,
          restrictionGroupId: null,
        },
      ]),
    );

    return accepted({ id });
  }

  function edit(
    state: PeriodTables,
    tableId: string,
    draft: TableDraft,
  ): Result {
    const verdict = validateTable(state.tables$.getValue(), draft, tableId);

    if (!verdict.ok) {
      return verdict;
    }

    state.tables$.next(
      ranked(
        state.tables$.getValue().map((table) => {
          return table.id === tableId
            ? {
                ...table,
                name: draft.name.trim(),
                order: draft.order,
                notes: draft.notes,
              }
            : table;
        }),
      ),
    );

    return verdict;
  }

  function remove(state: PeriodTables, tableId: string): Result {
    const table = must(
      state.tables$.getValue().find((candidate) => {
        return candidate.id === tableId;
      }),
      `the table ${tableId}`,
    );
    const verdict = validateTableDelete(table, accountsOf(state.periodId));

    if (!verdict.ok) {
      return verdict;
    }

    // The table goes first, so no reader sees a table whose coefficients are gone.
    state.tables$.next(
      state.tables$.getValue().filter((candidate) => {
        return candidate.id !== tableId;
      }),
    );
    state.coefficients$.next(
      state.coefficients$.getValue().filter((coefficient) => {
        return coefficient.tableId !== tableId;
      }),
    );

    return verdict;
  }

  function set(
    state: PeriodTables,
    tableId: string,
    unitId: string,
    value: number,
  ): Result {
    if (!state.unitIds.includes(unitId)) {
      throw new Error(`missing: the unit ${unitId}`);
    }

    const verdict = validateCoefficient(value);

    if (!verdict.ok) {
      return verdict;
    }

    const coefficients = state.coefficients$.getValue();
    const held = coefficients.some((coefficient) => {
      return coefficient.tableId === tableId && coefficient.unitId === unitId;
    });

    state.coefficients$.next(
      held
        ? coefficients.map((coefficient) => {
            return coefficient.tableId === tableId &&
              coefficient.unitId === unitId
              ? { ...coefficient, value }
              : coefficient;
          })
        : [...coefficients, { tableId, unitId, value }],
    );

    return ok();
  }

  return {
    tables: (periodId: string): Observable<ThousandthTable[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missing(periodId)
        : state.tables$.asObservable();
    },
    coefficients: (periodId: string): Observable<Coefficient[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missing(periodId)
        : state.coefficients$.asObservable();
    },
    addTable: (
      periodId: string,
      draft: TableDraft,
    ): Promise<ResultOf<TableAdded>> => {
      // A throw inside the executor is a rejection, as the port promises.
      return new Promise((resolve) => {
        resolve(add(stateOf(periodId), draft));
      });
    },
    editTable: (tableId: string, draft: TableDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(edit(holderOfTable(tableId), tableId, draft));
      });
    },
    deleteTable: (tableId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(remove(holderOfTable(tableId), tableId));
      });
    },
    setCoefficient: (
      tableId: string,
      unitId: string,
      value: number,
    ): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(set(holderOfTable(tableId), tableId, unitId, value));
      });
    },
  };
}

/** In order, then by id. */
function ranked(tables: ThousandthTable[]): ThousandthTable[] {
  return [...tables].sort((a, b) => {
    return a.order - b.order || compareText(a.id, b.id);
  });
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : 1;
}

function missing<T>(periodId: string): Observable<T> {
  return throwError(() => {
    return new Error(`missing: the period ${periodId}`);
  });
}
