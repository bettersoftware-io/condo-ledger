// packages/domain/src/allocate.ts
/** Split an integer cents total across weights using largest-remainder rounding.
 * Invariant: result sums exactly to totalCents. Ties go to the lower index. */
export function allocate(totalCents: number, weights: number[]): number[] {
  if (!Number.isInteger(totalCents)) throw new Error("totalCents must be an integer");
  if (totalCents < 0) return allocate(-totalCents, weights).map((v) => -v);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / totalWeight);
  const out = raw.map(Math.floor);
  let remainder = totalCents - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    const entry = order[k]!;
    out[entry.i] = out[entry.i]! + 1;
  }
  return out;
}
