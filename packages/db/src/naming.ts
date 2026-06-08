// Irregular tokens that do not follow plain camel boundaries. The map is applied
// in BOTH directions so the transform is lossless. Order matters: longest first,
// and junction "2" tokens (digit 2 meaning "to") before bare acronyms so the
// acronym after the 2 is handled by the junction rule, not the acronym rule.
//
// Junction "2" pattern: `<lowercase>2<UPPERCASE>` — the digit is the word "to",
// e.g. ledgerEntry2URDistribution, ledgerInvoice2F24, withholdingTax2LA. It must
// become `_2_`. Contrast with NON-junction digits where 2 is part of the token
// and stays fused: `expenseLA2Table` (`A2`, preceded by uppercase) -> `la2`, and
// `iso3166`/`alpha2`/`f24` (digit not followed by uppercase) -> fused.
//
// `LA` = "Ledger Account" acronym (like UR, F24, PO, I18n). Mapping `LA` -> `_la`
// also yields the correct fused `la2` for expenseLA2Table: `LA` -> ` _la `, then
// the trailing `2Table` splits at the digit/Upper boundary into `2_table`, giving
// `expense_la2_table`.
const IRREGULAR: Array<[camel: string, snake: string]> = [
  // junctions (must precede bare acronyms so the post-2 acronym lowercases right)
  ["2URDistribution", "_2_ur_distribution"],
  ["2F24", "_2_f24"],
  ["2LA", "_2_la"],
  // bare acronyms
  ["URDistribution", "_ur_distribution"],
  ["I18n", "_i18n"],
  ["LA", "_la"],
  ["PO", "_po"],
  // "770" is the name of an Italian tax declaration form — a standalone token, so
  // the schema splits `tax770` -> `tax_770` even though we otherwise keep
  // letter->digit fused (iso3166, alpha2, f24). Handle it explicitly.
  ["tax770", "tax_770"],
];

export function toSnake(camel: string): string {
  // Substitute the irregular tokens for their (already snake_case) forms. We keep
  // them inline (no surrounding spaces) so the seam between an irregular form and
  // a following CamelCase word still presents a lower/Upper boundary that the
  // regex below will split — e.g. `expenseLAUnitException`:
  //   LA -> _la  =>  expense_laUnitException
  //   then the `aU` boundary splits =>  expense_la_unit_exception  (correct).
  let s = camel;
  for (const [c, snake] of IRREGULAR) s = s.split(c).join(snake);
  // Split lower/digit -> Upper boundaries (e.g. f24Id -> f24_Id). We deliberately
  // do NOT split letter -> digit: digit-adjacent tokens like iso3166, alpha2, and
  // f24 stay fused, matching the authored schema.
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return s.replace(/__+/g, "_").replace(/^_/, "").replace(/_$/, "").toLowerCase();
}

export function toCamel(snake: string): string {
  // Reverse via the known irregular snake forms first, then standard. Longest
  // first so `_2_ur_distribution` wins over `_ur_distribution`, etc.
  const rev: Array<[snake: string, camel: string]> = [
    ["_2_ur_distribution", "2URDistribution"],
    ["_2_f24", "2F24"],
    ["_2_la", "2LA"],
    ["_ur_distribution", "URDistribution"],
    ["_i18n", "I18n"],
    ["_la", "LA"],
    ["_po", "PO"],
    ["tax_770", "tax770"],
  ];
  let s = snake;
  for (const [sn, c] of rev) s = s.split(sn).join(` ${c} `);
  return s
    .split(" ")
    .map((seg) =>
      seg.includes("_") || /^[a-z0-9]+$/.test(seg)
        ? seg.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
        : seg,
    )
    .join("");
}
