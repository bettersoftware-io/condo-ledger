import type { Money } from "@cl/domain";

type Id = string;

export type AccountingPeriodType = "ordinary" | "extra" | "auxiliary";

export interface AccountingPeriodNode {
  id: Id;
  name: string; // "2010 (Ordinario)"
  type: AccountingPeriodType;
  closed: boolean;
  start: string; // ISO date
  end: string; // ISO date
}
export interface CondominiumNode {
  id: Id;
  code: string; // "SAT"
  name: string; // "Saturno (via dei Glicini, 4, 33017 Tarcento)"
  type: "regular" | "super" | "residence";
  periods: AccountingPeriodNode[];
}

type LedgerAccountKind = "grouping" | "regular" | "subsidiary" | "control";
export interface LedgerAccountRow {
  id: Id;
  kind: LedgerAccountKind;
  label: string;
  dare: Money;
  avere: Money;
  saldo: Money;
  preventivo: Money | null;
  rd?: "R" | "d"; // Ripartito / diretto
  tabelle?: string; // riparto table names, comma-joined
  restriction?: string; // restr. competenza display range
  children?: LedgerAccountRow[];
}

export interface LedgerTxnEntry {
  accountId?: Id;
  account: string;
  dare: Money;
  avere: Money;
}
export interface LedgerTxnRow {
  id: Id;
  date: string;
  code: number;
  description: string;
  partita?: string; // legacy "Partita" matching reference
  dare: Money;
  avere: Money;
  entries: LedgerTxnEntry[];
}

export interface InstallmentColumn {
  id: Id;
  header: string;
  expiry?: string;
  locked?: boolean;
}
export interface InstallmentRow {
  id: Id;
  kind: "group" | "unit" | "resident";
  label: string;
  unitId?: Id;
  role?: string;
  restriction?: string;
  saldoPrec: Money;
  totPreventivo: Money;
  totDovuto: Money;
  byInstallment: Record<Id, Money>;
  overridden?: Record<Id, boolean>;
  children?: InstallmentRow[];
}

/** ---- Anagrafiche (Plan 4) ---- */
type AnagraficaKind = "person" | "company"; // legacy person / company tables
type AnagraficaStatus = "active" | "archived"; // legacy masterData.status enum
export interface Anagrafica {
  id: Id;
  kind: AnagraficaKind;
  /** display name: "Cognome Nome" for persons, ragione sociale for companies */
  nominativo: string;
  categoria: string; // masterDataCategory name; registry in anagraficaCategories()
  stato: AnagraficaStatus;
  codice?: string; // legacy masterData.code, e.g. "LUCENT"
  indirizzo?: string; // single-line reference address ("Indirizzo di riferimento")
  codiceFiscale?: string;
  partitaIva?: string;
  /* person-only fields (legacy person table) */
  nome?: string;
  cognome?: string;
  sesso?: "m" | "f"; // lowercase, as in the legacy person table
  dataNascita?: string; // ISO yyyy-mm-dd
  luogoNascita?: string;
  professione?: string;
  /* bank coordinates (legacy bankAccount link), shown for companies */
  banca?: string; // legacy "Banca / Filiale"
  iban?: string;
  note?: string;
}
