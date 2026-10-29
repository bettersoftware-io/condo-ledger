import type {
  AccountingPeriodNode,
  AccountingPeriodType,
  CondominiumNode,
} from "#/seedTypes.ts";

import type { Db } from "../db.ts";

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

  if (type === "extra") {
    return `${name} (Straordinario)`;
  }

  if (type === "auxiliary") {
    return `${name} (Ausiliario)`;
  }

  return `${name} (Ordinario)`;
}

function condType(raw: unknown): CondominiumNode["type"] {
  const t = String(raw);
  return t === "super" || t === "residence" ? t : "regular";
}

export function projectTree(db: Db): CondominiumNode[] {
  return db.condominiums.map((c) => {
    return {
      id: `c${c.id}`,
      code: str(c.code) ?? "",
      name: String(c.name),
      type: condType(c.type),
      periods: db.periodsOf(String(c.id)).map((p): AccountingPeriodNode => {
        return {
          id: `p${p.id}`,
          name: periodLabel(String(p.name), String(p.type)),
          type: mapPeriodType(String(p.type)),
          closed: String(p.status) === "closed",
          start: str(p.startDate) ?? "",
          end: str(p.endDate) ?? "",
        };
      }),
    };
  });
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) {
    return undefined;
  }

  const t = String(v).trim();
  return t === "" ? undefined : t;
}
