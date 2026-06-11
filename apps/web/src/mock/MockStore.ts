import { BehaviorSubject, map, type Observable } from "rxjs";
import type {
  MockDataSource, Id, DistributionType, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow,
} from "@cl/application";
import { fromCents } from "@cl/domain";
import * as fx from "./fixtures";
import { mapRow } from "./treeRows";
import { recomputeDistribution } from "../recompute/distribution";
import { redistributeOverride } from "../recompute/installments";

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

  setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void {
    this.patch(this.tables$, periodId, [], (tables) =>
      tables.map((t) => {
        if (t.id !== tableId) return t;
        const others = t.items.filter((it) => it.unitId !== unitId);
        const othersSum = others.reduce((a, it) => a + it.coefficient, 0);
        const remainder = t.total - coefficient;
        const items = t.items.map((it) => {
          if (it.unitId === unitId) return { ...it, coefficient };
          // scale other items proportionally to fill remainder
          const scaled = othersSum > 0 ? (it.coefficient / othersSum) * remainder : 0;
          return { ...it, coefficient: scaled };
        });
        return { ...t, items };
      }));
    const table = (this.tables$.getValue()[periodId] ?? []).find((t) => t.id === tableId);
    if (!table) return;
    const coeffByUnit = new Map(table.items.map((i) => [i.unitId, i.coefficient]));
    const cur = this.distributions$.getValue();
    const dist = cur[periodId];
    if (!dist) return;
    this.distributions$.next({
      ...cur,
      [periodId]: {
        estimate: recomputeDistribution(dist.estimate, coeffByUnit),
        current: recomputeDistribution(dist.current, coeffByUnit),
      },
    });
  }

  setPreventivo(periodId: Id, accountId: Id, cents: number): void {
    this.patch(this.accounts$, periodId, [], (rows) =>
      mapRow(rows, accountId, (r) => ({ ...r, preventivo: fromCents(cents) })));
  }

  setInstallmentAmount(periodId: Id, rowId: Id, installmentId: Id, cents: number): void {
    this.patch(this.installments$, periodId, { columns: [], rows: [] }, (data) => {
      const order = data.columns.map((c) => c.id);
      const edited = mapRow(data.rows, rowId, (r) => {
        const cells = order.map((id) => r.byInstallment[id]?.cents ?? 0);
        const next = redistributeOverride(cells, order.indexOf(installmentId), cents);
        return { ...r, byInstallment: Object.fromEntries(order.map((id, i) => [id, fromCents(next[i]!)])) };
      });
      const rows = edited.map((g) => !g.children?.length ? g : ({
        ...g,
        byInstallment: Object.fromEntries(order.map((id) => [
          id,
          fromCents(g.children!.reduce((a, ch) => a + (ch.byInstallment[id]?.cents ?? 0), 0)),
        ])),
      }));
      return { ...data, rows };
    });
  }
}
