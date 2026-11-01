import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Contact,
  type ContactCategory,
  type ContactsPort,
  type ContactUsesById,
  type ContactView,
  contactViewsOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import type { ContactDraft } from "@cl/domain/useCases/contacts/validateContact.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import {
  type ContactsPresenter,
  type ContactsView,
  createContactsPresenter,
} from "./contactsPresenter.ts";

describe("the contacts presenter", () => {
  it("is null until the contacts, categories, uses and buildings have answered", () => {
    const { ports } = createAppHarness();
    const uses$ = new Subject<ContactUsesById>();
    const presenter = createContactsPresenter({
      contacts: {
        ...ports.contacts,
        uses: () => {
          return uses$;
        },
      },
      buildings: ports.buildings,
    });
    const views: Array<ContactsView | null> = [];
    const subscription = presenter.view$.subscribe((view) => {
      views.push(view);
    });

    expect(views.at(-1)).toBeNull();
    uses$.next(new Map());
    expect(views.at(-1)?.total).toBe(113);

    subscription.unsubscribe();
  });

  it("applies a reveal made with no subscriber when the view is subscribed to", () => {
    const harness = createAppHarness();
    const presenter = createContactsPresenter({
      contacts: harness.ports.contacts,
      buildings: harness.ports.buildings,
    });
    const target = lastContactIn(harness);

    presenter.reveal(target);

    const views: Array<ContactsView | null> = [];
    const subscription = presenter.view$.subscribe((view) => {
      views.push(view);
    });

    expect(views.at(-1)?.page).toBe(12);
    expect(views.at(-1)?.selected?.id).toBe(target);

    subscription.unsubscribe();
  });

  it("applies a reveal when the contact reaches the registry, and drops it for a choice of the person", async () => {
    const harness = createAppHarness();
    const all = await firstValueFrom(harness.ports.contacts.contacts());
    const last = must(all.at(-1), "a contact");
    const arriving$ = new BehaviorSubject<Contact[]>(
      all.filter((contact) => {
        return contact.id !== last.id;
      }),
    );

    const presenter = createContactsPresenter({
      contacts: {
        ...harness.ports.contacts,
        contacts: () => {
          return arriving$;
        },
      },
      buildings: harness.ports.buildings,
    });
    const seen: Array<ContactsView | null> = [];
    const subscription = presenter.view$.subscribe((view) => {
      seen.push(view);
    });

    function latest(): ContactsView {
      return must(seen.at(-1), "the view");
    }

    presenter.reveal(last.id);
    expect(latest().page).toBe(1);

    arriving$.next(all);
    expect(latest().selected?.id).toBe(last.id);

    presenter.reveal("md-not-yet");
    presenter.setPage(2);
    arriving$.next([...all, createStoredContact("md-not-yet")]);
    expect(latest().page).toBe(2);

    subscription.unsubscribe();
  });

  it("lands a rename made while unsubscribed on the right page", async () => {
    const { contacts, harness, view, stop } = createPresented();
    const target = must(view().rows[0], "the first row");
    const contact = must(
      harness.seed.contacts.find((candidate) => {
        return candidate.id === target.id;
      }),
      "the seed's contact",
    );

    stop();
    await harness.ports.contacts.editContact(
      target.id,
      createDraftRenamed(contact, "Zzzzz"),
    );
    contacts.reveal(target.id);

    const views: Array<ContactsView | null> = [];
    const subscription = contacts.view$.subscribe((next) => {
      views.push(next);
    });

    expect(views.at(-1)?.page).toBe(12);
    expect(views.at(-1)?.selected?.id).toBe(target.id);

    subscription.unsubscribe();
  });

  it("asks for a contact's connections once while the selection stays, whatever else changes", () => {
    const harness = createAppHarness();
    const asked: string[] = [];
    const contacts = createContactsPresenter({
      contacts: {
        ...harness.ports.contacts,
        connections: (contactId: string) => {
          asked.push(contactId);

          return harness.ports.contacts.connections(contactId);
        },
      },
      buildings: harness.ports.buildings,
    });
    const subscription = contacts.view$.subscribe();

    contacts.typeKeyword("a");
    contacts.setFilter({});
    contacts.setFilter({ status: null });
    expect(asked).toHaveLength(1);

    subscription.unsubscribe();
  });

  it("orders ties by id, names a building the port lacks by its id, and leaves out a connection to a missing contact", () => {
    const plain = createPresented();
    const [first, second, third] = plain.view().rows.map(idOf);

    plain.stop();

    const { ports } = createAppHarness();
    const { contacts, categories } = stubbedPorts(ports, {
      contactId: must(first, "a first row"),
      firstConnected: must(second, "a second row"),
      secondConnected: must(third, "a third row"),
    });
    const views: Array<ContactsView | null> = [];
    const presenter = createContactsPresenter({
      contacts,
      buildings: ports.buildings,
    });

    const subscription = presenter.view$.subscribe((view) => {
      views.push(view);
    });
    const view = must(views.at(-1), "the view");

    expect(
      view.categories.map((item) => {
        return item.category.id;
      }),
    ).toEqual(["mc1", "mc2"]);
    expect(categories).toHaveLength(2);
    expect(view.uses?.supplierOf).toEqual(["c-ghost"]);
    expect(
      view.connections.map((item) => {
        return item.connection.id;
      }),
    ).toEqual(["cr-a", "cr-b"]);

    subscription.unsubscribe();
  });

  it("lists 113 contacts in 12 pages of 10, the first row selected", () => {
    const { view, stop } = createPresented();

    expect(view().total).toBe(113);
    expect(view().allCount).toBe(113);
    expect(view().pageSize).toBe(10);
    expect(view().pageCount).toBe(12);
    expect(view().page).toBe(1);
    expect(view().rows).toHaveLength(10);
    expect(view().selected?.id).toBe(view().rows[0]?.id);
    expect(view().filter).toEqual({
      persons: true,
      companies: true,
      keyword: "",
      buildingId: null,
      status: null,
      categoryId: null,
    });

    stop();
  });

  it("gives 5 pages and page 1 at a page size of 25", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setPage(3);
    contacts.setPageSize(25);
    expect(view().pageCount).toBe(5);
    expect(view().page).toBe(1);
    expect(view().rows).toHaveLength(25);

    stop();
  });

  it("clamps a page past the end and below the start", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setPage(99);
    expect(view().page).toBe(12);
    expect(view().rows).toHaveLength(3);
    contacts.setPage(-2);
    expect(view().page).toBe(1);

    stop();
  });

  it("lists the persons alone when Companies is unticked, and goes back to page 1", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setPage(3);
    contacts.setFilter({ companies: false });
    expect(view().total).toBe(81);
    expect(view().page).toBe(1);
    expect(
      view().rows.every((row) => {
        return row.kind === "person";
      }),
    ).toBe(true);
    expect(view().allCount).toBe(113);

    stop();
  });

  it("lists nothing, with no selection, when neither box is ticked", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setFilter({ persons: false, companies: false });
    expect(view().total).toBe(0);
    expect(view().rows).toEqual([]);
    expect(view().page).toBe(1);
    expect(view().pageCount).toBe(1);
    expect(view().selected).toBeNull();
    expect(view().uses).toBeNull();
    expect(view().connections).toEqual([]);

    stop();
  });

  it("filters by the keyword only on search, and holds what was typed", () => {
    const { contacts, view, stop } = createPresented();
    const [first] = view().rows;
    const name = must(first, "a first row").name;
    const keyword = name.slice(0, 4);

    contacts.typeKeyword(keyword);
    expect(view().typedKeyword).toBe(keyword);
    expect(view().filter.keyword).toBe("");
    expect(view().total).toBe(113);

    contacts.search();
    expect(view().filter.keyword).toBe(keyword);
    expect(view().total).toBeLessThan(113);
    expect(view().rows.map(nameOf)).toContain(name);

    stop();
  });

  it("applies a category at once, and its count does not follow the other filters", () => {
    const { contacts, view, stop } = createPresented();
    const category = must(
      view().categories.find((candidate) => {
        return candidate.count > 0;
      }),
      "a category with contacts",
    );

    contacts.setFilter({ companies: false });
    contacts.setFilter({ categoryId: category.category.id });
    expect(view().total).toBeLessThanOrEqual(category.count);
    expect(
      view().categories.find((candidate) => {
        return candidate.category.id === category.category.id;
      })?.count,
    ).toBe(category.count);
    expect(view().allCount).toBe(113);
    expect(view().categories).toHaveLength(34);

    stop();
  });

  it("takes the filter back to every category when the filtered category is deleted, and keeps it when the delete is refused or another category goes", async () => {
    const { contacts, view, stop } = createPresented();
    const empty = must(
      view().categories.find((candidate) => {
        return candidate.count === 0;
      }),
      "an empty category",
    ).category;

    const other = must(
      view().categories.find((candidate) => {
        return candidate.count === 0 && candidate.category.id !== empty.id;
      }),
      "another empty category",
    ).category;

    const full = must(
      view().categories.find((candidate) => {
        return candidate.count > 0;
      }),
      "a category with contacts",
    ).category;

    contacts.setFilter({ companies: false, categoryId: full.id });

    expect(await contacts.deleteCategory(full.id)).toEqual({
      ok: false,
      reason: "category-not-empty",
      detail: expect.any(String),
    });
    expect(view().filter.categoryId).toBe(full.id);

    contacts.setFilter({ categoryId: empty.id });

    expect(await contacts.deleteCategory(other.id)).toEqual({ ok: true });
    expect(view().filter.categoryId).toBe(empty.id);

    expect(await contacts.deleteCategory(empty.id)).toEqual({ ok: true });
    expect(view().filter.categoryId).toBeNull();
    expect(view().filter.companies).toBe(false);
    expect(view().categories).toHaveLength(32);

    stop();
  });

  it("lists, for the building Pozzetto, its residents, suppliers and those on its invoices or entries", async () => {
    const { contacts, harness, view, stop } = createPresented();
    const uses = await firstValueFrom(harness.ports.contacts.uses());
    const expected = [...uses.entries()]
      .filter(([, found]) => {
        return [
          found.residentOf,
          found.supplierOf,
          found.onInvoicesOf,
          found.inEntriesOf,
        ].some((ids) => {
          return ids.includes("c19");
        });
      })
      .map(([id]) => {
        return id;
      })
      .sort();

    contacts.setPageSize(100);
    contacts.setFilter({ buildingId: "c19" });
    expect(expected.length).toBeGreaterThan(0);
    expect(view().rows.map(idOf).sort()).toEqual(expected);

    stop();
  });

  it("restores everything on reset, the typed keyword included", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setPageSize(25);
    contacts.setFilter({ companies: false, status: "archived" });
    contacts.typeKeyword("zz");
    contacts.search();
    contacts.typeKeyword("another");
    contacts.reset();

    expect(view().typedKeyword).toBe("");
    expect(view().filter).toEqual({
      persons: true,
      companies: true,
      keyword: "",
      buildingId: null,
      status: null,
      categoryId: null,
    });
    expect(view().total).toBe(113);
    expect(view().page).toBe(1);
    expect(view().pageSize).toBe(25);

    stop();
  });

  it("selects a row, and the first row of the page when a filter then hides it", () => {
    const { contacts, view, stop } = createPresented();
    const target = must(
      view().rows.find((row) => {
        return row.kind === "company";
      }) ?? view().rows[3],
      "a row to select",
    );

    contacts.select(target.id);
    expect(view().selected?.id).toBe(target.id);

    contacts.setFilter({
      [target.kind === "company" ? "companies" : "persons"]: false,
    });
    expect(view().selected?.id).toBe(view().rows[0]?.id);
    expect(view().selected?.id).not.toBe(target.id);

    stop();
  });

  it("falls to the first row of another page", () => {
    const { contacts, view, stop } = createPresented();
    const first = must(view().rows[0], "the first row");

    contacts.select(must(view().rows[4], "a fifth row").id);
    contacts.setPage(2);
    expect(view().selected?.id).toBe(view().rows[0]?.id);
    expect(view().selected?.id).not.toBe(first.id);

    stop();
  });

  it("lands on the page before, with a selection, when the only contact of the last page is deleted", async () => {
    const { contacts, harness, view, stop } = createPresented();

    // Eight new contacts sort last, so the last page holds one.
    for (let index = 1; index <= 8; index += 1) {
      await harness.ports.contacts.addContact(
        createPersonDraft(`Zzzz${index}`),
      );
    }

    expect(view().total).toBe(121);
    contacts.setPage(13);
    expect(view().page).toBe(13);
    expect(view().rows).toHaveLength(1);

    const [only] = view().rows;

    expect(
      await harness.ports.contacts.deleteContact(must(only, "the last").id),
    ).toEqual({ ok: true });
    expect(view().total).toBe(120);
    expect(view().pageCount).toBe(12);
    expect(view().page).toBe(12);
    expect(view().selected).not.toBeNull();

    stop();
  });

  it("keeps a renamed contact selected on the page it moves to, through reveal", async () => {
    const { contacts, harness, view, stop } = createPresented();
    const target = must(view().rows[0], "the first row");

    contacts.select(target.id);

    const contact = must(
      harness.seed.contacts.find((candidate) => {
        return candidate.id === target.id;
      }),
      "the seed's contact",
    );

    expect(
      await harness.ports.contacts.editContact(
        target.id,
        createDraftRenamed(contact, "Zzzzz"),
      ),
    ).toEqual({ ok: true });
    // The list re-sorted; the page did not follow.
    expect(view().rows.map(idOf)).not.toContain(target.id);

    contacts.reveal(target.id);
    expect(view().page).toBe(12);
    expect(view().selected?.id).toBe(target.id);
    expect(view().selected?.name).toContain("Zzzzz");

    stop();
  });

  it("reveals a contact a filter hides by going back to every contact first", () => {
    const { contacts, view, stop } = createPresented();
    const person = must(
      view().rows.find((row) => {
        return row.kind === "person";
      }),
      "a person",
    );

    contacts.setFilter({ persons: false });
    contacts.typeKeyword("abc");
    contacts.reveal(person.id);
    expect(view().filter.persons).toBe(true);
    expect(view().typedKeyword).toBe("");
    expect(view().selected?.id).toBe(person.id);

    stop();
  });

  it("changes nothing when revealing an unknown id", () => {
    const { contacts, view, stop } = createPresented();

    contacts.setPage(2);
    contacts.reveal("md-nobody");
    expect(view().page).toBe(2);

    stop();
  });

  it("shows the selected contact's uses by building name, and its connections by order", () => {
    const { contacts, harness, view, stop } = createPresented();
    const connection = must(harness.seed.contactConnections[0], "a connection");

    contacts.setPageSize(100);
    contacts.select(connection.contactId);
    expect(view().selected?.id).toBe(connection.contactId);
    expect(view().connections.length).toBeGreaterThan(0);

    const orders = view().connections.map((item) => {
      return item.connection.order;
    });

    expect(orders).toEqual(
      [...orders].sort((a, b) => {
        return a - b;
      }),
    );
    expect(
      view().connections.every((item) => {
        return item.connected.id === item.connection.connectedId;
      }),
    ).toBe(true);

    const withUses = must(
      view().rows.find((row) => {
        return (
          harness.seed.buildings.length > 0 && contactsUsed(harness, row.id)
        );
      }),
      "a contact with uses",
    );

    contacts.select(withUses.id);
    expect(view().uses).not.toBeNull();
    expect(
      [
        ...(view().uses?.residentOf ?? []),
        ...(view().uses?.supplierOf ?? []),
        ...(view().uses?.onInvoicesOf ?? []),
        ...(view().uses?.inEntriesOf ?? []),
      ].every((name) => {
        return harness.seed.buildings.some((building) => {
          return building.name === name;
        });
      }),
    ).toBe(true);

    stop();
  });

  it("selects a connection by id, the first row until then, and the first row again on another contact", async () => {
    const { contacts, harness, view, stop } = createPresented();

    contacts.setPageSize(100);

    const [owner, other] = view().rows.map(idOf);
    const ownerId = must(owner, "a contact");
    const otherId = must(other, "another contact");

    contacts.select(ownerId);
    expect(view().selectedConnection).toBeNull();

    for (const [order, relationship] of [
      [1, "Alpha"],
      [2, "Beta"],
    ] as const) {
      await harness.ports.contacts.addConnection(ownerId, {
        connectedId: otherId,
        relationship,
        order,
      });
    }

    expect(view().selectedConnection?.connection.relationship).toBe("Alpha");

    const second = must(view().connections[1], "the second connection");

    contacts.selectConnection(second.connection.id);
    expect(view().selectedConnection?.connection.id).toBe(second.connection.id);

    contacts.selectConnection("cr-unknown");
    expect(view().selectedConnection?.connection.relationship).toBe("Alpha");

    contacts.selectConnection(second.connection.id);
    contacts.select(otherId);
    contacts.select(ownerId);
    expect(view().selectedConnection?.connection.relationship).toBe("Alpha");

    stop();
  });

  it("falls to the first row when the selected connection is deleted, and to none with no rows", async () => {
    const { contacts, harness, view, stop } = createPresented();
    const ownerId = must(view().selected, "a contact").id;
    const otherId = must(view().rows[1], "another contact").id;

    for (const [order, relationship] of [
      [1, "Alpha"],
      [2, "Beta"],
    ] as const) {
      await harness.ports.contacts.addConnection(ownerId, {
        connectedId: otherId,
        relationship,
        order,
      });
    }

    const [first, second] = view().connections;

    contacts.selectConnection(must(second, "second").connection.id);
    expect(
      (await contacts.deleteConnection(second?.connection.id ?? "")).ok,
    ).toBe(true);
    expect(view().selectedConnection?.connection.id).toBe(first?.connection.id);

    await contacts.deleteConnection(first?.connection.id ?? "");
    expect(view().selectedConnection).toBeNull();

    stop();
  });

  it("gives a contact used nowhere empty lists", () => {
    const { contacts, harness, view, stop } = createPresented();
    const unused = must(
      view().rows.find((row) => {
        return !contactsUsed(harness, row.id);
      }),
      "an unused contact",
    );

    contacts.select(unused.id);
    expect(view().uses).toEqual({
      supplierOf: [],
      residentOf: [],
      onInvoicesOf: [],
      inEntriesOf: [],
    });

    stop();
  });
});

function stubbedPorts(
  ports: AppHarness["ports"],
  { contactId, firstConnected, secondConnected }: StubIds,
): StubbedPorts {
  const categories = [
    { id: "mc2", name: "Same" },
    { id: "mc1", name: "Same" },
  ];

  return {
    categories,
    contacts: {
      ...ports.contacts,
      categories: () => {
        return of(categories);
      },
      uses: () => {
        return of(
          new Map([
            [
              contactId,
              {
                supplierOf: ["c-ghost"],
                residentOf: [],
                onInvoicesOf: [],
                inEntriesOf: [],
              },
            ],
          ]),
        );
      },
      connections: () => {
        return of([
          {
            id: "cr-b",
            contactId,
            connectedId: firstConnected,
            relationship: "B",
            order: 1,
          },
          {
            id: "cr-ghost",
            contactId,
            connectedId: "md-ghost",
            relationship: "G",
            order: 1,
          },
          {
            id: "cr-a",
            contactId,
            connectedId: secondConnected,
            relationship: "A",
            order: 1,
          },
        ]);
      },
    },
  };
}

interface StubIds {
  contactId: string;
  firstConnected: string;
  secondConnected: string;
}

interface StubbedPorts {
  categories: ContactCategory[];
  contacts: ContactsPort;
}

interface Presented {
  harness: AppHarness;
  contacts: ContactsPresenter;
  view: () => ContactsView;
  stop: () => void;
}

function createPresented(): Presented {
  const harness = createAppHarness();
  const contacts = createContactsPresenter({
    contacts: harness.ports.contacts,
    buildings: harness.ports.buildings,
  });
  let latest: ContactsView | null = null;
  const subscription = contacts.view$.subscribe((next) => {
    latest = next;
  });

  return {
    harness,
    contacts,
    view: (): ContactsView => {
      return must(latest, "the contacts view");
    },
    stop: (): void => {
      subscription.unsubscribe();
    },
  };
}

function lastContactIn(harness: AppHarness): string {
  return must(
    contactViewsOf(harness.seed.contacts, harness.seed.contactCategories).at(
      -1,
    ),
    "the last contact",
  ).id;
}

function createStoredContact(id: string): Contact {
  return { ...createPersonDraft("Newcomer"), id, rows: [] } as Contact;
}

function contactsUsed(harness: AppHarness, id: string): boolean {
  return usedIds(harness).has(id);
}

function usedIds(harness: AppHarness): Set<string> {
  const used = new Set<string>();

  harness.ports.contacts
    .uses()
    .subscribe((uses) => {
      for (const [id, found] of uses) {
        if (
          found.residentOf.length +
            found.supplierOf.length +
            found.onInvoicesOf.length +
            found.inEntriesOf.length >
          0
        ) {
          used.add(id);
        }
      }
    })
    .unsubscribe();

  return used;
}

function idOf(row: ContactView): string {
  return row.id;
}

function nameOf(row: ContactView): string {
  return row.name;
}

function createPersonDraft(lastName: string): ContactDraft {
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

function createDraftRenamed(contact: Contact, lastName: string): ContactDraft {
  if (contact.kind === "company") {
    return {
      ...contact,
      companyName: lastName,
      rows: contact.rows.map((row) => {
        return { ...row };
      }),
    };
  }

  return {
    ...createPersonDraft(lastName),
    ...contact,
    lastName,
    rows: contact.rows.map((row) => {
      return { ...row };
    }),
  };
}
