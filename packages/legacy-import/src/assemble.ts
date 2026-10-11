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
} from "#/seedTypes.ts";
import type { PeriodState } from "@cl/domain";
import type { Db } from "./db.ts";
import { reconcilePeriods } from "./reconcile.ts";
import { projectAnagrafiche, projectCategories } from "./project/anagrafiche.ts";
import { projectLayers, projectEvents } from "./project/calendar.ts";
import { projectTree, projectDetails, projectFunctional, projectF24 } from "./project/structure.ts";
import { projectAccounts, projectTransactions } from "./project/accounting.ts";
import { projectUnits } from "./project/units.ts";
import { projectDistributionTables, projectDistribution } from "./project/distribution.ts";
import { projectInstallments } from "./project/installments.ts";
import { dbToPeriodState } from "./project/periodState.ts";
import { projectIndividual } from "./project/individual.ts";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

export interface Seed {
  tree: CondominiumNode[];
  detailByPeriod: Record<Id, CondominiumDetail>;
  unitsByPeriod: Record<Id, UnitRow[]>;
  distributionTablesByPeriod: Record<Id, DistributionTable[]>;
  distributionByPeriod: Record<Id, Record<DistributionType, Dist>>;
  ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]>;
  ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]>;
  installmentsByPeriod: Record<Id, Installments>;
  periodStateByPeriod: Record<Id, PeriodState>;
  individualByPeriod: Record<Id, Record<string, number>>;
  f24sByPeriod: Record<Id, F24Row[]>;
  functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>>;
  calendarLayers: CalendarLayer[];
  calendarEvents: CalendarEvent[];
  anagraficaCategories: string[];
  anagrafiche: Anagrafica[];
}

const emptyDist: Dist = { columns: [], rows: [] };
const emptyInst: Installments = { columns: [], rows: [] };

export function assemble(db: Db): Seed {
  const tree = projectTree(db);
  const detailByPeriod = projectDetails(db);
  const functionalByPeriod = projectFunctional(db);
  const f24sByPeriod = projectF24(db);
  const calendarLayers = projectLayers(db);
  const calendarEvents = projectEvents(db);
  const anagraficaCategories = projectCategories(db);
  const anagrafiche = projectAnagrafiche(db);

  const status = reconcilePeriods(db);

  const unitsByPeriod: Record<Id, UnitRow[]> = {};
  const distributionTablesByPeriod: Record<Id, DistributionTable[]> = {};
  const distributionByPeriod: Record<Id, Record<DistributionType, Dist>> = {};
  const ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]> = {};
  const ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]> = {};
  const installmentsByPeriod: Record<Id, Installments> = {};
  const periodStateByPeriod: Record<Id, PeriodState> = {};
  const individualByPeriod: Record<Id, Record<string, number>> = {};

  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const lp = String(p.id);
      const pid: Id = `p${lp}`;

      // Structure is always shipped, even for periods without books.
      unitsByPeriod[pid] = projectUnits(db, lp);

      const st = status[lp];
      if (st?.hasBooks && st?.reconciles) {
        ledgerAccountsByPeriod[pid] = projectAccounts(db, lp);
        ledgerTxnsByPeriod[pid] = projectTransactions(db, lp);
        distributionTablesByPeriod[pid] = projectDistributionTables(db, lp);
        distributionByPeriod[pid] = projectDistribution(db, lp);
        installmentsByPeriod[pid] = projectInstallments(db, lp);
        periodStateByPeriod[pid] = dbToPeriodState(db, lp);
        individualByPeriod[pid] = projectIndividual(db, lp);
      } else {
        ledgerAccountsByPeriod[pid] = [];
        ledgerTxnsByPeriod[pid] = [];
        distributionTablesByPeriod[pid] = [];
        distributionByPeriod[pid] = { estimate: emptyDist, current: emptyDist };
        installmentsByPeriod[pid] = emptyInst;
        periodStateByPeriod[pid] = {
          riparto: {
            accounts: [], links: [], estimateCentsByAccount: {}, actualCentsByAccount: {},
            tableItems: [], roles: [], residents: [], unitLegacyIds: [],
          },
          plan: { installmentIds: [], overrides: [] },
          opening: {}, paid: {},
        };
        individualByPeriod[pid] = {};
      }
    }
  }

  return {
    tree,
    detailByPeriod,
    unitsByPeriod,
    distributionTablesByPeriod,
    distributionByPeriod,
    ledgerAccountsByPeriod,
    ledgerTxnsByPeriod,
    installmentsByPeriod,
    periodStateByPeriod,
    individualByPeriod,
    f24sByPeriod,
    functionalByPeriod,
    calendarLayers,
    calendarEvents,
    anagraficaCategories,
    anagrafiche,
  };
}
