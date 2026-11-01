import {
  BehaviorSubject,
  firstValueFrom,
  map,
  type Observable,
  of,
} from "rxjs";

import type { Building } from "#/entities/building.ts";
import type {
  Contact,
  ContactCategory,
  ContactConnection,
  ContactRow,
} from "#/entities/contact.ts";
import {
  type Added,
  accepted,
  ok,
  type Result,
  type ResultOf,
} from "#/entities/result.ts";
import type { ContactsPort } from "#/ports/contactsPort.ts";
import { must } from "#/support/must.ts";
import {
  type ContactUsesById,
  contactUsesOf,
  validateContactDelete,
} from "#/useCases/contacts/contactUses.ts";
import {
  validateCategory,
  validateCategoryDelete,
} from "#/useCases/contacts/validateCategory.ts";
import {
  type ConnectionDraft,
  validateConnection,
} from "#/useCases/contacts/validateConnection.ts";
import {
  type ContactDraft,
  type ContactRowDraft,
  validateContact,
  validateContactRow,
} from "#/useCases/contacts/validateContact.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";
import { seededResidents } from "./seededParties.ts";

/** The port, and what the other simulators read of it: the contacts as they stand now. */
export interface ContactsSimulator extends ContactsPort {
  currentContacts(): Contact[];
}

/** What a delete is judged against, read when it asks: where each contact is used, and the buildings that name it in a refusal. */
export interface ContactsReaders {
  uses$: Observable<ContactUsesById>;
  buildings(): Building[];
}

/**
 * The seed's contacts, categories and connections, with what is written kept
 * in memory. A delete is judged against `readers.uses$` as it stands then;
 * each reader left out is the seed's. New contacts are `md<n>` (the highest
 * number held plus one), categories `mc-new-<n>`, connections `cr-new-<n>`
 * and rows `mr-new-<n>`. Throws on an id it does not hold.
 */
export function createContactsSimulator(
  seed: LegacySeed,
  wired: Partial<ContactsReaders> = {},
): ContactsSimulator {
  const readers: ContactsReaders = { ...seededReaders(seed), ...wired };
  const contacts$ = new BehaviorSubject<Contact[]>(seed.contacts);
  const categories$ = new BehaviorSubject<ContactCategory[]>(
    seed.contactCategories,
  );

  const connections$ = new BehaviorSubject<ContactConnection[]>(
    seed.contactConnections,
  );
  let categoriesAdded = 0;
  let connectionsAdded = 0;
  let rowsAdded = 0;

  function contactIn(id: string): Contact {
    return must(
      contacts$.getValue().find((contact) => {
        return contact.id === id;
      }),
      `the contact ${id}`,
    );
  }

  function categoryIn(id: string): ContactCategory {
    return must(
      categories$.getValue().find((category) => {
        return category.id === id;
      }),
      `the category ${id}`,
    );
  }

  function connectionIn(id: string): ContactConnection {
    return must(
      connections$.getValue().find((connection) => {
        return connection.id === id;
      }),
      `the connection ${id}`,
    );
  }

  /** The draft's rows as the contact holds them: a new row gets its id, all by their order. */
  function rowsOf(drafts: ContactRowDraft[]): ContactRow[] {
    return drafts
      .map((row) => {
        if (row.id !== null) {
          return { ...row, id: row.id };
        }

        rowsAdded += 1;

        return { ...row, id: `mr-new-${rowsAdded}` };
      })
      .sort((a, b) => {
        return a.order - b.order;
      });
  }

  /** The first refusal of a contact draft: its own, then its first refused row. */
  function judge(draft: ContactDraft, editing: string | null): Result {
    const verdict = validateContact(draft, contacts$.getValue(), editing);

    if (!verdict.ok) {
      return verdict;
    }

    for (const row of draft.rows) {
      const rowVerdict = validateContactRow(row);

      if (!rowVerdict.ok) {
        return rowVerdict;
      }
    }

    return verdict;
  }

  function addContact(draft: ContactDraft): ResultOf<Added> {
    const verdict = judge(draft, null);

    if (!verdict.ok) {
      return verdict;
    }

    const held = contacts$.getValue();
    const id = `md${highestNumber(held) + 1}`;

    contacts$.next([...held, { ...draft, id, rows: rowsOf(draft.rows) }]);

    return accepted({ id });
  }

  function editContact(id: string, draft: ContactDraft): Result {
    const existing = contactIn(id);

    if (existing.kind !== draft.kind) {
      throw new Error(
        `kind: the contact ${id} is a ${existing.kind}, not a ${draft.kind}`,
      );
    }

    const verdict = judge(draft, id);

    if (!verdict.ok) {
      return verdict;
    }

    const edited: Contact = { ...draft, id, rows: rowsOf(draft.rows) };

    contacts$.next(
      contacts$.getValue().map((contact) => {
        return contact.id === id ? edited : contact;
      }),
    );

    return verdict;
  }

  async function deleteContact(id: string): Promise<Result> {
    contactIn(id);

    const uses = await firstValueFrom(readers.uses$);
    const verdict = validateContactDelete(uses.get(id), readers.buildings());

    if (!verdict.ok) {
      return verdict;
    }

    // The connections go before the contact, so no reader sees one to a contact that is gone.
    connections$.next(
      connections$.getValue().filter((connection) => {
        return connection.contactId !== id && connection.connectedId !== id;
      }),
    );
    contacts$.next(
      contacts$.getValue().filter((contact) => {
        return contact.id !== id;
      }),
    );

    return verdict;
  }

  function addCategory(name: string): ResultOf<Added> {
    const verdict = validateCategory(name, categories$.getValue(), null);

    if (!verdict.ok) {
      return verdict;
    }

    categoriesAdded += 1;

    const id = `mc-new-${categoriesAdded}`;

    categories$.next([...categories$.getValue(), { id, name: name.trim() }]);

    return accepted({ id });
  }

  function editCategory(id: string, name: string): Result {
    categoryIn(id);

    const verdict = validateCategory(name, categories$.getValue(), id);

    if (verdict.ok) {
      categories$.next(
        categories$.getValue().map((category) => {
          return category.id === id
            ? { ...category, name: name.trim() }
            : category;
        }),
      );
    }

    return verdict;
  }

  function deleteCategory(id: string): Result {
    const verdict = validateCategoryDelete(
      categoryIn(id),
      contacts$.getValue(),
    );

    if (verdict.ok) {
      categories$.next(
        categories$.getValue().filter((category) => {
          return category.id !== id;
        }),
      );
    }

    return verdict;
  }

  function addConnection(
    contactId: string,
    draft: ConnectionDraft,
  ): ResultOf<Added> {
    contactIn(contactId);

    const verdict = validateConnection(
      contactId,
      draft,
      connections$.getValue(),
      null,
    );

    if (!verdict.ok) {
      return verdict;
    }

    connectionsAdded += 1;

    const id = `cr-new-${connectionsAdded}`;

    connections$.next([
      ...connections$.getValue(),
      {
        id,
        contactId,
        connectedId: must(draft.connectedId, "the draft's contact"),
        relationship: draft.relationship.trim(),
        order: draft.order,
      },
    ]);

    return accepted({ id });
  }

  function editConnection(id: string, draft: ConnectionDraft): Result {
    const existing = connectionIn(id);
    const verdict = validateConnection(
      existing.contactId,
      draft,
      connections$.getValue(),
      id,
    );

    if (verdict.ok) {
      connections$.next(
        connections$.getValue().map((connection) => {
          return connection.id === id
            ? {
                ...connection,
                connectedId: must(draft.connectedId, "the draft's contact"),
                relationship: draft.relationship.trim(),
                order: draft.order,
              }
            : connection;
        }),
      );
    }

    return verdict;
  }

  function deleteConnection(id: string): Result {
    connectionIn(id);
    connections$.next(
      connections$.getValue().filter((connection) => {
        return connection.id !== id;
      }),
    );

    return ok();
  }

  return {
    contacts: (): Observable<Contact[]> => {
      return contacts$.asObservable();
    },
    categories: (): Observable<ContactCategory[]> => {
      return categories$.asObservable();
    },
    connections: (contactId: string): Observable<ContactConnection[]> => {
      return connections$.pipe(
        map((all) => {
          return all
            .filter((connection) => {
              return connection.contactId === contactId;
            })
            .sort((a, b) => {
              return a.order - b.order;
            });
        }),
      );
    },
    uses: (): Observable<ContactUsesById> => {
      return readers.uses$;
    },
    // A throw inside the executor is a rejection, as the port promises.
    addContact: (draft: ContactDraft): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addContact(draft));
      });
    },
    editContact: (id: string, draft: ContactDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editContact(id, draft));
      });
    },
    deleteContact,
    addCategory: (name: string): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addCategory(name));
      });
    },
    editCategory: (id: string, name: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editCategory(id, name));
      });
    },
    deleteCategory: (id: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteCategory(id));
      });
    },
    addConnection: (
      contactId: string,
      draft: ConnectionDraft,
    ): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addConnection(contactId, draft));
      });
    },
    editConnection: (id: string, draft: ConnectionDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editConnection(id, draft));
      });
    },
    deleteConnection: (id: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteConnection(id));
      });
    },
    currentContacts: (): Contact[] => {
      return contacts$.getValue();
    },
  };
}

/** The seed's use of each contact and its buildings: what a delete is judged against when nothing else is wired in. */
function seededReaders(seed: LegacySeed): ContactsReaders {
  return {
    uses$: of(
      contactUsesOf(
        seed.supplierLinks,
        seed.buildings.flatMap((building) => {
          return building.periods.map((period) => {
            return {
              buildingId: building.id,
              residents: seededResidents(seed, period.id),
              invoices: seed.invoices.filter((invoice) => {
                return invoice.periodId === period.id;
              }),
              entries: seed.entries.filter((entry) => {
                return entry.periodId === period.id;
              }),
            };
          });
        }),
      ),
    ),
    buildings: (): Building[] => {
      return seed.buildings;
    },
  };
}

/** The highest number among the ids `md<n>`; 0 with none. */
function highestNumber(contacts: Contact[]): number {
  return Math.max(
    0,
    ...contacts.map((contact) => {
      return Number(/^md(\d+)$/.exec(contact.id)?.[1] ?? 0);
    }),
  );
}
