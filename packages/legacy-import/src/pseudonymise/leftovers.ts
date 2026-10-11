import type { NameEntry } from "./freeText.ts";

// Real firms typed by hand into free text (journal and account names,
// calendar notes) that have no master-data entry of their own, so neither the
// person nor the company rule reaches them. Each maps to a fixed fake; the
// banks map to names of the fake bank pool (names.ts BANK_NAMES).
export const EXTRA_ENTRIES: readonly NameEntry[] = [
  {
    original: "Assicurazioni del Varmo S.p.A.",
    pseudonym: "Assicurazioni del Varmo S.p.A.",
    anyCase: true,
  },
  {
    original: "Brillante Pulizie s.r.l.",
    pseudonym: "Brillante Pulizie s.r.l.",
    anyCase: true,
  },
  { original: "Brillante Pulizie", pseudonym: "Brillante Pulizie", anyCase: true },
  { original: "Credito Carnico", pseudonym: "Credito Carnico", anyCase: true },
  { original: "Credito Carnico", pseudonym: "Credito Carnico", anyCase: true },
  {
    original: "Cassa Rurale del Torre",
    pseudonym: "Cassa Rurale del Torre",
    anyCase: true,
  },
  {
    original: "Cassa di Risparmio del Natisone",
    pseudonym: "Cassa di Risparmio del Natisone",
    anyCase: true,
  },
];
