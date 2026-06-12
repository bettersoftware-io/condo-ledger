import { fromCents } from "@cl/domain";
import type {
  CondominiumNode, CondominiumDetail, UnitRow, DistributionTable,
  DistributionColumn, DistributionRow, LedgerAccountRow, LedgerTxnRow,
  InstallmentColumn, InstallmentRow, Id, F24Row, FunctionalRole, SupplierRow,
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
      { id: "s1", nominativo: "Acme Pulizie S.r.l.", categoria: "Pulizie" },
      { id: "s2", nominativo: "Verdi Giardini", categoria: "Giardinaggio" },
    ],
    publicDocs: ["Regolamento condominiale.pdf"], privateDocs: ["Polizza fabbricato.pdf"],
  },
  "sat-2011": {
    intestazione: "Saturno", codice: "SAT", status: "active", tipo: "Condominio",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "—",
    dataCostruzione: null, datiCatastali: null, idSistema: "20",
    creatoIl: "2011-03-11T14:55:57", modificatoIl: "2011-03-11T14:55:57",
    suppliers: [{ id: "s3", nominativo: "Banca Pop. Emilia Romagna", categoria: "Banca" }],
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
    columns: [{ id: "r1", header: "Rata 1" }, { id: "r2", header: "Rata 2" }, { id: "r3", header: "Rata 3" }],
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
    columns: [{ id: "r1", header: "Rata 1" }, { id: "r2", header: "Rata 2" }],
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
