export interface Money {
  readonly cents: number; // integer minor units
}

export function fromCents(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new Error("cents must be an integer");
  }

  return { cents };
}

/** Construct from a decimal amount (e.g. 1234.56) → integer cents, half-away-from-zero. */
export function money(amount: number): Money {
  const scaled = amount * 100;
  const rounded = scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
  return { cents: rounded };
}

export function add(a: Money, b: Money): Money {
  return { cents: a.cents + b.cents };
}

export function subtract(a: Money, b: Money): Money {
  return { cents: a.cents - b.cents };
}

export function isNegative(m: Money): boolean {
  return m.cents < 0;
}

/** Group an integer's digits in threes with '.' (Italian thousands separator).
 * Deterministic — does not depend on the runtime's ICU grouping rules. */
function groupThousands(whole: number): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Italian formatting: thousands '.', decimals ',' — no currency symbol (added in UI). */
export function formatEUR(m: Money): string {
  const negative = m.cents < 0;
  const abs = Math.abs(m.cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const wholeStr = groupThousands(whole);
  return `${negative ? "-" : ""}${wholeStr},${frac}`;
}
