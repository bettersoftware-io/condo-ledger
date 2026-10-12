// packages/domain/src/useCases/allocate.ts
import { must } from "#/support/must.ts";

/** Split an integer cents total across weights using largest-remainder rounding.
 * Invariant: result sums exactly to totalCents. Ties go to the lower index. */
export function allocate(totalCents: number, weights: number[]): number[] {
  if (!Number.isInteger(totalCents)) {
    throw new Error("totalCents must be an integer");
  }

  if (totalCents < 0) {
    return allocate(-totalCents, weights).map((v) => {
      return -v;
    });
  }

  const totalWeight = weights.reduce((a, b) => {
    return a + b;
  }, 0);

  if (totalWeight <= 0) {
    return weights.map(() => {
      return 0;
    });
  }

  const raw = weights.map((w) => {
    return (totalCents * w) / totalWeight;
  });
  const out = raw.map(Math.floor);
  let remainder =
    totalCents -
    out.reduce((a, b) => {
      return a + b;
    }, 0);

  const order = raw
    .map((r, i) => {
      return { frac: r - Math.floor(r), i };
    })
    .sort((a, b) => {
      return b.frac - a.frac || a.i - b.i;
    });

  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    const entry = must(order[k], `the share at rank ${k}`);
    out[entry.i] = must(out[entry.i], `the share ${entry.i}`) + 1;
  }

  return out;
}
