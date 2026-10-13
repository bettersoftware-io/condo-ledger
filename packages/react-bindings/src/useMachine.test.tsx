import { describe, expect, it } from "vitest";

import {
  createSplitMachine,
  type Machine,
  type SplitIntents,
  type SplitState,
} from "@cl/client-core";

import { mountMachine } from "./useMachine.page.tsx";

describe("useMachine", () => {
  it("gives the component the machine's state and intents", async () => {
    const page = mountMachine(createSplitMachine);

    expect(page.state()).toEqual({ ratio: 0.5 });

    await page.send((intents) => {
      return intents.setRatio(0.3);
    });

    expect(page.state()).toEqual({ ratio: 0.3 });
  });

  it("keeps the machine alive through StrictMode's mount, unmount and remount", async () => {
    const counted = createCountedMachines();
    const page = mountMachine(counted.createMachine, { strict: true });

    await page.send((intents) => {
      return intents.setRatio(0.3);
    });

    expect(page.state()).toEqual({ ratio: 0.3 });
    expect(counted.disposed()).toBe(0);
  });

  it("disposes the machine once, on unmount", async () => {
    const counted = createCountedMachines();
    const page = mountMachine(counted.createMachine);

    await page.unmount();

    expect(counted.disposed()).toBe(1);
  });
});

interface CountedMachines {
  createMachine: () => Machine<SplitState, SplitIntents>;
  disposed: () => number;
}

function createCountedMachines(): CountedMachines {
  let disposed = 0;

  return {
    createMachine: (): Machine<SplitState, SplitIntents> => {
      const machine = createSplitMachine();

      return {
        ...machine,
        dispose: (): void => {
          disposed += 1;
          machine.dispose();
        },
      };
    },
    disposed: () => {
      return disposed;
    },
  };
}
