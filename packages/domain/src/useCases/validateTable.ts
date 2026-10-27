import type { Account } from "../entities/account.ts";
import { ok, type Result, rejected } from "../entities/result.ts";
import type { ThousandthTable } from "../entities/table.ts";

/** What the table dialog hands the port: the port adds the id and the period. */
export interface TableDraft {
  name: string;
  order: number;
  notes: string;
}

/**
 * Whether a table may be added to, or edited in, a period whose tables are
 * `tables`; `editing` is the edited table's id, null for a new one. The
 * reasons are checked in this order: a blank name, a name another table
 * already has (by case), an order that is not a whole number from 1.
 */
export function validateTable(
  tables: ThousandthTable[],
  draft: TableDraft,
  editing: string | null,
): Result {
  const name = draft.name.trim();

  if (name === "") {
    return rejected("blank-name");
  }

  const taken = tables.some((table) => {
    return table.id !== editing && table.name.trim() === name;
  });

  if (taken) {
    return rejected("name-taken");
  }

  if (!Number.isInteger(draft.order) || draft.order < 1) {
    return rejected("bad-order");
  }

  return ok();
}

/**
 * Whether a table may go: not while an account links to it, since its
 * allocation would change unseen. The detail names the first such account.
 */
export function validateTableDelete(
  table: ThousandthTable,
  accounts: Account[],
): Result {
  const linking = accounts.find((account) => {
    return account.links.some((link) => {
      return link.tableId === table.id;
    });
  });

  return linking === undefined ? ok() : rejected("table-linked", linking.id);
}

/** A coefficient is a whole count of ten-thousandths, zero or more. */
export function validateCoefficient(value: number): Result {
  return Number.isInteger(value) && value >= 0
    ? ok()
    : rejected("not-a-coefficient");
}
