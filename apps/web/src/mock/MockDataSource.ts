import { of, type Observable } from "rxjs";
import type { MockDataSource, Id, DistributionType } from "@cl/application";
import * as fx from "./fixtures";

export function createMockDataSource(): MockDataSource {
  return {
    condominiumTree: () => of(fx.tree),
    condominiumDetail: (periodId: Id) => of(fx.detailByPeriod[periodId] ?? null),
    unitsTree: (periodId: Id) => of(fx.unitsByPeriod[periodId] ?? []),
    distributionTables: (periodId: Id) => of(fx.distributionTablesByPeriod[periodId] ?? []),
    distribution: (periodId: Id, type: DistributionType) =>
      of(fx.distributionByPeriod[periodId]?.[type] ?? { columns: [], rows: [] }),
    ledgerAccountsTree: (periodId: Id) => of(fx.ledgerAccountsByPeriod[periodId] ?? []),
    ledgerTransactions: (periodId: Id) => of(fx.ledgerTxnsByPeriod[periodId] ?? []),
    installments: (periodId: Id) => of(fx.installmentsByPeriod[periodId] ?? { columns: [], rows: [] }),
  } satisfies MockDataSource as unknown as MockDataSource;
}
