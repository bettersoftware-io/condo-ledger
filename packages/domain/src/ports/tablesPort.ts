import type { Observable } from "rxjs";

import type { Result, ResultOf } from "#/entities/result.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { TableDraft } from "#/useCases/validateTable.ts";

/** What adding a table answers: the id the port gave it. */
export interface TableAdded {
  id: string;
}

/**
 * A period's thousandth tables and the coefficient of each unit in each. A
 * write is judged by validateTable, validateTableDelete and
 * validateCoefficient, and the reads emit again after an accepted write.
 */
export interface TablesPort {
  /** In order. Errors with "missing: the period <id>" for a period the port does not have. */
  tables(periodId: string): Observable<ThousandthTable[]>;
  /** Every table's coefficients, one for each unit of the period. Errors as tables() does. */
  coefficients(periodId: string): Observable<Coefficient[]>;
  /** Adds the table with a 0 coefficient for every unit of the period. Refused with validateTable's reason. Rejects for a period the port does not have. */
  addTable(periodId: string, draft: TableDraft): Promise<ResultOf<TableAdded>>;
  /** Refused with validateTable's reason. Rejects for a table the port does not have. */
  editTable(tableId: string, draft: TableDraft): Promise<Result>;
  /** Removes the table and its coefficients. Refused with validateTableDelete's reason. Rejects for a table the port does not have. */
  deleteTable(tableId: string): Promise<Result>;
  /** Refused with validateCoefficient's reason. Rejects for a table or a unit the port does not have. */
  setCoefficient(
    tableId: string,
    unitId: string,
    value: number,
  ): Promise<Result>;
}
