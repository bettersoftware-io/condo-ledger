import { afterEach } from "vitest";

/**
 * Starts a list of the machines a test builds and disposes them all after
 * each test. Call it once in a test file; the function it returns takes a
 * machine, remembers it and hands it back.
 */
export function disposeAfterEach(): Track {
  const built: Disposable[] = [];

  afterEach(() => {
    for (const machine of built.splice(0)) {
      machine.dispose();
    }
  });

  return <TMachine extends Disposable>(machine: TMachine): TMachine => {
    built.push(machine);

    return machine;
  };
}

export type Track = <TMachine extends Disposable>(
  machine: TMachine,
) => TMachine;

interface Disposable {
  dispose: () => void;
}
