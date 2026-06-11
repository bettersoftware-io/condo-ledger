/** "1.234,56" → 123456 cents; plain integers are euros. Null when unparseable. */
export function parseItMoney(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  const scaled = n * 100;
  return scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
}
