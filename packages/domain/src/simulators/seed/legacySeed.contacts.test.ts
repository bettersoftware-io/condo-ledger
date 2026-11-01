import { describe, expect, it } from "vitest";

import type { Contact } from "#/entities/contact.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's contacts", () => {
  it("holds every contact of the dump: 81 people and 32 companies", () => {
    expect(seed.contacts).toHaveLength(113);
    expect(countOf("person")).toBe(81);
    expect(countOf("company")).toBe(32);
  });

  it("holds 111 active contacts and 2 archived", () => {
    expect(countWhere("active")).toBe(111);
    expect(countWhere("archived")).toBe(2);
  });

  it("gives 29 contacts a code, each different", () => {
    const codes = seed.contacts
      .map((contact) => {
        return contact.code;
      })
      .filter((code): code is string => {
        return code !== null;
      });

    expect(codes).toHaveLength(29);
    expect(new Set(codes).size).toBe(29);
  });

  it("holds the 34 categories, and every contact's category is among them", () => {
    const ids = new Set(
      seed.contactCategories.map((category) => {
        return category.id;
      }),
    );

    expect(seed.contactCategories).toHaveLength(34);
    expect(ids.size).toBe(34);

    for (const contact of seed.contacts) {
      expect(contact.categoryId === null || ids.has(contact.categoryId)).toBe(
        true,
      );
    }
  });

  it("holds 47 rows, each contact's by their order", () => {
    const rows = seed.contacts.flatMap((contact) => {
      return contact.rows;
    });

    expect(rows).toHaveLength(47);

    for (const contact of seed.contacts) {
      expect(
        contact.rows.map((row) => {
          return row.order;
        }),
      ).toEqual(
        contact.rows
          .map((row) => {
            return row.order;
          })
          .sort((a, b) => {
            return a - b;
          }),
      );
    }
  });

  it("holds the one connection, showing on the contact the legacy row points to", () => {
    expect(seed.contactConnections).toEqual([
      {
        id: "cr1",
        contactId: "md12",
        connectedId: "md15",
        relationship: "Employee",
        order: 1,
      },
    ]);
  });

  it("holds the 9 salutations, once each", () => {
    expect(seed.salutations).toHaveLength(9);
    expect(new Set(seed.salutations).size).toBe(9);
  });

  it("lists the salutations most used first", () => {
    const held = new Map<string, number>();

    for (const contact of seed.contacts) {
      if (contact.salutation !== null) {
        held.set(contact.salutation, (held.get(contact.salutation) ?? 0) + 1);
      }
    }

    const most = Math.max(...held.values());

    expect(held.get(seed.salutations[0] ?? "")).toBe(most);
    expect(
      seed.salutations.map((salutation) => {
        return held.get(salutation) ?? 0;
      }),
    ).toEqual(
      seed.salutations
        .map((salutation) => {
          return held.get(salutation) ?? 0;
        })
        .sort((a, b) => {
          return b - a;
        }),
    );
  });

  it("gives every person a last name", () => {
    for (const contact of seed.contacts) {
      if (contact.kind === "person") {
        expect(contact.lastName, contact.id).not.toBe("");
      }
    }
  });

  it("keeps the two seeded buildings' suppliers: 6 for Saturno and 12 for Pozzetto", () => {
    expect(linksOf("c1")).toBe(6);
    expect(linksOf("c19")).toBe(12);
  });
});

const seed = loadLegacySeed(legacySeedData);

function countOf(kind: Contact["kind"]): number {
  return seed.contacts.filter((contact) => {
    return contact.kind === kind;
  }).length;
}

function countWhere(status: Contact["status"]): number {
  return seed.contacts.filter((contact) => {
    return contact.status === status;
  }).length;
}

function linksOf(buildingId: string): number {
  return seed.supplierLinks.filter((link) => {
    return link.buildingId === buildingId;
  }).length;
}
