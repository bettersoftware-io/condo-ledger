/**
 * Faithful legacy distribution (riparto) engine.
 *
 * Shared, pure functions used by BOTH distribution.ts (per-UNIT matrices) and
 * units.ts (per-RESIDENT preventivo/consuntivo).
 *
 * Data model (verified against old/db/it-jtime-condominium.all.sql):
 *  - expenseLA2Table: one row per LINK of an expense account to a distribution
 *    table. { id, expenseLedgerAccountId, distributionTableId, type ∈
 *    {null,'estimate','currentBalance'}, percentage (null OR e.g. "30.00") }.
 *    Multi-link accounts split the account total across tables by percentage;
 *    type splits estimate vs currentBalance onto different tables.
 *  - Linked accounts are mostly GROUPING accounts; the actual money + estimate
 *    live on their LEAF descendants, so we roll up the subtree (excluding any
 *    descendant that is ITSELF a linked account — it owns its own subtree).
 *  - expenseLA2Role: { expenseLA2TableId (the LINK id), unitResidentPriorityId,
 *    percentage }. Assigns each link's per-unit amount to residents of a given
 *    priority at a %. No role rows → whole amount to the unit's owners.
 *  - distributionTableItem: { distributionTableId, unitId, coefficient }.
 */
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export type Mode = "estimate" | "current";

/** One link of an account to a table. pct null → 100. */
export interface LinkRef {
  linkId: string;
  tableId: string;
  pct: number;
  type: "estimate" | "currentBalance" | null;
}

export interface LinkedColumn {
  legacyAccountId: string;
  name: string;
  links: LinkRef[];
  /** Primary table for display (estimate-side first, else first link). */
  displayTableId: string;
}

export interface RipartoEngine {
  columns: LinkedColumn[];
  /** per-unit amount in cents for an account+mode+legacy unit id. */
  perUnitAmount(accountId: string, mode: Mode, legacyUnitId: string): number;
  /** subtree totals (cents) for a linked account. */
  subtree(accountId: string): { estimateCents: number; actualCents: number };
  /** split a unit's per-unit amount among its residents. Map<unitResidentId, cents>. */
  perResidentAmount(accountId: string, mode: Mode, legacyUnitId: string): Map<string, number>;
  /** legacy unit ids present this period (sorted by code). */
  unitLegacyIds: string[];
}

interface ResidentInfo {
  id: string;
  priorityId: string;
  percentage: number;
}

/**
 * Build the riparto engine for one accounting period. All amounts are integer
 * cents. Pure: depends only on db rows.
 */
export function buildRiparto(db: Db, periodId: string): RipartoEngine {
  // --- accounts in this period -------------------------------------------
  const accounts = db
    .rows("ledgerAccount")
    .filter((a) => String(a.accountingPeriodId) === periodId);
  const acctById = new Map(accounts.map((a) => [String(a.id), a]));
  const childrenOf = new Map<string, string[]>();
  for (const a of accounts) {
    const parent = str(a.parentLedgerAccountId);
    if (parent && acctById.has(parent)) {
      (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(String(a.id));
    }
  }

  // --- links (expenseLA2Table) keyed by account --------------------------
  const linksByAccount = db.group("expenseLA2Table", "expenseLedgerAccountId");
  const isLinkedAccount = (id: string): boolean => (linksByAccount.get(id)?.length ?? 0) > 0;

  // --- estimate per account (own, not rolled up) -------------------------
  const expenseByAccount = db.by("expenseLedgerAccount", "ledgerAccountId");
  const ownEstimateCents = (id: string): number =>
    eur(str(expenseByAccount.get(id)?.estimate) ?? null).cents;

  // --- signed actual cents per posting account, this period --------------
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const ownActualCents = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const acct = String(e.postingAccountId);
    ownActualCents.set(acct, (ownActualCents.get(acct) ?? 0) + eur(str(e.amount) ?? null).cents);
  }

  /**
   * Roll up estimate + actual over an account + descendants, EXCLUDING any
   * descendant that is itself a linked account (it owns its own subtree).
   * The root account itself is always included even though it is linked.
   */
  function subtreeFor(rootId: string): { estimateCents: number; actualCents: number } {
    let estimateCents = 0;
    let actualCents = 0;
    const visit = (id: string, isRoot: boolean): void => {
      // A linked descendant (not the root) owns its own subtree — skip it.
      if (!isRoot && isLinkedAccount(id)) return;
      estimateCents += ownEstimateCents(id);
      actualCents += ownActualCents.get(id) ?? 0;
      for (const k of childrenOf.get(id) ?? []) visit(k, false);
    };
    visit(rootId, true);
    return { estimateCents, actualCents };
  }
  const subtreeCache = new Map<string, { estimateCents: number; actualCents: number }>();
  const subtree = (accountId: string): { estimateCents: number; actualCents: number } => {
    let v = subtreeCache.get(accountId);
    if (!v) {
      v = subtreeFor(accountId);
      subtreeCache.set(accountId, v);
    }
    return v;
  };

  // --- distribution table coefficients -----------------------------------
  const itemsByTable = db.group("distributionTableItem", "distributionTableId");
  const tableTotalCache = new Map<string, number>();
  const tableTotal = (tableId: string): number => {
    let t = tableTotalCache.get(tableId);
    if (t === undefined) {
      t = (itemsByTable.get(tableId) ?? []).reduce((s, i) => s + num(i.coefficient), 0);
      tableTotalCache.set(tableId, t);
    }
    return t;
  };
  const coeff = (tableId: string, legacyUnitId: string): number => {
    const items = itemsByTable.get(tableId) ?? [];
    const mine = items.find((i) => String(i.unitId) === legacyUnitId);
    return mine ? num(mine.coefficient) : 0;
  };

  // --- role rows (expenseLA2Role) keyed by LINK id -----------------------
  const rolesByLink = db.group("expenseLA2Role", "expenseLA2TableId");

  // --- residents of this period, keyed by legacy unit id -----------------
  const upById = db.by("unitPeriod", "id");
  const residentsByUnit = new Map<string, ResidentInfo[]>();
  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (!up) continue;
    const unitId = String(up.unitId);
    const info: ResidentInfo = {
      id: String(r.id),
      priorityId: String(r.unitResidentPriorityId),
      percentage: num(r.percentage),
    };
    (residentsByUnit.get(unitId) ?? residentsByUnit.set(unitId, []).get(unitId)!).push(info);
  }

  // --- columns: one per distinct linked account, ordered by account.order -
  const columns: LinkedColumn[] = [];
  for (const a of accounts
    .slice()
    .sort((x, y) => num(x.order) - num(y.order))) {
    const id = String(a.id);
    const raw = linksByAccount.get(id);
    if (!raw || raw.length === 0) continue;
    const links: LinkRef[] = raw.map((l) => ({
      linkId: String(l.id),
      tableId: String(l.distributionTableId),
      pct: l.percentage === null || l.percentage === undefined ? 100 : num(l.percentage),
      type:
        l.type === "estimate" || l.type === "currentBalance"
          ? (l.type as "estimate" | "currentBalance")
          : null,
    }));
    const estimateSide = links.find((l) => l.type === "estimate") ?? links[0]!;
    columns.push({
      legacyAccountId: id,
      name: String(a.name),
      links,
      displayTableId: estimateSide.tableId,
    });
  }
  const colByAccount = new Map(columns.map((c) => [c.legacyAccountId, c]));

  /** Pick the links relevant to a mode. */
  const chosenLinks = (col: LinkedColumn, mode: Mode): LinkRef[] => {
    if (mode === "estimate") {
      const est = col.links.filter((l) => l.type === "estimate");
      if (est.length > 0) return est;
      return col.links.filter((l) => l.type === null);
    }
    const cur = col.links.filter((l) => l.type === "currentBalance");
    if (cur.length > 0) return cur;
    return col.links.filter((l) => l.type === null);
  };

  /** per-unit amount, per chosen link, as a list (used by resident split). */
  function perUnitByLink(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): { link: LinkRef; cents: number }[] {
    const col = colByAccount.get(accountId);
    if (!col) return [];
    const totals = subtree(accountId);
    const base = mode === "estimate" ? totals.estimateCents : totals.actualCents;
    const out: { link: LinkRef; cents: number }[] = [];
    for (const link of chosenLinks(col, mode)) {
      const tot = tableTotal(link.tableId);
      if (tot === 0) continue;
      const c = coeff(link.tableId, legacyUnitId);
      const cents = Math.round((base * link.pct) / 100 * (c / tot));
      out.push({ link, cents });
    }
    return out;
  }

  const perUnitAmount = (accountId: string, mode: Mode, legacyUnitId: string): number =>
    perUnitByLink(accountId, mode, legacyUnitId).reduce((s, x) => s + x.cents, 0);

  /**
   * Split one link's per-unit amount among the unit's residents using the
   * link's expenseLA2Role rows.
   */
  function splitLinkAmount(
    link: LinkRef,
    cents: number,
    residents: ResidentInfo[],
    out: Map<string, number>,
  ): void {
    if (cents === 0 || residents.length === 0) return;
    const owners = residents.filter((r) => r.priorityId === "1");
    const ownerFallback = owners.length > 0 ? owners : residents;

    const addTo = (group: ResidentInfo[], amount: number): void => {
      if (amount === 0) return;
      const totalPct = group.reduce((s, r) => s + r.percentage, 0);
      if (group.length === 1) {
        const only = group[0]!;
        out.set(only.id, (out.get(only.id) ?? 0) + amount);
        return;
      }
      if (totalPct > 0) {
        let allocated = 0;
        for (let i = 0; i < group.length; i++) {
          const r = group[i]!;
          const share =
            i === group.length - 1
              ? amount - allocated
              : Math.round((amount * r.percentage) / totalPct);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      } else {
        // equal split
        let allocated = 0;
        for (let i = 0; i < group.length; i++) {
          const r = group[i]!;
          const share =
            i === group.length - 1
              ? amount - allocated
              : Math.round(amount / group.length);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      }
    };

    const roles = rolesByLink.get(link.linkId) ?? [];
    if (roles.length === 0) {
      // No role rows: whole amount to owners (or all residents if no owners),
      // split by ownership percentage.
      addTo(ownerFallback, cents);
      return;
    }

    let allocated = 0;
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]!;
      const rolePct = num(role.percentage);
      const share =
        i === roles.length - 1
          ? cents - allocated
          : Math.round((cents * rolePct) / 100);
      allocated += share;
      const priorityId = String(role.unitResidentPriorityId);
      const group = residents.filter((r) => r.priorityId === priorityId);
      // Orphaned share (no resident of that priority) → owner(s).
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
    for (const { link, cents } of perUnitByLink(accountId, mode, legacyUnitId)) {
      splitLinkAmount(link, cents, residents, out);
    }
    return out;
  }

  // --- unit ids present this period, sorted by code ----------------------
  const unitLegacyIds = db
    .rows("unit")
    .filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"))
    .map((u) => String(u.id));

  return { columns, perUnitAmount, subtree, perResidentAmount, unitLegacyIds };
}
