import { BehaviorSubject, map, type Observable } from "rxjs";
import type {
  MockDataSource, Id, DistributionType, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow,
  TransactionInput, InvoiceInput, TakingInput,
} from "@cl/application";
import { fromCents } from "@cl/domain";
import * as fx from "./fixtures";
import { mapRow } from "./treeRows";
import { recomputeDistribution } from "../recompute/distribution";
import { redistributeOverride } from "../recompute/installments";
import { applyEntryDeltas } from "../recompute/balances";

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
      tables.map((t) => t.id !== tableId ? t : ({
        ...t,
        items: t.items.map((it) => (it.unitId === unitId ? { ...it, coefficient } : it)),
      })));
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
    const order = (this.installments$.getValue()[periodId]?.columns ?? []).map((c) => c.id);
    const idx = order.indexOf(installmentId);
    if (idx === -1) return; // unknown installment id: no-op
    this.patch(this.installments$, periodId, { columns: [], rows: [] }, (data) => {
      const edited = mapRow(data.rows, rowId, (r) => {
        const cells = order.map((id) => r.byInstallment[id]?.cents ?? 0);
        const next = redistributeOverride(cells, idx, cents);
        return { ...r, byInstallment: Object.fromEntries(order.map((id, i) => [id, fromCents(next[i]!)])) };
      });
      // single-level re-derivation: assumes group → leaf rows (current fixture shape)
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

  addTransaction(periodId: Id, input: TransactionInput): void {
    const totDare = input.entries.reduce((a, e) => a + e.dareCents, 0);
    const totAvere = input.entries.reduce((a, e) => a + e.avereCents, 0);
    if (totDare !== totAvere) throw new Error("Scrittura non bilanciata: dare ≠ avere");
    const existing = this.txns$.getValue()[periodId] ?? [];
    const code = existing.reduce((m, t) => Math.max(m, t.code), 0) + 1;
    this.patch(this.txns$, periodId, [], (txns) => [...txns, {
      id: `tx-${periodId}-${code}`,
      date: input.date, code, description: input.description,
      dare: fromCents(totDare), avere: fromCents(totAvere),
      entries: input.entries.map((e) => ({ account: e.label, dare: fromCents(e.dareCents), avere: fromCents(e.avereCents) })),
    }]);
    this.patch(this.accounts$, periodId, [], (rows) =>
      applyEntryDeltas(rows, input.entries.map((e) => ({
        accountId: e.accountId, dareCents: e.dareCents, avereCents: e.avereCents,
      }))));
  }

  openBalances(periodId: Id, input: TransactionInput): void {
    this.addTransaction(periodId, input); // same balanced-posting rule; wizard differs, command doesn't
  }

  registerInvoice(periodId: Id, inv: InvoiceInput): void {
    const net = inv.grossCents - inv.withholdingCents;
    this.addTransaction(periodId, {
      date: inv.date,
      description: `Registrazione fattura ${inv.invoiceNumber} ${inv.supplierName}`,
      entries: [
        { accountId: inv.expenseAccountId, label: inv.expenseAccountLabel, dareCents: inv.grossCents, avereCents: 0 },
        { accountId: inv.payableAccountId, label: inv.payableAccountLabel, dareCents: 0, avereCents: net },
        ...(inv.withholdingCents > 0
          ? [{ accountId: inv.withholdingAccountId, label: inv.withholdingAccountLabel, dareCents: 0, avereCents: inv.withholdingCents }]
          : []),
      ],
    });
  }

  recordTaking(periodId: Id, t: TakingInput): void {
    const containsResident = (rows: UnitRow[]): boolean =>
      rows.some((r) => r.id === t.residentId || containsResident(r.children ?? []));
    if (!containsResident(this.units$.getValue()[periodId] ?? [])) {
      throw new Error(`Residente inesistente: ${t.residentId}`);
    }
    const total = t.settlements.reduce((a, s) => a + s.amountCents, 0);
    this.addTransaction(periodId, {
      date: t.date,
      description: `Incasso ${t.residentLabel}`,
      entries: [
        { accountId: t.liquidAccountId, label: t.liquidAccountLabel, dareCents: total, avereCents: 0 },
        { accountId: t.creditAccountId, label: t.creditAccountLabel, dareCents: 0, avereCents: total },
      ],
    });
    const addVersato = (rows: UnitRow[]): UnitRow[] => {
      const contains = (r: UnitRow): boolean =>
        r.id === t.residentId || (r.children ?? []).some(contains);
      const walk = (r: UnitRow): UnitRow => contains(r)
        ? { ...r, versato: fromCents(r.versato.cents + total), children: r.children?.map(walk) }
        : r;
      return rows.map(walk);
    };
    this.patch(this.units$, periodId, [], addVersato);
  }
}
