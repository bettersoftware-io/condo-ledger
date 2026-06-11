/** "1.234,56" → 123456 cents; plain integers are euros ("500" → 50000).
 * Dots are accepted only as thousands separators (groups of 3); comma is the
 * decimal separator. Mixed/US formats ("1,234.56") and stray dots ("1.23")
 * return null. */
export function parseItMoney(s: string): number | null {
  const t = s.trim();
  const valid = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+(,\d+)?$/.test(t);
  if (!valid) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  const scaled = n * 100;
  return scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
}
