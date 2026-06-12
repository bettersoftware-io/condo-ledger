import { BehaviorSubject, of, switchMap, map } from "rxjs";
import { bind } from "@react-rxjs/core";
import type {
  AppRuntime, MockDataSource, Module, CondominiSection, Selection,
  DistributionType, Id,
} from "@cl/application";

export function createAppRuntime(deps: { data: MockDataSource }): AppRuntime {
  const { data } = deps;

  const module$ = new BehaviorSubject<Module>("condomini");
  const section$ = new BehaviorSubject<CondominiSection>("dati");
  const selection$ = new BehaviorSubject<Selection>({});
  const selectedTable$ = new BehaviorSubject<Id | null>(null);

  const emptyRows: Record<CondominiSection, string | null> =
    { dati: null, unita: null, tabelle: null, conti: null, giornale: null, rate: null };
  const selectedRows$ = new BehaviorSubject<Record<CondominiSection, string | null>>(emptyRows);
  const [useSelectedRows] = bind(selectedRows$, emptyRows);

  const periodId$ = selection$.pipe(map((s) => s.accountingPeriodId ?? null));

  // bound hooks scoped to THIS factory call (no module singletons).
  // Defaults mirror each BehaviorSubject seed so reads resolve synchronously
  // without requiring a <Subscribe> boundary (react-rxjs single-arg bind needs one).
  const [useModule] = bind(module$, "condomini");
  const [useSection] = bind(section$, "dati");
  const [useSelection] = bind(selection$, {});
  const [useSelectedTableId] = bind(selectedTable$, null);

  const [useCondominiumTree] = bind(data.condominiumTree(), []);
  const [useCondominiumDetail] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.condominiumDetail(id) : of(null)))),
    null,
  );
  const [useUnitsTree] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.unitsTree(id) : of([])))),
    [],
  );
  const [useDistributionTables] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.distributionTables(id) : of([])))),
    [],
  );
  const distribution = (type: DistributionType) =>
    bind(
      periodId$.pipe(switchMap((id) => (id ? data.distribution(id, type) : of({ columns: [], rows: [] })))),
      { columns: [], rows: [] },
    );
  const [useEstimate] = distribution("estimate");
  const [useCurrent] = distribution("current");
  const [useLedgerAccountsTree] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.ledgerAccountsTree(id) : of([])))),
    [],
  );
  const [useLedgerTransactions] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.ledgerTransactions(id) : of([])))),
    [],
  );
  const [useInstallments] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.installments(id) : of({ columns: [], rows: [] })))),
    { columns: [], rows: [] },
  );
  const [useF24s] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.f24s(id) : of([])))), []);
  const [useFunctionalAccounts] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.functionalAccounts(id) : of({})))), {});
  const [usePeriodSummaries] = bind(data.periodSummaries(), {});

  return {
    useModule, setModule: (m) => module$.next(m),
    useSection, setSection: (s) => section$.next(s),
    useCondominiumTree,
    useSelection, select: (sel) => selection$.next(sel),
    useCondominiumDetail,
    useUnitsTree,
    useDistributionTables,
    useSelectedTableId, selectTable: (id) => selectedTable$.next(id),
    // Call BOTH hooks unconditionally (stable hook order across renders, since
    // `type` is toggled at runtime by the Preventivo/Consuntivo switch) and
    // select the result — avoids a conditional-hook Rules-of-Hooks violation.
    useDistribution: (type) => {
      const estimate = useEstimate();
      const current = useCurrent();
      return type === "estimate" ? estimate : current;
    },
    useLedgerAccountsTree,
    useLedgerTransactions,
    useInstallments,
    useF24s, useFunctionalAccounts, usePeriodSummaries,
    commands: data,
    useSelectedRow: (section) => useSelectedRows()[section] ?? null,
    selectRow: (section, id) =>
      selectedRows$.next({ ...selectedRows$.getValue(), [section]: id }),
  };
}
