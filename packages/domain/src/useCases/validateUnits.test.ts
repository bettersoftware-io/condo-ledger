import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import type { JournalEntry } from "../entities/journal.ts";
import type { OwnerParty } from "../entities/party.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import {
  type GroupDraft,
  type ResidencyDraft,
  type UnitDraft,
  validateGroup,
  validateGroupDelete,
  validateResidency,
  validateResidencyDelete,
  validateUnit,
  validateUnitDelete,
} from "./validateUnits.ts";

describe("validateGroup", () => {
  it("accepts a group with a code and a name of its own", () => {
    expect(validateGroup(createGroup({}), null, saturnoGroups, null)).toEqual({
      ok: true,
    });
  });

  it("refuses a blank code and a blank name", () => {
    expect(
      validateGroup(createGroup({ code: " " }), null, saturnoGroups, null),
    ).toEqual({ ok: false, reason: "blank-code" });
    expect(
      validateGroup(createGroup({ name: "" }), null, saturnoGroups, null),
    ).toEqual({ ok: false, reason: "blank-name" });
  });

  it("refuses the code or the name of a sibling, by case", () => {
    expect(
      validateGroup(createGroup({ code: "a" }), null, saturnoGroups, null),
    ).toEqual({ ok: false, reason: "group-taken", detail: "a" });
    expect(
      validateGroup(
        createGroup({ name: " stairwell a " }),
        null,
        saturnoGroups,
        null,
      ),
    ).toEqual({ ok: false, reason: "group-taken", detail: "stairwell a" });
  });

  it("lets the edited group keep its code, and another parent reuse it", () => {
    expect(
      validateGroup(
        createGroup({ code: "A", name: "Stairwell A" }),
        null,
        saturnoGroups,
        "ug1",
      ),
    ).toEqual({ ok: true });
    expect(
      validateGroup(createGroup({ code: "A" }), "ug2", saturnoGroups, null),
    ).toEqual({ ok: true });
  });
});

describe("validateGroupDelete", () => {
  it("refuses a group that holds a unit or a group, and accepts an empty one", () => {
    expect(validateGroupDelete("ug1", saturnoGroups, saturnoUnits)).toEqual({
      ok: false,
      reason: "group-not-empty",
    });

    const child = {
      ...must(saturnoGroups[0], "group"),
      id: "ug-child",
      parentId: "ug2",
    };

    expect(validateGroupDelete("ug2", [...saturnoGroups, child], [])).toEqual({
      ok: false,
      reason: "group-not-empty",
    });
    expect(validateGroupDelete("ug-child", [child], [])).toEqual({ ok: true });
  });
});

describe("validateUnit", () => {
  it("accepts a new code, and an edited unit keeping its own", () => {
    expect(validateUnit(createUnit({}), saturnoUnits, SATURNO, null)).toEqual({
      ok: true,
    });
    expect(
      validateUnit(createUnit({ code: "A1" }), saturnoUnits, SATURNO, "u1"),
    ).toEqual({ ok: true });
  });

  it("refuses a blank code", () => {
    expect(
      validateUnit(createUnit({ code: " " }), saturnoUnits, SATURNO, null),
    ).toEqual({ ok: false, reason: "blank-code" });
  });

  it("refuses the code of another unit, by case", () => {
    expect(
      validateUnit(createUnit({ code: " a1" }), saturnoUnits, SATURNO, null),
    ).toEqual({ ok: false, reason: "unit-code-taken", detail: "a1" });
  });

  it("refuses an end before the start", () => {
    expect(
      validateUnit(
        createUnit({ restriction: { from: "2011-06-01", to: "2011-05-01" } }),
        saturnoUnits,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "bad-dates" });
  });

  it("refuses dates outside the period", () => {
    expect(
      validateUnit(
        createUnit({ restriction: { from: "2011-12-01", to: "2012-01-31" } }),
        saturnoUnits,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "outside-period" });
    expect(
      validateUnit(
        createUnit({ restriction: { from: "2010-12-31", to: null } }),
        saturnoUnits,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "outside-period" });
  });
});

describe("validateResidency", () => {
  it("accepts a contact who does not live in the unit yet", () => {
    expect(
      validateResidency(
        createResidency({ contactId: "md9" }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: true });
    expect(
      validateResidency(
        createResidency({ contactId: "md4" }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: true });
  });

  it("refuses no contact", () => {
    expect(
      validateResidency(
        createResidency({ contactId: null }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "no-contact" });
  });

  it("refuses a contact already in the unit, unless it is the edited residency", () => {
    expect(
      validateResidency(
        createResidency({ contactId: "md3" }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "already-resident", detail: "md3" });
    expect(
      validateResidency(
        createResidency({ contactId: "md3" }),
        "u1",
        residents,
        SATURNO,
        "r1",
      ),
    ).toEqual({ ok: true });
  });

  it("refuses an end before the start and dates outside the period", () => {
    expect(
      validateResidency(
        createResidency({
          ownRestriction: { from: "2011-06-01", to: "2011-05-01" },
        }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "bad-dates" });
    expect(
      validateResidency(
        createResidency({
          ownRestriction: { from: "2011-12-01", to: "2012-01-31" },
        }),
        "u1",
        residents,
        SATURNO,
        null,
      ),
    ).toEqual({ ok: false, reason: "outside-period" });
  });

  const residents = [
    createOwner({ id: "r1", personId: "md3", unitId: "u1" }),
    createOwner({ id: "r2", personId: "md4", unitId: "u2" }),
  ];
});

describe("validateResidencyDelete", () => {
  it("refuses a resident the journal names, with their name", () => {
    const r166 = must(
      pozzetto.find((owner) => {
        return owner.id === "r166";
      }),
      "r166",
    );

    expect(validateResidencyDelete(r166, entries, items)).toEqual({
      ok: false,
      reason: "named-in-journal",
      detail: r166.name,
    });
  });

  it("refuses a resident with installments but no postings", () => {
    const fresh = createOwner({ id: "r-new-1", name: "Fresh Owner" });
    const item = {
      id: "i1",
      installmentId: "n1",
      residentId: "r-new-1",
      amount: cents(100),
    };

    expect(validateResidencyDelete(fresh, [], [item])).toEqual({
      ok: false,
      reason: "has-installments",
      detail: "Fresh Owner",
    });
  });

  it("accepts a resident nothing names", () => {
    expect(
      validateResidencyDelete(createOwner({ id: "r-new-1" }), [], []),
    ).toEqual({ ok: true });
  });

  const pozzetto = seedOwners("p36");

  const entries = seed.entries.filter((entry) => {
    return entry.periodId === "p36";
  });

  const items = seed.installmentItems;
});

describe("validateUnitDelete", () => {
  it("answers the first resident's refusal, and accepts a unit with none", () => {
    const named = createOwner({ id: "r5", unitId: "u5", name: "Named" });
    const free = createOwner({ id: "r6", unitId: "u5", name: "Free" });
    const other = createOwner({ id: "r7", unitId: "u6", name: "Other" });
    const entry: JournalEntry = {
      id: "e1",
      periodId: "p1",
      number: 1,
      at: "2011-02-01",
      kind: "generic",
      description: "x",
      invoiceId: null,
      postings: [
        {
          accountId: "a1",
          debit: cents(1),
          credit: cents(0),
          counterpart: { kind: "owner", id: "r5" },
        },
      ],
    };

    expect(validateUnitDelete("u5", [free, named, other], [entry], [])).toEqual(
      { ok: false, reason: "named-in-journal", detail: "Named" },
    );
    expect(validateUnitDelete("u6", [free, named, other], [], [])).toEqual({
      ok: true,
    });
    expect(validateUnitDelete("u9", [free, named], [entry], [])).toEqual({
      ok: true,
    });
  });
});

const seed = loadLegacySeed(legacySeedData);
const SATURNO = { start: "2011-01-01", end: "2011-12-31" };
const saturnoGroups = seed.unitGroups.filter((group) => {
  return group.periodId === "p1";
});

const saturnoUnits = seed.units.filter((unit) => {
  return unit.periodId === "p1";
});

function seedOwners(periodId: string): OwnerParty[] {
  const parties = must(
    seed.parties.find((held) => {
      return held.periodId === periodId;
    }),
    "parties",
  ).parties;

  return parties.flatMap((party) => {
    return party.kind === "owner" ? [party] : [];
  });
}

function createGroup(changes: Partial<GroupDraft>): GroupDraft {
  return { code: "C", name: "Cellars", address: null, notes: null, ...changes };
}

function createUnit(changes: Partial<UnitDraft>): UnitDraft {
  return {
    code: "Z9",
    name: null,
    floor: null,
    interior: null,
    subUnit: null,
    restriction: null,
    type: "apartment",
    cadastralData: null,
    notes: null,
    ...changes,
  };
}

function createResidency(changes: Partial<ResidencyDraft>): ResidencyDraft {
  return {
    contactId: "md9",
    role: "PR",
    startingBalance: cents(0),
    ownRestriction: null,
    ...changes,
  };
}

function createOwner(changes: Partial<OwnerParty>): OwnerParty {
  return {
    kind: "owner",
    id: "r0",
    personId: "md0",
    name: "Owner",
    unitCode: "A1",
    unitId: "u1",
    startingBalance: cents(0),
    role: "PR",
    share: null,
    restriction: null,
    ownRestriction: null,
    ...changes,
  };
}
