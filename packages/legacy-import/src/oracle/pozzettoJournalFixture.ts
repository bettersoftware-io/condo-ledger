import { journalOf } from "@cl/domain";

import {
  JOURNAL_DEVIATIONS,
  JOURNAL_LABEL_ALIASES,
  renderJournalFixture,
} from "./designJournal.ts";
import { pozzetto2013Books } from "./pozzettoFixture.ts";

/** Where the committed journal fixture is: beside the accounts fixture, in the domain's testing/. */
export const POZZETTO_JOURNAL_FIXTURE_URL = new URL(
  "../../../domain/src/testing/pozzetto2013.journal.ts",
  import.meta.url,
);

/**
 * The journal fixture module for Pozzetto 2013: its entries as the Journal
 * screen derives them from the committed seed, as numbers, kinds, stamps,
 * keys and cents only (no description leaves the seed), under a header that
 * lists the deviations and the label aliases.
 */
export function renderPozzetto2013JournalFixture(): string {
  const { tree, entries } = pozzetto2013Books();

  return renderJournalFixture(
    journalOf(tree, entries),
    JOURNAL_DEVIATIONS,
    JOURNAL_LABEL_ALIASES,
  );
}
