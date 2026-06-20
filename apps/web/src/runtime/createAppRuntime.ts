import { BehaviorSubject, combineLatest, of, switchMap, map } from "rxjs";
import { bind } from "@react-rxjs/core";
import type {
  AppRuntime, MockDataSource, Module, CondominiSection, Selection,
  DistributionType, Id, AnagraficaKindFilter, AnagraficaStatusFilter,
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

  // Calendario slice. Studio-wide (not gated on selection$): the legacy agenda
  // spans all condominiums; the month is the unit of fetching. The initial month is
  // data-driven — the month carrying the most seeded events — so the view opens on a
  // populated month for any seed (fixtures land on 2011-04, the generated data on
  // 2013-02). "2011-04" is only the fallback when there are no events; a real adapter
  // would use today.
  const pickInitialMonth = (): string => {
    let events: { date: string }[] = [];
    data.calendarEvents().subscribe((e) => { events = e; }).unsubscribe();
    if (events.length === 0) return "2011-04";
    const counts = new Map<string, number>();
    for (const e of events) {
      const ym = e.date.slice(0, 7);
      counts.set(ym, (counts.get(ym) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  };
  const initialMonth = pickInitialMonth();
  const calendarMonth$ = new BehaviorSubject<string>(initialMonth);
  const selectedDay$ = new BehaviorSubject<string | null>(null);
  const [useCalendarMonth] = bind(calendarMonth$, initialMonth);
  const [useSelectedDay] = bind(selectedDay$, null);
  const [useCalendarLayers] = bind(data.calendarLayers(), []);
  const [useAllCalendarEvents] = bind(data.calendarEvents(), []);
  const [useCalendarEvents] = bind(
    combineLatest([calendarMonth$, data.calendarEvents()]).pipe(
      map(([ym, events]) => events
        .filter((e) => e.date.startsWith(`${ym}-`))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))),
    ),
    [],
  );

  // Anagrafiche slice. Studio-wide like the calendar (legacy masterData has no
  // condominium FK); search + tipo + stato + categoria compose as ONE derived
  // stream (spec §5.2) so the grid, paging and counts all read consistent state.
  const anagSearch$ = new BehaviorSubject<string>("");
  const anagKind$ = new BehaviorSubject<AnagraficaKindFilter>("tutte");
  const anagStato$ = new BehaviorSubject<AnagraficaStatusFilter>("tutte");
  const anagCategory$ = new BehaviorSubject<string | null>(null);
  const selectedAnagrafica$ = new BehaviorSubject<Id | null>(null);
  const [useAnagSearch] = bind(anagSearch$, "");
  const [useAnagKind] = bind(anagKind$, "tutte");
  const [useAnagStato] = bind(anagStato$, "tutte");
  const [useAnagCategory] = bind(anagCategory$, null);
  const [useSelectedAnagrafica] = bind(selectedAnagrafica$, null);
  const [useAllAnagrafiche] = bind(data.anagrafiche(), []);
  const [useAnagraficaCategories] = bind(data.anagraficaCategories(), []);
  const [useAnagrafiche] = bind(
    combineLatest([data.anagrafiche(), anagSearch$, anagKind$, anagStato$, anagCategory$]).pipe(
      map(([all, search, kind, stato, category]) => {
        const q = search.trim().toLowerCase();
        return all
          .filter((a) => kind === "tutte" || a.kind === kind)
          .filter((a) => stato === "tutte" || a.stato === stato)
          .filter((a) => category === null || a.categoria === category)
          .filter((a) => !q ||
            [a.nominativo, a.codice, a.codiceFiscale, a.partitaIva, a.indirizzo]
              .some((f) => f?.toLowerCase().includes(q)))
          .sort((a, b) => a.nominativo.localeCompare(b.nominativo, "it", { sensitivity: "base" })); // pinned locale: default-locale sort varies across CI environments
      }),
    ),
    [],
  );
  const [useAnagraficaCategoryCounts] = bind(
    data.anagrafiche().pipe(map((all) => {
      const counts: Record<string, number> = {};
      for (const a of all) counts[a.categoria] = (counts[a.categoria] ?? 0) + 1;
      return counts;
    })),
    {},
  );
  const [useAnagraficaLinks] = bind(
    selectedAnagrafica$.pipe(switchMap((id) => (id ? data.anagraficaLinks(id) : of([])))),
    [],
  );

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
    useCalendarMonth,
    setCalendarMonth: (ym) => { calendarMonth$.next(ym); selectedDay$.next(null); },
    useSelectedDay,
    selectDay: (iso) => selectedDay$.next(iso),
    useCalendarLayers,
    useCalendarEvents,
    useAllCalendarEvents,
    useAnagSearch, setAnagSearch: (q) => anagSearch$.next(q),
    useAnagKind, setAnagKind: (k) => anagKind$.next(k),
    useAnagStato, setAnagStato: (s) => anagStato$.next(s),
    useAnagCategory, setAnagCategory: (c) => anagCategory$.next(c),
    useSelectedAnagrafica, selectAnagrafica: (id) => selectedAnagrafica$.next(id),
    useAnagrafiche, useAllAnagrafiche,
    useAnagraficaCategories, useAnagraficaCategoryCounts,
    useAnagraficaLinks,
  };
}
