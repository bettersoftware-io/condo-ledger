import { firstValueFrom, type Observable, type Subscription } from "rxjs";
import { describe, expect, it } from "vitest";

import type {
  Contact,
  ContactCategory,
  ContactConnection,
} from "#/entities/contact.ts";
import type { Added, Result, ResultOf } from "#/entities/result.ts";
import type { ConnectionDraft } from "#/useCases/contacts/validateConnection.ts";
import type {
  ContactDraft,
  ContactRowDraft,
} from "#/useCases/contacts/validateContact.ts";

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
  /** A contact used in a building (a supplier, say), that building, and its name. */
  usedContactId: string;
  usedBuildingId: string;
  usedBuildingName: string;
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

    it("answers where a contact is used", async () => {
      const { port, usedContactId, usedBuildingId, teardown } = createHarness();

      try {
        const uses = await firstValueFrom(port.uses());
        const used = uses.get(usedContactId);
        const buildings = [
          ...(used?.supplierOf ?? []),
          ...(used?.residentOf ?? []),
          ...(used?.onInvoicesOf ?? []),
          ...(used?.inEntriesOf ?? []),
        ];

        expect(buildings).toContain(usedBuildingId);
      } finally {
        teardown();
      }
    });

    it("emits the list again after an accepted write, and answers the id the list then holds", async () => {
      const { port, teardown } = createHarness();

      try {
        const seen = collect(port.contacts());
        const added = await port.addContact(personDraft("Lombardi", []));
        const id = addedId(added);

        expect(seen.values).toHaveLength(2);
        expect(
          seen.values[1]?.some((contact) => {
            return contact.id === id;
          }),
        ).toBe(true);
        seen.subscription.unsubscribe();
      } finally {
        teardown();
      }
    });

    it("gives a new contact the number after the highest held", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        const highest = Math.max(
          ...expected.map((contact) => {
            return Number(contact.id.replace("md", ""));
          }),
        );

        expect(
          addedId(await port.addContact(personDraft("Lombardi", []))),
        ).toBe(`md${highest + 1}`);
        expect(addedId(await port.addContact(personDraft("Gallo", [])))).toBe(
          `md${highest + 2}`,
        );
      } finally {
        teardown();
      }
    });

    it("gives the rows of a new contact ids, by their order", async () => {
      const { port, teardown } = createHarness();

      try {
        const id = addedId(
          await port.addContact(
            personDraft("Lombardi", [
              rowDraft(null, "second", 2),
              rowDraft(null, "first", 1),
            ]),
          ),
        );
        const contact = await contactNamed(port, id);

        expect(
          contact.rows.map((row) => {
            return row.value;
          }),
        ).toEqual(["first", "second"]);
        expect(
          new Set(
            contact.rows.map((row) => {
              return row.id;
            }),
          ).size,
        ).toBe(2);
        expect(
          contact.rows.every((row) => {
            return row.id.length > 0;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("refuses a contact for the reason the rules name, and changes and emits nothing", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        const seen = collect(port.contacts());

        expect(await port.addContact(personDraft(" ", []))).toEqual({
          ok: false,
          reason: "blank-last-name",
        });
        expect(
          await port.addContact(
            personDraft("Lombardi", [rowDraft(null, "", 1)]),
          ),
        ).toEqual({ ok: false, reason: "blank-value" });
        expect(seen.values).toEqual([expected]);
        seen.subscription.unsubscribe();
      } finally {
        teardown();
      }
    });

    it("edits a contact, keeps its kind and drops the rows the draft leaves out", async () => {
      const { port, teardown } = createHarness();

      try {
        const id = addedId(
          await port.addContact(
            personDraft("Lombardi", [
              rowDraft(null, "keep", 1),
              rowDraft(null, "drop", 2),
            ]),
          ),
        );
        const before = await contactNamed(port, id);
        const kept = before.rows[0];

        expect(
          await port.editContact(
            id,
            personDraft("Gallo", [rowDraft(kept?.id ?? null, "kept", 1)]),
          ),
        ).toEqual({ ok: true });

        const after = await contactNamed(port, id);

        expect(after.kind).toBe("person");
        expect(after.kind === "person" && after.lastName).toBe("Gallo");
        expect(after.rows).toEqual([
          {
            id: kept?.id,
            type: "phone",
            label: "Mobile",
            value: "kept",
            order: 1,
          },
        ]);
      } finally {
        teardown();
      }
    });

    it("refuses an edit the rules refuse, and rejects one on an id it lacks or of the other kind", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        const person = expected.find((contact) => {
          return contact.kind === "person";
        });
        const id = person?.id ?? "";

        expect(await port.editContact(id, personDraft(" ", []))).toMatchObject({
          ok: false,
          reason: "blank-last-name",
        });
        await expect(
          port.editContact("md-none", personDraft("Gallo", [])),
        ).rejects.toThrow("missing");
        await expect(
          port.editContact(id, companyDraft("Gallo srl")),
        ).rejects.toThrow("kind");
      } finally {
        teardown();
      }
    });

    it("deletes a contact with its rows and every connection on either end", async () => {
      const { port, usedContactId, teardown } = createHarness();

      try {
        const id = addedId(
          await port.addContact(
            personDraft("Lombardi", [rowDraft(null, "x", 1)]),
          ),
        );

        addedId(await port.addConnection(usedContactId, connection(id, 1)));
        addedId(await port.addConnection(id, connection(usedContactId, 1)));

        const seen = collect(port.connections(usedContactId));

        expect(await port.deleteContact(id)).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.contacts())).some((contact) => {
            return contact.id === id;
          }),
        ).toBe(false);
        expect(await firstValueFrom(port.connections(id))).toEqual([]);
        expect(
          (await firstValueFrom(port.connections(usedContactId))).some(
            (held) => {
              return held.connectedId === id;
            },
          ),
        ).toBe(false);
        expect(seen.values).toHaveLength(2);
        seen.subscription.unsubscribe();
      } finally {
        teardown();
      }
    });

    it("refuses to delete a contact that is used, naming the building, and keeps it", async () => {
      const { port, usedContactId, usedBuildingName, teardown } =
        createHarness();

      try {
        const verdict = await port.deleteContact(usedContactId);

        expect(verdict.ok).toBe(false);
        expect(verdict).toMatchObject({ detail: usedBuildingName });
        expect(
          (await firstValueFrom(port.contacts())).some((contact) => {
            return contact.id === usedContactId;
          }),
        ).toBe(true);
        await expect(port.deleteContact("md-none")).rejects.toThrow("missing");
      } finally {
        teardown();
      }
    });

    it("adds, edits and deletes a category, refusing a taken name and a category with contacts", async () => {
      const { port, expectedCategories, teardown } = createHarness();

      try {
        const [existing] = expectedCategories;
        const seen = collect(port.categories());
        const id = addedId(await port.addCategory("Plumber"));

        expect(id).toBe("mc-new-1");
        expect(seen.values).toHaveLength(2);
        expect(await port.addCategory(" plumber ")).toMatchObject({
          ok: false,
          reason: "category-name-taken",
        });
        expect(await port.editCategory(id, "Roofer")).toEqual({ ok: true });
        expect(await port.editCategory(id, existing?.name ?? "")).toMatchObject(
          { ok: false, reason: "category-name-taken" },
        );
        expect(
          (await firstValueFrom(port.categories())).find((held) => {
            return held.id === id;
          })?.name,
        ).toBe("Roofer");

        await port.addContact({
          ...personDraft("Lombardi", []),
          categoryId: id,
        });

        expect(await port.deleteCategory(id)).toEqual({
          ok: false,
          reason: "category-not-empty",
          detail: "1",
        });
        expect(await port.deleteCategory(existing?.id ?? "")).toEqual({
          ok: true,
        });
        await expect(port.deleteCategory("mc-none")).rejects.toThrow("missing");
        await expect(port.editCategory("mc-none", "x")).rejects.toThrow(
          "missing",
        );
        seen.subscription.unsubscribe();
      } finally {
        teardown();
      }
    });

    it("adds, edits and deletes a connection, by its order, on one contact only", async () => {
      const { port, connections, teardown } = createHarness();

      try {
        const contactId = connections[0]?.contactId ?? "";
        const seen = collect(port.connections(contactId));
        const id = addedId(
          await port.addConnection(contactId, connection("md2", 3)),
        );

        expect(id).toBe("cr-new-1");
        expect(seen.values).toHaveLength(2);
        expect(seen.values[1]?.at(-1)?.id).toBe(id);
        expect(
          await port.addConnection(contactId, connection("md2", 4)),
        ).toMatchObject({ ok: false, reason: "connection-taken" });
        expect(
          await port.editConnection(id, {
            ...connection("md2", 5),
            relationship: "Cousin",
          }),
        ).toEqual({ ok: true });

        const edited = (await firstValueFrom(port.connections(contactId))).find(
          (held) => {
            return held.id === id;
          },
        );

        expect(edited).toEqual({
          id,
          contactId,
          connectedId: "md2",
          relationship: "Cousin",
          order: 5,
        });
        expect(
          await port.editConnection(id, connection(contactId, 1)),
        ).toMatchObject({
          ok: false,
          reason: "same-contact",
        });
        expect(await port.deleteConnection(id)).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.connections(contactId))).some((held) => {
            return held.id === id;
          }),
        ).toBe(false);
        await expect(port.deleteConnection(id)).rejects.toThrow("missing");
        await expect(
          port.addConnection("md-none", connection("md2", 1)),
        ).rejects.toThrow("missing");
        seen.subscription.unsubscribe();
      } finally {
        teardown();
      }
    });
  });
}

function addedId(result: ResultOf<Added> | Result): string {
  if (!result.ok || !("value" in result)) {
    throw new Error(`not added: ${JSON.stringify(result)}`);
  }

  return result.value.id;
}

interface Collected<T> {
  values: T[];
  subscription: Subscription;
}

/** What a stream emits from now on, the first at once. */
function collect<T>(stream: Observable<T>): Collected<T> {
  const values: T[] = [];
  const subscription = stream.subscribe((value) => {
    values.push(value);
  });

  return {
    values,
    subscription,
  };
}

async function contactNamed(port: ContactsPort, id: string): Promise<Contact> {
  const found = (await firstValueFrom(port.contacts())).find((contact) => {
    return contact.id === id;
  });

  if (found === undefined) {
    throw new Error(`the list does not hold ${id}`);
  }

  return found;
}

function rowDraft(
  id: string | null,
  value: string,
  order: number,
): ContactRowDraft {
  return { id, type: "phone", label: "Mobile", value, order };
}

function personDraft(lastName: string, rows: ContactRowDraft[]): ContactDraft {
  return {
    kind: "person",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows,
    firstName: null,
    lastName,
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
  };
}

function companyDraft(companyName: string): ContactDraft {
  return {
    kind: "company",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows: [],
    companyName,
    registeredOffice: null,
    taxDomicile: null,
  };
}

function connection(connectedId: string, order: number): ConnectionDraft {
  return { connectedId, relationship: "Friend", order };
}
