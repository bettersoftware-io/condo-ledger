import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import type { ContactRow } from "#/entities/contact.ts";

import { createPersonContact } from "../testing/createContacts.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createContactsSimulator } from "./contactsSimulator.ts";

describe("contacts simulator", () => {
  it("refuses to delete a contact the wired uses name as a resident, and keeps it", async () => {
    const contacts = createContactsSimulator(createSmallSeed(), {
      uses$: of(
        new Map([
          [
            "md10",
            {
              supplierOf: [],
              residentOf: ["c1"],
              onInvoicesOf: [],
              inEntriesOf: [],
            },
          ],
        ]),
      ),
    });

    expect(await contacts.deleteContact("md10")).toEqual({
      ok: false,
      reason: "is-resident",
      detail: "Pozzetto",
    });
    expect(
      contacts.currentContacts().some((contact) => {
        return contact.id === "md10";
      }),
    ).toBe(true);
  });

  it("deletes a contact the wired uses do not name", async () => {
    const contacts = createContactsSimulator(createSmallSeed(), {
      uses$: of(new Map()),
    });

    expect(await contacts.deleteContact("md1")).toEqual({ ok: true });
    expect(
      contacts.currentContacts().some((contact) => {
        return contact.id === "md1";
      }),
    ).toBe(false);
  });

  it("reads the use of a contact from the seed's links, residents and journal when nothing is wired in", async () => {
    const contacts = createContactsSimulator(createSmallSeed());
    const uses = await firstValueFrom(contacts.uses());

    expect(uses.get("md1")?.supplierOf).toEqual(["c1"]);
    expect(uses.get("md1")?.inEntriesOf).toEqual(["c1"]);
    expect(uses.get("md10")?.residentOf).toEqual(["c1"]);
    expect(await contacts.deleteContact("md10")).toMatchObject({
      reason: "is-resident",
    });
  });

  it("rejects an edit on an unknown id, and names the id", async () => {
    const contacts = createContactsSimulator(createSmallSeed());

    await expect(
      contacts.editContact("md99", createPersonContact("x", "Gallo", null)),
    ).rejects.toThrow("missing: the contact md99");
  });

  it("numbers a new contact after the highest id, not after how many there are", async () => {
    const contacts = createContactsSimulator({
      ...createSmallSeed(),
      contacts: [createPersonContact("md40", "Gallo", null)],
    });

    expect(
      await contacts.addContact(createPersonContact("x", "Lombardi", null)),
    ).toEqual({ ok: true, value: { id: "md41" } });
  });

  it("judges every row after the contact, and answers the first refusal", async () => {
    const contacts = createContactsSimulator(createSmallSeed());
    const row = createRowDraft();

    expect(
      await contacts.addContact(
        createPersonContact("x", "Lombardi", null, { rows: [row] }),
      ),
    ).toEqual({ ok: false, reason: "bad-order" });
    expect(
      await contacts.addContact(
        createPersonContact("x", " ", null, { rows: [row] }),
      ),
    ).toEqual({ ok: false, reason: "blank-last-name" });
  });
});

function createRowDraft(): ContactRow {
  return { id: "mr1", type: "email", label: "Work", value: "x", order: 0 };
}
