/** An amount of money in integer minor units. Formatting is the UI's. */
export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`not an integer amount of cents: ${value}`);
  }

  return value as Cents;
}

export const ZERO_CENTS: Cents = cents(0);

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}
