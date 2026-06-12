import type { LedgerAccountRow } from "@cl/application";

/** Drop zero-movement leaves; a group disappears when all its leaves were dropped. */
function pruneEmpty(rows: LedgerAccountRow[]): LedgerAccountRow[] {
  return rows.flatMap((r) => {
    if (r.children?.length) {
      const children = pruneEmpty(r.children);
      return children.length ? [{ ...r, children }] : [];
    }
    return r.dare.cents === 0 && r.avere.cents === 0 ? [] : [r];
  });
}

/** Search + hide-empty over the account tree. Hide-empty is applied first, then the
 * query: a row survives a query when its label matches (a matching group keeps its
 * whole — already pruned — subtree) or when any descendant matches. */
export function filterAccounts(rows: LedgerAccountRow[], query: string, hideEmpty: boolean): LedgerAccountRow[] {
  const q = query.trim().toLowerCase();
  if (!q && !hideEmpty) return rows;
  const base = hideEmpty ? pruneEmpty(rows) : rows;
  if (!q) return base;
  const byQuery = (rs: LedgerAccountRow[]): LedgerAccountRow[] =>
    rs.flatMap((r) => {
      const selfMatch = r.label.toLowerCase().includes(q);
      if (r.children?.length) {
        const children = byQuery(r.children);
        if (selfMatch) return [{ ...r, children: children.length ? children : r.children }];
        return children.length ? [{ ...r, children }] : [];
      }
      return selfMatch ? [r] : [];
    });
  return byQuery(base);
}
