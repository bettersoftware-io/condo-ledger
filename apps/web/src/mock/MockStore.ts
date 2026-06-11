import { BehaviorSubject, map, type Observable } from "rxjs";
import type {
  MockDataSource, Id, DistributionType, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow,
} from "@cl/application";
import * as fx from "./fixtures";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

export class MockStore implements MockDataSource {
  private tree$ = new BehaviorSubject<CondominiumNode[]>(fx.tree);
  private details$ = new BehaviorSubject<Record<Id, CondominiumDetail>>(fx.detailByPeriod);
  private units$ = new BehaviorSubject<Record<Id, UnitRow[]>>(fx.unitsByPeriod);
  private tables$ = new BehaviorSubject<Record<Id, DistributionTable[]>>(fx.distributionTablesByPeriod);
  private distributions$ = new BehaviorSubject<Record<Id, Record<DistributionType, Dist>>>(fx.distributionByPeriod);
  private accounts$ = new BehaviorSubject<Record<Id, LedgerAccountRow[]>>(fx.ledgerAccountsByPeriod);
  protected txns$ = new BehaviorSubject<Record<Id, LedgerTxnRow[]>>(fx.ledgerTxnsByPeriod);
  private installments$ = new BehaviorSubject<Record<Id, Installments>>(fx.installmentsByPeriod);

  condominiumTree(): Observable<CondominiumNode[]> { return this.tree$.asObservable(); }
  condominiumDetail(periodId: Id) { return this.details$.pipe(map((d) => d[periodId] ?? null)); }
  unitsTree(periodId: Id) { return this.units$.pipe(map((u) => u[periodId] ?? [])); }
  distributionTables(periodId: Id) { return this.tables$.pipe(map((t) => t[periodId] ?? [])); }
  distribution(periodId: Id, type: DistributionType): Observable<Dist> {
    return this.distributions$.pipe(map((d) => d[periodId]?.[type] ?? { columns: [], rows: [] }));
  }
  ledgerAccountsTree(periodId: Id) { return this.accounts$.pipe(map((a) => a[periodId] ?? [])); }
  ledgerTransactions(periodId: Id) { return this.txns$.pipe(map((t) => t[periodId] ?? [])); }
  installments(periodId: Id): Observable<Installments> {
    return this.installments$.pipe(map((i) => i[periodId] ?? { columns: [], rows: [] }));
  }

  /** Immutable per-period patch; commands in later tasks build on this. */
  protected patch<K>(
    subject: BehaviorSubject<Record<Id, K>>, periodId: Id, empty: K, fn: (cur: K) => K,
  ): void {
    const cur = subject.getValue();
    subject.next({ ...cur, [periodId]: fn(cur[periodId] ?? empty) });
  }
}
