import type {
  CondominiumNode,
  AccountingPeriodNode,
  AccountingPeriodType,
  CondominiumDetail,
  SupplierRow,
  F24Row,
  FunctionalRole,
  Id,
} from "@cl/application";
import type { Db } from "../db.ts";
import { parseAddressVO, formatAddress } from "../addressVO.ts";

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
};

/**
 * Map legacy DB accountingPeriod.type → TS AccountingPeriodType.
 * Real dump values: 'regular', 'extra', 'auxiliary'.
 * 'ordinary' and 'extraordinary' do not appear in real exports; those
 * branches are defensive dead-code kept for safety.
 */
function mapPeriodType(raw: string): AccountingPeriodType {
  switch (raw) {
    case "ordinary":
    case "regular":
      return "ordinary";
    case "extra":
    case "extraordinary":
      return "extra";
    case "auxiliary":
      return "auxiliary";
    default:
      return "ordinary";
  }
}

function periodLabel(name: string, rawType: string): string {
  const type = mapPeriodType(rawType);
  if (type === "extra") return `${name} (Straordinario)`;
  if (type === "auxiliary") return `${name} (Ausiliario)`;
  return `${name} (Ordinario)`;
}

function condType(raw: unknown): CondominiumNode["type"] {
  const t = String(raw);
  return t === "super" || t === "residence" ? t : "regular";
}

export function projectTree(db: Db): CondominiumNode[] {
  return db.condominiums.map((c) => ({
    id: `c${c.id}`,
    code: String(c.code),
    name: String(c.name),
    type: condType(c.type),
    periods: db.periodsOf(String(c.id)).map((p): AccountingPeriodNode => ({
      id: `p${p.id}`,
      name: periodLabel(String(p.name), String(p.type)),
      type: mapPeriodType(String(p.type)),
      closed: String(p.status) === "closed",
      start: String(p.startDate),
      end: String(p.endDate),
    })),
  }));
}

function categoryName(db: Db, categoryId: string | null): string | undefined {
  if (!categoryId) return undefined;
  const base = db.by("masterDataCategory", "id").get(categoryId);
  if (!base) return undefined;
  const i18n = (db.group("masterDataCategoryI18n", "masterDataCategoryId").get(categoryId) ?? []).find(
    (r) => String(r.localeCode).startsWith("it"),
  );
  return str(i18n?.translation) ?? str(base.name);
}

function nominativoOf(db: Db, mdId: string): string {
  const company = db.by("company", "masterDataId").get(mdId);
  if (company) return String(company.name);
  const person = db.by("person", "masterDataId").get(mdId);
  if (person) return [str(person.lastName), str(person.firstName)].filter(Boolean).join(" ");
  return `Anagrafica ${mdId}`;
}

export function projectDetails(db: Db): Record<Id, CondominiumDetail> {
  const suppliersByCond = db.group("condominiumSupplier", "condominiumId");
  const mdById = db.by("masterData", "id");
  const out: Record<Id, CondominiumDetail> = {};

  for (const c of db.condominiums) {
    const condId = String(c.id);
    const suppliers: SupplierRow[] = (suppliersByCond.get(condId) ?? [])
      .slice()
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((sup) => {
        const mdId = String(sup.masterDataId);
        const md = mdById.get(mdId);
        return {
          id: `sup${condId}-${mdId}`,
          nominativo: nominativoOf(db, mdId),
          categoria: categoryName(db, md ? (str(md.masterDataCategoryId) ?? null) : null) ?? "—",
        };
      });

    const indirizzo = str(formatAddress(parseAddressVO(str(c.address) ?? null))) ?? "—";

    for (const p of db.periodsOf(condId)) {
      const detail: CondominiumDetail = {
        intestazione: String(c.name),
        codice: String(c.code),
        status: String(c.status) === "active" ? "active" : "inactive",
        tipo: "Condominio",
        indirizzo,
        codiceFiscale: str(c.taxCode) ?? "—",
        dataCostruzione: str(c.manufacturedDate) ?? null,
        datiCatastali: str(c.landRegistry) ?? null,
        idSistema: condId,
        creatoIl: str(c.created) ?? "",
        modificatoIl: str(c.lastModified) ?? "",
        suppliers,
        publicDocs: [],
        privateDocs: [],
      };
      out[`p${p.id}`] = detail;
    }
  }

  return out;
}

const ROLE_COL: Record<FunctionalRole, string> = {
  liquid: "defaultCheckingAccountLedgerAccountId",
  payable: "supplierAccountsPayableLedgerAccountId",
  withholding: "withholdingTaxPenaltyLedgerAccountId",
  credit: "flatResidentAccountsReceivableLedgerAccountId",
};

export function projectFunctional(db: Db): Record<Id, Partial<Record<FunctionalRole, Id>>> {
  const out: Record<Id, Partial<Record<FunctionalRole, Id>>> = {};
  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const m: Partial<Record<FunctionalRole, Id>> = {};
      for (const role of Object.keys(ROLE_COL) as FunctionalRole[]) {
        const v = str(p[ROLE_COL[role]!]);
        if (v) m[role] = `la${v}`;
      }
      out[`p${p.id}`] = m;
    }
  }
  return out;
}

export function projectF24(db: Db): Record<Id, F24Row[]> {
  const byCond = db.group("f24", "condominiumId");
  const out: Record<Id, F24Row[]> = {};

  for (const c of db.condominiums) {
    const condId = String(c.id);
    const rows = byCond.get(condId) ?? [];
    const mapped: F24Row[] = rows.map((f) => ({
      id: `f24-${f.id}`,
      descrizione: "Modello F24",
      scadenza: str(f.paymentDate) ?? str(f.referenceDate) ?? "",
      importo: { cents: 0 }, // amount from withholdingTax/ledgerInvoice2F24; no clean per-row source → 0
      stato: f.confirmed === true ? "pagato" : "da pagare",
    }));
    // F24 is condominium-scoped in legacy; attach to every period of the condominium.
    for (const p of db.periodsOf(condId)) out[`p${p.id}`] = mapped;
  }

  return out;
}
