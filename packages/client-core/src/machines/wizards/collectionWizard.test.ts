import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  cents,
  type EntryAdded,
  type EntryDraft,
  fixedClock,
  type JournalEntry,
  type ResultOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  type CollectionForm,
  type CollectionSummary,
  createCollectionWizard,
  fitsCollection,
  type PersonRow,
  type SettlementRow,
} from "./collectionWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the Record owner collection wizard", () => {
  it("starts on step 1 of 3 with no owner, the bank account chosen, and the persons who owe something in unit order", () => {
    const { machine, harness } = createWizard();
    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      step: 1,
      firstStep: 1,
      stepCount: 3,
      editing: null,
      form: {
        personId: null,
        accountId: "la156",
        amount: "",
        description: "",
        edited: [],
      },
      stepVerdict: { ok: false, reason: "no-owner" },
      verdict: { ok: false, reason: "no-owner" },
      summary: { person: null, owed: null, settlement: [] },
      preview: [],
    });
    expect(
      state.summary.people.map((row) => {
        return row.personId;
      }),
    ).toEqual([
      "md89",
      "md90",
      "md92",
      "md94",
      "md93",
      "md95",
      "md96",
      "md99",
      "md101",
      "md104",
      "md105",
      "md106",
      "md107",
      "md109",
      "md108",
      "md110",
      "md112",
      "md114",
      "md113",
    ]);

    const md109: PersonRow = {
      personId: "md109",
      name: personName(harness, "md109"),
      units: ["A14", "A15"],
      total: cents(81939),
      paid: cents(19255),
      remaining: cents(62684),
    };

    expect(personRow(machine, "md109")).toEqual(md109);
  });

  it("leaves out a person whose items are all zero, and one who has paid them all", () => {
    const { machine } = createWizard();
    const listed = new Set(
      machine.state$.getValue().summary.people.map((row) => {
        return row.personId;
      }),
    );

    for (const personId of ["md91", "md97", "md98", "md100", "md111"]) {
      expect(listed.has(personId)).toBe(false);
    }
  });

  it("step 1 is no-owner until a listed person is chosen", () => {
    const { machine } = createWizard();

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(1);

    machine.intents.edit({ personId: "md91" });
    expect(machine.state$.getValue()).toMatchObject({
      stepVerdict: { ok: false, reason: "no-owner" },
      summary: { owed: 0 },
    });

    machine.intents.edit({ personId: "md-none" });
    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-owner" },
      summary: { person: null, owed: null },
    });

    machine.intents.edit({ personId: "md89" });
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);
  });

  it("choosing a person prefills the bank account, what they owe on items due by today, and the description of what it settles", () => {
    const { machine, harness } = createWizard();

    machine.intents.edit({ personId: "md89" });

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        personId: "md89",
        accountId: "la156",
        amount: "539.92",
        description: `Collection of installments from ${personName(harness, "md89")}: Rata 9 (20/09/2013), Rata 10 (20/10/2013), Rata 11 (20/11/2013), Rata 12 (20/12/2013)`,
        edited: ["personId"],
      },
      summary: { person: personName(harness, "md89"), owed: 53992 },
      stepVerdict: { ok: true },
      verdict: { ok: true },
    });

    machine.intents.edit({ personId: "md104" });

    expect(machine.state$.getValue().form).toMatchObject({
      amount: "305.84",
      description: `Collection of installments from ${personName(harness, "md104")}: Rata 10 (20/10/2013), Rata 11 (20/11/2013), Rata 12 (20/12/2013)`,
    });
  });

  it("prefills only the items due by today, today's included", () => {
    const harness = createP36Harness("2013-10-20T10:00:00Z");
    const machine = createNewWizard(harness);

    machine.intents.edit({ personId: "md89" });

    expect(machine.state$.getValue().form.amount).toBe("269.96");
  });

  it("with nothing due yet, prefills the remaining of the person's first open item", () => {
    const harness = createP36Harness("2012-12-01T10:00:00Z");
    const machine = createNewWizard(harness);

    machine.intents.edit({ personId: "md96" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { amount: "34.75" },
      summary: { owed: 91495 },
    });
  });

  it("the settlement follows the amount: fewer items for less, the last one partial", () => {
    const { machine } = createWizard();

    machine.intents.edit({ personId: "md89" });

    expect(machine.state$.getValue().summary.settlement).toEqual([
      createRow("ii763", "Rata 9", "2013-09-20", 13498, 13498),
      createRow("ii790", "Rata 10", "2013-10-20", 13498, 13498),
      createRow("ii817", "Rata 11", "2013-11-20", 13498, 13498),
      createRow("ii844", "Rata 12", "2013-12-20", 13498, 13498),
    ]);

    machine.intents.edit({ amount: "200" });

    expect(machine.state$.getValue().summary.settlement).toEqual([
      createRow("ii763", "Rata 9", "2013-09-20", 13498, 13498),
      createRow("ii790", "Rata 10", "2013-10-20", 13498, 6502),
    ]);
  });

  it("step 2 names the liquidity account, then the amount, then one cent above what the person owes (Review Focus 3)", () => {
    const { machine } = createWizard();

    machine.intents.edit({ personId: "md89" });
    machine.intents.next();

    expect(stepReasonAfter(machine, { accountId: null })).toBe(
      "no-liquidity-account",
    );
    expect(stepReasonAfter(machine, { accountId: "la158" })).toBe(
      "no-liquidity-account",
    );
    expect(stepReasonAfter(machine, { accountId: "la154", amount: "0" })).toBe(
      "not-an-amount",
    );
    expect(stepReasonAfter(machine, { amount: "abc" })).toBe("not-an-amount");
    expect(machine.state$.getValue().summary.settlement).toEqual([]);
    expect(stepReasonAfter(machine, { amount: "539.93" })).toBe("over-owed");
    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "over-owed" },
      summary: { settlement: [] },
    });
    expect(stepReasonAfter(machine, { amount: "539.92" })).toBeNull();
    expect(machine.state$.getValue().summary.settlement).toHaveLength(4);
  });

  it("an amount and a description the person typed stay when the person changes", () => {
    const { machine } = createWizard();

    machine.intents.edit({ personId: "md89" });
    machine.intents.edit({ amount: "50", description: "Acconto" });
    machine.intents.edit({ personId: "md90" });

    expect(machine.state$.getValue().form).toMatchObject({
      personId: "md90",
      amount: "50",
      description: "Acconto",
      edited: ["personId", "amount", "description"],
    });
  });

  it("a blank description is step 3's: step 2 passes it; step 3 and the save refuse it", async () => {
    const { machine } = createWizard();

    machine.intents.edit({ personId: "md89", description: " " });
    machine.intents.next();

    expect(machine.state$.getValue().stepVerdict).toEqual({ ok: true });

    machine.intents.next();

    expect(machine.state$.getValue()).toMatchObject({
      step: 3,
      stepVerdict: { ok: false, reason: "blank-description" },
    });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "blank-description",
    });
  });

  it("p1's md3: the settlement walks due date, then unit code, across r1, r2, r6 and r8 (Review Focus 4)", () => {
    const machine = createNewWizard(createAppHarness());

    machine.intents.edit({ personId: "md3" });

    expect(
      machine.state$.getValue().summary.settlement.map((row) => {
        return [row.itemId, row.installment, row.unitCode, row.dueDate];
      }),
    ).toEqual([
      ["ii41", "Rata nr. 2", "A1", "2011-07-15"],
      ["ii42", "Rata nr. 2", "A2", "2011-07-15"],
      ["ii46", "Rata nr. 2", "B1", "2011-07-15"],
      ["ii48", "Rata nr. 2", "B2", "2011-07-15"],
      ["ii51", "Rata nr. 3", "A1", "2011-12-15"],
      ["ii52", "Rata nr. 3", "A2", "2011-12-15"],
      ["ii56", "Rata nr. 3", "B1", "2011-12-15"],
      ["ii58", "Rata nr. 3", "B2", "2011-12-15"],
    ]);
  });

  it("previews the liquidity account debited and one owner credit per item", () => {
    const { machine } = createWizard();

    machine.intents.edit({ personId: "md89", amount: "200" });

    expect(
      machine.state$.getValue().preview.map((line) => {
        return [line.path.endsWith("A01"), line.debit, line.credit];
      }),
    ).toEqual([
      [false, 20000, 0],
      [true, 0, 13498],
      [true, 0, 6502],
    ]);
  });

  it("a save lands, and what the person still owes falls by the amount", async () => {
    const harness = createP36Harness();
    const machine = createNewWizard(harness);

    machine.intents.edit({ personId: "md89", amount: "100" });

    const saved = await machine.intents.save();

    expect(saved.ok).toBe(true);
    expect(currentEntry(harness, saved.ok ? saved.value.id : "")).toMatchObject(
      {
        kind: "collection",
        postings: [
          { accountId: "la156", debit: 10000, credit: 0, counterpart: null },
          {
            accountId: "la158",
            debit: 0,
            credit: 10000,
            counterpart: { kind: "owner", id: "r162" },
            installmentItemId: "ii763",
          },
        ],
      },
    );
    expect(personRow(createNewWizard(harness), "md89")).toMatchObject({
      paid: 28669 + 10000,
      remaining: 53992 - 10000,
    });
  });

  it("an owed amount another collection made stale is refused by the port, and the summary says what the person owes now (Review Focus 1)", async () => {
    const harness = createP36Harness();
    const machine = createNewWizard(harness);

    machine.intents.edit({ personId: "md89" });

    const elsewhere = await harness.ports.journal.addEntry(
      "p36",
      createCollectionOfMd89(),
    );

    expect(elsewhere.ok).toBe(true);
    expect(machine.state$.getValue().summary.owed).toBe(53992);
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "over-remaining-item",
    });

    const state = machine.state$.getValue();

    expect(state.saving).toBe(false);
    expect(state.summary.owed).toBe(0);
    expect(personRowOrNull(machine, "md89")).toBeNull();
    expect(state.summary.person).toBe(personName(harness, "md89"));
    expect(state.verdict).toEqual({ ok: false, reason: "over-owed" });
  });

  it("a new collection is written through the write it is given", async () => {
    const harness = createP36Harness();
    const drafts: EntryDraft[] = [];

    function write(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
      drafts.push(draft);

      return Promise.resolve(accepted({ id: "new1" }));
    }

    const machine = createCollectionWizard(
      currentBooks(harness),
      harness.ports.clock,
      write,
      null,
    );

    created.push(machine);
    machine.intents.edit({ personId: "md89" });

    expect(await machine.intents.save()).toEqual(accepted({ id: "new1" }));
    expect(drafts[0]).toMatchObject({
      kind: "collection",
      postings: [{ debit: 53992 }, {}, {}, {}, {}],
    });
  });

  it("with no owners account, a chosen person is refused for it", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const machine = createCollectionWizard(
      {
        ...books,
        accounts: books.accounts.map((account) => {
          return account.role === "owners"
            ? { ...account, role: null }
            : account;
        }),
      },
      harness.ports.clock,
      neverWrite,
      null,
    );

    created.push(machine);
    machine.intents.edit({ personId: "md89" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-owners-account" },
      preview: [],
    });
  });

  it("with no books: no choices, no people, no account", () => {
    const harness = createP36Harness();
    const machine = createCollectionWizard(
      null,
      harness.ports.clock,
      neverWrite,
      null,
    );

    created.push(machine);
    machine.intents.edit({ personId: "md89" });

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      form: { accountId: null, amount: "", description: "" },
      verdict: { ok: false, reason: "no-owner" },
      summary: { people: [], person: null, owed: null, settlement: [] },
    });
  });
});

describe("editing a collection", () => {
  it("p1's tx6 opens at step 2 on its person, its account, its amount and its description, and Back stays there", () => {
    const { machine, harness } = createEdit("tx6");
    const entry = currentEntry(harness, "tx6");

    expect(machine.state$.getValue()).toMatchObject({
      step: 2,
      firstStep: 2,
      editing: "tx6",
      form: {
        personId: "md6",
        accountId: "la4",
        amount: "1000.00",
        description: entry.description,
      },
      verdict: { ok: true },
      stepVerdict: { ok: true },
    });

    machine.intents.back();

    expect(machine.state$.getValue().step).toBe(2);
  });

  it("the edited entry's own payment is owed again: in the people, the owed amount and its lines' rows", () => {
    const { machine } = createEdit("tx6");
    const state = machine.state$.getValue();

    expect(personRow(machine, "md6")).toMatchObject({
      paid: 0,
      remaining: 295116,
    });
    expect(state.summary.owed).toBe(295116);
    expect(state.summary.settlement).toEqual([
      createRow("ii5", "Rata nr. 1", "2011-03-15", 96114, 92684, "A4"),
      createRow("ii10", "Rata nr. 1", "2011-03-15", 7402, 7316, "B4"),
    ]);
  });

  it.each(["tx6", "tx167"])(
    "saving %s unchanged writes the same lines in the same order and keeps its number (Review Focus 2)",
    async (id) => {
      const { machine, harness } = createEdit(id);
      const before = currentEntry(harness, id);

      expect(await machine.intents.save()).toEqual(accepted({ id }));
      expect(currentEntry(harness, id)).toEqual(before);
    },
  );

  it("the same amount written another way keeps the lines; a new account alone keeps them too", async () => {
    const { machine, harness } = createEdit("tx167");
    const before = currentEntry(harness, "tx167");

    machine.intents.edit({ amount: "568.220", accountId: "la2" });
    machine.intents.edit({ amount: "568.22" });

    expect(await machine.intents.save()).toEqual(accepted({ id: "tx167" }));
    expect(currentEntry(harness, "tx167")).toEqual({
      ...before,
      postings: [
        { ...must(before.postings[0], "the debit"), accountId: "la2" },
        ...before.postings.slice(1),
      ],
    });
  });

  it("changing the amount settles oldest first, the entry left out, and regenerates the description", () => {
    const { machine, harness } = createEdit("tx167");

    machine.intents.edit({ amount: "568.21" });

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        description: `Collection of installments from ${personName(harness, "md3")}: Rata nr. 1 (15/03/2011), Rata nr. 1 (15/03/2011), Rata nr. 1 (15/03/2011), Rata nr. 1 (15/03/2011)`,
      },
      verdict: { ok: true },
    });
    expect(
      machine.state$.getValue().summary.settlement.map((row) => {
        return [row.unitCode, row.paidNow, row.partial];
      }),
    ).toEqual([
      ["A1", 31642, false],
      ["A2", 17122, false],
      ["B1", 2922, false],
      ["B2", 5135, true],
    ]);
  });

  it("back to the entry's own amount, its lines and its description come back", () => {
    const { machine, harness } = createEdit("tx6");

    machine.intents.edit({ amount: "500" });

    expect(machine.state$.getValue().summary.settlement).toEqual([
      createRow("ii5", "Rata nr. 1", "2011-03-15", 96114, 50000, "A4"),
    ]);

    machine.intents.edit({ amount: "1,000" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { description: currentEntry(harness, "tx6").description },
      summary: {
        settlement: [{ itemId: "ii5", paidNow: 92684 }, { itemId: "ii10" }],
      },
    });
  });

  it("a description typed during the edit is kept when the amount changes, and the saved entry is rewritten in place", async () => {
    const { machine, harness } = createEdit("tx6");
    const before = currentEntry(harness, "tx6");

    machine.intents.edit({ description: "Mine" });
    machine.intents.edit({ amount: "500" });

    expect(machine.state$.getValue().form.description).toBe("Mine");
    expect(await machine.intents.save()).toEqual(accepted({ id: "tx6" }));
    expect(currentEntry(harness, "tx6")).toMatchObject({
      number: before.number,
      description: "Mine",
      postings: [
        { accountId: "la4", debit: 50000 },
        { credit: 50000, installmentItemId: "ii5" },
      ],
    });
  });

  it("its person does not change", () => {
    const { machine } = createEdit("tx6");

    machine.intents.edit({ personId: "md3" });

    expect(machine.state$.getValue().form).toMatchObject({
      personId: "md6",
      amount: "1000.00",
    });
  });

  it("an entry that is not a collection the wizard can write is not edited here", () => {
    const harness = createAppHarness();

    expect(() => {
      return createCollectionWizard(
        currentBooks(harness),
        harness.ports.clock,
        neverWrite,
        currentEntry(harness, "tx1"),
      );
    }).toThrow();
  });
});

describe("fitsCollection", () => {
  it("fits all 40 seeded collections, each in its own period's books", () => {
    let fitting = 0;

    for (const periodId of ["p1", "p36"]) {
      const harness = createAppHarness();

      harness.app.presenters.buildings.selectPeriod(periodId);

      const books = currentBooks(harness);

      for (const entry of books.entries) {
        if (entry.kind === "collection" && fitsCollection(entry, books)) {
          fitting += 1;
        }
      }
    }

    expect(fitting).toBe(40);
  });

  it.each([
    [
      "no lines",
      createUnfit((postings) => {
        return postings.slice(0, 0);
      }),
    ],
    [
      "the debit only",
      createUnfit((postings) => {
        return postings.slice(0, 1);
      }),
    ],
    [
      "a debit on an account that is not liquidity",
      createUnfit((postings) => {
        return [{ ...at(postings, 0), accountId: "la9" }, ...postings.slice(1)];
      }),
    ],
    [
      "a credit first",
      createUnfit((postings) => {
        return [...postings.slice(1), at(postings, 0)];
      }),
    ],
    [
      "a credit with no item",
      createUnfit((postings) => {
        return [
          ...postings.slice(0, 2),
          { ...at(postings, 2), installmentItemId: undefined },
        ];
      }),
    ],
    [
      "a credit on an item the books do not have",
      createUnfit((postings) => {
        return [
          ...postings.slice(0, 2),
          { ...at(postings, 2), installmentItemId: "ii999" },
        ];
      }),
    ],
    [
      "a credit to another resident than the item's",
      createUnfit((postings) => {
        return [
          ...postings.slice(0, 2),
          {
            ...at(postings, 2),
            counterpart: { kind: "owner" as const, id: "r5" },
          },
        ];
      }),
    ],
    [
      "a credit off the owners account",
      createUnfit((postings) => {
        return [
          ...postings.slice(0, 2),
          { ...at(postings, 2), accountId: "la2" },
        ];
      }),
    ],
    [
      "items of two persons",
      createUnfit((postings) => {
        return [
          ...postings.slice(0, 2),
          {
            ...at(postings, 2),
            counterpart: { kind: "owner" as const, id: "r3" },
            installmentItemId: "ii3",
          },
        ];
      }),
    ],
    [
      "a debit that is not the credits' total",
      createUnfit((postings) => {
        return [
          { ...at(postings, 0), debit: cents(99999) },
          ...postings.slice(1),
        ];
      }),
    ],
  ])("does not fit %s", (_name, unfit) => {
    const harness = createAppHarness();

    expect(fitsCollection(unfit(harness), currentBooks(harness))).toBe(false);
  });
});

interface CreatedWizard {
  machine: WizardMachine<CollectionForm, CollectionSummary>;
  harness: AppHarness;
}

type Postings = JournalEntry["postings"];

/** The harness on p36, with a wizard for a new collection built through the application. */
function createWizard(): CreatedWizard {
  const harness = createP36Harness();

  return { machine: createNewWizard(harness), harness };
}

/** The wizard editing one of p1's collections. */
function createEdit(id: string): CreatedWizard {
  const harness = createAppHarness();
  const machine = harness.app.machines.createCollectionWizard(id);

  created.push(machine);

  return { machine, harness };
}

/** A new collection's wizard over the books as they stand now. */
function createNewWizard(
  harness: AppHarness,
): WizardMachine<CollectionForm, CollectionSummary> {
  const machine = harness.app.machines.createCollectionWizard(null);

  created.push(machine);

  return machine;
}

/** The harness on p36, on its own clock or the harness's. */
function createP36Harness(now?: string): AppHarness {
  const harness =
    now === undefined
      ? createAppHarness()
      : createAppHarness(undefined, fixedClock(now));

  harness.app.presenters.buildings.selectPeriod("p36");

  return harness;
}

/** md89 (r162, A01) paying everything still open: Rata 9 to 12, 134.98 each. */
function createCollectionOfMd89(): EntryDraft {
  return {
    kind: "collection",
    description: "Collected elsewhere",
    postings: [
      {
        accountId: "la156",
        debit: cents(53992),
        credit: cents(0),
        counterpart: null,
      },
      ...["ii763", "ii790", "ii817", "ii844"].map((itemId) => {
        return {
          accountId: "la158",
          debit: cents(0),
          credit: cents(13498),
          counterpart: { kind: "owner" as const, id: "r162" },
          installmentItemId: itemId,
        };
      }),
    ],
  };
}

/** p1's tx6 with its lines changed: a collection the wizard cannot write. */
function createUnfit(
  change: (postings: Postings) => Postings,
): (harness: AppHarness) => JournalEntry {
  return (harness: AppHarness): JournalEntry => {
    const entry = currentEntry(harness, "tx6");

    return { ...entry, postings: change(entry.postings) };
  };
}

/** One row of the settlement, on A01 unless said. */
function createRow(
  itemId: string,
  installment: string,
  dueDate: string,
  owed: number,
  paidNow: number,
  unitCode = "A01",
): SettlementRow {
  return {
    itemId,
    installment,
    unitCode,
    dueDate,
    owed: cents(owed),
    paidNow: cents(paidNow),
    partial: paidNow < owed,
  };
}

/** The current step's reason after the patch; null when it passes. */
function stepReasonAfter(
  machine: WizardMachine<CollectionForm, CollectionSummary>,
  patch: Partial<CollectionForm>,
): string | null {
  machine.intents.edit(patch);

  const verdict = machine.state$.getValue().stepVerdict;

  return verdict.ok ? null : verdict.reason;
}

function personRow(
  machine: WizardMachine<CollectionForm, CollectionSummary>,
  personId: string,
): PersonRow {
  return must(personRowOrNull(machine, personId), `the person ${personId}`);
}

function personRowOrNull(
  machine: WizardMachine<CollectionForm, CollectionSummary>,
  personId: string,
): PersonRow | null {
  return (
    machine.state$.getValue().summary.people.find((row) => {
      return row.personId === personId;
    }) ?? null
  );
}

/** The name of the person's first residency in the selected period. */
function personName(harness: AppHarness, personId: string): string {
  const books: Books = currentBooks(harness);

  return must(
    books.parties.find((party) => {
      return party.kind === "owner" && party.personId === personId;
    }),
    `the person ${personId}`,
  ).name;
}

function at(postings: Postings, index: number): Postings[number] {
  return must(postings[index], `the line ${String(index)}`);
}

function neverWrite(): Promise<ResultOf<EntryAdded>> {
  return Promise.resolve(accepted({ id: "never" }));
}

const created: WizardMachine<CollectionForm, CollectionSummary>[] = [];
