export interface TreeRowLike { id: string; children?: TreeRowLike[] }

export function mapRow<R extends TreeRowLike>(rows: R[], id: string, fn: (r: R) => R): R[] {
  let changed = false;
  const out = rows.map((r): R => {
    if (r.id === id) { changed = true; return fn(r); }
    if (r.children?.length) {
      const children = mapRow(r.children as R[], id, fn);
      if (children !== r.children) { changed = true; return { ...r, children }; }
    }
    return r;
  });
  return changed ? out : rows;
}

export function removeRow<R extends TreeRowLike>(rows: R[], id: string): R[] {
  let changed = false;
  const out: R[] = [];
  for (const r of rows) {
    if (r.id === id) { changed = true; continue; }
    if (r.children?.length) {
      const children = removeRow(r.children as R[], id);
      if (children !== r.children) { changed = true; out.push({ ...r, children }); continue; }
    }
    out.push(r);
  }
  return changed ? out : rows;
}

export function insertChild<R extends TreeRowLike>(rows: R[], parentId: string | null, child: R): R[] {
  if (parentId === null) return [...rows, child];
  return mapRow(rows, parentId, (p) => ({ ...p, children: [...(p.children ?? []), child] }));
}

export function findRow<R extends TreeRowLike>(rows: R[], id: string): R | null {
  for (const r of rows) {
    if (r.id === id) return r;
    const hit = r.children?.length ? findRow(r.children as R[], id) : null;
    if (hit) return hit;
  }
  return null;
}

/** Depth-first flatten of a tree into a single list (parents before children). */
export function flattenRows<R extends TreeRowLike>(rows: R[]): R[] {
  return rows.flatMap((r) => [r, ...flattenRows((r.children ?? []) as R[])]);
}
