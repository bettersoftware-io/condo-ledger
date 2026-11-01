import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type { Invoice } from "#/entities/invoice.ts";
import type { JournalEntry, Posting } from "#/entities/journal.ts";
import type { OwnerParty } from "#/entities/party.ts";

import {
  type ContactUses,
  contactUsesOf,
  type UsesOfPeriod,
  validateContactDelete,
} from "./contactUses.ts";

describe("contactUsesOf", () => {
  it("lists where a contact is supplier, resident, on an invoice and in entries", () => {
    const uses = contactUsesOf(
      [{ buildingId: "c1", contactId: "md1" }],
      [
        createPeriod("c2", {
          residents: [createResident("md2")],
          invoices: [{ supplierId: "md3" } as Invoice],
          entries: [createEntry([{ kind: "supplier", id: "md4" }])],
        }),
      ],
    );

    expect(uses.get("md1")).toEqual(createUses({ supplierOf: ["c1"] }));
    expect(uses.get("md2")).toEqual(createUses({ residentOf: ["c2"] }));
    expect(uses.get("md3")).toEqual(createUses({ onInvoicesOf: ["c2"] }));
    expect(uses.get("md4")).toEqual(createUses({ inEntriesOf: ["c2"] }));
    expect(uses.get("md9")).toBeUndefined();
  });

  it("reaches the contact of an owner counterpart through the resident", () => {
    const uses = contactUsesOf(
      [],
      [
        createPeriod("c1", {
          residents: [createResident("md2", "res7")],
          entries: [createEntry([{ kind: "owner", id: "res7" }])],
        }),
      ],
    );

    expect(uses.get("md2")).toEqual(
      createUses({ residentOf: ["c1"], inEntriesOf: ["c1"] }),
    );
    expect(uses.has("res7")).toBe(false);
  });

  it("skips a posting with no counterpart or an owner no resident answers to", () => {
    const uses = contactUsesOf(
      [],
      [
        createPeriod("c1", {
          entries: [createEntry([null, { kind: "owner", id: "gone" }])],
        }),
      ],
    );

    expect(uses.size).toBe(0);
  });

  it("names a building once however many periods name the contact", () => {
    const uses = contactUsesOf(
      [
        { buildingId: "c1", contactId: "md1" },
        { buildingId: "c1", contactId: "md1" },
      ],
      [
        createPeriod("c1", { residents: [createResident("md1")] }),
        createPeriod("c1", { residents: [createResident("md1")] }),
      ],
    );

    expect(uses.get("md1")).toEqual(
      createUses({ supplierOf: ["c1"], residentOf: ["c1"] }),
    );
  });
});

describe("validateContactDelete", () => {
  it("passes with no uses, and with empty lists", () => {
    expect(validateContactDelete(undefined, buildings)).toEqual({
      ok: true,
    });
    expect(validateContactDelete(createUses({}), buildings)).toEqual({
      ok: true,
    });
  });

  it("names the building by its id when the building is not listed", () => {
    expect(
      validateContactDelete(createUses({ supplierOf: ["c9"] }), []),
    ).toEqual({ ok: false, reason: "is-supplier", detail: "c9" });
  });

  it("refuses by each use in order, naming the first building", () => {
    const all = createUses({
      supplierOf: ["c2"],
      residentOf: ["c1", "c2"],
      onInvoicesOf: ["c2"],
      inEntriesOf: ["c2"],
    });

    expect(validateContactDelete(all, buildings)).toEqual({
      ok: false,
      reason: "is-resident",
      detail: "Saturno",
    });
    expect(
      validateContactDelete({ ...all, residentOf: [] }, buildings),
    ).toEqual({ ok: false, reason: "is-supplier", detail: "Pozzetto" });
    expect(
      validateContactDelete(
        { ...all, residentOf: [], supplierOf: [] },
        buildings,
      ),
    ).toEqual({ ok: false, reason: "on-invoice", detail: "Pozzetto" });
    expect(
      validateContactDelete(createUses({ inEntriesOf: ["c1"] }), buildings),
    ).toEqual({ ok: false, reason: "in-entries", detail: "Saturno" });
  });

  const buildings = [
    { id: "c1", name: "Saturno" },
    { id: "c2", name: "Pozzetto" },
  ] as Building[];
});

function createUses(over: Partial<ContactUses>): ContactUses {
  return {
    supplierOf: [],
    residentOf: [],
    onInvoicesOf: [],
    inEntriesOf: [],
    ...over,
  };
}

function createPeriod(
  buildingId: string,
  over: Partial<UsesOfPeriod>,
): UsesOfPeriod {
  return { buildingId, residents: [], invoices: [], entries: [], ...over };
}

function createResident(personId: string, id = `r-${personId}`): OwnerParty {
  return { kind: "owner", id, personId } as OwnerParty;
}

function createEntry(counterparts: Posting["counterpart"][]): JournalEntry {
  return {
    postings: counterparts.map((counterpart) => {
      return { counterpart } as Posting;
    }),
  } as JournalEntry;
}
