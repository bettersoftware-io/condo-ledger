import type { LedgerAccountRow, LedgerTxnRow, LedgerTxnEntry } from "#/seedTypes.ts";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

/** Sum of signed entry cents per postingAccountId, for one period. */
function accountSignedCents(db: Db, periodId: string): Map<string, number> {
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => {return String(t.accountingPeriodId) === periodId})
      .map((t) => {return String(t.id)}),
  );
  const sums = new Map<string, number>();

  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const acct = String(e.postingAccountId);
    sums.set(acct, (sums.get(acct) ?? 0) + eur(str(e.amount) ?? null).cents);
  }

  return sums;
}

/** An account row of the tree, with its signed cents rolled up. */
interface BuiltAccount {
  row: LedgerAccountRow;
  signed: number;
}

export function projectAccounts(db: Db, periodId: string): LedgerAccountRow[] {
  const accounts = db.rows("ledgerAccount").filter((a) => {return String(a.accountingPeriodId) === periodId});
  const own = accountSignedCents(db, periodId);
  const estimate = db.by("expenseLedgerAccount", "ledgerAccountId");

  const byId = new Map(accounts.map((a) => {return [String(a.id), a]}));
  const childrenOf = new Map<string, string[]>();

  for (const a of accounts) {
    const parent = str(a.parentLedgerAccountId);

    if (parent && byId.has(parent)) {
      (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(String(a.id));
    }
  }

  function ordered(ids: string[]): string[] {
    return ids.slice().sort((x, y) => {return Number(byId.get(x)!.order ?? 0) - Number(byId.get(y)!.order ?? 0)});
  }

  function build(id: string): BuiltAccount {
    const a = byId.get(id)!;
    const kids = ordered(childrenOf.get(id) ?? []);
    const ownSigned = own.get(id) ?? 0;
    let subtreeSigned = ownSigned;
    const childRows: LedgerAccountRow[] = [];

    for (const k of kids) {
      const built = build(k);
      childRows.push(built.row);
      subtreeSigned += built.signed;
    }

    const isGrouping = String(a.type) === "grouping" || childRows.length > 0;

    // Own-level dare/avere for leaf accounts
    const ownDare = ownSigned > 0 ? ownSigned : 0;
    const ownAvere = ownSigned < 0 ? -ownSigned : 0;

    // For grouping accounts: roll up children; for leaves: own amounts
    const dareCents = isGrouping ? childRows.reduce((s, c) => {return s + c.dare.cents}, ownDare) : ownDare;
    const avereCents = isGrouping ? childRows.reduce((s, c) => {return s + c.avere.cents}, ownAvere) : ownAvere;

    const est = estimate.get(id);
    const restriction = restrictionLabel(str(a.periodRestrictionStartDate), str(a.periodRestrictionEndDate));

    const row: LedgerAccountRow = {
      id: `la${id}`,
      kind: isGrouping ? "grouping" : "regular",
      label: String(a.name),
      dare: m(dareCents),
      avere: m(avereCents),
      saldo: m(subtreeSigned),
      preventivo: est ? eur(str(est.estimate) ?? null) : null,
      ...(restriction !== undefined ? { restriction } : {}),
      ...(childRows.length > 0 ? { children: childRows } : {}),
    };

    return { row, signed: subtreeSigned };
  }

  const roots = ordered(
    accounts
      .filter((a) => {
        const p = str(a.parentLedgerAccountId);
        return !p || !byId.has(p);
      })
      .map((a) => {return String(a.id)}),
  );

  return roots.map((id) => {return build(id).row});
}

function restrictionLabel(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;

  function f(d?: string): string {
    return d ? d.split(" ")[0]!.split("-").reverse().join("/") : "";
  }

  return `${f(start)} - ${f(end)}`;
}

export function projectTransactions(db: Db, periodId: string): LedgerTxnRow[] {
  const txns = db
    .rows("ledgerTransaction")
    .filter((t) => {return String(t.accountingPeriodId) === periodId});

  const acctName = new Map(db.rows("ledgerAccount").map((a) => {return [String(a.id), String(a.name)]}));
  const entriesByTx = db.group("ledgerEntry", "ledgerTransactionId");

  return txns
    .slice()
    .sort((a, b) => {return Number(a.code) - Number(b.code)})
    .map((t) => {
      const raw = (entriesByTx.get(String(t.id)) ?? [])
        .slice()
        .sort((x, y) => {return Number(x.order) - Number(y.order)});

      const entries: LedgerTxnEntry[] = raw.map((e) => {
        const cents = eur(str(e.amount) ?? null).cents;
        return {
          accountId: `la${String(e.postingAccountId)}`,
          account: acctName.get(String(e.postingAccountId)) ?? String(e.postingAccountId),
          dare: m(cents > 0 ? cents : 0),
          avere: m(cents < 0 ? -cents : 0),
        };
      });

      const dare = entries.reduce((s, e) => {return s + e.dare.cents}, 0);

      return {
        id: `tx${String(t.id)}`,
        date: String(t.timestamp ?? "").split(" ")[0] ?? "",
        code: Number(t.code),
        description: String(t.description ?? ""),
        partita: String(t.description ?? "").slice(0, 24),
        dare: m(dare),
        avere: m(dare), // double-entry: dare === avere for each balanced transaction
        entries,
      };
    });
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();
}

function m(cents: number): Money {
  return { cents };
}
