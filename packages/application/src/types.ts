import type { Money } from "@cl/domain";

export type Id = string;
export type Module = "calendario" | "condomini" | "anagrafiche";
export type CondominiSection =
  | "dati" | "unita" | "tabelle" | "conti" | "giornale" | "rate";

export type AccountingPeriodType = "ordinary" | "extra" | "auxiliary";

export interface AccountingPeriodNode {
  id: Id;
  name: string;            // "2010 (Ordinario)"
  type: AccountingPeriodType;
  closed: boolean;
  start: string;           // ISO date
  end: string;             // ISO date
}
export interface CondominiumNode {
  id: Id;
  code: string;            // "SAT"
  name: string;            // "Saturno (Piazza del Duomo, 39, 33100 Udine)"
  type: "regular" | "super" | "residence";
  periods: AccountingPeriodNode[];
}

export interface Selection { condominiumId?: Id; accountingPeriodId?: Id; }

export interface CondominiumDetail {
  intestazione: string;
  codice: string;
  status: "active" | "inactive";
  tipo: string;
  indirizzo: string;
  codiceFiscale: string;
  dataCostruzione: string | null;
  datiCatastali: string | null;
  idSistema: string;
  creatoIl: string;
  modificatoIl: string;
  suppliers: SupplierRow[];
  publicDocs: string[];
  privateDocs: string[];
}
export interface SupplierRow { id: Id; nominativo: string; categoria: string; }

export type UnitRowKind = "group" | "unit" | "resident";
export interface UnitRow {
  id: Id;
  kind: UnitRowKind;
  label: string;           // group/unit/resident display
  unitType?: string;       // "Appartamento"
  floor?: string;
  inner?: string;
  sub?: string;
  restriction?: string;    // competenza date range
  saldoPrec: Money;
  preventivo: Money;
  consuntivo: Money;
  totDovuto: Money;
  versato: Money;
  children?: UnitRow[];
}

export interface DistributionTable {
  id: Id; name: string; restriction: string | null; total: number;
  items: DistributionTableItem[];
}
export interface DistributionTableItem { unitId: Id; unitLabel: string; coefficient: number; competenza: string; }

export type DistributionType = "estimate" | "current";
export interface DistributionRow {
  id: Id; kind: "group" | "unit"; label: string;
  unitId?: Id;             // set on kind === "unit"; links riparto rows to coefficient items
  amounts: Record<Id /*expenseAccountId*/, Money>;
  total: Money; children?: DistributionRow[];
}
export interface DistributionColumn { accountId: Id; header: string; tableId?: Id /* owning riparto table; columns from other tables are untouched by coefficient edits */; }

export type LedgerAccountKind = "grouping" | "regular" | "subsidiary" | "control";
export interface LedgerAccountRow {
  id: Id; kind: LedgerAccountKind; label: string;
  dare: Money; avere: Money; saldo: Money; preventivo: Money | null;
  rd?: "R" | "d";          // Ripartito / diretto
  tabelle?: string;        // riparto table names, comma-joined
  restriction?: string;    // restr. competenza display range
  children?: LedgerAccountRow[];
}

export interface LedgerTxnEntry { accountId?: Id; account: string; dare: Money; avere: Money; }
export interface LedgerTxnRow {
  id: Id; date: string; code: number; description: string;
  partita?: string;        // legacy "Partita" matching reference
  dare: Money; avere: Money;
  entries: LedgerTxnEntry[];
}

export interface InstallmentColumn { id: Id; header: string; expiry?: string; locked?: boolean; }
export interface InstallmentRow {
  id: Id; kind: "group" | "unit" | "resident"; label: string; unitId?: Id; role?: string;
  restriction?: string; saldoPrec: Money; totPreventivo: Money; totDovuto: Money;
  byInstallment: Record<Id, Money>; overridden?: Record<Id, boolean>; children?: InstallmentRow[];
}

/** ---- Command inputs (Plan 1 foundations) ---- */
export interface LedgerEntryInput { accountId: Id; label: string; dareCents: number; avereCents: number; }
export interface TransactionInput { date: string; description: string; entries: LedgerEntryInput[]; partita?: string; }
export interface InvoiceInput {
  date: string; supplierName: string; invoiceNumber: string;
  grossCents: number; withholdingCents: number;
  expenseAccountId: Id; expenseAccountLabel: string;
  payableAccountId: Id; payableAccountLabel: string;
  withholdingAccountId: Id; withholdingAccountLabel: string;
}
export interface TakingInput {
  date: string; residentId: Id; residentLabel: string;
  liquidAccountId: Id; liquidAccountLabel: string;
  creditAccountId: Id; creditAccountLabel: string;
  settlements: { installmentId: Id; amountCents: number }[];
}
export interface CreateInstallmentsInput {
  count: number; firstExpiry: string /* ISO date */; cadenceMonths: number;
  totalCents: number; tableId: Id;
}

export interface F24Row { id: Id; descrizione: string; scadenza: string /* ISO date */; importo: Money; stato: "da pagare" | "pagato"; }
export type FunctionalRole = "liquid" | "payable" | "withholding" | "credit";
export interface PeriodSummary {
  liquidita: Money; fondi: Money; preventivo: Money;
  consuntivo: Money; saldoPrec: Money; totDovuto: Money;
}
export interface WithholdingPaymentInput {
  date: string; amountCents: number;
  withholdingAccountId: Id; withholdingAccountLabel: string;
  liquidAccountId: Id; liquidAccountLabel: string;
}

/** ---- Calendario (Plan 3) ---- */
export type CalendarPriority = "idle" | "low" | "medium" | "high" | "critical"; // legacy enum
export type CalendarStatus = "new" | "closed" | "cancelled";                    // values seen in the dump
export interface CalendarLayer { id: Id; name: string; color: string /* CSS color for chips */; }
export interface CalendarEvent {
  id: Id;
  date: string;            // ISO yyyy-mm-dd
  time?: string;           // "HH:mm"; omitted = all-day (legacy ignoreTime)
  description: string;
  layerId: Id;
  status: CalendarStatus;
  priority: CalendarPriority;
  notes?: string;
  periodId?: Id;           // competenza link to an accounting period (drives the Competenza filter)
}

/** ---- Anagrafiche (Plan 4) ---- */
export type AnagraficaKind = "person" | "company";    // legacy person / company tables
export type AnagraficaStatus = "active" | "archived"; // legacy masterData.status enum
export interface Anagrafica {
  id: Id;
  kind: AnagraficaKind;
  /** display name: "Cognome Nome" for persons, ragione sociale for companies */
  nominativo: string;
  categoria: string;        // masterDataCategory name; registry in anagraficaCategories()
  stato: AnagraficaStatus;
  codice?: string;          // legacy masterData.code, e.g. "FCLEAN"
  indirizzo?: string;       // single-line reference address ("Indirizzo di riferimento")
  codiceFiscale?: string;
  partitaIva?: string;
  /* person-only fields (legacy person table) */
  nome?: string;
  cognome?: string;
  sesso?: "m" | "f";       // lowercase, as in the legacy person table
  dataNascita?: string;     // ISO yyyy-mm-dd
  luogoNascita?: string;
  professione?: string;
  /* bank coordinates (legacy bankAccount link), shown for companies */
  banca?: string;           // legacy "Banca / Filiale"
  iban?: string;
  note?: string;
}
/** Cross-reference row for the "Anagrafiche Condomini" tab (read-only, derived).
 * Deliberately keyless: a pure value object recomputed by the store; lists render by index. */
export interface AnagraficaLink {
  condominio: string;       // condominium display name (no address suffix)
  esercizio: string;        // accounting-period name, e.g. "2011 (Ordinario)"
  ruolo: "Fornitore" | "Condòmino";
  dettaglio: string;        // supplier categoria, or the matched unit-tree row label
}
export type AnagraficaKindFilter = "tutte" | "person" | "company";
export type AnagraficaStatusFilter = "tutte" | AnagraficaStatus;
