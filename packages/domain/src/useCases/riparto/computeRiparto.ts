// packages/domain/src/useCases/riparto/computeRiparto.ts
import { listFor, must } from "#/support/must.ts";

import type {
  LinkedColumn,
  LinkRef,
  Mode,
  ResidentInfo,
  RipartoEngine,
  RipartoInput,
  SubtreeTotals,
} from "./types.ts";

/**
 * Build the riparto engine for one accounting period from a clean input.
 * Pure: depends only on `input`. All amounts are integer cents.
 * Algorithm is identical to the legacy generator engine; only the data source differs.
 */
export function buildRiparto(input: RipartoInput): RipartoEngine {
  // --- accounts ----------------------------------------------------------
  const acctById = new Map(
    input.accounts.map((a) => {
      return [a.id, a];
    }),
  );
  const childrenOf = new Map<string, string[]>();

  for (const a of input.accounts) {
    const parent = a.parentId;

    if (parent && acctById.has(parent)) {
      listFor(childrenOf, parent).push(a.id);
    }
  }

  // --- links keyed by account -------------------------------------------
  const linksByAccount = new Map<string, LinkRef[]>();

  for (const l of input.links) {
    const ref: LinkRef = {
      linkId: l.linkId,
      tableId: l.tableId,
      pct: l.pct,
      type: l.type,
    };
    listFor(linksByAccount, l.accountId).push(ref);
  }

  function isLinkedAccount(id: string): boolean {
    return (linksByAccount.get(id)?.length ?? 0) > 0;
  }

  // --- own estimate / actual cents --------------------------------------
  function ownEstimateCents(id: string): number {
    return input.estimateCentsByAccount[id] ?? 0;
  }

  function ownActualCents(id: string): number {
    return input.actualCentsByAccount[id] ?? 0;
  }

  /**
   * Roll up estimate + actual over an account + descendants, EXCLUDING any
   * descendant that is itself a linked account (it owns its own subtree).
   * The root account itself is always included even though it is linked.
   */
  function subtreeFor(rootId: string): SubtreeTotals {
    let estimateCents = 0;
    let actualCents = 0;

    function visit(id: string, isRoot: boolean): void {
      if (!isRoot && isLinkedAccount(id)) {
        return;
      }

      estimateCents += ownEstimateCents(id);
      actualCents += ownActualCents(id);

      for (const k of childrenOf.get(id) ?? []) {
        visit(k, false);
      }
    }

    visit(rootId, true);
    return { estimateCents, actualCents };
  }

  const subtreeCache = new Map<string, SubtreeTotals>();

  function subtree(accountId: string): SubtreeTotals {
    must(acctById.get(accountId), `the account ${accountId}`);

    let v = subtreeCache.get(accountId);

    if (!v) {
      v = subtreeFor(accountId);
      subtreeCache.set(accountId, v);
    }

    return v;
  }

  // --- distribution table coefficients -----------------------------------
  const itemsByTable = new Map<
    string,
    { unitId: string; coefficient: number }[]
  >();

  for (const it of input.tableItems) {
    listFor(itemsByTable, it.tableId).push({
      unitId: it.unitId,
      coefficient: it.coefficient,
    });
  }

  const tableTotalCache = new Map<string, number>();

  function tableTotal(tableId: string): number {
    let t = tableTotalCache.get(tableId);

    if (t === undefined) {
      t = (itemsByTable.get(tableId) ?? []).reduce((s, i) => {
        return s + i.coefficient;
      }, 0);
      tableTotalCache.set(tableId, t);
    }

    return t;
  }

  function coeff(tableId: string, legacyUnitId: string): number {
    const items = itemsByTable.get(tableId) ?? [];
    const mine = items.find((i) => {
      return i.unitId === legacyUnitId;
    });
    return mine ? mine.coefficient : 0;
  }

  // --- role rows keyed by LINK id ----------------------------------------
  const rolesByLink = new Map<
    string,
    { priorityId: string; percentage: number }[]
  >();

  for (const r of input.roles) {
    listFor(rolesByLink, r.linkId).push({
      priorityId: r.priorityId,
      percentage: r.percentage,
    });
  }

  // --- residents keyed by legacy unit id ---------------------------------
  const residentsByUnit = new Map<string, ResidentInfo[]>();

  for (const r of input.residents) {
    const info: ResidentInfo = {
      id: r.residentId,
      priorityId: r.priorityId,
      percentage: r.percentage,
    };
    listFor(residentsByUnit, r.unitId).push(info);
  }

  // --- columns: one per distinct linked account, ordered by account.order -
  const columns: LinkedColumn[] = [];

  for (const a of input.accounts.slice().sort((x, y) => {
    return x.order - y.order;
  })) {
    const raw = linksByAccount.get(a.id);

    if (!raw || raw.length === 0) {
      continue;
    }

    const estimateSide =
      raw.find((l) => {
        return l.type === "estimate";
      }) ?? must(raw[0], `a link of account ${a.id}`);
    columns.push({
      legacyAccountId: a.id,
      name: a.name,
      links: raw,
      displayTableId: estimateSide.tableId,
    });
  }

  const colByAccount = new Map(
    columns.map((c) => {
      return [c.legacyAccountId, c];
    }),
  );

  /** Pick the links relevant to a mode. */
  function chosenLinks(col: LinkedColumn, mode: Mode): LinkRef[] {
    if (mode === "estimate") {
      const est = col.links.filter((l) => {
        return l.type === "estimate";
      });

      if (est.length > 0) {
        return est;
      }

      return col.links.filter((l) => {
        return l.type === null;
      });
    }

    const cur = col.links.filter((l) => {
      return l.type === "currentBalance";
    });

    if (cur.length > 0) {
      return cur;
    }

    return col.links.filter((l) => {
      return l.type === null;
    });
  }

  /** per-unit amount, per chosen link, as a list (used by resident split). */
  function perUnitByLink(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): LinkCents[] {
    const col = colByAccount.get(accountId);

    if (!col) {
      return [];
    }

    const totals = subtree(accountId);
    const base =
      mode === "estimate" ? totals.estimateCents : totals.actualCents;
    const out: LinkCents[] = [];

    for (const link of chosenLinks(col, mode)) {
      const tot = tableTotal(link.tableId);

      if (tot === 0) {
        continue;
      }

      const c = coeff(link.tableId, legacyUnitId);
      const cents = Math.round(((base * link.pct) / 100) * (c / tot));
      out.push({ link, cents });
    }

    return out;
  }

  function perUnitAmount(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): number {
    return perUnitByLink(accountId, mode, legacyUnitId).reduce((s, x) => {
      return s + x.cents;
    }, 0);
  }

  /** Split one link's per-unit amount among the unit's residents. */
  function splitLinkAmount(
    link: LinkRef,
    cents: number,
    residents: ResidentInfo[],
    out: Map<string, number>,
  ): void {
    if (cents === 0 || residents.length === 0) {
      return;
    }

    const owners = residents.filter((r) => {
      return r.priorityId === "1";
    });
    const ownerFallback = owners.length > 0 ? owners : residents;

    function addTo(group: ResidentInfo[], amount: number): void {
      if (amount === 0) {
        return;
      }

      const totalPct = group.reduce((s, r) => {
        return s + r.percentage;
      }, 0);

      if (group.length === 1) {
        const only = must(group[0], "the first resident of the group");
        out.set(only.id, (out.get(only.id) ?? 0) + amount);
        return;
      }

      if (totalPct > 0) {
        let allocated = 0;

        for (let i = 0; i < group.length; i++) {
          const r = must(group[i], `resident ${i} of the group`);
          const share =
            i === group.length - 1
              ? amount - allocated
              : Math.round((amount * r.percentage) / totalPct);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      } else {
        let allocated = 0;

        for (let i = 0; i < group.length; i++) {
          const r = must(group[i], `resident ${i} of the group`);
          const share =
            i === group.length - 1
              ? amount - allocated
              : Math.round(amount / group.length);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      }
    }

    const roles = rolesByLink.get(link.linkId) ?? [];

    if (roles.length === 0) {
      addTo(ownerFallback, cents);
      return;
    }

    let allocated = 0;

    for (let i = 0; i < roles.length; i++) {
      const role = must(roles[i], `role ${i} of link ${link.linkId}`);
      const rolePct = role.percentage;
      const share =
        i === roles.length - 1
          ? cents - allocated
          : Math.round((cents * rolePct) / 100);
      allocated += share;
      const priorityId = role.priorityId;
      const group = residents.filter((r) => {
        return r.priorityId === priorityId;
      });
      addTo(group.length > 0 ? group : ownerFallback, share);
    }
  }

  function perResidentAmount(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): Map<string, number> {
    const out = new Map<string, number>();
    const residents = residentsByUnit.get(legacyUnitId) ?? [];

    for (const { link, cents } of perUnitByLink(
      accountId,
      mode,
      legacyUnitId,
    )) {
      splitLinkAmount(link, cents, residents, out);
    }

    return out;
  }

  return {
    columns,
    perUnitAmount,
    subtree,
    perResidentAmount,
    unitLegacyIds: input.unitLegacyIds,
  };
}

/** One chosen link's per-unit amount. */
interface LinkCents {
  link: LinkRef;
  cents: number;
}
