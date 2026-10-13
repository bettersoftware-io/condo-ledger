import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { Building } from "@cl/domain";

import { buildPorts } from "./buildPorts.ts";

describe("choosing what stands behind the ports", () => {
  it("runs on the simulators over the generated seed when there is no server URL", () => {
    const said = silenceInfo();
    let buildings: Building[] = [];

    // The simulator answers from memory, so the answer is in before the line ends.
    buildPorts(undefined)
      .buildings.buildings()
      .subscribe((answer) => {
        buildings = answer;
      })
      .unsubscribe();

    expect(buildings).toHaveLength(2);
    expect(said).toHaveBeenCalledWith(
      "[data] composed sim: no VITE_SERVER_URL",
    );
  });

  it("refuses a server URL until the server's ports arrive", () => {
    expect(() => {
      return buildPorts("ws://example.test/ws");
    }).toThrow(/M3/);
  });
});

/** The composition says which source it chose; a test reads that instead of printing it. */
function silenceInfo(): ReturnType<typeof vi.spyOn> {
  const said = vi.spyOn(console, "info").mockImplementation(() => {});

  onTestFinished(() => {
    said.mockRestore();
  });

  return said;
}
