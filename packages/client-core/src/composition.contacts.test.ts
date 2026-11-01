import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Party, ScheduleNode } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import type { ContactDraft } from "@cl/domain/useCases/contacts/validateContact.ts";
import type { JournalEntryView } from "@cl/domain/useCases/journal.ts";
import type { UnitsRow } from "@cl/domain/useCases/units/unitsList.ts";

import { createAppHarness } from "./testing/appHarness.ts";

describe("a resident's name is its contact's", () => {
  it("is the held name until the contacts say otherwise, and keeps the held name for a person the contacts lack", async () => {
    const seed = createSmallSeed();
    const { ports } = createAppHarness({
      ...seed,
      contacts: seed.contacts.filter((contact) => {
        return contact.id !== "md11";
      }),
    });
    const residents = await firstValueFrom(ports.units.residents("p1"));

    expect(
      residents.map((resident) => {
        return resident.name;
      }),
    ).toEqual(["Rossi Mario", "Rossi Mario", "Bianchi Anna"]);
  });

  it("follows a rename on the units port, the accounts parties, the Units view, the schedule and the journal, without another subscribe", async () => {
    const { app, ports } = createAppHarness(createSmallSeed());

    app.presenters.buildings.selectPeriod("p1");

    const residents: string[][] = [];
    let parties: Party[] = [];
    let unitRows: UnitsRow[] = [];
    let scheduleNodes: ScheduleNode[] = [];
    let entries: JournalEntryView[] = [];
    const subscriptions = [
      ports.units.residents("p1").subscribe((next) => {
        residents.push(
          next.map((resident) => {
            return resident.name;
          }),
        );
      }),
      ports.accounts.parties("p1").subscribe((next) => {
        parties = next;
      }),
      app.presenters.units.view$.subscribe((view) => {
        unitRows = flatten(view?.list.root, (row) => {
          return row.children;
        });
      }),
      app.presenters.schedule.schedule$.subscribe((schedule) => {
        scheduleNodes = flatten(schedule?.root, (node) => {
          return node.children;
        });
      }),
      app.presenters.journal.entries$.subscribe((next) => {
        entries = next;
      }),
    ];

    expect(
      await ports.contacts.editContact("md10", createPersonDraft()),
    ).toEqual({ ok: true });

    expect(residents.at(-1)).toEqual([
      "Verdi Luca",
      "Verdi Luca",
      "Bianchi Anna",
    ]);
    expect(
      parties
        .filter((party) => {
          return party.kind === "owner";
        })
        .map((party) => {
          return party.name;
        }),
    ).toEqual(["Verdi Luca", "Verdi Luca", "Bianchi Anna"]);
    expect(
      unitRows.some((row) => {
        return row.label.includes("Verdi Luca");
      }),
    ).toBe(true);
    expect(
      scheduleNodes.some((node) => {
        return node.kind === "resident" && node.label.includes("Verdi Luca");
      }),
    ).toBe(true);
    expect(
      entries
        .flatMap((entry) => {
          return entry.postings;
        })
        .some((posting) => {
          return posting.path.includes("Verdi Luca");
        }),
    ).toBe(true);
    expect(JSON.stringify([unitRows, scheduleNodes, entries])).not.toContain(
      "Rossi Mario",
    );

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
  });
});

function flatten<T>(root: T | undefined, childrenOf: (node: T) => T[]): T[] {
  if (root === undefined) {
    return [];
  }

  return [
    root,
    ...childrenOf(root).flatMap((child) => {
      return flatten(child, childrenOf);
    }),
  ];
}

function createPersonDraft(): ContactDraft {
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
    rows: [],
    firstName: "Luca",
    lastName: "Verdi",
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
  };
}
