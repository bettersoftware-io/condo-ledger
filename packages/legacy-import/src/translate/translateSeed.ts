import type { AccountData, LegacySeedData } from "@cl/domain";

import { exactEnglish } from "./exact.ts";
import { PATTERNS } from "./patterns.ts";

/**
 * The seed with the legacy data's own words in English: account names and
 * abbreviations, entry descriptions, invoice reasons, installment, table,
 * unit group and withholding names, and table notes. Ids, amounts and the
 * names of people, firms, buildings and periods are left as they are. A
 * string with no exact entry and no pattern stops the generator, naming the
 * field and the record, so new legacy data is translated before it is
 * imported.
 */
export function translateLegacySeed(data: LegacySeedData): LegacySeedData {
  const accounts = data.accounts.map((account) => {
    return {
      ...account,
      name: english(account.name, "accounts.name", account.id),
      abbreviation:
        account.abbreviation === null
          ? null
          : english(account.abbreviation, "accounts.abbreviation", account.id),
    };
  });

  assertSiblingsApart(data.accounts, accounts);

  return {
    ...data,
    accounts,
    entries: data.entries.map((entry) => {
      return {
        ...entry,
        description: english(
          entry.description,
          "entries.description",
          entry.id,
        ),
      };
    }),
    invoices: data.invoices.map((invoice) => {
      return {
        ...invoice,
        reason: english(invoice.reason, "invoices.reason", invoice.id),
      };
    }),
    installments: data.installments.map((installment) => {
      return {
        ...installment,
        name: english(installment.name, "installments.name", installment.id),
      };
    }),
    tables: data.tables.map((table) => {
      return {
        ...table,
        name: english(table.name, "tables.name", table.id),
        notes: english(table.notes, "tables.notes", table.id),
      };
    }),
    unitGroups: data.unitGroups.map((group) => {
      return {
        ...group,
        name: english(group.name, "unitGroups.name", group.id),
      };
    }),
    withholdingTaxes: data.withholdingTaxes.map((tax) => {
      return {
        ...tax,
        name: english(
          tax.name,
          "withholdingTaxes.name",
          `${tax.periodId}/${tax.code}`,
        ),
      };
    }),
  };
}

/** An Italian string in English: by the exact map, else by the first pattern that matches it whole. An empty string stays empty. */
function english(italian: string, field: string, id: string): string {
  if (italian === "") {
    return italian;
  }

  const exact = exactEnglish(italian);

  if (exact !== undefined) {
    return exact;
  }

  for (const { pattern, english: render } of PATTERNS) {
    const match = pattern.exec(italian);
    const translated = match === null ? undefined : render(match.slice(1));

    if (translated !== undefined) {
      return translated;
    }
  }

  throw new Error(
    `No English for ${field} of ${id}: "${italian}". Add it to src/translate/exact.ts, or a pattern for it to src/translate/patterns.ts.`,
  );
}

/** Two sibling accounts with different Italian names must not read the same in English. */
function assertSiblingsApart(
  italian: readonly AccountData[],
  english: readonly AccountData[],
): void {
  const seen = new Map<string, Translated>();

  english.forEach((account, index) => {
    const key = `${account.periodId}/${account.parentId ?? ""}/${account.name}`;
    const before = seen.get(key);
    const italianName = italian[index]?.name ?? "";

    if (before !== undefined && before.italian !== italianName) {
      throw new Error(
        `the accounts ${before.id} and ${account.id} are siblings with different Italian names that both read "${account.name}" in English`,
      );
    }

    seen.set(key, { id: account.id, italian: italianName });
  });
}

/** An account already met: its id and its Italian name. */
interface Translated {
  id: string;
  italian: string;
}
