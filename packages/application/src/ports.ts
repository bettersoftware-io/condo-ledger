import type { Observable } from "rxjs";
import type {
  Module, CondominiSection, Selection, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionRow, DistributionColumn, DistributionType,
  LedgerAccountRow, LedgerTxnRow, InstallmentRow, InstallmentColumn, Id,
} from "./types";

/** Data port. Mock today; HTTP/tRPC adapter later. Returns observables. */
export interface MockDataSource {
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
}

/** Grid adapter contract — independent of TanStack. */
export interface TreeColumn<Row> {
  id: string;
  header: string;
  align?: "left" | "right";
  /** render a cell; receives the row */
  cell: (row: Row) => React.ReactNode;
  /** optional inline editor; when present cell is editable */
  editor?: (row: Row, commit: (next: Row) => void) => React.ReactNode;
}
export interface TreeTableProps<Row extends { id: string; children?: Row[] }> {
  rows: Row[];
  columns: TreeColumn<Row>[];
  getRowKind?: (row: Row) => string; // for group/subtotal styling
  selectedId?: string | null;
  onSelect?: (row: Row) => void;
}
