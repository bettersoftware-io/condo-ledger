import type { Tables, Row } from "./loadRows.ts";

const T = (tables: Tables, name: string): Row[] => tables[name] ?? [];
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export interface Db {
  tables: Tables;
  condominiums: Row[];                 // selected, real, populated
  periodsOf(condId: string): Row[];    // selected condominium's periods, by id asc
  rows(name: string): Row[];
  by(name: string, key: string): Map<string, Row>;          // index by a column
  group(name: string, key: string): Map<string, Row[]>;     // group by a column
}

// Junk rows carry "test" in the name.
const JUNK_NAME = /\btest\b/i;

// Code-null rows with a trailing number are unnumbered duplicates (e.g. "Pozzetto 2").
// Real buildings always have a non-null code, so this never fires on genuine buildings.
const JUNK_NUMBERED_DUPE = /\s+\d+$/;

export function buildDb(tables: Tables): Db {
  const indexCache = new Map<string, Map<string, Row>>();
  const groupCache = new Map<string, Map<string, Row[]>>();

  const by = (name: string, key: string): Map<string, Row> => {
    const ck = `${name}.${key}`;
    let m = indexCache.get(ck);
    if (!m) {
      m = new Map();
      for (const r of T(tables, name)) { const k = s(r[key]); if (k !== null) m.set(k, r); }
      indexCache.set(ck, m);
    }
    return m;
  };
  const group = (name: string, key: string): Map<string, Row[]> => {
    const ck = `${name}.${key}`;
    let m = groupCache.get(ck);
    if (!m) {
      m = new Map();
      for (const r of T(tables, name)) { const k = s(r[key]); if (k === null) continue; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
      groupCache.set(ck, m);
    }
    return m;
  };

  const periodsByCond = group("accountingPeriod", "condominiumId");
  const unitsByPeriod = group("unit", "accountingPeriodId");

  const periodsOf = (condId: string): Row[] =>
    (periodsByCond.get(condId) ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id));

  const condById = (id: string): Row | undefined => T(tables, "condominium").find((r) => String(r.id) === id);

  const condHasUnits = (condId: string): boolean => {
    if (String(condById(condId)?.type) === "super") return true; // super-condos have no direct periods/units
    return periodsOf(condId).some((p) => (unitsByPeriod.get(String(p.id)) ?? []).length > 0);
  };

  const condominiums = T(tables, "condominium")
    .filter((c) => !JUNK_NAME.test(String(c.name)))                                // drop "... test" rows
    .filter((c) => !(s(c.code) === null && JUNK_NUMBERED_DUPE.test(String(c.name)))) // drop code-null numbered dupes
    .filter((c) => condHasUnits(String(c.id)))                                    // drop empty buildings
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { tables, condominiums, periodsOf, rows: (n) => T(tables, n), by, group };
}
