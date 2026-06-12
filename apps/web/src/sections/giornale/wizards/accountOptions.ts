import type { LedgerAccountRow } from "@cl/application";
import { flattenRows } from "../../../mock/treeRows";

export interface AccountOption { value: string; label: string; }

export function accountOptions(rows: LedgerAccountRow[]): AccountOption[] {
  return flattenRows(rows)
    .filter((r) => r.kind !== "grouping")
    .map((r) => ({ value: r.id, label: r.label }));
}

export function accountLabel(options: AccountOption[], id: string): string {
  return options.find((o) => o.value === id)?.label ?? id;
}
