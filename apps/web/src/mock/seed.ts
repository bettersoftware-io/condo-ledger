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
import type { PeriodState } from "@cl/domain";

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
  /** Phase 1b-2: pure-cascade input per period (book-reconciling periods only).
   * The live app derives distribution + balances by calling recomputePeriod on this. */
  periodStateByPeriod?: Record<Id, PeriodState>;
  /** Phase 1b-2: per-resident directly-attributed individual expenses (legacy
   * unitResidentId → cents) folded into consuntivo on top of the riparto share. */
  individualByPeriod?: Record<Id, Record<string, number>>;
  f24sByPeriod: Record<Id, F24Row[]>;
  functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>>;
  calendarLayers: CalendarLayer[];
  calendarEvents: CalendarEvent[];
  anagraficaCategories: string[];
  anagrafiche: Anagrafica[];
}
