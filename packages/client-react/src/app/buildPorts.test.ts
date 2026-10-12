import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { Price } from "@cl/domain";

import { buildPorts } from "./buildPorts.ts";

describe("choosing what stands behind the ports", () => {
  it("runs on the simulator when there is no server URL", () => {
    const said = silenceInfo();
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const received: Price[] = [];

    const subscription = buildPorts(undefined)
      .price.prices()
      .subscribe((price) => {
        return received.push(price);
      });
    vi.advanceTimersByTime(500);
    subscription.unsubscribe();

    expect(received).toHaveLength(1);
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
