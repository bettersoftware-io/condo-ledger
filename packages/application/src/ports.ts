import type { Observable } from "rxjs";
import type {
  Module, CondominiSection, Selection, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionTableItem, DistributionRow, DistributionColumn, DistributionType,
  LedgerAccountRow, LedgerTxnRow, InstallmentRow, InstallmentColumn, Id,
  AccountingPeriodNode, SupplierRow,
  TransactionInput, InvoiceInput, TakingInput, CreateInstallmentsInput,
  F24Row, FunctionalRole, PeriodSummary, WithholdingPaymentInput,
} from "./types";

/** Accounting + inline-edit commands. Synchronous: mock store mutates in memory. */
export interface DataCommands {
  setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void;
  setPreventivo(periodId: Id, accountId: Id, cents: number): void;
  setInstallmentAmount(periodId: Id, rowId: Id, installmentId: Id, cents: number): void;
  addTransaction(periodId: Id, input: TransactionInput): void;
  openBalances(periodId: Id, input: TransactionInput): void;
  registerInvoice(periodId: Id, input: InvoiceInput): void;
  recordTaking(periodId: Id, input: TakingInput): void;
  createInstallments(periodId: Id, input: CreateInstallmentsInput): void;
  payWithholding(periodId: Id, input: WithholdingPaymentInput): void;
}

/** Registry CRUD commands (dialogs call these). */
export interface CrudCommands {
  addCondominium(node: CondominiumNode): void;
  editCondominium(id: Id, patch: Partial<CondominiumNode>): void;
  removeCondominium(id: Id): void;
  addPeriod(condominiumId: Id, period: AccountingPeriodNode): void;
  addSupplier(periodId: Id, supplier: SupplierRow): void;
  removeSupplier(periodId: Id, supplierId: Id): void;
  addUnitRow(periodId: Id, parentId: Id | null, row: UnitRow): void;
  editUnitRow(periodId: Id, id: Id, patch: Partial<UnitRow>): void;
  removeUnitRow(periodId: Id, id: Id): void;
  addTable(periodId: Id, table: DistributionTable): void;
  editTable(periodId: Id, id: Id, patch: Partial<DistributionTable>): void;
  removeTable(periodId: Id, id: Id): void;
  addTableItem(periodId: Id, tableId: Id, item: DistributionTableItem): void;
  removeTableItem(periodId: Id, tableId: Id, unitId: Id): void;
  addAccountRow(periodId: Id, parentId: Id | null, row: LedgerAccountRow): void;
  editAccountRow(periodId: Id, id: Id, patch: Partial<LedgerAccountRow>): void;
  removeAccountRow(periodId: Id, id: Id): void;
  addF24(periodId: Id, f24: F24Row): void;
  editF24(periodId: Id, id: Id, patch: Partial<F24Row>): void;
  editInstallment(periodId: Id, installmentId: Id, patch: Partial<InstallmentColumn>): void;
  setFunctionalAccount(periodId: Id, role: FunctionalRole, accountId: Id): void;
}

/** Data port. Mock today; HTTP/tRPC adapter later. Returns observables. */
export interface MockDataSource extends DataCommands, CrudCommands {
  condominiumTree(): Observable<CondominiumNode[]>;
  condominiumDetail(periodId: Id): Observable<CondominiumDetail | null>;
  unitsTree(periodId: Id): Observable<UnitRow[]>;
  distributionTables(periodId: Id): Observable<DistributionTable[]>;
  distribution(periodId: Id, type: DistributionType):
    Observable<{ columns: DistributionColumn[]; rows: DistributionRow[] }>;
  ledgerAccountsTree(periodId: Id): Observable<LedgerAccountRow[]>;
  ledgerTransactions(periodId: Id): Observable<LedgerTxnRow[]>;
  installments(periodId: Id):
    Observable<{ columns: InstallmentColumn[]; rows: InstallmentRow[] }>;
  f24s(periodId: Id): Observable<F24Row[]>;
  functionalAccounts(periodId: Id): Observable<Partial<Record<FunctionalRole, Id>>>;
  /** keyed by accounting-period id; feeds the Dati grid money columns (Task 15) */
  periodSummaries(): Observable<Record<Id, PeriodSummary>>;
}

/** The reactive runtime, exposed as bound hooks (DI via context). */
export interface AppRuntime {
  useModule(): Module;
  setModule(m: Module): void;
  useSection(): CondominiSection;
  setSection(s: CondominiSection): void;

  useCondominiumTree(): CondominiumNode[];
  useSelection(): Selection;
  select(sel: Selection): void;

  useCondominiumDetail(): CondominiumDetail | null;
  useUnitsTree(): UnitRow[];
  useDistributionTables(): DistributionTable[];
  useSelectedTableId(): Id | null;
  selectTable(id: Id): void;
  useDistribution(type: DistributionType):
    { columns: DistributionColumn[]; rows: DistributionRow[] };
  useLedgerAccountsTree(): LedgerAccountRow[];
  useLedgerTransactions(): LedgerTxnRow[];
  useInstallments(): { columns: InstallmentColumn[]; rows: InstallmentRow[] };
  useF24s(): F24Row[];
  useFunctionalAccounts(): Partial<Record<FunctionalRole, Id>>;
  usePeriodSummaries(): Record<Id, PeriodSummary>;

  /** Store commands, surfaced through the runtime so components never import the store. */
  commands: DataCommands & CrudCommands;
  /** Per-section selected row (grid row id), promoted from section-local state. */
  useSelectedRow(section: CondominiSection): string | null;
  selectRow(section: CondominiSection, id: string | null): void;
}

/** Grid adapter contract — independent of TanStack. */
export interface TreeColumn<Row> {
  id: string;
  header: string;
  align?: "left" | "right";
  /** render a cell; receives the row */
  cell: (row: Row) => React.ReactNode;
}
export interface TreeTableProps<Row extends { id: string; children?: Row[] }> {
  rows: Row[];
  columns: TreeColumn<Row>[];
  getRowKind?: (row: Row) => string; // for group/subtotal styling
  selectedId?: string | null;
  onSelect?: (row: Row) => void;
}
