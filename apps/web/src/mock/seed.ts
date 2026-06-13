import type {
  CondominiumNode,
  CondominiumDetail,
  UnitRow,
  DistributionTable,
  DistributionColumn,
  DistributionRow,
  LedgerAccountRow,
  LedgerTxnRow,
  InstallmentColumn,
  InstallmentRow,
  F24Row,
  FunctionalRole,
  Id,
  CalendarLayer,
  CalendarEvent,
  Anagrafica,
  DistributionType,
} from "@cl/application";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

/** The data a {@link MockStore} is seeded from. Structurally identical to the
 * offline generator's `Seed` (apps/web/tools/gen/assemble.ts) so the generated
 * JSON can be loaded as a seed without conversion. */
export interface MockStoreSeed {
  tree: CondominiumNode[];
  detailByPeriod: Record<Id, CondominiumDetail>;
  unitsByPeriod: Record<Id, UnitRow[]>;
  distributionTablesByPeriod: Record<Id, DistributionTable[]>;
  distributionByPeriod: Record<Id, Record<DistributionType, Dist>>;
  ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]>;
  ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]>;
  installmentsByPeriod: Record<Id, Installments>;
  f24sByPeriod: Record<Id, F24Row[]>;
  functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>>;
  calendarLayers: CalendarLayer[];
  calendarEvents: CalendarEvent[];
  anagraficaCategories: string[];
  anagrafiche: Anagrafica[];
}
