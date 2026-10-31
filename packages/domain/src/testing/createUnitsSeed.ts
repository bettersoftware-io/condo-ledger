import { cents } from "#/entities/cents.ts";
import type { Contact } from "#/entities/contact.ts";
import type { OwnerParty } from "#/entities/party.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createTablesSeed } from "./createTablesSeed.ts";

/**
 * The tables seed with what the units port is driven through: an empty group
 * ugC "C" in p1; a fourth resident, r4 (Neri Paolo, md13), in uB01, whom no
 * posting names but who owes 100.00 on Rata 1 (ii3); and a contact, Verdi
 * Luca (md12), who lives in no unit. The journal names r1, r2 and r3.
 */
export function createUnitsSeed(): LegacySeed {
  const seed = createTablesSeed();

  return {
    ...seed,
    unitGroups: [
      ...seed.unitGroups,
      {
        id: "ugC",
        periodId: "p1",
        code: "C",
        name: "C",
        parentId: null,
        address: null,
        notes: null,
      },
    ],
    parties: seed.parties.map((list) => {
      return list.periodId === "p1"
        ? { ...list, parties: [...list.parties, createFourthResident()] }
        : list;
    }),
    installmentItems: [
      ...seed.installmentItems,
      {
        id: "ii3",
        installmentId: "in1",
        residentId: "r4",
        amount: cents(10000),
      },
    ],
    contacts: [
      ...seed.contacts,
      createPerson("md12", "Verdi Luca"),
      createPerson("md13", "Neri Paolo"),
    ],
  };
}

function createFourthResident(): OwnerParty {
  return {
    kind: "owner",
    id: "r4",
    personId: "md13",
    name: "Neri Paolo",
    unitCode: "B01",
    unitId: "uB01",
    startingBalance: cents(0),
    role: "CO",
    share: null,
    restriction: null,
    ownRestriction: null,
  };
}

function createPerson(id: string, name: string): Contact {
  return {
    id,
    kind: "person",
    name,
    status: "active",
    code: null,
    category: null,
    companyName: null,
    registeredOffice: null,
    taxDomicile: null,
    phone: null,
    email: null,
  };
}
