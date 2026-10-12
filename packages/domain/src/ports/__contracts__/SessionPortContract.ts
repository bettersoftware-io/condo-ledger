import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Preferences } from "#/entities/session.ts";

import type { SessionPort } from "../sessionPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface SessionPortHarness {
  port: SessionPort;
  teardown: () => void;
}

export function describeSessionPortContract(
  label: string,
  createHarness: () => SessionPortHarness,
): void {
  describe(`${label} :: SessionPort contract`, () => {
    it("answers the principal, the firm and the preferences to a new subscriber at once", async () => {
      const { port, teardown } = createHarness();

      try {
        const principal = await firstValueFrom(port.principal());
        const firm = await firstValueFrom(port.firm());
        const preferences = await firstValueFrom(port.preferences());

        expect(principal.username).not.toBe("");
        expect(firm.name).not.toBe("");
        expect(["light", "dark"]).toContain(preferences.mode);
      } finally {
        teardown();
      }
    });

    it("applies a preference patch and tells every subscriber", async () => {
      const { port, teardown } = createHarness();
      const seen: Preferences[] = [];
      const subscription = port.preferences().subscribe((preferences) => {
        seen.push(preferences);
      });

      try {
        const before = seen[0];
        const result = await port.setPreference({ mode: "dark" });

        expect(result).toEqual({ ok: true });
        expect(seen.at(-1)).toEqual({ ...before, mode: "dark" });
        expect(await firstValueFrom(port.preferences())).toEqual({
          ...before,
          mode: "dark",
        });
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });
  });
}
