import type { ContactConnection } from "#/entities/contact.ts";

import { describeContactsPortContract } from "../ports/__contracts__/ContactsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createContactsSimulator } from "./contactsSimulator.ts";

describeContactsPortContract("contacts simulator", () => {
  const seed = {
    ...createSmallSeed(),
    contactCategories: [
      { id: "mc1", name: "Gardener" },
      { id: "mc2", name: "Electrician" },
    ],
    contactConnections: createConnections(),
  };

  return {
    port: createContactsSimulator(seed),
    expected: seed.contacts,
    expectedCategories: seed.contactCategories,
    connections: seed.contactConnections,
    teardown: (): void => {},
  };
});

function createConnections(): ContactConnection[] {
  return [
    {
      id: "cr2",
      contactId: "md1",
      connectedId: "md10",
      relationship: "Employee",
      order: 2,
    },
    {
      id: "cr1",
      contactId: "md1",
      connectedId: "md11",
      relationship: "Managing director",
      order: 1,
    },
    {
      id: "cr3",
      contactId: "md2",
      connectedId: "md10",
      relationship: "Employee",
      order: 1,
    },
  ];
}
