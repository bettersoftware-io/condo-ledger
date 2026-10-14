import { BehaviorSubject } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";

import {
  type AccountNode,
  buildAccountTree,
  type JournalEntryView,
  journalOf,
  ZERO_CENTS,
} from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import {
  createJournalGridMachine,
  type JournalGridIntents,
  type JournalGridRow,
  type JournalGridState,
  PAGE_SIZES,
  type PageSize,
} from "./journalGridMachine.ts";
import type { Machine } from "./machine.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the journal grid machine", () => {
  it("starts on page 1 of 1 at ten per page, nothing expanded or selected", () => {
    const { machine } = createGrid();

    expect(machine.state$.getValue()).toMatchObject({
      page: 1,
      pageSize: 10,
      pageCount: 1,
      total: 9,
      selectedId: null,
      expanded: [],
      search: "",
    });
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual([
      "entry e1",
      "entry e2",
      "entry e3",
      "entry e4",
      "entry e5",
      "entry e6",
      "entry e7",
      "entry e8",
      "entry e9",
    ]);
  });

  it("toggle shows an entry's postings after it, the last one marked", () => {
    const { machine } = createGrid();

    machine.intents.toggle("e4");

    expect(machine.state$.getValue().rows.slice(3, 8).map(kindAndId)).toEqual([
      "entry e4",
      "posting e4/0",
      "posting e4/1",
      "posting e4/2",
      "posting e4/3",
    ]);
    expect(machine.state$.getValue().rows[7]).toMatchObject({
      kind: "posting",
      last: true,
    });
    expect(machine.state$.getValue().rows[6]).toMatchObject({
      kind: "posting",
      last: false,
    });

    machine.intents.toggle("e4");

    expect(machine.state$.getValue().rows).toHaveLength(9);
  });

  it("select marks one entry; selecting another moves it", () => {
    const { machine } = createGrid();

    machine.intents.select("e2");
    machine.intents.select("e3");

    expect(machine.state$.getValue().selectedId).toBe("e3");
    expect(selectedRows(machine.state$.getValue().rows)).toEqual(["entry e3"]);
  });

  it("pages: size 25 then 10, page 2 holds the rest, a page past the end is clamped", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(23));
    expect(machine.state$.getValue()).toMatchObject({
      pageCount: 3,
      total: 23,
    });

    machine.intents.setPage(3);
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual([
      "entry m21",
      "entry m22",
      "entry m23",
    ]);

    machine.intents.setPageSize(25);
    expect(machine.state$.getValue()).toMatchObject({ page: 1, pageCount: 1 });

    machine.intents.setPage(9);
    expect(machine.state$.getValue().page).toBe(1);

    machine.intents.setPageSize(10);
    machine.intents.setPage(0);
    expect(machine.state$.getValue().page).toBe(1);
  });

  it("offers 10, 25, 50 and 100 per page, each dividing 101 entries into its own pages", () => {
    const { machine, entries$ } = createGrid();
    const pagesOf: Record<PageSize, number> = { 10: 11, 25: 5, 50: 3, 100: 2 };

    entries$.next(manyEntries(101));

    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);

    for (const size of PAGE_SIZES) {
      machine.intents.setPageSize(size);

      expect(machine.state$.getValue()).toMatchObject({
        pageSize: size,
        pageCount: pagesOf[size],
      });
    }
  });

  it("a new page size starts again from page 1, even where the old page still exists", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(60));
    machine.intents.setPage(2);
    machine.intents.setPageSize(25);

    expect(machine.state$.getValue()).toMatchObject({ page: 1, pageCount: 3 });
  });

  it("search matches the description or the exact number, and goes back to page 1", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(23));
    machine.intents.setPage(2);
    machine.intents.setSearch("fattura");

    expect(machine.state$.getValue()).toMatchObject({
      page: 1,
      total: 0,
      pageCount: 1,
    });

    machine.intents.setSearch("");
    machine.intents.setPage(3);
    machine.intents.setSearch("Riga");
    expect(machine.state$.getValue()).toMatchObject({ page: 1, total: 23 });

    machine.intents.setSearch("Riga 3");
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual(["entry m3"]);

    entries$.next(journalOf(root(), createSmallBooks().entries));
    machine.intents.setSearch("FATTURA");
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual([
      "entry e1",
      "entry e2",
    ]);

    machine.intents.setSearch("  fattura ");
    expect(machine.state$.getValue().total).toBe(2);

    machine.intents.setSearch("3");
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual(["entry e3"]);
  });

  it("a number matches the whole number, not a part of it", () => {
    const { machine, entries$ } = createGrid();

    entries$.next([3, 13, 23].map(numbered));
    machine.intents.setSearch("3");

    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual(["entry n3"]);
  });

  it("expand all opens every entry the search left; collapse all closes them", () => {
    const { machine } = createGrid();

    machine.intents.setSearch("fattura");
    machine.intents.expandAll();

    expect(machine.state$.getValue().expanded).toEqual(["e1", "e2"]);
    expect(machine.state$.getValue().rows).toHaveLength(6);

    machine.intents.setSearch("");
    expect(machine.state$.getValue().expanded).toEqual(["e1", "e2"]);

    machine.intents.collapseAll();
    expect(machine.state$.getValue().expanded).toEqual([]);
  });

  it("a selected or expanded entry that is gone is dropped; a page past the new end becomes the last", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(11));
    machine.intents.setPage(2);
    machine.intents.select("m11");
    machine.intents.toggle("m11");
    entries$.next(manyEntries(10));

    expect(machine.state$.getValue()).toMatchObject({
      page: 1,
      pageCount: 1,
      selectedId: null,
      expanded: [],
    });
  });

  it("deleting the only entry on the last page lands on the new last page, never an empty one", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(21));
    machine.intents.setPage(3);
    machine.intents.select("m21");
    entries$.next(manyEntries(20));

    expect(machine.state$.getValue()).toMatchObject({
      page: 2,
      pageCount: 2,
      total: 20,
      selectedId: null,
    });
    expect(machine.state$.getValue().rows.map(kindAndId)).toEqual(
      Array.from({ length: 10 }, (_, index) => {
        return `entry m${11 + index}`;
      }),
    );
  });

  it("reveal pages to the entry and selects it, without expanding it", () => {
    const { machine, entries$ } = createGrid();

    entries$.next(manyEntries(23));
    machine.intents.reveal("m17");

    expect(machine.state$.getValue()).toMatchObject({
      page: 2,
      selectedId: "m17",
      expanded: [],
    });

    machine.intents.reveal("m10");
    expect(machine.state$.getValue().page).toBe(1);

    machine.intents.reveal("m17");
    machine.intents.reveal("nope");
    expect(machine.state$.getValue()).toMatchObject({
      page: 2,
      selectedId: "m17",
    });
  });
});

interface Grid {
  machine: Machine<JournalGridState, JournalGridIntents>;
  entries$: BehaviorSubject<JournalEntryView[]>;
}

function createGrid(): Grid {
  const entries$ = new BehaviorSubject<JournalEntryView[]>(
    journalOf(root(), createSmallBooks().entries),
  );
  const machine = createJournalGridMachine(entries$);

  created.push(machine);

  return { machine, entries$ };
}

function root(): AccountNode {
  const books = createSmallBooks();

  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function kindAndId(row: JournalGridRow): string {
  if (row.kind === "entry") {
    return `entry ${row.entry.id}`;
  }

  return `posting ${row.entryId}/${row.index}`;
}

function selectedRows(rows: JournalGridRow[]): string[] {
  return rows
    .filter((row) => {
      return row.kind === "entry" && row.selected;
    })
    .map(kindAndId);
}

function manyEntries(count: number): JournalEntryView[] {
  return Array.from({ length: count }, (_, index) => {
    return entryView(`m${index + 1}`, index + 1, `Riga ${index + 1}`);
  });
}

function numbered(number: number): JournalEntryView {
  return entryView(`n${number}`, number, "Altro");
}

function entryView(
  id: string,
  number: number,
  description: string,
): JournalEntryView {
  return {
    id,
    number,
    at: "2013-01-01T00:00:00",
    kind: "generic",
    description,
    debit: ZERO_CENTS,
    credit: ZERO_CENTS,
    postings: [],
  };
}

const created: Machine<JournalGridState, JournalGridIntents>[] = [];
