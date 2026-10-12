import type { AppPorts } from "@cl/client-core";
import { createPriceSimulator } from "@cl/domain";

/**
 * Picks what stands behind each port. This is the only place that chooses an
 * adapter: with a server URL the app talks to the server, without one it runs
 * on the simulator.
 */
export function buildPorts(serverUrl: string | undefined): AppPorts {
  if (serverUrl) {
    throw new Error(
      `a server URL is set (${serverUrl}) but the server's ports arrive in M3`,
    );
  }

  console.info("[data] composed sim: no VITE_SERVER_URL");

  return { price: createPriceSimulator() };
}
