import type { LedgerAccountRow } from "@cl/application";

/** Search + hide-empty over the account tree. A group survives if it matches the
 * query itself (keeping all its children) or if any descendant survives. */
export function filterAccounts(rows: LedgerAccountRow[], query: string, hideEmpty: boolean): LedgerAccountRow[] {
  const q = query.trim().toLowerCase();
  if (!q && !hideEmpty) return rows;
  const walk = (rs: LedgerAccountRow[]): LedgerAccountRow[] =>
    rs.flatMap((r) => {
      const children = r.children ? walk(r.children) : undefined;
      const selfMatch = !q || r.label.toLowerCase().includes(q);
      if (r.children?.length) {
        if (!children?.length && !selfMatch) return [];
        return [{ ...r, children: selfMatch && !children?.length ? r.children : children }];
      }
      const empty = r.dare.cents === 0 && r.avere.cents === 0;
      return selfMatch && !(hideEmpty && empty) ? [r] : [];
    });
  return walk(rows);
}
