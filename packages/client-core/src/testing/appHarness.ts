import { type LegacySeed, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import {
  type App,
  type AppPorts,
  createApp,
  createSimulatorPorts,
} from "../composition.ts";

/** The real application on the simulators, and what it stands on. */
export interface AppHarness {
  app: App;
  /** The simulators behind the app, for a test that drives one directly. */
  ports: AppPorts;
  seed: LegacySeed;
}

/**
 * The real application on the simulators, over the real seed unless a test
 * brings its own. For tests above the core (bindings, UI): everything real
 * except the outside world. Only this file calls createApp.
 */
export function createAppHarness(
  seed: LegacySeed = loadLegacySeed(legacySeedData),
): AppHarness {
  const ports = createSimulatorPorts(seed);

  return { app: createApp(ports), ports, seed };
}
