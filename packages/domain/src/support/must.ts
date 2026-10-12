/** The value, or an error that says what was missing. For lookups that the data guarantees. */
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`missing: ${what}`);
  }

  return value;
}

/** The list under `key`, created empty when absent. */
export function listFor<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const created: V[] = [];
  map.set(key, created);

  return created;
}
