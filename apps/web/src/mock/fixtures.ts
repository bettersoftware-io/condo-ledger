import { fromCents } from "@cl/domain";
import type {
  CondominiumNode, CondominiumDetail, UnitRow, DistributionTable,
  DistributionColumn, DistributionRow, LedgerAccountRow, LedgerTxnRow,
  InstallmentColumn, InstallmentRow, Id, F24Row, FunctionalRole, SupplierRow,
  CalendarLayer, CalendarEvent, Anagrafica,
} from "@cl/application";

const c = fromCents;

export const tree: CondominiumNode[] = [
  {
    id: "poz", code: "POZ",
    name: "Pozzetto (34071 Nimis (GO) - Italia)", type: "regular",
    periods: [{ id: "poz-2010", name: "2010 (Ordinario)", type: "ordinary", closed: false, start: "2010-01-01", end: "2010-12-31" }],
  },
  {
    id: "sat", code: "SAT",
    name: "Saturno (Piazza del Duomo, 39, 33100 Udine)", type: "regular",
    periods: [{ id: "sat-2011", name: "2011 (Ordinario)", type: "ordinary", closed: false, start: "2011-01-01", end: "2011-12-31" }],
  },
];

export const detailByPeriod: Record<Id, CondominiumDetail> = {
  "poz-2010": {
    intestazione: "Pozzetto", codice: "POZ", status: "active", tipo: "Condominio",
    indirizzo: "34071 Nimis (GO) - Italia", codiceFiscale: "—",
    dataCostruzione: null, datiCatastali: null, idSistema: "19",
    creatoIl: "2011-03-11T14:55:57", modificatoIl: "2011-03-11T14:55:57",
    suppliers: [
      { id: "s1", nominativo: "Acme Pulizie S.r.l.", categoria: "Impresa di pulizie" },
      { id: "s2", nominativo: "Verdi Giardini", categoria: "Giardiniere" },
    ],
    publicDocs: ["Regolamento condominiale.pdf"], privateDocs: ["Polizza fabbricato.pdf"],
  },
  "sat-2011": {
    intestazione: "Saturno", codice: "SAT", status: "active", tipo: "Condominio",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "—",
    dataCostruzione: null, datiCatastali: null, idSistema: "20",
    creatoIl: "2011-03-11T14:55:57", modificatoIl: "2011-03-11T14:55:57",
    suppliers: [{ id: "s3", nominativo: "Banca Pop. Emilia Romagna", categoria: "Istituto di credito" }],
    publicDocs: ["Regolamento condominiale.pdf", "Verbale assemblea 2011-03.pdf"], privateDocs: ["Contratto pulizie Acme.pdf"],
  },
};

export const unitsByPeriod: Record<Id, UnitRow[]> = {
  "sat-2011": [
    {
      id: "g-sat", kind: "group", label: "Saturno / 2011 (via A. Marangoni, 4, Udine)",
      saldoPrec: c(-625099), preventivo: c(3800000), consuntivo: c(3439865), totDovuto: c(2814766), versato: c(0),
      children: [
        {
          id: "u-a01", kind: "unit", label: "A01 - Alberi Dina (PR)", unitType: "Appartamento",
          floor: "T", inner: "1", sub: "—", restriction: "01/01/2011 - 31/12/2011",
          saldoPrec: c(-86065), preventivo: c(148727), consuntivo: c(151180), totDovuto: c(65115), versato: c(0),
          children: [
            { id: "r-a01-1", kind: "resident", label: "Alberi Dina (PR 100%)",
              saldoPrec: c(-86065), preventivo: c(148727), consuntivo: c(151180), totDovuto: c(65115), versato: c(0) },
          ],
        },
        {
          id: "u-a02", kind: "unit", label: "A02 - Mauri Dina, Picech Giorgio", unitType: "Appartamento",
          floor: "1", inner: "2", sub: "—", restriction: "01/01/2011 - 31/12/2011",
          saldoPrec: c(-43739), preventivo: c(214823), consuntivo: c(193551), totDovuto: c(149814), versato: c(0),
          children: [
            { id: "r-a02-1", kind: "resident", label: "Mauri Dina (PR 100%)",
              saldoPrec: c(-43739), preventivo: c(214823), consuntivo: c(193551), totDovuto: c(149814), versato: c(0) },
            { id: "r-a02-2", kind: "resident", label: "Picech Giorgio (PR)",
              saldoPrec: c(0), preventivo: c(0), consuntivo: c(0), totDovuto: c(0), versato: c(0) },
          ],
        },
      ],
    },
  ],
  "poz-2010": [
    {
      id: "g-poz", kind: "group", label: "Pozzetto / 2010 (Nimis GO)",
      saldoPrec: c(0), preventivo: c(1200000), consuntivo: c(1180000), totDovuto: c(1180000), versato: c(0),
      children: [
        { id: "u-p01", kind: "unit", label: "P01 - Floreani Tiziano", unitType: "Appartamento",
          floor: "T", inner: "1", sub: "—", restriction: "01/01/2010 - 31/12/2010",
          saldoPrec: c(0), preventivo: c(600000), consuntivo: c(590000), totDovuto: c(590000), versato: c(0) },
      ],
    },
  ],
};

export const distributionTablesByPeriod: Record<Id, DistributionTable[]> = {
  "sat-2011": [
    { id: "t-prop", name: "Proprietà", restriction: null, total: 1000,
      items: [
        { unitId: "u-a01", unitLabel: "A01 - Alberi Dina", coefficient: 312.5, competenza: "intero" },
        { unitId: "u-a02", unitLabel: "A02 - Mauri/Picech", coefficient: 687.5, competenza: "intero" },
      ] },
    { id: "t-scale", name: "Scale", restriction: null, total: 1000,
      items: [
        { unitId: "u-a01", unitLabel: "A01 - Alberi Dina", coefficient: 400, competenza: "intero" },
        { unitId: "u-a02", unitLabel: "A02 - Mauri/Picech", coefficient: 600, competenza: "intero" },
      ] },
  ],
  "poz-2010": [
    { id: "t-prop-p", name: "Proprietà", restriction: null, total: 1000,
      items: [{ unitId: "u-p01", unitLabel: "P01 - Floreani Tiziano", coefficient: 1000, competenza: "intero" }] },
  ],
};

export const distributionByPeriod: Record<Id, Record<"estimate" | "current", { columns: DistributionColumn[]; rows: DistributionRow[] }>> = {
  "sat-2011": {
    estimate: {
      columns: [{ accountId: "e-pul", header: "Pulizie", tableId: "t-prop" }, { accountId: "e-asc", header: "Ascensore", tableId: "t-scale" }],
      rows: [
        { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(120000), "e-asc": c(80000) }, total: c(200000),
          children: [
            { id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01 - Alberi Dina", amounts: { "e-pul": c(37500), "e-asc": c(32000) }, total: c(69500) },
            { id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02 - Mauri/Picech", amounts: { "e-pul": c(82500), "e-asc": c(48000) }, total: c(130500) },
          ] },
      ],
    },
    current: {
      columns: [{ accountId: "e-pul", header: "Pulizie", tableId: "t-prop" }, { accountId: "e-asc", header: "Ascensore", tableId: "t-scale" }],
      rows: [
        { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(118000), "e-asc": c(81000) }, total: c(199000),
          children: [
            { id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01 - Alberi Dina", amounts: { "e-pul": c(36875), "e-asc": c(32400) }, total: c(69275) },
            { id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02 - Mauri/Picech", amounts: { "e-pul": c(81125), "e-asc": c(48600) }, total: c(129725) },
          ] },
      ],
    },
  },
  "poz-2010": {
    estimate: { columns: [{ accountId: "e-pul", header: "Pulizie", tableId: "t-prop-p" }],
      rows: [{ id: "d-gp", kind: "group", label: "Totale", amounts: { "e-pul": c(60000) }, total: c(60000),
        children: [{ id: "d-p01", kind: "unit", unitId: "u-p01", label: "P01 - Floreani Tiziano", amounts: { "e-pul": c(60000) }, total: c(60000) }] }] },
    current: { columns: [{ accountId: "e-pul", header: "Pulizie", tableId: "t-prop-p" }],
      rows: [{ id: "d-gp", kind: "group", label: "Totale", amounts: { "e-pul": c(59000) }, total: c(59000),
        children: [{ id: "d-p01", kind: "unit", unitId: "u-p01", label: "P01 - Floreani Tiziano", amounts: { "e-pul": c(59000) }, total: c(59000) }] }] },
  },
};

export const ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]> = {
  "sat-2011": [
    { id: "tot", kind: "grouping", label: "Totale", dare: c(1335340), avere: c(1335340), saldo: c(0), preventivo: null,
      children: [
        { id: "patr", kind: "grouping", label: "Patrimoniali", dare: c(1139340), avere: c(1335340), saldo: c(-196000), preventivo: null,
          children: [
            { id: "att", kind: "grouping", label: "(Attività)", dare: c(1139340), avere: c(325900), saldo: c(813440), preventivo: null,
              children: [
                { id: "liq", kind: "grouping", label: "Liquidità", dare: c(227741), avere: c(175900), saldo: c(51841), preventivo: null,
                  children: [
                    { id: "cassa", kind: "regular", label: "Cassa Contanti", dare: c(13552), avere: c(2350), saldo: c(11202), preventivo: null },
                    { id: "banca", kind: "regular", label: "Banca Pop. Emilia Romagna - C/C 0764.94", dare: c(214189), avere: c(173550), saldo: c(40639), preventivo: null },
                  ] },
                { id: "fondi", kind: "grouping", label: "Fondi", dare: c(0), avere: c(50000), saldo: c(-50000), preventivo: null,
                  children: [
                    { id: "friserva", kind: "regular", label: "Fondo di riserva", dare: c(0), avere: c(50000), saldo: c(-50000), preventivo: null },
                  ] },
                { id: "crediti", kind: "grouping", label: "Crediti v/condòmini", dare: c(911599), avere: c(100000), saldo: c(811599), preventivo: null,
                  children: [
                    { id: "csaldi", kind: "regular", label: "Condòmini c/saldi iniziali", dare: c(625099), avere: c(0), saldo: c(625099), preventivo: null },
                    { id: "crate", kind: "regular", label: "Condòmini c/rate", dare: c(286500), avere: c(100000), saldo: c(186500), preventivo: null },
                  ] },
              ] },
            { id: "pass", kind: "grouping", label: "(Passività)", dare: c(0), avere: c(1009440), saldo: c(-1009440), preventivo: null,
              children: [
                { id: "forn", kind: "regular", label: "Fornitori c/acquisti", dare: c(0), avere: c(120000), saldo: c(-120000), preventivo: null },
                { id: "erar", kind: "regular", label: "Erario c/ritenute", dare: c(0), avere: c(0), saldo: c(0), preventivo: null },
                { id: "patrini", kind: "regular", label: "Patrimonio iniziale", dare: c(0), avere: c(889440), saldo: c(-889440), preventivo: null },
              ] },
          ] },
        { id: "econ", kind: "grouping", label: "Economici", dare: c(196000), avere: c(0), saldo: c(196000), preventivo: null,
          children: [
            { id: "spese", kind: "grouping", label: "Spese", dare: c(196000), avere: c(0), saldo: c(196000), preventivo: null,
              children: [
                { id: "e-pul", kind: "regular", label: "Pulizie", dare: c(120000), avere: c(0), saldo: c(120000), preventivo: c(120000),
                  rd: "R", tabelle: "Proprietà", restriction: "01/01/2011 - 31/12/2011" },
                { id: "e-asc", kind: "regular", label: "Ascensore", dare: c(76000), avere: c(0), saldo: c(76000), preventivo: c(80000),
                  rd: "R", tabelle: "Scale", restriction: "01/01/2011 - 31/12/2011" },
              ] },
          ] },
      ] },
  ],
  "poz-2010": [
    { id: "tot-p", kind: "grouping", label: "Totale", dare: c(659000), avere: c(659000), saldo: c(0), preventivo: null,
      children: [
        { id: "liq-p", kind: "regular", label: "Cassa Contanti", dare: c(600000), avere: c(590000), saldo: c(10000), preventivo: null },
        { id: "e-pul-p", kind: "regular", label: "Pulizie", dare: c(59000), avere: c(0), saldo: c(59000), preventivo: c(60000), rd: "R", tabelle: "Proprietà" },
        { id: "patr-p", kind: "regular", label: "Patrimonio iniziale", dare: c(0), avere: c(69000), saldo: c(-69000), preventivo: null },
      ] },
  ],
};

export const ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]> = {
  "sat-2011": [
    { id: "tx1", date: "2011-01-01", code: 1, description: "Apertura saldi iniziali", partita: "Apertura",
      dare: c(625099), avere: c(625099),
      entries: [
        { accountId: "csaldi", account: "Condòmini c/saldi iniziali", dare: c(625099), avere: c(0) },
        { accountId: "patrini", account: "Patrimonio iniziale", dare: c(0), avere: c(625099) },
      ] },
    { id: "tx2", date: "2011-03-15", code: 2, description: "Registrazione fattura Pulizie Acme", partita: "Acme Pulizie",
      dare: c(120000), avere: c(120000),
      entries: [
        { accountId: "e-pul", account: "Pulizie", dare: c(120000), avere: c(0) },
        { accountId: "forn", account: "Fornitori c/acquisti", dare: c(0), avere: c(120000) },
      ] },
    { id: "tx3", date: "2011-04-02", code: 3, description: "Incasso rata A02 Mauri", partita: "A02 Mauri",
      dare: c(100000), avere: c(100000),
      entries: [
        { accountId: "banca", account: "Banca Pop. Emilia Romagna", dare: c(100000), avere: c(0) },
        { accountId: "crate", account: "Condòmini c/rate", dare: c(0), avere: c(100000) },
      ] },
  ],
  "poz-2010": [
    { id: "txp1", date: "2010-02-01", code: 1, description: "Apertura", partita: "Apertura",
      dare: c(600000), avere: c(600000),
      entries: [
        { accountId: "liq-p", account: "Cassa", dare: c(600000), avere: c(0) },
        { accountId: "patr-p", account: "Patrimonio", dare: c(0), avere: c(600000) },
      ] },
  ],
};

export const installmentsByPeriod: Record<Id, { columns: InstallmentColumn[]; rows: InstallmentRow[] }> = {
  "sat-2011": {
    columns: [
      { id: "r1", header: "Rata 1", expiry: "2011-02-28" },
      { id: "r2", header: "Rata 2", expiry: "2011-04-30" },
      { id: "r3", header: "Rata 3", expiry: "2011-08-31" },
    ],
    rows: [
      { id: "i-g", kind: "group", label: "Saturno / 2011", saldoPrec: c(-625099), totPreventivo: c(3800000), totDovuto: c(2814766),
        byInstallment: { r1: c(1266667), r2: c(1266667), r3: c(1266666) },
        children: [
          { id: "i-a01", kind: "unit", unitId: "u-a01", label: "A01 - Alberi Dina", role: "Proprietario", restriction: "01/01/2011 - 31/12/2011",
            saldoPrec: c(-86065), totPreventivo: c(148727), totDovuto: c(65115),
            byInstallment: { r1: c(49576), r2: c(49576), r3: c(49575) } },
          { id: "i-a02", kind: "unit", unitId: "u-a02", label: "A02 - Mauri/Picech", role: "Proprietario", restriction: "01/01/2011 - 31/12/2011",
            saldoPrec: c(-43739), totPreventivo: c(214823), totDovuto: c(149814),
            byInstallment: { r1: c(71608), r2: c(71608), r3: c(71607) } },
        ] },
    ],
  },
  "poz-2010": {
    columns: [
      { id: "r1", header: "Rata 1", expiry: "2010-03-31" },
      { id: "r2", header: "Rata 2", expiry: "2010-09-30" },
    ],
    rows: [
      { id: "i-gp", kind: "group", label: "Pozzetto / 2010", saldoPrec: c(0), totPreventivo: c(1200000), totDovuto: c(1180000),
        byInstallment: { r1: c(600000), r2: c(600000) },
        children: [
          { id: "i-p01", kind: "unit", unitId: "u-p01", label: "P01 - Floreani Tiziano", role: "Proprietario",
            saldoPrec: c(0), totPreventivo: c(600000), totDovuto: c(590000),
            byInstallment: { r1: c(300000), r2: c(300000) } },
        ] },
    ],
  },
};

export const f24sByPeriod: Record<Id, F24Row[]> = {
  "sat-2011": [
    { id: "f24-1", descrizione: "Ritenute d'acconto 1° trim.", scadenza: "2011-04-16", importo: c(10000), stato: "da pagare" },
    { id: "f24-2", descrizione: "Ritenute d'acconto 2010 conguaglio", scadenza: "2011-01-16", importo: c(7500), stato: "pagato" },
  ],
  "poz-2010": [
    { id: "f24-p1", descrizione: "Ritenute d'acconto", scadenza: "2010-07-16", importo: c(4200), stato: "pagato" },
  ],
};

export const functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>> = {
  "sat-2011": { liquid: "banca", payable: "forn", withholding: "erar", credit: "crate" },
  // poz-2010 has no dedicated payable/withholding/credit accounts; patr-p is a placeholder
  "poz-2010": { liquid: "liq-p", payable: "patr-p", withholding: "patr-p", credit: "patr-p" },
};

/** Pool the "add supplier" dialog picks from (replaced by real anagrafiche in Plan 4). */
export const supplierCandidates: SupplierRow[] = [
  { id: "cand-1", nominativo: "Idraulica Blu S.n.c.", categoria: "Idraulico" },
  { id: "cand-2", nominativo: "Elettrosistemi Friuli", categoria: "Elettricista" },
  { id: "cand-3", nominativo: "Studio Rag. Bianchi", categoria: "Commercialista" },
];

/** ---- Calendario (Plan 3) ---- */
export const calendarLayers: CalendarLayer[] = [
  { id: "lay-scad", name: "Scadenze", color: "#c0392b" },
  { id: "lay-assem", name: "Assemblee", color: "#2e6da4" },
  { id: "lay-manut", name: "Manutenzioni", color: "#3d8b40" },
  { id: "lay-studio", name: "Studio", color: "#7f8c8d" },
];

/** Studio-wide agenda. Dates mirror f24sByPeriod scadenze and installment expiries
 * (guarded by fixtures.test.ts) so Calendario, Dati and Rate tell one story.
 * Several descriptions echo the legacy dump (old/db/calendarEvent.sql). */
export const calendarEvents: CalendarEvent[] = [
  // — Saturno 2011 —
  { id: "ev-f24-sat-1", date: "2011-01-16", description: "F24 Ritenute d'acconto 2010 conguaglio",
    layerId: "lay-scad", status: "closed", priority: "high", periodId: "sat-2011" },
  { id: "ev-f24-sat-2", date: "2011-04-16", description: "F24 Ritenute d'acconto 1° trim.",
    layerId: "lay-scad", status: "new", priority: "critical", periodId: "sat-2011" },
  { id: "ev-rata1-sat", date: "2011-02-28", description: "Scadenza Rata 1 — Condominio Saturno",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "sat-2011" },
  { id: "ev-rata2-sat", date: "2011-04-30", description: "Scadenza Rata 2 — Condominio Saturno",
    layerId: "lay-scad", status: "new", priority: "medium", periodId: "sat-2011" },
  { id: "ev-rata3-sat", date: "2011-08-31", description: "Scadenza Rata 3 — Condominio Saturno",
    layerId: "lay-scad", status: "new", priority: "medium", periodId: "sat-2011" },
  { id: "ev-assem-sat", date: "2011-04-21", time: "18:00", description: "Assemblea ordinaria — Condominio Saturno",
    layerId: "lay-assem", status: "new", priority: "critical", periodId: "sat-2011",
    notes: "Ordine del giorno: approvazione bilancio preventivo 2011, nomina revisore." },
  { id: "ev-cald-sat", date: "2011-04-05", time: "09:30", description: "Revisione caldaia — Condominio Saturno",
    layerId: "lay-manut", status: "new", priority: "medium", periodId: "sat-2011" },
  // — Pozzetto 2010 —
  { id: "ev-f24-poz", date: "2010-07-16", description: "F24 Ritenute d'acconto",
    layerId: "lay-scad", status: "closed", priority: "high", periodId: "poz-2010" },
  { id: "ev-rata1-poz", date: "2010-03-31", description: "Scadenza Rata 1 — Condominio Pozzetto",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "poz-2010" },
  { id: "ev-rata2-poz", date: "2010-09-30", description: "Scadenza Rata 2 — Condominio Pozzetto",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "poz-2010" },
  { id: "ev-assem-poz", date: "2010-09-24", time: "18:30", description: "Assemblea del condominio Pozzetto",
    layerId: "lay-assem", status: "closed", priority: "critical", periodId: "poz-2010" },
  // — Studio-wide (nessuna competenza) —
  { id: "ev-polizza", date: "2011-04-12", description: "Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A.",
    layerId: "lay-studio", status: "new", priority: "critical" },
  { id: "ev-ferie", date: "2011-08-13", description: "Chiusura studio per ferie",
    layerId: "lay-studio", status: "new", priority: "low",
    notes: "Lo studio resterà chiuso dal 13/8 al 26/8. Per urgenze: 347-2115474." },
];

/** ---- Anagrafiche (Plan 4) ---- */
/** Legacy masterDataCategory registry (dump-accurate names, alphabetical).
 * Static like calendarLayers; several stay at 0 entries on purpose — the
 * legacy sidebar shows the whole registry with counts. */
export const anagraficaCategories: string[] = [
  "Amministrazione condominiale", "Antincendio", "Assicurazione", "Avvocato",
  "Commercialista", "Condòmino", "Elettricista", "Fabbro", "Fornitura acqua",
  "Fornitura energia elettrica", "Fornitura gas", "Geometra", "Giardiniere",
  "Idraulico", "Impresa di pulizie", "Istituto di credito", "Manutenzione ascensori",
];

/** Studio-wide registry. Companies/codes/P.IVA/addresses transcribed from the dump
 * (company + masterData tables); persons tied to fixture units keep the prototype
 * names so Unità, Rate and Giornale keep telling one story (guarded by fixtures.test). */
export const anagrafiche: Anagrafica[] = [
  // — persone fisiche —
  { id: "ana-alberi", kind: "person", nominativo: "Alberi Dina", categoria: "Condòmino",
    stato: "active", nome: "Dina", cognome: "Alberi", sesso: "f",
    dataNascita: "1955-04-05", luogoNascita: "Udine",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "LBRRTT55D45L483F" },
  { id: "ana-mauri", kind: "person", nominativo: "Mauri Dina", categoria: "Condòmino",
    stato: "active", nome: "Dina", cognome: "Mauri", sesso: "f",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "MRALDN62M50L483Q" },
  { id: "ana-picech", kind: "person", nominativo: "Picech Giorgio", categoria: "Condòmino",
    stato: "active", nome: "Giorgio", cognome: "Picech", sesso: "m",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "PCHGRG58T10L483Z" },
  { id: "ana-rossi", kind: "person", nominativo: "Floreani Tiziano", categoria: "Condòmino",
    stato: "active", nome: "Tiziano", cognome: "Rossi", sesso: "m", codice: "MROSSI",
    indirizzo: "34071 Nimis (GO)" },
  { id: "ana-savino", kind: "person", nominativo: "Adami Valerio", categoria: "Amministrazione condominiale",
    stato: "active", nome: "Vito", cognome: "Adami", sesso: "m", codice: "ADAMI",
    professione: "Amministratore di condominio", indirizzo: "via Gorghi, 123, 33044 Tarcento",
    note: "Titolare dello Studio Bertoli Amministrazioni." },
  { id: "ana-sfiligoi", kind: "person", nominativo: "Mattiussi Vittorio", categoria: "Amministrazione condominiale",
    stato: "active", nome: "Vittorio", cognome: "Mattiussi", sesso: "m",
    indirizzo: "via Pordenone, 143, 33100 Udine" },
  // — società (fornitori correnti dei condomìni fixture) —
  { id: "ana-acme", kind: "company", nominativo: "Acme Pulizie S.r.l.", categoria: "Impresa di pulizie",
    stato: "active", partitaIva: "02471550301", indirizzo: "via dei Platani, 12, 33100 Udine",
    note: "Contratto pulizie scale in essere per il condominio Saturno." },
  { id: "ana-verdi", kind: "company", nominativo: "Verdi Giardini", categoria: "Giardiniere",
    stato: "active", partitaIva: "01988770304", indirizzo: "via Pradamano, 7, 33100 Udine" },
  { id: "ana-bper", kind: "company", nominativo: "Banca Pop. Emilia Romagna", categoria: "Istituto di credito",
    stato: "active", codice: "BPEMRM", partitaIva: "72415790327",
    indirizzo: "via S. Carlo, 20, 41121 Modena",
    banca: "BPER — Filiale di Udine", iban: "IT60X0542811101000000123456" },
  // — società (candidati fornitore, già nel prototipo) —
  { id: "ana-idraulica", kind: "company", nominativo: "Idraulica Blu S.n.c.", categoria: "Idraulico",
    stato: "active", partitaIva: "01775430309", indirizzo: "via Cividale, 44, 33100 Udine" },
  { id: "ana-elettro", kind: "company", nominativo: "Elettrosistemi Friuli", categoria: "Elettricista",
    stato: "active", partitaIva: "02214550306", indirizzo: "via Buttrio, 9, 33100 Udine" },
  { id: "ana-bianchi", kind: "company", nominativo: "Studio Rag. Bianchi", categoria: "Commercialista",
    stato: "active", partitaIva: "01551230307", indirizzo: "piazza Libertà, 3, 33100 Udine" },
  // — società dal dump legacy —
  { id: "ana-friulclean", kind: "company", nominativo: "Zanon Servizi di Pulizia s.n.c.", categoria: "Impresa di pulizie",
    stato: "active", codice: "FCLEAN", partitaIva: "14476590311",
    indirizzo: "Via Mazzini, 48, 33100 Udine" },
  { id: "ana-modesto", kind: "company", nominativo: "Ascensori Castellarin s.a.s.", categoria: "Manutenzione ascensori",
    stato: "active", codice: "MODEST", partitaIva: "91757180301",
    indirizzo: "via dei Gelsi, 101, 33017 Tarcento" },
  { id: "ana-ascoop", kind: "company", nominativo: "Cargnelutti Elevatori s.n.c.", categoria: "Manutenzione ascensori",
    stato: "active", codice: "ASCOOP", partitaIva: "58080030321",
    indirizzo: "via Nievo, 72, 34015 Muggia (TS)" },
  { id: "ana-enel", kind: "company", nominativo: "Energie del Ledra S.p.A.", categoria: "Fornitura energia elettrica",
    stato: "active", codice: "ENERGIE DEL LEDRA" },
  { id: "ana-poiana", kind: "company", nominativo: "Acque Arzino s.n.c.", categoria: "Fornitura acqua",
    stato: "active", codice: "POIANA", indirizzo: "piazza XX Settembre, 84, 33043 Cividale del Friuli" },
  { id: "ana-iris", kind: "company", nominativo: "Acque Fella s.r.l.", categoria: "Fornitura acqua",
    stato: "active", codice: "IRIS", partitaIva: "74864820316", indirizzo: "Via della Roggia, 107, 34170 Gorizia" },
  { id: "ana-isogas", kind: "company", nominativo: "Natisone Gas S.p.A.", categoria: "Fornitura gas",
    stato: "active", codice: "Natisone Gas", partitaIva: "57281340307", indirizzo: "Via della Roggia, 107, 34170 Gorizia" },
  { id: "ana-lloyd", kind: "company", nominativo: "Mutua Assicuratrice del Livenza", categoria: "Assicurazione",
    stato: "active", codice: "LYDADR", partitaIva: "11075030327", indirizzo: "via San Rocco, 134, 34123 Trieste" },
  { id: "ana-reale", kind: "company", nominativo: "Minisini Assicurazioni s.r.l.", categoria: "Assicurazione",
    stato: "active", codice: "RLMTAS", partitaIva: "16318210933", indirizzo: "Via San Rocco, 62, 33010 Tavagnacco" },
  { id: "ana-carifvg", kind: "company", nominativo: "Cassa di Risparmio del Natisone S.p.A.", categoria: "Istituto di credito",
    stato: "active", codice: "CARIFVG", codiceFiscale: "57337330310", partitaIva: "14036590314",
    indirizzo: "Via delle Acacie, 128, 34170 Gorizia" },
  { id: "ana-amga", kind: "company", nominativo: "Fella Gas S.p.A.", categoria: "Fornitura gas",
    stato: "archived", codice: "AMGAUD" }, // archived in the dump too
];
