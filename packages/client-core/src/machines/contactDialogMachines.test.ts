import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type {
  Contact,
  ContactDraft,
  ContactRow,
  ContactRowDraft,
  ContactsPort,
  LegacySeed,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import {
  createCompanyContact,
  createPersonContact,
} from "@cl/domain/testing/createContacts.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { createAppHarness } from "#/testing/appHarness.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";

describe("the contact dialog", () => {
  it("opens a new person Active on the first salutation, and saves once the last name is filled", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      kind: "person",
      canSave: false,
      editing: null,
      nextOrder: 1,
      salutations: ["Dear Sir", "Dear Madam"],
      verdict: { ok: false, reason: "blank-last-name" },
      form: { status: "active", salutation: "Dear Sir", rows: [] },
    });

    machine.intents.edit({ lastName: "Verdi" });

    expect(machine.state$.getValue()).toMatchObject({
      canSave: true,
      verdict: { ok: true },
    });
  });

  it("holds the categories the port gives, to choose from", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue().categories).toEqual([
      { id: "mc1", name: "Gardener" },
      { id: "mc2", name: "Electrician" },
    ]);
  });

  it("opens a new company blank until the company name is filled", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "company", editing: null },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      kind: "company",
      canSave: false,
      verdict: { ok: false, reason: "blank-company-name" },
    });

    machine.intents.edit({ companyName: "Gamma" });

    expect(machine.state$.getValue().canSave).toBe(true);
  });

  it("edits a company as it stands and keeps its kind", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const company = contactOf(createContactsSeed(), "md2");
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: company },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      kind: "company",
      editing: "md2",
      nextOrder: 3,
      form: { companyName: "Beta S.p.A.", code: "BETA" },
    });

    machine.intents.edit({ companyName: " Beta Group " });
    expect(await machine.intents.save()).toEqual({ ok: true });

    const saved = await contactIn(ports.contacts, "md2");

    expect(saved).toMatchObject({
      kind: "company",
      companyName: "Beta Group",
      code: "BETA",
    });
  });

  it("holds the rows and writes nothing until it is saved, then writes them in one call", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const before = await firstValueFrom(ports.contacts.contacts());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "company", editing: contactOf(createContactsSeed(), "md2") },
        ignoreAdded,
      ),
    );

    machine.intents.applyRow(
      null,
      createRow({ label: "Office", value: "02 111", order: 3 }),
    );
    machine.intents.applyRow(
      0,
      createRow({ id: "mr1", label: "Main", value: "02 999", order: 1 }),
    );
    machine.intents.removeRow(1);

    expect(machine.state$.getValue()).toMatchObject({
      nextOrder: 4,
      form: {
        rows: [
          { id: "mr1", label: "Main", value: "02 999" },
          { id: null, label: "Office", value: "02 111" },
        ],
      },
    });
    expect(await firstValueFrom(ports.contacts.contacts())).toEqual(before);

    expect(await machine.intents.save()).toEqual({ ok: true });

    const saved = await contactIn(ports.contacts, "md2");

    expect(
      saved.rows.map((row) => {
        return row.label;
      }),
    ).toEqual(["Main", "Office"]);
  });

  it("leaves the port as it was when it is never saved", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const before = await firstValueFrom(ports.contacts.contacts());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    machine.intents.edit({ lastName: "Verdi" });
    machine.intents.applyRow(null, createRow({}));
    machine.dispose();

    expect(await firstValueFrom(ports.contacts.contacts())).toEqual(before);
  });

  it("refuses a code another contact has, as typed, ignoring case", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    machine.intents.edit({ lastName: "Verdi", code: " beta " });

    const refusal = { ok: false, reason: "contact-code-taken", detail: "beta" };

    expect(machine.state$.getValue().verdict).toEqual(refusal);
    expect(await machine.intents.save()).toEqual(refusal);
  });

  it("judges a code the registry takes after the dialog opened", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    machine.intents.edit({ lastName: "Verdi", code: "NEW" });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });

    await ports.contacts.addContact({
      ...personDraft("Neri"),
      code: "NEW",
    });

    expect(machine.state$.getValue().verdict).toMatchObject({
      reason: "contact-code-taken",
    });
  });

  it("reads the birth date as typed, in the clock's year without one, and shows one that does not read", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    machine.intents.edit({ lastName: "Verdi", birthDate: "31/02/1980" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "bad-birth-date",
    });

    machine.intents.edit({ birthDate: "20/05/1980" });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
  });

  it("tells the date the birth date reads as, and none while it is blank or does not read", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue().bornOn).toBeNull();

    machine.intents.edit({ birthDate: "1/2" });
    expect(machine.state$.getValue().bornOn).toBe("2027-02-01");

    machine.intents.edit({ birthDate: "31/02/1980" });
    expect(machine.state$.getValue().bornOn).toBeNull();
  });

  it("types a stored birth date back as dd/mm/yyyy, and saves it as an ISO date", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const person = contactOf(createContactsSeed(), "md10");
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: person },
        ignoreAdded,
      ),
    );

    expect(machine.state$.getValue().form.birthDate).toBe("20/05/1980");

    machine.intents.edit({ birthDate: "1/2" });
    await machine.intents.save();

    expect(await contactIn(ports.contacts, "md10")).toMatchObject({
      birthDate: "2027-02-01",
    });
  });

  it("hands a new contact's id to onAdded before it answers, with blank fields as none", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const added: string[] = [];
    const machine = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        (id) => {
          added.push(id);
        },
      ),
    );

    machine.intents.edit({ lastName: " Verdi ", firstName: " ", notes: "" });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(added).toEqual(["md12"]);
    expect(await contactIn(ports.contacts, "md12")).toMatchObject({
      lastName: "Verdi",
      firstName: null,
      notes: null,
      salutation: "Dear Sir",
      code: null,
    });
  });

  it("does not call onAdded for a refused save or an edit", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const added: string[] = [];
    const refused = track(
      app.machines.createContactDialog(
        { kind: "person", editing: null },
        (id) => {
          added.push(id);
        },
      ),
    );

    const edited = track(
      app.machines.createContactDialog(
        { kind: "person", editing: contactOf(createContactsSeed(), "md10") },
        (id) => {
          added.push(id);
        },
      ),
    );

    await refused.intents.save();
    await edited.intents.save();

    expect(added).toEqual([]);
  });
});

describe("the contact row dialog", () => {
  it("starts a new row on the next order and Phone, and saves once it has a value", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const applied: ContactRowDraft[] = [];
    const machine = track(
      app.machines.createContactRowDialog(null, 4, (row) => {
        applied.push(row);
      }),
    );

    expect(machine.state$.getValue()).toMatchObject({
      canSave: false,
      form: { order: "4", type: "phone", label: "Phone", value: "" },
    });

    machine.intents.edit({ value: " 02 123 " });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(applied).toEqual([
      { id: null, type: "phone", label: "Phone", value: "02 123", order: 4 },
    ]);
  });

  it("changes a label still equal to the type's usual one with the type, and keeps one that was typed", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(
      app.machines.createContactRowDialog(null, 1, ignoreRow),
    );

    machine.intents.edit({ type: "email" });
    expect(machine.state$.getValue().form.label).toBe("Email");

    machine.intents.edit({ label: "Work" });
    machine.intents.edit({ type: "web" });
    expect(machine.state$.getValue().form.label).toBe("Work");

    machine.intents.edit({ label: "Website" });
    machine.intents.edit({ type: "im" });
    expect(machine.state$.getValue().form.label).toBe("Instant messaging");

    machine.intents.edit({ type: "pec" });
    expect(machine.state$.getValue().form.label).toBe("Certified email");
  });

  it("edits a row as it stands, keeping its id", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const applied: ContactRowDraft[] = [];
    const row = createRow({
      id: "mr1",
      type: "email",
      label: "Work",
      value: "a@b.it",
      order: 2,
    });

    const machine = track(
      app.machines.createContactRowDialog(row, 9, (saved) => {
        applied.push(saved);
      }),
    );

    expect(machine.state$.getValue().form).toEqual({
      order: "2",
      type: "email",
      label: "Work",
      value: "a@b.it",
    });

    machine.intents.edit({ value: "c@d.it" });
    await machine.intents.save();

    expect(applied).toEqual([{ ...row, value: "c@d.it" }]);
  });

  it("refuses an order that is not a whole number from 1, and applies nothing", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const applied: ContactRowDraft[] = [];
    const machine = track(
      app.machines.createContactRowDialog(null, 1, (row) => {
        applied.push(row);
      }),
    );

    machine.intents.edit({ value: "x", order: "0" });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "bad-order",
    });

    machine.intents.edit({ order: "abc" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "bad-order",
    });
    expect(applied).toEqual([]);
  });
});

describe("the category dialog", () => {
  it("adds a category and hands its id to onAdded", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const added: string[] = [];
    const machine = track(
      app.machines.createCategoryDialog(null, (id) => {
        added.push(id);
      }),
    );

    expect(machine.state$.getValue()).toMatchObject({
      canSave: false,
      editing: null,
      form: { name: "" },
    });

    machine.intents.edit({ name: " Plumber " });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(added).toEqual(["mc-new-1"]);
    expect(await firstValueFrom(ports.contacts.categories())).toContainEqual({
      id: "mc-new-1",
      name: "Plumber",
    });
  });

  it("edits a category under its own name, and refuses another's", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const category = must(
      createContactsSeed().contactCategories[0],
      "the first category",
    );

    const machine = track(
      app.machines.createCategoryDialog(category, ignoreAdded),
    );

    expect(machine.state$.getValue()).toMatchObject({
      editing: "mc1",
      form: { name: "Gardener" },
      verdict: { ok: true },
    });

    machine.intents.edit({ name: "electrician" });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "category-name-taken",
      detail: "electrician",
    });

    machine.intents.edit({ name: "Landscaper" });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(await firstValueFrom(ports.contacts.categories())).toContainEqual({
      id: "mc1",
      name: "Landscaper",
    });
  });
});

describe("the connection dialog", () => {
  it("starts a new connection on the next free order, and saves once it has a contact and a relationship", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const machine = track(app.machines.createConnectionDialog("md2", null));

    expect(machine.state$.getValue()).toMatchObject({
      canSave: false,
      editing: null,
      form: { connectedId: null, relationship: "", order: "3" },
    });

    machine.intents.edit({ connectedId: "md10", relationship: "Manager" });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(
      await firstValueFrom(ports.contacts.connections("md2")),
    ).toContainEqual(
      expect.objectContaining({
        connectedId: "md10",
        relationship: "Manager",
        order: 3,
      }),
    );
  });

  it("starts on order 1 when the contact has none", () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(app.machines.createConnectionDialog("md10", null));

    expect(machine.state$.getValue().form.order).toBe("1");
  });

  it("refuses the contact itself and a relationship the contact already has", async () => {
    const { app } = createAppHarness(createContactsSeed());
    const machine = track(app.machines.createConnectionDialog("md2", null));

    machine.intents.edit({ connectedId: "md2", relationship: "x" });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "same-contact",
    });

    machine.intents.edit({ connectedId: "md11", relationship: " employee " });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "connection-taken",
      detail: "md11",
    });
  });

  it("edits a connection as it stands, its own relationship no clash", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const connection = must(
      createContactsSeed().contactConnections[0],
      "the first connection",
    );

    const machine = track(
      app.machines.createConnectionDialog("md2", connection),
    );

    expect(machine.state$.getValue()).toMatchObject({
      editing: "cr1",
      form: { connectedId: "md11", relationship: "Employee", order: "1" },
      verdict: { ok: true },
    });

    machine.intents.edit({ order: "5" });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(
      await firstValueFrom(ports.contacts.connections("md2")),
    ).toContainEqual(expect.objectContaining({ id: "cr1", order: 5 }));
  });
});

describe("the supplier dialog", () => {
  it("adds the contact as a supplier of the building, and refuses one it has", async () => {
    const { app, ports } = createAppHarness(createContactsSeed());
    const machine = track(app.machines.createSupplierDialog("c1"));

    expect(machine.state$.getValue()).toMatchObject({
      canSave: false,
      verdict: { ok: false, reason: "no-contact" },
      form: { contactId: null },
    });

    machine.intents.edit({ contactId: "md2" });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "already-supplier",
      detail: "Beta S.p.A.",
    });

    machine.intents.edit({ contactId: "md10" });
    expect(machine.state$.getValue()).toMatchObject({
      canSave: true,
      verdict: { ok: true },
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(await firstValueFrom(ports.buildings.suppliers("c1"))).toContain(
      "md10",
    );
  });
});

function personDraft(lastName: string): ContactDraft {
  const { id: _id, ...person } = createPersonContact("x", lastName, null);

  return person;
}

function createContactsSeed(): LegacySeed {
  return {
    ...createSmallSeed(),
    salutations: ["Dear Sir", "Dear Madam"],
    contactCategories: [
      { id: "mc1", name: "Gardener" },
      { id: "mc2", name: "Electrician" },
    ],
    contacts: [
      createCompanyContact("md1", "Alfa s.n.c."),
      createPersonContact("md11", "Bianchi", "Anna"),
      createCompanyContact("md2", "Beta S.p.A.", {
        code: "BETA",
        rows: [
          createStoredRow("mr1", "Main", 1),
          createStoredRow("mr2", "Fax", 2),
        ],
      }),
      createPersonContact("md10", "Rossi", "Mario", {
        birthDate: "1980-05-20",
      }),
    ],
    contactConnections: [
      {
        id: "cr1",
        contactId: "md2",
        connectedId: "md11",
        relationship: "Employee",
        order: 1,
      },
      {
        id: "cr2",
        contactId: "md2",
        connectedId: "md1",
        relationship: "Partner",
        order: 2,
      },
    ],
  };
}

function createRow(patch: Partial<ContactRowDraft>): ContactRowDraft {
  return {
    id: null,
    type: "phone",
    label: "Phone",
    value: "02 000",
    order: 1,
    ...patch,
  };
}

function createStoredRow(id: string, label: string, order: number): ContactRow {
  return { id, type: "phone", label, value: String(order), order };
}

function contactOf(seed: LegacySeed, id: string): Contact {
  return must(
    seed.contacts.find((contact) => {
      return contact.id === id;
    }),
    `the contact ${id}`,
  );
}

async function contactIn(port: ContactsPort, id: string): Promise<Contact> {
  return must(
    (await firstValueFrom(port.contacts())).find((contact) => {
      return contact.id === id;
    }),
    `the contact ${id}`,
  );
}

function ignoreAdded(): void {}

function ignoreRow(): void {}

const track = disposeAfterEach();
