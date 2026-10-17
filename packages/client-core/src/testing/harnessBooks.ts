import type { JournalEntry } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import type { Books } from "../presenters/booksPresenter.ts";
import type { AppHarness } from "./appHarness.ts";

/** The selected period's books as the application holds them now. */
export function currentBooks(harness: AppHarness): Books {
  return must(harness.app.presenters.books.books$.getValue(), "the books");
}

/** An entry of the selected period as the application holds it now. */
export function currentEntry(harness: AppHarness, id: string): JournalEntry {
  return must(
    currentBooks(harness).entries.find((entry) => {
      return entry.id === id;
    }),
    `the entry ${id}`,
  );
}
