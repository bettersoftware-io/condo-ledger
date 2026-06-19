import { BehaviorSubject, combineLatest, map, of, type Observable } from "rxjs";
import type {
  MockDataSource, Id, DistributionType, CondominiumNode, CondominiumDetail,
  AccountingPeriodNode, SupplierRow,
  UnitRow, DistributionTable, DistributionTableItem, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow,
  TransactionInput, InvoiceInput, TakingInput, CreateInstallmentsInput,
  F24Row, FunctionalRole, PeriodSummary, WithholdingPaymentInput,
  CalendarLayer, CalendarEvent,
  Anagrafica, AnagraficaLink,
} from "@cl/application";
import { fromCents } from "@cl/domain";
import { fixtureSeed } from "./fixtures";
import type { MockStoreSeed } from "./seed";
import { mapRow, removeRow, insertChild } from "./treeRows";
import { recomputePeriod, type PeriodState } from "@cl/domain";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";
import { distributeInstallments, redistributeOverride } from "../recompute/installments";
import { addMonths, formatItDate } from "../recompute/dates";
import { applyEntryDeltas } from "../recompute/balances";
import { periodSummary } from "../recompute/summary";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

export class MockStore implements MockDataSource {
  private tree$: BehaviorSubject<CondominiumNode[]>;
  private details$: BehaviorSubject<Record<Id, CondominiumDetail>>;
  private units$: BehaviorSubject<Record<Id, UnitRow[]>>;
  private tables$: BehaviorSubject<Record<Id, DistributionTable[]>>;
  private distributions$: BehaviorSubject<Record<Id, Record<DistributionType, Dist>>>;
  private accounts$: BehaviorSubject<Record<Id, LedgerAccountRow[]>>;
  protected txns$: BehaviorSubject<Record<Id, LedgerTxnRow[]>>;
  private installments$: BehaviorSubject<Record<Id, Installments>>;
  private paid$: BehaviorSubject<Record<Id, Record<string, number>>>;
  private f24s$: BehaviorSubject<Record<Id, F24Row[]>>;
  private functional$: BehaviorSubject<Record<Id, Partial<Record<FunctionalRole, Id>>>>;
  private calendar$: BehaviorSubject<CalendarEvent[]>;
  private anagrafiche$: BehaviorSubject<Anagrafica[]>;
  /** Static registries: shipped as-is, validated against on CRUD. */
  private readonly calendarLayers_: CalendarLayer[];
  private readonly anagraficaCategories_: string[];
  /** Seeded pure-cascade input + individual expenses (book-reconciling periods only). */
  private readonly periodStates_: Record<Id, PeriodState>;
  private readonly individual_: Record<Id, Record<string, number>>;

  constructor(seed: MockStoreSeed = fixtureSeed) {
    this.tree$ = new BehaviorSubject<CondominiumNode[]>(seed.tree);
    this.details$ = new BehaviorSubject<Record<Id, CondominiumDetail>>(seed.detailByPeriod);
    this.units$ = new BehaviorSubject<Record<Id, UnitRow[]>>(seed.unitsByPeriod);
    this.tables$ = new BehaviorSubject<Record<Id, DistributionTable[]>>(seed.distributionTablesByPeriod);
    this.distributions$ = new BehaviorSubject<Record<Id, Record<DistributionType, Dist>>>(seed.distributionByPeriod);
    this.accounts$ = new BehaviorSubject<Record<Id, LedgerAccountRow[]>>(seed.ledgerAccountsByPeriod);
    this.txns$ = new BehaviorSubject<Record<Id, LedgerTxnRow[]>>(seed.ledgerTxnsByPeriod);
    this.installments$ = new BehaviorSubject<Record<Id, Installments>>(seed.installmentsByPeriod);
    const states = seed.periodStateByPeriod ?? {};
    this.periodStates_ = states;
    this.individual_ = seed.individualByPeriod ?? {};
    const paidSeed: Record<Id, Record<string, number>> = {};
    for (const pid of Object.keys(states)) paidSeed[pid] = { ...states[pid]!.paid };
    this.paid$ = new BehaviorSubject<Record<Id, Record<string, number>>>(paidSeed);
    this.f24s$ = new BehaviorSubject<Record<Id, F24Row[]>>(seed.f24sByPeriod);
    this.functional$ = new BehaviorSubject<Record<Id, Partial<Record<FunctionalRole, Id>>>>(seed.functionalByPeriod);
    this.calendar$ = new BehaviorSubject<CalendarEvent[]>(seed.calendarEvents);
    this.anagrafiche$ = new BehaviorSubject<Anagrafica[]>(seed.anagrafiche);
    this.calendarLayers_ = seed.calendarLayers;
    this.anagraficaCategories_ = seed.anagraficaCategories;
  }

  condominiumTree(): Observable<CondominiumNode[]> { return this.tree$.asObservable(); }
  condominiumDetail(periodId: Id) { return this.details$.pipe(map((d) => d[periodId] ?? null)); }
  unitsTree(periodId: Id) { return this.units$.pipe(map((u) => u[periodId] ?? [])); }
  distributionTables(periodId: Id) { return this.tables$.pipe(map((t) => t[periodId] ?? [])); }
  /** recomputePeriod over the live subjects for a period; null when not a book period. */
  private engineFor(
    periodId: Id,
    tables: Record<Id, DistributionTable[]>,
    accounts: Record<Id, LedgerAccountRow[]>,
    paid: Record<Id, Record<string, number>>,
  ): ReturnType<typeof recomputePeriod> | null {
    const seeded = this.periodStates_[periodId];
    if (!seeded) return null;
    return recomputePeriod(liveState(seeded, tables[periodId] ?? [], accounts[periodId] ?? [], paid[periodId] ?? {}));
  }

  distribution(periodId: Id, type: DistributionType): Observable<Dist> {
    return combineLatest([this.distributions$, this.tables$, this.accounts$, this.paid$]).pipe(
      map(([dists, tables, accounts, paid]) => {
        const skeleton = dists[periodId]?.[type] ?? { columns: [], rows: [] };
        const eng = this.engineFor(periodId, tables, accounts, paid);
        return eng ? overlayDistribution(eng.riparto, skeleton, type) : skeleton;
      }),
    );
  }
  ledgerAccountsTree(periodId: Id) { return this.accounts$.pipe(map((a) => a[periodId] ?? [])); }
  ledgerTransactions(periodId: Id) { return this.txns$.pipe(map((t) => t[periodId] ?? [])); }
  installments(periodId: Id): Observable<Installments> {
    return this.installments$.pipe(map((i) => i[periodId] ?? { columns: [], rows: [] }));
  }
  f24s(periodId: Id) { return this.f24s$.pipe(map((f) => f[periodId] ?? [])); }
  functionalAccounts(periodId: Id) { return this.functional$.pipe(map((f) => f[periodId] ?? {})); }
  periodSummaries(): Observable<Record<Id, PeriodSummary>> {
    return combineLatest([this.accounts$, this.units$]).pipe(map(([accounts, units]) => {
      const ids = new Set([...Object.keys(accounts), ...Object.keys(units)]);
      return Object.fromEntries(
        [...ids].map((id) => [id, periodSummary(accounts[id] ?? [], units[id] ?? [])]),
      );
    }));
  }
  calendarLayers(): Observable<CalendarLayer[]> { return of(this.calendarLayers_); } // static registry
  calendarEvents(): Observable<CalendarEvent[]> { return this.calendar$.asObservable(); }
  anagrafiche(): Observable<Anagrafica[]> { return this.anagrafiche$.asObservable(); }
  anagraficaCategories(): Observable<string[]> { return of(this.anagraficaCategories_); } // static registry
  anagraficaLinks(anagraficaId: Id): Observable<AnagraficaLink[]> {
    return combineLatest([this.anagrafiche$, this.tree$, this.details$, this.units$]).pipe(
      map(([anas, tree, details, units]) => {
        const a = anas.find((x) => x.id === anagraficaId);
        if (!a) return [];
        const links: AnagraficaLink[] = [];
        for (const cond of tree) {
          const condominio = cond.name.split(" (")[0] ?? cond.name;
          for (const p of cond.periods) {
            const supplier = (details[p.id]?.suppliers ?? []).find((s) => s.nominativo === a.nominativo);
            if (supplier) {
              links.push({ condominio, esercizio: p.name, ruolo: "Fornitore", dettaglio: supplier.categoria });
            }
            const row = findRowLabel(units[p.id] ?? [], a.nominativo);
            if (row) links.push({ condominio, esercizio: p.name, ruolo: "Condòmino", dettaglio: row });
          }
        }
        return links;
      }),
    );
  }

  /** Immutable per-period patch; commands in later tasks build on this. */
  protected patch<K>(
    subject: BehaviorSubject<Record<Id, K>>, periodId: Id, empty: K, fn: (cur: K) => K,
  ): void {
    const cur = subject.getValue();
    subject.next({ ...cur, [periodId]: fn(cur[periodId] ?? empty) });
  }

  // --- registry CRUD ---
  addCondominium(node: CondominiumNode): void { this.tree$.next([...this.tree$.getValue(), node]); }
  editCondominium(id: Id, patchNode: Partial<CondominiumNode>): void {
    this.tree$.next(this.tree$.getValue().map((n) => (n.id === id ? { ...n, ...patchNode } : n)));
  }
  removeCondominium(id: Id): void { this.tree$.next(this.tree$.getValue().filter((n) => n.id !== id)); }
  addPeriod(condominiumId: Id, period: AccountingPeriodNode): void {
    this.tree$.next(this.tree$.getValue().map((n) =>
      n.id === condominiumId ? { ...n, periods: [...n.periods, period] } : n));
  }

  addSupplier(periodId: Id, supplier: SupplierRow): void {
    const cur = this.details$.getValue();
    const d = cur[periodId];
    if (!d) return;
    this.details$.next({ ...cur, [periodId]: { ...d, suppliers: [...d.suppliers, supplier] } });
  }
  removeSupplier(periodId: Id, supplierId: Id): void {
    const cur = this.details$.getValue();
    const d = cur[periodId];
    if (!d) return;
    this.details$.next({ ...cur, [periodId]: { ...d, suppliers: d.suppliers.filter((s) => s.id !== supplierId) } });
  }

  addUnitRow(periodId: Id, parentId: Id | null, row: UnitRow): void {
    this.patch(this.units$, periodId, [], (rows) => insertChild(rows, parentId, row));
  }
  editUnitRow(periodId: Id, id: Id, patchRow: Partial<UnitRow>): void {
    this.patch(this.units$, periodId, [], (rows) => mapRow(rows, id, (r) => ({ ...r, ...patchRow })));
  }
  removeUnitRow(periodId: Id, id: Id): void {
    this.patch(this.units$, periodId, [], (rows) => removeRow(rows, id));
  }

  addTable(periodId: Id, table: DistributionTable): void {
    this.patch(this.tables$, periodId, [], (ts) => [...ts, table]);
  }
  editTable(periodId: Id, id: Id, patchTable: Partial<DistributionTable>): void {
    this.patch(this.tables$, periodId, [], (ts) => ts.map((t) => (t.id === id ? { ...t, ...patchTable } : t)));
  }
  removeTable(periodId: Id, id: Id): void {
    this.patch(this.tables$, periodId, [], (ts) => ts.filter((t) => t.id !== id));
  }
  addTableItem(periodId: Id, tableId: Id, item: DistributionTableItem): void {
    this.patch(this.tables$, periodId, [], (ts) => ts.map((t) =>
      t.id === tableId ? { ...t, items: [...t.items, item] } : t));
  }
  removeTableItem(periodId: Id, tableId: Id, unitId: Id): void {
    this.patch(this.tables$, periodId, [], (ts) => ts.map((t) =>
      t.id === tableId ? { ...t, items: t.items.filter((i) => i.unitId !== unitId) } : t));
  }

  addAccountRow(periodId: Id, parentId: Id | null, row: LedgerAccountRow): void {
    this.patch(this.accounts$, periodId, [], (rows) => insertChild(rows, parentId, row));
  }
  editAccountRow(periodId: Id, id: Id, patchRow: Partial<LedgerAccountRow>): void {
    this.patch(this.accounts$, periodId, [], (rows) => mapRow(rows, id, (r) => ({ ...r, ...patchRow })));
  }
  removeAccountRow(periodId: Id, id: Id): void {
    this.patch(this.accounts$, periodId, [], (rows) => removeRow(rows, id));
  }

  addF24(periodId: Id, f24: F24Row): void {
    this.patch(this.f24s$, periodId, [], (fs) => [...fs, f24]);
  }
  editF24(periodId: Id, id: Id, patchF24: Partial<F24Row>): void {
    this.patch(this.f24s$, periodId, [], (fs) => fs.map((f) => (f.id === id ? { ...f, ...patchF24 } : f)));
  }
  editInstallment(periodId: Id, installmentId: Id, patchCol: Partial<InstallmentColumn>): void {
    this.patch(this.installments$, periodId, { columns: [], rows: [] }, (data) => ({
      ...data,
      columns: data.columns.map((col) => (col.id === installmentId ? { ...col, ...patchCol } : col)),
    }));
  }
  setFunctionalAccount(periodId: Id, role: FunctionalRole, accountId: Id): void {
    this.patch(this.functional$, periodId, {}, (cur) => ({ ...cur, [role]: accountId }));
  }
  addCalendarEvent(event: CalendarEvent): void {
    if (!this.calendarLayers_.some((l) => l.id === event.layerId))
      throw new Error(`Calendario sconosciuto: ${event.layerId}`);
    this.calendar$.next([...this.calendar$.getValue(), event]);
  }
  editCalendarEvent(id: Id, patch: Partial<CalendarEvent>): void {
    this.calendar$.next(this.calendar$.getValue().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  removeCalendarEvent(id: Id): void {
    this.calendar$.next(this.calendar$.getValue().filter((e) => e.id !== id));
  }
  addAnagrafica(a: Anagrafica): void {
    if (!this.anagraficaCategories_.includes(a.categoria))
      throw new Error(`Categoria sconosciuta: ${a.categoria}`);
    this.anagrafiche$.next([...this.anagrafiche$.getValue(), a]);
  }
  editAnagrafica(id: Id, patch: Partial<Anagrafica>): void {
    this.anagrafiche$.next(this.anagrafiche$.getValue().map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  removeAnagrafica(id: Id): void {
    this.anagrafiche$.next(this.anagrafiche$.getValue().filter((a) => a.id !== id));
  }
  payWithholding(periodId: Id, input: WithholdingPaymentInput): void {
    this.addTransaction(periodId, {
      date: input.date, description: "Pagamento ritenuta d'acconto", partita: "F24",
      entries: [
        { accountId: input.withholdingAccountId, label: input.withholdingAccountLabel, dareCents: input.amountCents, avereCents: 0 },
        { accountId: input.liquidAccountId, label: input.liquidAccountLabel, dareCents: 0, avereCents: input.amountCents },
      ],
    });
  }

  setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void {
    this.patch(this.tables$, periodId, [], (tables) =>
      tables.map((t) => t.id !== tableId ? t : ({
        ...t,
        items: t.items.map((it) => (it.unitId === unitId ? { ...it, coefficient } : it)),
      })));
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
        const current = cells[idx]!;
        if (cents === current) return r; // identity edit: silent no-op
        const next = redistributeOverride(cells, idx, cents);
        if (next === cells) throw new Error("Importo non valido: le rate successive diverrebbero negative");
        return {
          ...r,
          byInstallment: Object.fromEntries(order.map((id, i) => [id, fromCents(next[i]!)])),
          overridden: { ...r.overridden, [installmentId]: true },
        };
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
    const accounts = this.accounts$.getValue()[periodId] ?? [];
    const exists = (rows: LedgerAccountRow[], id: Id): boolean =>
      rows.some((r) => r.id === id || exists(r.children ?? [], id));
    for (const e of input.entries) {
      if (!exists(accounts, e.accountId)) throw new Error(`Conto inesistente: ${e.accountId}`);
    }
    const existing = this.txns$.getValue()[periodId] ?? [];
    const code = existing.reduce((m, t) => Math.max(m, t.code), 0) + 1;
    this.patch(this.txns$, periodId, [], (txns) => [...txns, {
      id: `tx-${periodId}-${code}`,
      date: input.date, code, description: input.description,
      partita: input.partita,
      dare: fromCents(totDare), avere: fromCents(totAvere),
      entries: input.entries.map((e) => ({ accountId: e.accountId, account: e.label, dare: fromCents(e.dareCents), avere: fromCents(e.avereCents) })),
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

  createInstallments(periodId: Id, input: CreateInstallmentsInput): void {
    const table = (this.tables$.getValue()[periodId] ?? []).find((t) => t.id === input.tableId);
    if (!table) throw new Error("Tabella di riparto inesistente");
    const columns: InstallmentColumn[] = Array.from({ length: input.count }, (_, i) => ({
      id: `r${i + 1}`,
      header: `Rata ${i + 1} (${formatItDate(addMonths(input.firstExpiry, i * input.cadenceMonths))})`,
    }));
    const split = distributeInstallments(input.totalCents, table.items.map((it) => it.coefficient), input.count);
    const children: InstallmentRow[] = table.items.map((item, idx) => {
      const totale = split[idx]!.reduce((a, b) => a + b, 0);
      return {
        id: `i-${item.unitId}`, kind: "unit", unitId: item.unitId, label: item.unitLabel, role: "Proprietario",
        saldoPrec: fromCents(0), totPreventivo: fromCents(totale), totDovuto: fromCents(totale),
        byInstallment: Object.fromEntries(columns.map((c, k) => [c.id, fromCents(split[idx]![k]!)])),
      };
    });
    const group: InstallmentRow = {
      id: "i-group", kind: "group", label: "Rate da preventivo",
      saldoPrec: fromCents(0), totPreventivo: fromCents(input.totalCents), totDovuto: fromCents(input.totalCents),
      byInstallment: Object.fromEntries(columns.map((c) => [
        c.id, fromCents(children.reduce((a, ch) => a + ch.byInstallment[c.id]!.cents, 0)),
      ])),
      children,
    };
    this.patch(this.installments$, periodId, { columns: [], rows: [] }, () => ({ columns, rows: [group] }));
  }
}

/** First unit-tree row whose label mentions the nominativo (prototype-grade
 * name matching: fixtures guarantee supplier/resident names match the registry). */
function findRowLabel(rows: UnitRow[], nominativo: string): string | null {
  for (const r of rows) {
    if (r.label.includes(nominativo)) return r.label;
    const inChild = findRowLabel(r.children ?? [], nominativo);
    if (inChild) return inChild;
  }
  return null;
}
