/** Narrows a value that the caller knows is present; throws when it is not. */
export function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected a value, found undefined");
  }

  return value;
}

/** The list stored under `key`, created and stored first when absent. */
export function listFor<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const created: V[] = [];
  map.set(key, created);

  return created;
}
