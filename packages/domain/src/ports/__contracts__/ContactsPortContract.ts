import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type {
  Contact,
  ContactCategory,
  ContactConnection,
} from "#/entities/contact.ts";

import type { ContactsPort } from "../contactsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface ContactsPortHarness {
  port: ContactsPort;
  /** What the port is expected to answer. */
  expected: Contact[];
  /** The categories it is expected to answer. */
  expectedCategories: ContactCategory[];
  /** Every connection it holds: at least two on one contact, out of order, and one on another. */
  connections: ContactConnection[];
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

    it("lists every category", async () => {
      const { port, expectedCategories, teardown } = createHarness();

      try {
        expect(await firstValueFrom(port.categories())).toEqual(
          expectedCategories,
        );
      } finally {
        teardown();
      }
    });

    it("lists the connections of a contact by their order, and only that contact's", async () => {
      const { port, connections, teardown } = createHarness();

      try {
        const contactId = connections[0]?.contactId ?? "";
        const mine = connections
          .filter((connection) => {
            return connection.contactId === contactId;
          })
          .sort((a, b) => {
            return a.order - b.order;
          });

        expect(mine.length).toBeGreaterThan(1);
        expect(mine.length).toBeLessThan(connections.length);
        expect(await firstValueFrom(port.connections(contactId))).toEqual(mine);
      } finally {
        teardown();
      }
    });

    it("lists no connection for a contact that has none", async () => {
      const { port, teardown } = createHarness();

      try {
        expect(await firstValueFrom(port.connections("md-none"))).toEqual([]);
      } finally {
        teardown();
      }
    });
  });
}
