import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Contact } from "#/entities/contact.ts";

import type { ContactsPort } from "../contactsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface ContactsPortHarness {
  port: ContactsPort;
  /** What the port is expected to answer. */
  expected: Contact[];
  teardown: () => void;
}

export function describeContactsPortContract(
  label: string,
  createHarness: () => ContactsPortHarness,
): void {
  describe(`${label} :: ContactsPort contract`, () => {
    it("lists every contact once, to each subscriber, at once", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        const listed = await firstValueFrom(port.contacts());

        expect(listed).toEqual(expected);
        expect(
          new Set(
            listed.map((contact) => {
              return contact.id;
            }),
          ).size,
        ).toBe(listed.length);
        expect(await firstValueFrom(port.contacts())).toEqual(expected);
      } finally {
        teardown();
      }
    });
  });
}
