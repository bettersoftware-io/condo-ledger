// apps/web/tools/gen/project/ripartoInput.ts

import type { RipartoInput } from "@cl/domain";

import { eur } from "../amounts.ts";
import type { Db } from "../db.ts";

/** Adapt the legacy Db (one accounting period) into the pure engine's clean input. */
export function dbToRipartoInput(db: Db, periodId: string): RipartoInput {
  // accounts in this period
  const accounts = db
    .rows("ledgerAccount")
    .filter((a) => {
      return String(a.accountingPeriodId) === periodId;
    })
    .map((a) => {
      return {
        id: String(a.id),
        name: String(a.name),
        order: num(a.order),
        parentId: str(a.parentLedgerAccountId) ?? null,
      };
    });

  // links (expenseLA2Table) — pct resolved (null→100), type normalised
  const links: RipartoInput["links"] = [];

  for (const l of db.rows("expenseLA2Table")) {
    links.push({
      accountId: String(l.expenseLedgerAccountId),
      linkId: String(l.id),
      tableId: String(l.distributionTableId),
      pct:
        l.percentage === null || l.percentage === undefined
          ? 100
          : num(l.percentage),
      type:
        l.type === "estimate" || l.type === "currentBalance"
          ? (l.type as "estimate" | "currentBalance")
          : null,
    });
  }

  // own estimate cents per account (expenseLedgerAccount.estimate)
  const estimateCentsByAccount: Record<string, number> = {};

  for (const e of db.rows("expenseLedgerAccount")) {
    estimateCentsByAccount[String(e.ledgerAccountId)] = eur(
      str(e.estimate) ?? null,
    ).cents;
  }

  // own signed actual cents per posting account, this period
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => {
        return String(t.accountingPeriodId) === periodId;
      })
      .map((t) => {
        return String(t.id);
      }),
  );
  const actualCentsByAccount: Record<string, number> = {};

  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) {
      continue;
    }

    const acct = String(e.postingAccountId);
    actualCentsByAccount[acct] =
      (actualCentsByAccount[acct] ?? 0) + eur(str(e.amount) ?? null).cents;
  }

  // distribution table coefficients
  const tableItems = db.rows("distributionTableItem").map((it) => {
    return {
      tableId: String(it.distributionTableId),
      unitId: String(it.unitId),
      coefficient: num(it.coefficient),
    };
  });

  // role rows (expenseLA2Role) keyed by LINK id
  const roles = db.rows("expenseLA2Role").map((r) => {
    return {
      linkId: String(r.expenseLA2TableId),
      priorityId: String(r.unitResidentPriorityId),
      percentage: num(r.percentage),
    };
  });

  // residents of this period, joined to their unit via unitPeriod
  const upById = db.by("unitPeriod", "id");
  const residents: RipartoInput["residents"] = [];

  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));

    if (!up) {
      continue;
    }

    residents.push({
      unitId: String(up.unitId),
      residentId: String(r.id),
      priorityId: String(r.unitResidentPriorityId),
      percentage: num(r.percentage),
    });
  }

  // unit ids present this period, sorted by code (Italian collation)
  const unitLegacyIds = db
    .rows("unit")
    .filter((u) => {
      return String(u.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return String(a.code ?? "").localeCompare(String(b.code ?? ""), "it");
    })
    .map((u) => {
      return String(u.id);
    });

  return {
    accounts,
    links,
    estimateCentsByAccount,
    actualCentsByAccount,
    tableItems,
    roles,
    residents,
    unitLegacyIds,
  };
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v).trim();
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}
